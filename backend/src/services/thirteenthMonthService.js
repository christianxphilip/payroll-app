import Employee from '../models/Employee.js';
import Schedule from '../models/Schedule.js';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import ThirteenthMonthEmployee from '../models/ThirteenthMonthEmployee.js';

const HOURS_PER_DAY = 8;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
const startOfDay = (value) => { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; };
const endOfDay = (value) => { const date = new Date(value); date.setUTCHours(23, 59, 59, 999); return date; };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const employeeHourlyRate = (employee) => employee.wageType === 'DAILY'
  ? (Number(employee.wageRate) || 0) / HOURS_PER_DAY
  : (Number(employee.wageRate) || 0);

export const calculateProjectedWork = ({
  projectionStart,
  projectionEnd,
  employeeStart,
  employeeEnd,
  schedulesByDay,
  useWeeklyOffDays,
  weeklyOffDays = []
}) => {
  let projectedHours = 0;
  let projectedDays = 0;
  let fallbackDays = 0;
  const offDays = new Set(weeklyOffDays);
  const start = startOfDay(new Date(Math.max(projectionStart.getTime(), employeeStart.getTime())));
  const end = endOfDay(new Date(Math.min(projectionEnd.getTime(), employeeEnd.getTime())));

  for (let date = start; date <= end; date = new Date(date.getTime() + 86400000)) {
    const key = dayKey(date);
    const scheduled = schedulesByDay.get(key);
    let eligibleHours = 0;

    if (scheduled) {
      eligibleHours = Math.min(Math.max(scheduled.hours, 0), HOURS_PER_DAY);
    } else if (useWeeklyOffDays && !offDays.has(WEEKDAYS[date.getUTCDay()])) {
      eligibleHours = HOURS_PER_DAY;
      fallbackDays += 1;
    }

    if (eligibleHours > 0) projectedDays += 1;
    projectedHours += eligibleHours;
  }

  return { projectedHours, projectedDays, fallbackDays };
};

