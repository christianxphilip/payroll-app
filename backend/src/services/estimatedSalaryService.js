import Schedule from '../models/Schedule.js';
import Employee from '../models/Employee.js';
import TimesheetLog from '../models/TimesheetLog.js';
import Holiday from '../models/Holiday.js';
import Settings from '../models/Settings.js';
import { lookupSchedule } from './calculationService.js';

const STANDARD_HOURS_PER_DAY = 8;

// Get settings multipliers (with defaults)
const getSettings = async () => {
  const settings = await Settings.getSettings();
  return {
    overtimeMultiplier: settings.overtimeMultiplier || 1.25,
    nightDifferentialMultiplier: settings.nightDifferentialMultiplier || 0.1,
    regularHolidayMultiplier: settings.regularHolidayMultiplier || 1.0,
    specialHolidayMultiplier: settings.specialHolidayMultiplier || 0.3
  };
};

/**
 * Parse time string (e.g., "3PM", "12AM") to hour (0-23)
 */
const parseTimeString = (timeStr) => {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toUpperCase();
  const match = trimmed.match(/(\d+)(AM|PM)/);
  if (!match) return null;
  
  let hour = parseInt(match[1], 10);
  const period = match[2];
  
  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else { // PM
    if (hour !== 12) hour += 12;
  }
  
  return hour;
};

/**
 * Estimate ND hours from scheduled start and end times
 * ND period: 10:00 PM (22:00) to 6:00 AM (06:00)
 */
const estimateNDHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const startHour = parseTimeString(startTime);
  const endHour = parseTimeString(endTime);
  
  if (startHour === null || endHour === null) return 0;
  
  let ndHours = 0;
  
  if (endHour >= startHour) {
    // Same day shift (e.g., 3PM to 11PM)
    // Check if shift overlaps with ND period (10PM-6AM)
    if (startHour < 6) {
      // Starts before 6AM
      ndHours += Math.min(6, endHour) - startHour;
    } else if (endHour > 22) {
      // Ends after 10PM
      ndHours += endHour - Math.max(22, startHour);
    }
  } else {
    // Overnight shift (e.g., 6PM to 3AM)
    // Hours from start to midnight that are in ND period
    if (startHour < 22) {
      // Starts before 10PM, count from 10PM to midnight
      ndHours += 2; // 10PM to midnight (2 hours)
    } else {
      // Starts at or after 10PM, count from start to midnight
      ndHours += 24 - startHour;
    }
    // Hours after midnight that are in ND period
    if (endHour > 6) {
      // Ends after 6AM, count from midnight to 6AM
      ndHours += 6; // Midnight to 6AM (6 hours)
    } else {
      // Ends at or before 6AM, count from midnight to end
      ndHours += endHour;
    }
  }
  
  return Math.max(0, Math.min(ndHours, 8)); // Cap at 8 hours
};

/**
 * Check if a date is a holiday
 */
