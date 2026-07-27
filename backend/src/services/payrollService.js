import TimesheetLog from '../models/TimesheetLog.js';
import Employee from '../models/Employee.js';

/**
 * Generate payroll consolidation report
 * Aggregates timesheet data by employee for a given date range
 */
export const generatePayrollReport = async (filters = {}) => {
  const { startDate, endDate, employeeName, includeSubmittedOnly = false, timesheetId } = filters;
  
  console.log('[PayrollService] generatePayrollReport filters:', filters);
  
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
  
  console.log('[PayrollService] Query:', query);
  
  // Fetch all matching timesheet logs
  const logs = await TimesheetLog.find(query).sort({ employeeName: 1, date: 1 });
  
  console.log('[PayrollService] Found logs:', logs.length);
  
  // Fetch employee data to check employment type
  const employeeNames = [...new Set(logs.map(log => log.employeeName))];
  const employees = await Employee.find({ employeeName: { $in: employeeNames } }).lean();
  const employeeMap = {};
  employees.forEach(emp => {
    employeeMap[emp.employeeName] = emp;
  });
  
  // Group by employee and calculate totals
  const reportMap = {};
  
  logs.forEach(log => {
    if (!reportMap[log.employeeName]) {
      reportMap[log.employeeName] = {
        employeeName: log.employeeName,
        totalConsolidatedHours: 0,
        totalNDHours: 0,
        regularHolidayHours: 0,
        specialHolidayHours: 0,
        overtimeHours: 0,
        overtimeRegularHolidayHours: 0,
        overtimeSpecialHolidayHours: 0,
        recordCount: 0
      };
    }
    
    const emp = reportMap[log.employeeName];
    
    // Total consolidated hours worked (payable / adjusted) - capped at 8 for basic salary
    emp.totalConsolidatedHours += log.adjustedHoursWorked || 0;
    
    // Total ND hours
    emp.totalNDHours += log.ndHours || 0;
    
    // Holiday hours (use adjustedHoursWorked as baseline)
    if (log.isHoliday && log.holidayType === 'Regular') {
      emp.regularHolidayHours += log.adjustedHoursWorked || 0;
    }
    if (log.isHoliday && log.holidayType === 'Special') {
      emp.specialHolidayHours += log.adjustedHoursWorked || 0;
    }
    
    // Overtime hours: use scheduledHours (full hours) or hoursWorked if no schedule
    // Only count OT for full-time employees (part-time/on-call don't get OT multiplier)
    const employee = employeeMap[log.employeeName];
    const isFullTime = employee && employee.employmentType === 'FULL_TIME';
    
    if (isFullTime) {
      // Use scheduledHours (full hours) if available, otherwise hoursWorked
      const fullHours = (log.scheduledHours && log.scheduledHours > 0) 
        ? log.scheduledHours 
        : (log.hoursWorked || 0);
      const STANDARD_HOURS_PER_DAY = 8;
      if (fullHours > STANDARD_HOURS_PER_DAY) {
        const overtimeHours = fullHours - STANDARD_HOURS_PER_DAY;
        
        // Separate OT by holiday type
        if (log.isHoliday && log.holidayType === 'Regular') {
          emp.overtimeRegularHolidayHours += overtimeHours;
        } else if (log.isHoliday && log.holidayType === 'Special') {
          emp.overtimeSpecialHolidayHours += overtimeHours;
        } else {
          // Regular OT (non-holiday)
          emp.overtimeHours += overtimeHours;
        }
      }
    }
    // Part-time and on-call employees: OT hours = 0 (they don't get OT multiplier)
    
    emp.recordCount += 1;
  });
  
  // Convert to array and format
  const report = Object.values(reportMap).map(emp => ({
    employeeName: emp.employeeName,
    totalConsolidatedHours: Math.round(emp.totalConsolidatedHours * 100) / 100,
    totalNDHours: Math.round(emp.totalNDHours * 100) / 100,
    regularHolidayHours: Math.round(emp.regularHolidayHours * 100) / 100,
    specialHolidayHours: Math.round(emp.specialHolidayHours * 100) / 100,
    totalOvertimeHours: Math.round(emp.overtimeHours * 100) / 100,
    overtimeRegularHolidayHours: Math.round(emp.overtimeRegularHolidayHours * 100) / 100,
    overtimeSpecialHolidayHours: Math.round(emp.overtimeSpecialHolidayHours * 100) / 100,
    recordCount: emp.recordCount
  }));
  
  return {
    report,
    filters: {
      startDate,
      endDate,
      employeeName,
      includeSubmittedOnly
    },
    generatedAt: new Date(),
    totalEmployees: report.length,
    totalRecords: logs.length
  };
};

/**
 * Submit/archive timesheets
 * Sets isSubmitted=true and submittedAt=now for selected records
 */
export const submitTimesheets = async (timesheetIds) => {
  const result = await TimesheetLog.updateMany(
    { _id: { $in: timesheetIds } },
    {
      $set: {
        isSubmitted: true,
        submittedAt: new Date()
      }
    }
  );
  
  return {
    modifiedCount: result.modifiedCount,
    submittedAt: new Date()
  };
};

/**
 * Export report to CSV format
 */
export const formatReportAsCSV = (reportData) => {
  const headers = [
    'Employee Name',
    'Total Hours Worked',
    'Total ND Hours',
    'Regular Holiday Hours',
    'Special Holiday Hours',
    'Total Overtime Hours',
    'OT Regular Holiday Hours',
    'OT Special Holiday Hours',
    'Record Count'
  ];
  
  const rows = reportData.report.map(emp => [
    emp.employeeName,
    emp.totalConsolidatedHours,
    emp.totalNDHours,
    emp.regularHolidayHours,
    emp.specialHolidayHours,
    emp.totalOvertimeHours,
    emp.overtimeRegularHolidayHours || 0,
    emp.overtimeSpecialHolidayHours || 0,
    emp.recordCount
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  return csvContent;
};