export const calculateThirteenthMonthRun = async (run) => {
  const coverageStart = startOfDay(run.coverageStart);
  const coverageEnd = endOfDay(run.coverageEnd);
  const actualCutoff = endOfDay(run.actualCutoff);
  const projectionStart = new Date(Math.min(actualCutoff.getTime() + 1, coverageEnd.getTime() + 1));

  const employeeCandidates = await Employee.find({ eligibleForThirteenthMonth: { $ne: false } }).lean();
  const employees = employeeCandidates.filter(employee => {
    const hiredDate = employee.hiredDate ? new Date(employee.hiredDate) : null;
    const finalWorkDate = employee.lastWorkingDate
      ? new Date(employee.lastWorkingDate)
      : (employee.resignedDate ? new Date(employee.resignedDate) : null);
    return (!hiredDate || hiredDate <= coverageEnd) && (!finalWorkDate || finalWorkDate >= coverageStart);
  });

  const names = employees.map(employee => employee.employeeName);
  const finalizedPayRuns = await PayRun.find({
    status: { $in: ['APPROVED', 'PAID'] },
    payrollPeriodEnd: { $gte: coverageStart, $lte: actualCutoff },
    payrollPeriodStart: { $lte: actualCutoff }
  }, '_id payrollPeriodStart payrollPeriodEnd').lean();
  const finalizedPayRunIds = finalizedPayRuns.map(payRun => payRun._id);
  const [payrollEntries, schedules] = await Promise.all([
    finalizedPayRunIds.length
      ? PayRunEmployee.find({ payRunId: { $in: finalizedPayRunIds } }, 'payRunId employeeId employeeName basicSalary').lean()
      : [],
    projectionStart <= coverageEnd
      ? Schedule.find({
          employeeName: { $in: names },
          date: { $gte: projectionStart, $lte: coverageEnd }
        }).lean()
      : []
  ]);

  const payrollEntriesByEmployee = new Map();
  for (const payrollEntry of payrollEntries) {
    const key = String(payrollEntry.employeeId);
    if (!payrollEntriesByEmployee.has(key)) payrollEntriesByEmployee.set(key, []);
    payrollEntriesByEmployee.get(key).push(payrollEntry);
  }
  const schedulesByEmployee = new Map();
  for (const schedule of schedules) {
    if (!schedulesByEmployee.has(schedule.employeeName)) schedulesByEmployee.set(schedule.employeeName, new Map());
    const employeeSchedules = schedulesByEmployee.get(schedule.employeeName);
    const key = dayKey(schedule.date);
    const current = employeeSchedules.get(key) || { hours: 0 };
    if (!schedule.isOff) current.hours += Number(schedule.scheduledDuration) || 0;
    employeeSchedules.set(key, current);
  }

  const existing = await ThirteenthMonthEmployee.find({ runId: run._id }).lean();
  const existingByEmployee = new Map(existing.map(entry => [String(entry.employeeId), entry]));
  const retainedIds = [];

  for (const employee of employees) {
    const hourlyRate = employeeHourlyRate(employee);
    const employeeStart = employee.hiredDate ? startOfDay(employee.hiredDate) : coverageStart;
    const employeeEndValue = employee.lastWorkingDate || employee.resignedDate;
    const employeeEnd = employeeEndValue ? endOfDay(employeeEndValue) : coverageEnd;
    const employeePayrollEntries = payrollEntriesByEmployee.get(String(employee._id)) || [];
    const prior = existingByEmployee.get(String(employee._id));
    const projectionUsesWeeklyOffDays = Boolean(prior?.projectionUsesWeeklyOffDays);
    const weeklyOffDays = prior?.weeklyOffDays || [];
    const { projectedHours, projectedDays, fallbackDays } = calculateProjectedWork({
      projectionStart,
      projectionEnd: coverageEnd,
      employeeStart,
      employeeEnd,
      schedulesByDay: schedulesByEmployee.get(employee.employeeName) || new Map(),
      useWeeklyOffDays: projectionUsesWeeklyOffDays,
      weeklyOffDays
    });
    const actualBasicSalary = money(employeePayrollEntries.reduce((sum, payrollEntry) => sum + (Number(payrollEntry.basicSalary) || 0), 0));
    const projectedBasicSalary = money(projectedHours * hourlyRate);
    const manualAdjustment = Number(prior?.manualAdjustment) || 0;
    const eligibleBasicSalary = money(Math.max(0, actualBasicSalary + projectedBasicSalary + manualAdjustment));
    const thirteenthMonthPay = money(eligibleBasicSalary / 12);
    const calculationNotes = [];
    if (!employeePayrollEntries.length) calculationNotes.push('No Approved or Paid pay runs ending on or before the actual cutoff');
    if (projectionStart <= coverageEnd && !projectedDays) calculationNotes.push('No schedules in the projected period');
    if (fallbackDays) calculationNotes.push(`${fallbackDays} projected day(s) filled from weekly off-days`);

    const entry = await ThirteenthMonthEmployee.findOneAndUpdate(
      { runId: run._id, employeeId: employee._id },
      {
        runId: run._id,
        employeeId: employee._id,
        employeeName: employee.employeeName,
        actualBasicSalary,
        projectedBasicSalary,
        manualAdjustment,
        adjustmentReason: prior?.adjustmentReason || '',
        eligibleBasicSalary,
        thirteenthMonthPay,
        paidAmount: prior?.paidAmount || 0,
        actualPayRunCount: employeePayrollEntries.length,
        actualPayRunIds: employeePayrollEntries.map(payrollEntry => payrollEntry.payRunId),
        projectedDays,
        projectionUsesWeeklyOffDays,
        weeklyOffDays,
        calculationNotes
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    retainedIds.push(entry._id);
  }

  await ThirteenthMonthEmployee.deleteMany({ runId: run._id, _id: { $nin: retainedIds } });
  return ThirteenthMonthEmployee.find({ runId: run._id }).sort({ employeeName: 1 });
};

export const attachThirteenthMonthToPayRun = async (run) => {
  if (!run.attachedPayRunId) return;
  const payRun = await PayRun.findById(run.attachedPayRunId);
  if (!payRun || payRun.status !== 'DRAFT') throw new Error('Attached pay run must remain in Draft status');
  const entries = await ThirteenthMonthEmployee.find({ runId: run._id });

  for (const entry of entries) {
    let payrollEntry = await PayRunEmployee.findOne({ payRunId: payRun._id, employeeId: entry.employeeId });
    if (!payrollEntry) {
      payrollEntry = new PayRunEmployee({
        payRunId: payRun._id,
        employeeId: entry.employeeId,
        employeeName: entry.employeeName
      });
    }
    const oldAmount = Number(payrollEntry.thirteenthMonthPay) || 0;
    payrollEntry.thirteenthMonthPay = entry.thirteenthMonthPay;
    payrollEntry.thirteenthMonthRunId = run._id;
    payrollEntry.netSalary = money((Number(payrollEntry.netSalary) || 0) - oldAmount + entry.thirteenthMonthPay);
    await payrollEntry.save();
  }
  payRun.metadata = { ...(payRun.metadata || {}), thirteenthMonthRunId: run._id };
  payRun.markModified('metadata');
  await payRun.save();
};

export const detachThirteenthMonthFromPayRun = async (run) => {
  if (!run.attachedPayRunId) return;
  const payrollEntries = await PayRunEmployee.find({ payRunId: run.attachedPayRunId, thirteenthMonthRunId: run._id });
  for (const entry of payrollEntries) {
    entry.netSalary = money((Number(entry.netSalary) || 0) - (Number(entry.thirteenthMonthPay) || 0));
    entry.thirteenthMonthPay = 0;
    entry.thirteenthMonthRunId = null;
    await entry.save();
  }
  const payRun = await PayRun.findById(run.attachedPayRunId);
  if (payRun && String(payRun.metadata?.thirteenthMonthRunId || '') === String(run._id)) {
    const metadata = { ...(payRun.metadata || {}) };
    delete metadata.thirteenthMonthRunId;
    payRun.metadata = metadata;
    payRun.markModified('metadata');
    await payRun.save();
  }
};
