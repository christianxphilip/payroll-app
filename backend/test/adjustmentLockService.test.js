import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import PayRun from '../src/models/PayRun.js';
import PayRunEmployee from '../src/models/PayRunEmployee.js';
import {
  assertAdjustmentPeriodEditable,
  findLockedPayRunForAdjustment
} from '../src/services/adjustmentLockService.js';

const queryResult = (value) => ({
  select: () => ({
    lean: async () => value
  })
});

test('an adjustment is locked when it overlaps a finalized pay run for the employee', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(PayRun, 'find', () => queryResult([
    { _id: 'paid-run', status: 'PAID' }
  ]));
  mock.method(PayRunEmployee, 'findOne', () => queryResult({
    payRunId: 'paid-run'
  }));

  const lockedRun = await findLockedPayRunForAdjustment({
    employeeId: 'employee-1',
    appliesFrom: new Date('2026-10-01'),
    appliesTo: new Date('2026-10-15')
  });

  assert.deepEqual(lockedRun, { _id: 'paid-run', status: 'PAID' });
  await assert.rejects(
    assertAdjustmentPeriodEditable({
      employeeId: 'employee-1',
      appliesFrom: new Date('2026-10-01'),
      appliesTo: new Date('2026-10-15')
    }),
    /cannot be changed because they affect a PAID pay run/
  );
});

test('an adjustment remains editable when no finalized pay run overlaps', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(PayRun, 'find', () => queryResult([]));

  const adjustment = {
    employeeId: 'employee-1',
    appliesFrom: new Date('2026-11-01'),
    appliesTo: new Date('2026-11-15')
  };

  assert.equal(await findLockedPayRunForAdjustment(adjustment), null);
  await assert.doesNotReject(assertAdjustmentPeriodEditable(adjustment));
});