const checkHoliday = async (date) => {
  try {
    const dateStr = new Date(date).toISOString().split('T')[0];
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);
    
    const holiday = await Holiday.findOne({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
    
    if (holiday) {
      return {
        isHoliday: true,
        holidayType: holiday.type
      };
    }
    
    return {
      isHoliday: false,
      holidayType: null
    };
  } catch (error) {
    return {
      isHoliday: false,
      holidayType: null
    };
  }
};

/**
 * Calculate estimated salary for schedules without timesheet entries
 */
export const calculateEstimatedSalary = async (startDate, endDate) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  // Get all schedules in the date range
  const schedules = await Schedule.find({
    date: {
      $gte: start,
      $lte: end
    },
    isOff: { $ne: true }
  }).lean();
  
  // Get all timesheet logs in the date range
  const timesheets = await TimesheetLog.find({
    date: {
      $gte: start,
      $lte: end
    }
  }).lean();
  
  // Create a map of employee+date to timesheet
  const timesheetMap = {};
  timesheets.forEach(ts => {
    const dateStr = new Date(ts.date).toISOString().split('T')[0];
    const key = `${ts.employeeName}_${dateStr}`;
    timesheetMap[key] = ts;
  });
  
  // Get all unique employee names from schedules
  const employeeNames = [...new Set(schedules.map(s => s.employeeName))];
  
  // Get employee data
  const employees = await Employee.find({
    employeeName: { $in: employeeNames }
  }).lean();
  
  const employeeMap = {};
  employees.forEach(emp => {
    employeeMap[emp.employeeName] = emp;
  });
  
  // Group schedules by employee
  const employeeSchedules = {};
  schedules.forEach(schedule => {
    const dateStr = new Date(schedule.date).toISOString().split('T')[0];
    const key = `${schedule.employeeName}_${dateStr}`;
    
    // Only include schedules without timesheet entries
    if (!timesheetMap[key]) {
      if (!employeeSchedules[schedule.employeeName]) {
        employeeSchedules[schedule.employeeName] = [];
      }
      employeeSchedules[schedule.employeeName].push(schedule);
    }
  });
  
  // Get settings multipliers once for all calculations
  const settings = await getSettings();
  
  const results = [];
  
  for (const [employeeName, empSchedules] of Object.entries(employeeSchedules)) {
    const employee = employeeMap[employeeName];
    if (!employee) continue;
    
    let totalEstimatedHours = 0;
    let totalNDHours = 0;
    let totalRegularHolidayHours = 0;
    let totalSpecialHolidayHours = 0;
    let totalOvertimeHours = 0;
    
    // Process each schedule
    for (const schedule of empSchedules) {
      const scheduledHours = schedule.scheduledDuration || 0;
      if (scheduledHours === 0) continue;
      
      // Check if holiday
      const { isHoliday, holidayType } = await checkHoliday(schedule.date);
      
      // Estimate ND hours
      const ndHours = estimateNDHours(
        schedule.scheduledStartTime,
        schedule.scheduledEndTime
      );
      
      // Calculate overtime (if scheduled hours > standard)
      const overtimeHours = scheduledHours > STANDARD_HOURS_PER_DAY 
        ? scheduledHours - STANDARD_HOURS_PER_DAY 
        : 0;
      
      totalEstimatedHours += scheduledHours;
      totalNDHours += ndHours;
      totalOvertimeHours += overtimeHours;
      
      if (isHoliday) {
        if (holidayType === 'Regular') {
          totalRegularHolidayHours += scheduledHours;
        } else if (holidayType === 'Special') {
          totalSpecialHolidayHours += scheduledHours;
        }
      }
    }
    
    // Calculate hourly rate
    const hourlyRate = employee.wageType === 'DAILY'
      ? (employee.wageRate || 0) / STANDARD_HOURS_PER_DAY
      : employee.wageRate || 0;
    
    // Calculate estimated pay components using settings multipliers
    const basicSalary = employee.wageType === 'DAILY'
      ? (employee.wageRate || 0) * (totalEstimatedHours / STANDARD_HOURS_PER_DAY)
      : totalEstimatedHours * hourlyRate;
    
    const regularHolidayPay = totalRegularHolidayHours * hourlyRate * settings.regularHolidayMultiplier;
    const specialHolidayPay = totalSpecialHolidayHours * hourlyRate * settings.specialHolidayMultiplier;
    const overtimePay = totalOvertimeHours * hourlyRate * settings.overtimeMultiplier;
    const nightDiffPay = totalNDHours * hourlyRate * settings.nightDifferentialMultiplier;
    
    const totalEstimatedSalary = 
      basicSalary +
      overtimePay +
      nightDiffPay +
      regularHolidayPay +
      specialHolidayPay;
    
    results.push({
      employeeName,
      employeeId: employee._id,
      wageType: employee.wageType,
      wageRate: employee.wageRate,
      hourlyRate,
      scheduleCount: empSchedules.length,
      totalEstimatedHours: Math.round(totalEstimatedHours * 100) / 100,
      totalNDHours: Math.round(totalNDHours * 100) / 100,
      totalRegularHolidayHours: Math.round(totalRegularHolidayHours * 100) / 100,
      totalSpecialHolidayHours: Math.round(totalSpecialHolidayHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      basicSalary: Math.round(basicSalary * 100) / 100,
      overtimePay: Math.round(overtimePay * 100) / 100,
      nightDiffPay: Math.round(nightDiffPay * 100) / 100,
      regularHolidayPay: Math.round(regularHolidayPay * 100) / 100,
      specialHolidayPay: Math.round(specialHolidayPay * 100) / 100,
      totalEstimatedSalary: Math.round(totalEstimatedSalary * 100) / 100
    });
  }
  
  // Calculate totals
  const totals = {
    totalEmployees: results.length,
    totalSchedules: schedules.length - timesheets.length,
    totalEstimatedHours: results.reduce((sum, r) => sum + r.totalEstimatedHours, 0),
    totalBasicSalary: results.reduce((sum, r) => sum + r.basicSalary, 0),
    totalOvertimePay: results.reduce((sum, r) => sum + r.overtimePay, 0),
    totalNightDiffPay: results.reduce((sum, r) => sum + r.nightDiffPay, 0),
    totalRegularHolidayPay: results.reduce((sum, r) => sum + r.regularHolidayPay, 0),
    totalSpecialHolidayPay: results.reduce((sum, r) => sum + r.specialHolidayPay, 0),
    grandTotal: results.reduce((sum, r) => sum + r.totalEstimatedSalary, 0)
  };
  
  return {
    results,
    totals,
    dateRange: {
      startDate,
      endDate
    }
  };
};

