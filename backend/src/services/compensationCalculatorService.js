const nonNegative = value => Math.max(0, Number(value) || 0);

export const calculateCompensationComponents = ({
  totalHoursWorked,
  regularOvertimeHours,
  overtimeRegularHolidayHours,
  overtimeSpecialHolidayHours,
  nightDiffHours,
  regularHolidayHours,
  specialHolidayHours,
  hourlyRate,
  overtimeMultiplier,
  nightDifferentialMultiplier,
  regularHolidayMultiplier,
  specialHolidayMultiplier,
  overtimeRegularHolidayMultiplier,
  overtimeSpecialHolidayMultiplier
}) => {
  const totalHours = nonNegative(totalHoursWorked);
  const regularOtHours = nonNegative(regularOvertimeHours);
  const regularHolidayTotalHours = nonNegative(regularHolidayHours);
  const specialHolidayTotalHours = nonNegative(specialHolidayHours);
  const regularHolidayOtHours = Math.min(
    nonNegative(overtimeRegularHolidayHours),
    regularHolidayTotalHours
  );
  const specialHolidayOtHours = Math.min(
    nonNegative(overtimeSpecialHolidayHours),
    specialHolidayTotalHours
  );
  const regularHolidayBaseHours = Math.max(0, regularHolidayTotalHours - regularHolidayOtHours);
  const specialHolidayBaseHours = Math.max(0, specialHolidayTotalHours - specialHolidayOtHours);
  const basicHours = Math.max(
    0,
    totalHours - regularOtHours - regularHolidayTotalHours - specialHolidayTotalHours
  );
  const rate = nonNegative(hourlyRate);

  return {
    basicHours,
    basicSalary: basicHours * rate,
    overtimePay: regularOtHours * rate * nonNegative(overtimeMultiplier),
    overtimeRegularHolidayPay: regularHolidayOtHours * rate * nonNegative(overtimeRegularHolidayMultiplier),
    overtimeSpecialHolidayPay: specialHolidayOtHours * rate * nonNegative(overtimeSpecialHolidayMultiplier),
    nightDiffPay: nonNegative(nightDiffHours) * rate * nonNegative(nightDifferentialMultiplier),
    regularHolidayPay: regularHolidayBaseHours * rate * (1 + nonNegative(regularHolidayMultiplier)),
    specialHolidayPay: specialHolidayBaseHours * rate * (1 + nonNegative(specialHolidayMultiplier))
  };
};
