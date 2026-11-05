import TimesheetLog from '../models/TimesheetLog.js';
import Employee from '../models/Employee.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import Settings from '../models/Settings.js';
import { adjustmentTotalsForPayroll } from './adjustmentCalculatorService.js';
import { calculateCompensationComponents } from './compensationCalculatorService.js';

// Basic configuration
const STANDARD_HOURS_PER_DAY = 8;

// Get settings multipliers (with defaults)
const getSettings = async () => {
  const settings = await Settings.getSettings();
  return {
    overtimeMultiplier: settings.overtimeMultiplier || 1.25,
    nightDifferentialMultiplier: settings.nightDifferentialMultiplier || 0.1,
    regularHolidayMultiplier: settings.regularHolidayMultiplier || 1.0,
    specialHolidayMultiplier: settings.specialHolidayMultiplier || 0.3,
    overtimeRegularHolidayMultiplier: settings.overtimeRegularHolidayMultiplier || 2.6,
    overtimeSpecialHolidayMultiplier: settings.overtimeSpecialHolidayMultiplier || 1.69
  };
};

export const computePayRunForPeriod = async (payRun) => {
  const { payrollPeriodStart, payrollPeriodEnd, _id: payRunId, timesheetIds } = payRun;

  // Get all submitted timelogs in the period
  const query = {
    date: {
      $gte: payrollPeriodStart,
      $lte: payrollPeriodEnd
    },
    isSubmitted: true
  };

  if (timesheetIds && timesheetIds.length > 0) {
    query.timesheetId = { $in: timesheetIds };
  }

  const logs = await TimesheetLog.find(query).lean();

  if (!logs.length) {
    return [];
  }

  // Group by employeeName
  const groups = {};
  logs.forEach((log) => {
    if (!groups[log.employeeName]) {
      groups[log.employeeName] = [];
    }
    groups[log.employeeName].push(log);
  });

  const employeeDocs = await Employee.find({
    employeeName: { $in: Object.keys(groups) }
  }).lean();
  const employeeByName = {};
  employeeDocs.forEach((e) => {
    employeeByName[e.employeeName] = e;
  });

  const results = [];

  for (const [employeeName, empLogs] of Object.entries(groups)) {
    const employee = employeeByName[employeeName];
    if (!employee) continue;

    const totalHoursWorked = empLogs.reduce(
      (sum, l) => sum + (l.adjustedHoursWorked || 0),
      0
    );
    const nightDiffHours = empLogs.reduce(
      (sum, l) => sum + (l.ndHours || 0),
      0
    );
    const regularHolidayHours = empLogs.reduce(
      (sum, l) =>
        l.isHoliday && l.holidayType === 'Regular'
          ? sum + (l.adjustedHoursWorked || 0)
          : sum,
      0
    );
    const specialHolidayHours = empLogs.reduce(
      (sum, l) =>
        l.isHoliday && l.holidayType === 'Special'
          ? sum + (l.adjustedHoursWorked || 0)
          : sum,
      0
    );
    
    // Calculate overtime hours separately:
    // - Regular overtime (non-holiday days)
    // - Overtime on regular holidays
    // - Overtime on special holidays
    // NOTE: Overtime hours are only counted for FULL_TIME employees
    let regularOvertimeHours = 0;
    let overtimeRegularHolidayHours = 0;
    let overtimeSpecialHolidayHours = 0;
    
    // Only count OT for full-time employees
    if (employee.employmentType === 'FULL_TIME') {
      empLogs.forEach(l => {
        // OT calculation: ONLY use approved hours (adjustedHoursWorked > 8)
        const approvedHours = l.adjustedHoursWorked !== undefined && l.adjustedHoursWorked !== null
          ? l.adjustedHoursWorked
          : Math.min(l.hoursWorked || 0, STANDARD_HOURS_PER_DAY);
        if (approvedHours > STANDARD_HOURS_PER_DAY) {
          const overtimeHours = approvedHours - STANDARD_HOURS_PER_DAY;
          if (l.isHoliday && l.holidayType === 'Regular') {
            overtimeRegularHolidayHours += overtimeHours;
          } else if (l.isHoliday && l.holidayType === 'Special') {
            overtimeSpecialHolidayHours += overtimeHours;
          } else {
            regularOvertimeHours += overtimeHours;
          }
        }
      });
    }
    
    const totalOvertimeHours = regularOvertimeHours + overtimeRegularHolidayHours + overtimeSpecialHolidayHours;

    const hourlyRate =
      employee.wageType === 'DAILY'
        ? (employee.wageRate || 0) / STANDARD_HOURS_PER_DAY
        : employee.wageRate || 0;

    const settings = await getSettings();
    const baseOvertimeMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeMultiplier : 1.0;
    const otRegularHolidayMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeRegularHolidayMultiplier : 1.0;
    const otSpecialHolidayMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeSpecialHolidayMultiplier : 1.0;
    const {
      basicSalary,
      overtimePay: regularOvertimePay,
      overtimeRegularHolidayPay,
      overtimeSpecialHolidayPay,
      nightDiffPay,
      regularHolidayPay,
      specialHolidayPay
    } = calculateCompensationComponents({
      totalHoursWorked,
      regularOvertimeHours,
      overtimeRegularHolidayHours,
      overtimeSpecialHolidayHours,
      nightDiffHours,
      regularHolidayHours,
      specialHolidayHours,
      hourlyRate,
      overtimeMultiplier: baseOvertimeMultiplier,
      nightDifferentialMultiplier: settings.nightDifferentialMultiplier,
      regularHolidayMultiplier: settings.regularHolidayMultiplier,
      specialHolidayMultiplier: settings.specialHolidayMultiplier,
      overtimeRegularHolidayMultiplier: otRegularHolidayMultiplier,
      overtimeSpecialHolidayMultiplier: otSpecialHolidayMultiplier
    });

    // Allowances & deductions for this employee within period
    const adjustments = await AllowanceDeduction.find({
      employeeId: employee._id,
      $or: [
        {
          appliesFrom: { $lte: payrollPeriodEnd },
          appliesTo: { $gte: payrollPeriodStart }
        },
        {
          appliesFrom: { $lte: payrollPeriodEnd },
          appliesTo: null
        }
      ]
    }).lean();

    const { allowancesTotal, deductionsTotal } = adjustmentTotalsForPayroll(
      adjustments,
      totalHoursWorked
    );

    const netSalary =
      basicSalary +
      regularOvertimePay +
      overtimeRegularHolidayPay +
      overtimeSpecialHolidayPay +
      nightDiffPay +
      regularHolidayPay +
      specialHolidayPay +
      allowancesTotal -
      deductionsTotal;

    const payload = {
      payRunId,
      employeeId: employee._id,
      employeeName,
      totalHoursWorked,
      overtimeHours: totalOvertimeHours,
      regularOvertimeHours,
      overtimeRegularHolidayHours,
      overtimeSpecialHolidayHours,
      nightDiffHours,
      regularHolidayHours,
      specialHolidayHours,
      basicSalary,
      thirteenthMonthEligibleBasic: basicSalary,
      compensationVersion: 2,
      thirteenthMonthEligibleBasicCalculatedAt: new Date(),
      overtimePay: regularOvertimePay,
      overtimeRegularHolidayPay,
      overtimeSpecialHolidayPay,
      nightDiffPay,
      regularHolidayPay,
      specialHolidayPay,
      priorPeriodAdjustmentTotal: 0,
      priorPeriodAdjustments: [],
      allowancesTotal,
      deductionsTotal,
      netSalary,
      breakdown: {
        hourlyRate,
        wageType: employee.wageType,
        employmentType: employee.employmentType,
        adjustments,
        regularHolidayHours,
        specialHolidayHours
      }
    };

    // Upsert PayRunEmployee for this pay run + employee
    const doc = await PayRunEmployee.findOneAndUpdate(
      { payRunId, employeeId: employee._id },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    results.push(doc);
  }

  return results;
};

// Recompute pay for an existing pay run using current PayRunEmployee hours
// but refreshed Allowance/Deduction data. Manual hour overrides are preserved.
export const recomputePayRunFromEmployees = async (payRun) => {
  const { payrollPeriodStart, payrollPeriodEnd, _id: payRunId, timesheetIds } = payRun;

  const entries = await PayRunEmployee.find({ payRunId }).lean();
  // If there are no employee entries yet (older pay runs), fall back to a full recompute
  if (!entries.length) {
    return computePayRunForPeriod(payRun);
  }

  const employeeIds = entries.map((e) => e.employeeId);
  const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();
  const employeeById = {};
  employees.forEach((e) => {
    employeeById[e._id.toString()] = e;
  });

  // Fetch timesheet logs for all employees in the pay run period to recalculate OT breakdown
  // Only fetch submitted logs (same as computePayRunForPeriod)
  const query = {
    employeeName: { $in: entries.map(e => e.employeeName) },
    date: {
      $gte: new Date(payrollPeriodStart),
      $lte: new Date(payrollPeriodEnd)
    },
    isSubmitted: true
  };

  if (timesheetIds && timesheetIds.length > 0) {
    query.timesheetId = { $in: timesheetIds };
  }

  const timesheetLogs = await TimesheetLog.find(query).lean();

  // Group logs by employee name
  const logsByEmployee = {};
  timesheetLogs.forEach(log => {
    if (!logsByEmployee[log.employeeName]) {
      logsByEmployee[log.employeeName] = [];
    }
    logsByEmployee[log.employeeName].push(log);
  });

  const updated = [];

  for (const entry of entries) {
    const employee = employeeById[entry.employeeId.toString()];
    if (!employee) continue;

    const totalHoursWorked = entry.totalHoursWorked || 0;
    const nightDiffHours = entry.nightDiffHours || 0;
    const regularHolidayHours = entry.regularHolidayHours || 0;
    const specialHolidayHours = entry.specialHolidayHours || 0;

    // Recalculate overtime hours breakdown from timesheet logs
    // NOTE: Overtime hours are only counted for FULL_TIME employees
    const empLogs = logsByEmployee[entry.employeeName] || [];
    let regularOvertimeHours = 0;
    let overtimeRegularHolidayHours = 0;
    let overtimeSpecialHolidayHours = 0;
    
    // Only count OT for full-time employees
    if (employee.employmentType === 'FULL_TIME') {
      empLogs.forEach(l => {
        const approvedHours = l.adjustedHoursWorked !== undefined && l.adjustedHoursWorked !== null
          ? l.adjustedHoursWorked
          : Math.min(l.hoursWorked || 0, STANDARD_HOURS_PER_DAY);
        if (approvedHours > STANDARD_HOURS_PER_DAY) {
          const overtimeHours = approvedHours - STANDARD_HOURS_PER_DAY;
          if (l.isHoliday && l.holidayType === 'Regular') {
            overtimeRegularHolidayHours += overtimeHours;
          } else if (l.isHoliday && l.holidayType === 'Special') {
            overtimeSpecialHolidayHours += overtimeHours;
          } else {
            regularOvertimeHours += overtimeHours;
          }
        }
      });
    }
    
    const totalOvertimeHours = regularOvertimeHours + overtimeRegularHolidayHours + overtimeSpecialHolidayHours;

    const hourlyRate =
      employee.wageType === 'DAILY'
        ? (employee.wageRate || 0) / STANDARD_HOURS_PER_DAY
        : employee.wageRate || 0;

    const settings = await getSettings();
    const baseOvertimeMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeMultiplier : 1.0;
    const otRegularHolidayMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeRegularHolidayMultiplier : 1.0;
    const otSpecialHolidayMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeSpecialHolidayMultiplier : 1.0;
    const {
      basicSalary,
      overtimePay: regularOvertimePay,
      overtimeRegularHolidayPay,
      overtimeSpecialHolidayPay,
      nightDiffPay,
      regularHolidayPay,
      specialHolidayPay
    } = calculateCompensationComponents({
      totalHoursWorked,
      regularOvertimeHours,
      overtimeRegularHolidayHours,
      overtimeSpecialHolidayHours,
      nightDiffHours,
      regularHolidayHours,
      specialHolidayHours,
      hourlyRate,
      overtimeMultiplier: baseOvertimeMultiplier,
      nightDifferentialMultiplier: settings.nightDifferentialMultiplier,
      regularHolidayMultiplier: settings.regularHolidayMultiplier,
      specialHolidayMultiplier: settings.specialHolidayMultiplier,
      overtimeRegularHolidayMultiplier: otRegularHolidayMultiplier,
      overtimeSpecialHolidayMultiplier: otSpecialHolidayMultiplier
    });

    // Re-fetch allowances/deductions for this employee in the pay run period
    const adjustments = await AllowanceDeduction.find({
      employeeId: entry.employeeId,
      $or: [
        {
          appliesFrom: { $lte: payrollPeriodEnd },
          appliesTo: { $gte: payrollPeriodStart }
        },
        {
          appliesFrom: { $lte: payrollPeriodEnd },
          appliesTo: null
        }
      ]
    }).lean();

    const { allowancesTotal, deductionsTotal } = adjustmentTotalsForPayroll(
      adjustments,
      totalHoursWorked
    );

    const priorPeriodAdjustmentTotal = entry.priorPeriodAdjustmentTotal || 0;
    const netSalary =
      basicSalary +
      regularOvertimePay +
      overtimeRegularHolidayPay +
      overtimeSpecialHolidayPay +
      nightDiffPay +
      regularHolidayPay +
      specialHolidayPay +
      allowancesTotal -
      deductionsTotal +
      priorPeriodAdjustmentTotal +
      (entry.thirteenthMonthPay || 0);

    const payload = {
      basicSalary,
      thirteenthMonthEligibleBasic: basicSalary,
      compensationVersion: 2,
      thirteenthMonthEligibleBasicCalculatedAt: new Date(),
      overtimeHours: totalOvertimeHours,
      regularOvertimeHours,
      overtimeRegularHolidayHours,
      overtimeSpecialHolidayHours,
      overtimePay: regularOvertimePay,
      overtimeRegularHolidayPay,
      overtimeSpecialHolidayPay,
      nightDiffPay,
      regularHolidayPay,
      specialHolidayPay,
      priorPeriodAdjustmentTotal,
      priorPeriodAdjustments: entry.priorPeriodAdjustments || [],
      allowancesTotal,
      deductionsTotal,
      thirteenthMonthPay: entry.thirteenthMonthPay || 0,
      thirteenthMonthRunId: entry.thirteenthMonthRunId || null,
      netSalary,
      breakdown: {
        ...(entry.breakdown || {}),
        hourlyRate,
        wageType: employee.wageType,
        employmentType: employee.employmentType,
        adjustments,
        regularHolidayHours,
        specialHolidayHours
      }
    };

    const doc = await PayRunEmployee.findByIdAndUpdate(
      entry._id,
      payload,
      { new: true }
    );
    if (doc) {
      updated.push(doc);
    }
  }

  return updated;
};
