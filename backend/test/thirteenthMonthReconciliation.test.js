import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReconciliation } from '../src/services/thirteenthMonthService.js';

test('reconciliation proposes a top-up when final entitlement is higher', () => {
  assert.deepEqual(calculateReconciliation({ finalEligibleBasic: 120000, paidAmount: 9500 }), {
    finalThirteenthMonthPay: 10000,
    reconciliationDifference: 500,
    topUpAmount: 500,
    overpaymentAmount: 0
  });
});

test('reconciliation reports overpayment without making a deduction', () => {
  assert.deepEqual(calculateReconciliation({ finalEligibleBasic: 108000, paidAmount: 9500 }), {
    finalThirteenthMonthPay: 9000,
    reconciliationDifference: -500,
    topUpAmount: 0,
    overpaymentAmount: 500
  });
});
