import TimesheetLog from '../models/TimesheetLog.js';

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getPayRunTimesheetLogs = async (payRun, employeeName) => {
  const query = {
    employeeName: { $regex: `^${escapeRegex(employeeName)}$`, $options: 'i' }
  };

  if (Array.isArray(payRun.timesheetIds) && payRun.timesheetIds.length > 0) {
    query.timesheetId = { $in: payRun.timesheetIds };
  } else {
    query.date = {
      $gte: payRun.payrollPeriodStart || payRun.payPeriodStart,
      $lte: payRun.payrollPeriodEnd || payRun.payPeriodEnd
    };
    query.isSubmitted = true;
  }

  return TimesheetLog.find(query).sort({ date: 1, timeIn: 1 }).lean();
};
