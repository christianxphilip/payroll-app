const money = value => Math.round((Number(value) || 0) * 100) / 100;
const nonNegative = value => Math.max(0, Number(value) || 0);

export const deriveLegacyThirteenthMonthEligibleBasic = entry => {
  const totalHours = nonNegative(entry.totalHoursWorked);
  const recordedBasic = nonNegative(entry.basicSalary);
  const regularHolidayHours = nonNegative(entry.regularHolidayHours);
  const specialHolidayHours = nonNegative(entry.specialHolidayHours);
  const holidayOtHours = nonNegative(entry.overtimeRegularHolidayHours) +
    nonNegative(entry.overtimeSpecialHolidayHours);
  const totalOtHours = nonNegative(entry.overtimeHours);
  const regularOvertimeHours = entry.regularOvertimeHours !== undefined && entry.regularOvertimeHours !== null
    ? nonNegative(entry.regularOvertimeHours)
    : Math.max(0, totalOtHours - holidayOtHours);

  if (totalHours === 0) {
    return recordedBasic === 0
      ? { reliable: true, amount: 0, eligibleHours: 0, hourlyRate: 0 }
      : { reliable: false, reason: 'Basic salary exists but total hours are zero' };
  }

  const excludedHours = regularOvertimeHours + regularHolidayHours + specialHolidayHours;
  if (excludedHours > totalHours + 0.01) {
    return { reliable: false, reason: 'Excluded overtime and holiday hours exceed total hours' };
  }

  const hourlyRate = recordedBasic / totalHours;
  const eligibleHours = Math.max(0, totalHours - excludedHours);
  return {
    reliable: true,
    amount: money(eligibleHours * hourlyRate),
    eligibleHours: money(eligibleHours),
    hourlyRate: money(hourlyRate)
  };
};

export const eligibleBasicForPayrollEntry = entry => {
  if (entry.thirteenthMonthEligibleBasic !== undefined && entry.thirteenthMonthEligibleBasic !== null) {
    return nonNegative(entry.thirteenthMonthEligibleBasic);
  }
  if (Number(entry.compensationVersion) >= 2) return nonNegative(entry.basicSalary);

  const derived = deriveLegacyThirteenthMonthEligibleBasic(entry);
  return derived.reliable ? derived.amount : 0;
};
