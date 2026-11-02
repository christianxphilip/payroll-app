import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustmentAmountForPayroll,
  adjustmentTotalsForPayroll
} from '../src/services/adjustmentCalculatorService.js';

test('hourly allowance multiplies its rate by payable hours', () => {
  assert.equal(
    adjustmentAmountForPayroll({ type: 'ALLOWANCE', frequency: 'HOURLY', amount: 12.5 }, 104),
    1300
  );
});

test('totals combine hourly and fixed allowances without multiplying deductions', () => {
  const adjustments = [
    { type: 'ALLOWANCE', frequency: 'HOURLY', amount: 12.5 },
    { type: 'ALLOWANCE', frequency: 'ONE_TIME', amount: 500 },
    { type: 'DEDUCTION', frequency: 'ONE_TIME', amount: 6000 }
  ];

  assert.deepEqual(adjustmentTotalsForPayroll(adjustments, 104), {
    allowancesTotal: 1800,
    deductionsTotal: 6000
  });
});

test('fractional hourly allowance result is rounded to centavos', () => {
  assert.equal(
    adjustmentAmountForPayroll({ type: 'ALLOWANCE', frequency: 'HOURLY', amount: 12.5 }, 7.333),
    91.66
  );
});
