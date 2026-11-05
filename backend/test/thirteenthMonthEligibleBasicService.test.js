import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveLegacyThirteenthMonthEligibleBasic,
  eligibleBasicForPayrollEntry
} from '../src/services/thirteenthMonthEligibleBasicService.js';

test('derives Leanard legacy eligible basic without changing the paid payroll', () => {
  assert.deepEqual(deriveLegacyThirteenthMonthEligibleBasic({
    totalHoursWorked: 106,
    regularOvertimeHours: 2,
    overtimeHours: 2,
    regularHolidayHours: 0,
    specialHolidayHours: 0,
    basicSalary: 7287.5
  }), {
    reliable: true,
    amount: 7150,
    eligibleHours: 104,
    hourlyRate: 68.75
  });
});

test('legacy fallback does not subtract holiday overtime twice', () => {
  const result = deriveLegacyThirteenthMonthEligibleBasic({
    totalHoursWorked: 100,
    overtimeHours: 4,
    overtimeRegularHolidayHours: 2,
    overtimeSpecialHolidayHours: 0,
    regularHolidayHours: 10,
    specialHolidayHours: 0,
    basicSalary: 10000
  });

  assert.equal(result.reliable, true);
  assert.equal(result.eligibleHours, 88);
  assert.equal(result.amount, 8800);
});

test('stored versioned eligible basic takes precedence over legacy derivation', () => {
  assert.equal(eligibleBasicForPayrollEntry({
    compensationVersion: 2,
    basicSalary: 7150,
    thirteenthMonthEligibleBasic: 7000,
    totalHoursWorked: 106
  }), 7000);
});

test('flags contradictory legacy records for manual review', () => {
  assert.deepEqual(deriveLegacyThirteenthMonthEligibleBasic({
    totalHoursWorked: 8,
    regularOvertimeHours: 2,
    regularHolidayHours: 8,
    specialHolidayHours: 0,
    basicSalary: 800
  }), {
    reliable: false,
    reason: 'Excluded overtime and holiday hours exceed total hours'
  });
});
