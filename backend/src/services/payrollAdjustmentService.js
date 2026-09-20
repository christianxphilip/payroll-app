import PayrollAdjustment from '../models/PayrollAdjustment.js';
import PayRunEmployee from '../models/PayRunEmployee.js';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const calculatePayrollAdjustment = ({
  hourlyRate,
  regularHours = 0,
  overtimeHours = 0,
  nightDiffHours = 0,
  overtimeMultiplier = 1.25,
  nightDiffMultiplier = 0.1,
  holidayMultiplier = 0
}) => {
  const regularPay = roundMoney(regularHours * hourlyRate);
  const overtimePay = roundMoney(overtimeHours * hourlyRate * overtimeMultiplier);
  const nightDiffPay = roundMoney(nightDiffHours * hourlyRate * nightDiffMultiplier);
  const holidayPay = roundMoney(regularHours * hourlyRate * holidayMultiplier);

  return {
    regularPay,
    overtimePay,
    nightDiffPay,
    holidayPay,
    totalAmount: roundMoney(regularPay + overtimePay + nightDiffPay + holidayPay)
  };
};

export const syncPayRunEmployeeAdjustments = async (payRunEmployeeId) => {
  const entry = await PayRunEmployee.findById(payRunEmployeeId);
  if (!entry) return null;

  const adjustments = await PayrollAdjustment.find({
    includedPayRunId: entry.payRunId,
    employeeId: entry.employeeId,
    status: 'INCLUDED_IN_PAYRUN'
  }).sort({ originalWorkDate: 1, createdAt: 1 }).lean();

  const total = roundMoney(adjustments.reduce((sum, item) => sum + (item.totalAmount || 0), 0));
  entry.priorPeriodAdjustmentTotal = total;
  entry.priorPeriodAdjustments = adjustments.map((item) => ({
    adjustmentId: item._id,
    type: item.type,
    correctionType: item.correctionType,
    originalWorkDate: item.originalWorkDate,
    regularHours: item.regularHours,
    overtimeHours: item.overtimeHours,
    nightDiffHours: item.nightDiffHours,
    totalAmount: item.totalAmount,
    reason: item.reason
  }));
  entry.netSalary = roundMoney(
    (entry.basicSalary || 0) +
    (entry.overtimePay || 0) +
    (entry.overtimeRegularHolidayPay || 0) +
    (entry.overtimeSpecialHolidayPay || 0) +
    (entry.nightDiffPay || 0) +
    (entry.regularHolidayPay || 0) +
    (entry.specialHolidayPay || 0) +
    (entry.allowancesTotal || 0) +
    total -
    (entry.deductionsTotal || 0)
  );
  await entry.save();
  return entry;
};
