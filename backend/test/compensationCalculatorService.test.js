import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCompensationComponents } from '../src/services/compensationCalculatorService.js';

const multipliers = {
  overtimeMultiplier: 1.25,
  nightDifferentialMultiplier: 0.1,
  regularHolidayMultiplier: 1,
  specialHolidayMultiplier: 0.3,
  overtimeRegularHolidayMultiplier: 2.6,
  overtimeSpecialHolidayMultiplier: 1.69
};

test('Leanard sample pays 104 regular hours and 2 overtime hours once each', () => {
  const result = calculateCompensationComponents({
    totalHoursWorked: 106,
    regularOvertimeHours: 2,
    overtimeRegularHolidayHours: 0,
    overtimeSpecialHolidayHours: 0,
    nightDiffHours: 0,
    regularHolidayHours: 0,
    specialHolidayHours: 0,
    hourlyRate: 68.75,
    ...multipliers
  });

  assert.equal(result.basicHours, 104);
  assert.equal(result.basicSalary, 7150);
  assert.equal(result.overtimePay, 171.875);
  assert.equal(result.basicSalary + result.overtimePay, 7321.875);
});

test('holiday overtime is not duplicated in basic or ordinary holiday pay', () => {
  const result = calculateCompensationComponents({
    totalHoursWorked: 10,
    regularOvertimeHours: 0,
    overtimeRegularHolidayHours: 2,
    overtimeSpecialHolidayHours: 0,
    nightDiffHours: 0,
    regularHolidayHours: 10,
    specialHolidayHours: 0,
    hourlyRate: 100,
    ...multipliers
  });

  assert.equal(result.basicSalary, 0);
  assert.equal(result.regularHolidayPay, 1600);
  assert.equal(result.overtimeRegularHolidayPay, 520);
  assert.equal(result.regularHolidayPay + result.overtimeRegularHolidayPay, 2120);
});

test('night differential remains an additional premium', () => {
  const result = calculateCompensationComponents({
    totalHoursWorked: 8,
    regularOvertimeHours: 0,
    overtimeRegularHolidayHours: 0,
    overtimeSpecialHolidayHours: 0,
    nightDiffHours: 4,
    regularHolidayHours: 0,
    specialHolidayHours: 0,
    hourlyRate: 100,
    ...multipliers
  });

  assert.equal(result.basicSalary, 800);
  assert.equal(result.nightDiffPay, 40);
});
