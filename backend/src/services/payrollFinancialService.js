import TimesheetLog from '../models/TimesheetLog.js';
import Employee from '../models/Employee.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';
import Settings from '../models/Settings.js';

const STANDARD_HOURS_PER_DAY = 8;

/**
 * Generate payroll financial report
 * Calculates actual compensation breakdown including salaries, overtime, allowances, deductions
 */
export const generatePayrollFinancialReport = async (filters = {}) => {
  const { startDate, endDate, employeeName, includeSubmittedOnly = false, timesheetId } = filters;
  
  console.log('[PayrollFinancialService] generatePayrollFinancialReport filters:', filters);
  
  // Build query
  const query = {};
  
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  if (employeeName) {
    query.employeeName = employeeName;
  }
  
  if (includeSubmittedOnly) {
    query.isSubmitted = true;
  }
  
  if (timesheetId) {
    query.timesheetId = timesheetId;
  }
  
  // Fetch all matching timesheet logs
  const logs = await TimesheetLog.find(query).sort({ employeeName: 1, date: 1 });
  
  if (logs.length === 0) {
    return {
      report: [],
      summary: {
        totalBasicSalary: 0,
        totalOvertimePay: 0,
        totalOvertimeRegularHolidayPay: 0,
        totalOvertimeSpecialHolidayPay: 0,
        totalNightDiffPay: 0,
        totalRegularHolidayPay: 0,
        totalSpecialHolidayPay: 0,
        totalAllowances: 0,
        totalDeductions: 0,
        totalNetPay: 0,
        totalEmployees: 0,
        totalRecords: 0
      },
      filters: {
        startDate,
        endDate,
        employeeName,
        includeSubmittedOnly
      },
      generatedAt: new Date()
    };
  }
  
  // Fetch employee data
  const employeeNames = [...new Set(logs.map(log => log.employeeName))];
  const employees = await Employee.find({ employeeName: { $in: employeeNames } }).lean();
  const employeeMap = {};
  employees.forEach(emp => {
    employeeMap[emp.employeeName] = emp;
  });
  
  // Get settings for multipliers
  const settings = await Settings.getSettings();
  
  // Group by employee and calculate financial breakdown
  const reportMap = {};
  
  logs.forEach(log => {
    const employee = employeeMap[log.employeeName];
    if (!employee) return;
    
    if (!reportMap[log.employeeName]) {
      reportMap[log.employeeName] = {
        employeeName: log.employeeName,
        position: employee.position || '',
        employmentType: employee.employmentType || '',
        wageType: employee.wageType || '',
        wageRate: employee.wageRate || 0,
        totalHoursWorked: 0,
        regularOvertimeHours: 0,
        overtimeRegularHolidayHours: 0,
        overtimeSpecialHolidayHours: 0,
        nightDiffHours: 0,
        regularHolidayHours: 0,
        specialHolidayHours: 0,
        basicSalary: 0,
        overtimePay: 0,
        overtimeRegularHolidayPay: 0,
        overtimeSpecialHolidayPay: 0,
        nightDiffPay: 0,
        regularHolidayPay: 0,
        specialHolidayPay: 0,
        allowancesTotal: 0,
        deductionsTotal: 0,
        netSalary: 0,
        recordCount: 0
      };
    }
    
    const emp = reportMap[log.employeeName];
    
    // Calculate hourly rate
    const hourlyRate = employee.wageType === 'DAILY'
      ? (employee.wageRate || 0) / STANDARD_HOURS_PER_DAY
      : employee.wageRate || 0;
    
    // Accumulate hours
    emp.totalHoursWorked += log.adjustedHoursWorked || 0;
    emp.nightDiffHours += log.ndHours || 0;
    
    if (log.isHoliday && log.holidayType === 'Regular') {
      emp.regularHolidayHours += log.adjustedHoursWorked || 0;
    }
    if (log.isHoliday && log.holidayType === 'Special') {
      emp.specialHolidayHours += log.adjustedHoursWorked || 0;
    }
    
    // Calculate overtime hours breakdown (only for full-time employees)
    if (employee.employmentType === 'FULL_TIME') {
      const approvedHours = log.adjustedHoursWorked !== undefined && log.adjustedHoursWorked !== null
        ? log.adjustedHoursWorked
        : Math.min(log.hoursWorked || 0, STANDARD_HOURS_PER_DAY);
      if (approvedHours > STANDARD_HOURS_PER_DAY) {
        const overtimeHours = approvedHours - STANDARD_HOURS_PER_DAY;
        if (log.isHoliday && log.holidayType === 'Regular') {
          emp.overtimeRegularHolidayHours += overtimeHours;
        } else if (log.isHoliday && log.holidayType === 'Special') {
          emp.overtimeSpecialHolidayHours += overtimeHours;
        } else {
          emp.regularOvertimeHours += overtimeHours;
        }
      }
    }
    
    emp.recordCount += 1;
  });
  
  // Calculate financial breakdown for each employee
  const report = [];
  let totalBasicSalary = 0;
  let totalOvertimePay = 0;
  let totalOvertimeRegularHolidayPay = 0;
  let totalOvertimeSpecialHolidayPay = 0;
  let totalNightDiffPay = 0;
  let totalRegularHolidayPay = 0;
  let totalSpecialHolidayPay = 0;
  let totalAllowances = 0;
  let totalDeductions = 0;
  let totalNetPay = 0;
  
  for (const [employeeName, emp] of Object.entries(reportMap)) {
    const employee = employeeMap[employeeName];
    if (!employee) continue;
    
    // Calculate hourly rate
    const hourlyRate = employee.wageType === 'DAILY'
      ? (employee.wageRate || 0) / STANDARD_HOURS_PER_DAY
      : employee.wageRate || 0;
    
    // Basic salary calculation
    const basicSalary = employee.wageType === 'DAILY'
      ? (employee.wageRate || 0) * (emp.totalHoursWorked / STANDARD_HOURS_PER_DAY)
      : emp.totalHoursWorked * hourlyRate;
    
    // Overtime pay calculations (only for full-time employees)
    const baseOvertimeMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeMultiplier : 1.0;
    const otRegularHolidayMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeRegularHolidayMultiplier : 1.0;
    const otSpecialHolidayMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeSpecialHolidayMultiplier : 1.0;
    
    const overtimePay = emp.regularOvertimeHours * hourlyRate * baseOvertimeMultiplier;
    const overtimeRegularHolidayPay = emp.overtimeRegularHolidayHours * hourlyRate * otRegularHolidayMultiplier;
    const overtimeSpecialHolidayPay = emp.overtimeSpecialHolidayHours * hourlyRate * otSpecialHolidayMultiplier;
    
    // Night differential pay
    const nightDiffPay = emp.nightDiffHours * hourlyRate * settings.nightDifferentialMultiplier;
    
    // Holiday pay
    const regularHolidayPay = emp.regularHolidayHours * hourlyRate * settings.regularHolidayMultiplier;
    const specialHolidayPay = emp.specialHolidayHours * hourlyRate * settings.specialHolidayMultiplier;
    
    // Fetch allowances and deductions for this employee in the period
    const periodEnd = endDate ? new Date(endDate) : new Date();
    const periodStart = startDate ? new Date(startDate) : new Date(0);
    
    const adjustments = await AllowanceDeduction.find({
      employeeId: employee._id,
      $or: [
        {
          appliesFrom: { $lte: periodEnd },
          appliesTo: { $gte: periodStart }
        },
        {
          appliesFrom: { $lte: periodEnd },
          appliesTo: null
        }
      ]
    }).lean();
    
    let allowancesTotal = 0;
    let deductionsTotal = 0;
    adjustments.forEach((adj) => {
      if (adj.type === 'ALLOWANCE') {
        allowancesTotal += adj.amount || 0;
      } else if (adj.type === 'DEDUCTION') {
        deductionsTotal += adj.amount || 0;
      }
    });
    
    // Calculate net salary
    const netSalary = basicSalary +
      overtimePay +
      overtimeRegularHolidayPay +
      overtimeSpecialHolidayPay +
      nightDiffPay +
      regularHolidayPay +
      specialHolidayPay +
      allowancesTotal -
      deductionsTotal;
    
    // Accumulate totals
    totalBasicSalary += basicSalary;
    totalOvertimePay += overtimePay;
    totalOvertimeRegularHolidayPay += overtimeRegularHolidayPay;
    totalOvertimeSpecialHolidayPay += overtimeSpecialHolidayPay;
    totalNightDiffPay += nightDiffPay;
    totalRegularHolidayPay += regularHolidayPay;
    totalSpecialHolidayPay += specialHolidayPay;
    totalAllowances += allowancesTotal;
    totalDeductions += deductionsTotal;
    totalNetPay += netSalary;
    
    report.push({
      employeeName: emp.employeeName,
      position: emp.position,
      employmentType: emp.employmentType,
      wageType: emp.wageType,
      wageRate: emp.wageRate,
      totalHoursWorked: Math.round(emp.totalHoursWorked * 100) / 100,
      regularOvertimeHours: Math.round(emp.regularOvertimeHours * 100) / 100,
      overtimeRegularHolidayHours: Math.round(emp.overtimeRegularHolidayHours * 100) / 100,
      overtimeSpecialHolidayHours: Math.round(emp.overtimeSpecialHolidayHours * 100) / 100,
      nightDiffHours: Math.round(emp.nightDiffHours * 100) / 100,
      regularHolidayHours: Math.round(emp.regularHolidayHours * 100) / 100,
      specialHolidayHours: Math.round(emp.specialHolidayHours * 100) / 100,
      basicSalary: Math.round(basicSalary * 100) / 100,
      overtimePay: Math.round(overtimePay * 100) / 100,
      overtimeRegularHolidayPay: Math.round(overtimeRegularHolidayPay * 100) / 100,
      overtimeSpecialHolidayPay: Math.round(overtimeSpecialHolidayPay * 100) / 100,
      nightDiffPay: Math.round(nightDiffPay * 100) / 100,
      regularHolidayPay: Math.round(regularHolidayPay * 100) / 100,
      specialHolidayPay: Math.round(specialHolidayPay * 100) / 100,
      allowancesTotal: Math.round(allowancesTotal * 100) / 100,
      deductionsTotal: Math.round(deductionsTotal * 100) / 100,
      netSalary: Math.round(netSalary * 100) / 100,
      recordCount: emp.recordCount
    });
  }
  
  return {
    report: report.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    summary: {
      totalBasicSalary: Math.round(totalBasicSalary * 100) / 100,
      totalOvertimePay: Math.round(totalOvertimePay * 100) / 100,
      totalOvertimeRegularHolidayPay: Math.round(totalOvertimeRegularHolidayPay * 100) / 100,
      totalOvertimeSpecialHolidayPay: Math.round(totalOvertimeSpecialHolidayPay * 100) / 100,
      totalNightDiffPay: Math.round(totalNightDiffPay * 100) / 100,
      totalRegularHolidayPay: Math.round(totalRegularHolidayPay * 100) / 100,
      totalSpecialHolidayPay: Math.round(totalSpecialHolidayPay * 100) / 100,
      totalAllowances: Math.round(totalAllowances * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalNetPay: Math.round(totalNetPay * 100) / 100,
      totalEmployees: report.length,
      totalRecords: logs.length,
      averagePayPerEmployee: report.length > 0 ? Math.round((totalNetPay / report.length) * 100) / 100 : 0
    },
    filters: {
      startDate,
      endDate,
      employeeName,
      includeSubmittedOnly
    },
    generatedAt: new Date()
  };
};

/**
 * Export payroll financial report to CSV format
 */
export const formatPayrollFinancialReportAsCSV = (reportData) => {
  const headers = [
    'Employee Name',
    'Position',
    'Employment Type',
    'Wage Type',
    'Wage Rate',
    'Total Hours',
    'Basic Salary',
    'Overtime Pay',
    'OT Regular Holiday Pay',
    'OT Special Holiday Pay',
    'Night Differential Pay',
    'Regular Holiday Pay',
    'Special Holiday Pay',
    'Total Allowances',
    'Total Deductions',
    'Net Pay'
  ];
  
  const rows = reportData.report.map(emp => [
    emp.employeeName,
    emp.position || '',
    emp.employmentType || '',
    emp.wageType || '',
    emp.wageRate || 0,
    emp.totalHoursWorked,
    emp.basicSalary,
    emp.overtimePay,
    emp.overtimeRegularHolidayPay,
    emp.overtimeSpecialHolidayPay,
    emp.nightDiffPay,
    emp.regularHolidayPay,
    emp.specialHolidayPay,
    emp.allowancesTotal,
    emp.deductionsTotal,
    emp.netSalary
  ]);
  
  // Add summary row
  const summaryRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    reportData.summary.totalBasicSalary,
    reportData.summary.totalOvertimePay,
    reportData.summary.totalOvertimeRegularHolidayPay,
    reportData.summary.totalOvertimeSpecialHolidayPay,
    reportData.summary.totalNightDiffPay,
    reportData.summary.totalRegularHolidayPay,
    reportData.summary.totalSpecialHolidayPay,
    reportData.summary.totalAllowances,
    reportData.summary.totalDeductions,
    reportData.summary.totalNetPay
  ];
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
    summaryRow.join(',')
  ].join('\n');
  
  return csvContent;
};

