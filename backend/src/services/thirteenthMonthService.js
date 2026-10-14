import Employee from '../models/Employee.js';
import TimesheetLog from '../models/TimesheetLog.js';
import Schedule from '../models/Schedule.js';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import ThirteenthMonthEmployee from '../models/ThirteenthMonthEmployee.js';

const HOURS_PER_DAY = 8;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
const startOfDay = (value) => { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date; };
const endOfDay = (value) => { const date = new Date(value); date.setUTCHours(23, 59, 59, 999); return date; };

const employeeHourlyRate = (employee) => employee.wageType === 'DAILY'
  ? (Number(employee.wageRate) || 0) / HOURS_PER_DAY
  : (Number(employee.wageRate) || 0);

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
  const [logs, schedules] = await Promise.all([
    TimesheetLog.find({
      employeeName: { $in: names },
      date: { $gte: coverageStart, $lte: actualCutoff },
      isSubmitted: true
    }).lean(),
    projectionStart <= coverageEnd
      ? Schedule.find({
          employeeName: { $in: names },
          date: { $gte: projectionStart, $lte: coverageEnd },
          isOff: { $ne: true }
        }).lean()
      : []
  ]);

  const logsByEmployeeDay = new Map();
  for (const log of logs) {
    const key = `${log.employeeName}|${dayKey(log.date)}`;
    logsByEmployeeDay.set(key, (logsByEmployeeDay.get(key) || 0) + (Number(log.adjustedHoursWorked) || 0));
  }
  const schedulesByEmployeeDay = new Map();
  for (const schedule of schedules) {
    const key = `${schedule.employeeName}|${dayKey(schedule.date)}`;
    schedulesByEmployeeDay.set(key, (schedulesByEmployeeDay.get(key) || 0) + (Number(schedule.scheduledDuration) || 0));
  }

  const existing = await ThirteenthMonthEmployee.find({ runId: run._id }).lean();
  const existingByEmployee = new Map(existing.map(entry => [String(entry.employeeId), entry]));
  const retainedIds = [];

  for (const employee of employees) {
    const hourlyRate = employeeHourlyRate(employee);
    const employeeStart = employee.hiredDate ? startOfDay(employee.hiredDate) : coverageStart;
    const employeeEndValue = employee.lastWorkingDate || employee.resignedDate;
    const employeeEnd = employeeEndValue ? endOfDay(employeeEndValue) : coverageEnd;
    let actualHours = 0;
    let actualDays = 0;
    let projectedHours = 0;
    let projectedDays = 0;

    for (const [key, hours] of logsByEmployeeDay.entries()) {
      if (!key.startsWith(`${employee.employeeName}|`)) continue;
      const workDate = startOfDay(key.slice(key.lastIndexOf('|') + 1));
      if (workDate < employeeStart || workDate > employeeEnd) continue;
      const eligibleHours = Math.min(Math.max(hours, 0), HOURS_PER_DAY);
      if (eligibleHours > 0) actualDays += 1;
      actualHours += eligibleHours;
    }
    for (const [key, hours] of schedulesByEmployeeDay.entries()) {
      if (!key.startsWith(`${employee.employeeName}|`)) continue;
      const workDate = startOfDay(key.slice(key.lastIndexOf('|') + 1));
      if (workDate < employeeStart || workDate > employeeEnd) continue;
      const eligibleHours = Math.min(Math.max(hours, 0), HOURS_PER_DAY);
      if (eligibleHours > 0) projectedDays += 1;
      projectedHours += eligibleHours;
    }

    const prior = existingByEmployee.get(String(employee._id));
    const actualBasicSalary = money(actualHours * hourlyRate);
    const projectedBasicSalary = money(projectedHours * hourlyRate);
    const manualAdjustment = Number(prior?.manualAdjustment) || 0;
    const eligibleBasicSalary = money(Math.max(0, actualBasicSalary + projectedBasicSalary + manualAdjustment));
    const thirteenthMonthPay = money(eligibleBasicSalary / 12);
    const calculationNotes = [];
    if (!actualDays) calculationNotes.push('No submitted attendance in the actual period');
    if (projectionStart <= coverageEnd && !projectedDays) calculationNotes.push('No schedules in the projected period');

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
        actualDays,
        projectedDays,
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
