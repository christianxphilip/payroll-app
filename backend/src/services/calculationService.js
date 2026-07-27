import Holiday from '../models/Holiday.js';
import Schedule from '../models/Schedule.js';

/**
 * Calculate actual duration between two timestamps in hours
 */
export const calculateActualDuration = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return 0;

  const timeInDate = new Date(timeIn);
  const timeOutDate = new Date(timeOut);

  const diffMs = timeOutDate - timeInDate;
  const hours = diffMs / (1000 * 60 * 60);

  return Math.max(0, hours); // Prevent negative hours
};

/**
 * Calculate hours worked (with break deduction)
 * If actualDuration >= 7.5 hours: subtract 1 hour for break
 */
export const calculateHoursWorked = (actualDuration) => {
  if (actualDuration >= 7.5) {
    return actualDuration - 1;
  }
  return actualDuration;
};

/**
 * Calculate Night Differential (ND) hours
 * ND period: 10:00 PM (22:00) to 6:00 AM (06:00) Philippines time
 * Handles overnight shifts properly
 */
export const calculateNDHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return 0;

  const timeInDate = new Date(timeIn);
  const timeOutDate = new Date(timeOut);

  let totalNDHours = 0;
  let currentTime = new Date(timeInDate);

  // Process hour by hour to handle day boundaries
  while (currentTime < timeOutDate) {
    // Get hour in Philippines time (UTC+8)
    // Times are stored in UTC, so we need to add 8 hours to get Philippines time
    const utcHour = currentTime.getUTCHours();
    const utcMinutes = currentTime.getUTCMinutes();

    // Add 8 hours for Philippines timezone
    let philippinesHour = utcHour + 8;
    if (philippinesHour >= 24) {
      philippinesHour -= 24;
    }

    // ND hours are from 22:00 (10 PM) to 05:59 (6 AM) Philippines time
    // This means hours 22, 23, 0, 1, 2, 3, 4, 5
    const isNDHour = philippinesHour >= 22 || philippinesHour < 6;

    if (isNDHour) {
      // Calculate how much of this hour is worked
      const nextHour = new Date(currentTime);
      nextHour.setUTCHours(currentTime.getUTCHours() + 1, 0, 0, 0);

      const segmentEnd = nextHour < timeOutDate ? nextHour : timeOutDate;
      const hoursInSegment = (segmentEnd - currentTime) / (1000 * 60 * 60);

      totalNDHours += hoursInSegment;
    }

    // Move to next hour
    currentTime = new Date(currentTime);
    currentTime.setUTCHours(currentTime.getUTCHours() + 1, 0, 0, 0);

    // If we're past timeOut, break
    if (currentTime >= timeOutDate) {
      break;
    }
  }

  return totalNDHours;
};

/**
 * Look up if a date is a holiday
 */
export const lookupHoliday = async (date) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
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
    console.error('Error looking up holiday:', error);
    return {
      isHoliday: false,
      holidayType: null
    };
  }
};

/**
 * Parse time string like "9AM" or "2PM" to 24-hour format (0-23)
 */
const parseScheduleTime = (timeStr) => {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2})(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const isPM = match[2].toUpperCase() === 'PM';

  if (isPM && hours !== 12) {
    hours += 12;
  } else if (!isPM && hours === 12) {
    hours = 0;
  }

  return hours;
};

/**
 * Match a timesheet log's timeIn/timeOut to the best matching schedule
 * Returns the schedule that best matches the actual work times
 */
const matchScheduleToTimesheet = (schedules, timeIn, timeOut) => {
  if (!timeIn || !timeOut || schedules.length === 0) {
    return null;
  }

  // Ensure timeIn and timeOut are Date objects
  const timeInDate = timeIn instanceof Date ? timeIn : new Date(timeIn);
  const timeOutDate = timeOut instanceof Date ? timeOut : new Date(timeOut);

  // Convert timeIn/timeOut to hours (0-23) with minutes as decimal
  const timeInHour = timeInDate.getHours() + (timeInDate.getMinutes() / 60);
  const timeOutHour = timeOutDate.getHours() + (timeOutDate.getMinutes() / 60);

  // Handle overnight shifts (timeOut on next day)
  let timeOutHourAdjusted = timeOutHour;
  if (timeOutHour < timeInHour) {
    timeOutHourAdjusted = timeOutHour + 24; // Add 24 hours for next day
  }

  // Find the schedule that best matches the timesheet times
  let bestMatch = null;
  let bestScore = -1;

  for (const schedule of schedules) {
    const scheduleStartHour = parseScheduleTime(schedule.scheduledStartTime);
    const scheduleEndHour = parseScheduleTime(schedule.scheduledEndTime);

    if (scheduleStartHour === null || scheduleEndHour === null) continue;

    // Handle overnight schedules (end time before start time)
    let scheduleEndHourAdjusted = scheduleEndHour;
    if (scheduleEndHour < scheduleStartHour) {
      scheduleEndHourAdjusted = scheduleEndHour + 24;
    }

    // Calculate how well this schedule matches the timesheet
    // Check if timeIn is close to schedule start and timeOut is close to schedule end
    // Allow up to 2 hours difference for flexibility
    const startDiff = Math.abs(timeInHour - scheduleStartHour);
    const endDiff = Math.abs(timeOutHourAdjusted - scheduleEndHourAdjusted);

    // Only consider matches within 2 hours of scheduled times
    if (startDiff <= 2 && endDiff <= 2) {
      // Lower difference = better match
      const score = 100 - (startDiff + endDiff);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = schedule;
      }
    }
  }

  return bestMatch;
};

/**
 * Look up full schedule data for an employee on a specific date
 * Returns schedule hours and shift times, or null values if OFF/not found
 * Now supports multiple schedules per date - matches to specific schedule if timeIn/timeOut provided
 */
export const lookupSchedule = async (employeeName, date, timeIn = null, timeOut = null) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all schedules for this employee/date (not OFF)
    const schedules = await Schedule.find({
      employeeName,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      isOff: { $ne: true }
    }).sort({ scheduledStartTime: 1 }); // Sort by start time

    if (schedules.length === 0) {
      return {
        scheduledHours: 0,
        scheduledStartTime: null,
        scheduledEndTime: null
      };
    }

    // If timeIn/timeOut provided, try to match to specific schedule
    if (timeIn && timeOut) {
      const matchedSchedule = matchScheduleToTimesheet(schedules, timeIn, timeOut);
      if (matchedSchedule) {
        return {
          scheduledHours: matchedSchedule.scheduledDuration || 0,
          scheduledStartTime: matchedSchedule.scheduledStartTime || null,
          scheduledEndTime: matchedSchedule.scheduledEndTime || null
        };
      }
    }

    // Fallback: if no match or no times provided, sum all scheduled durations
    // Use first schedule's start time and last schedule's end time for display
    const totalScheduledHours = schedules.reduce((sum, schedule) => {
      return sum + (schedule.scheduledDuration || 0);
    }, 0);

    const firstSchedule = schedules[0];
    const lastSchedule = schedules[schedules.length - 1];

    return {
      scheduledHours: totalScheduledHours,
      scheduledStartTime: firstSchedule.scheduledStartTime || null,
      scheduledEndTime: lastSchedule.scheduledEndTime || null
    };
  } catch (error) {
    console.error('Error looking up schedule:', error);
    return {
      scheduledHours: 0,
      scheduledStartTime: null,
      scheduledEndTime: null
    };
  }
};

/**
 * Look up scheduled hours for an employee on a specific date
 * Returns 0 if OFF day or not found
 * @deprecated Use lookupSchedule() instead for full schedule data
 */
export const lookupScheduledHours = async (employeeName, date) => {
  const schedule = await lookupSchedule(employeeName, date);
  return schedule.scheduledHours;
};

/**
 * Calculate review flag
 * Flag if: timeIn missing OR timeOut missing OR hoursWorked > 8 OR hoursWorked > scheduledHours
 * OR hoursWorked is 0 or very low (< 0.5 hours = 30 minutes)
 * OR no scheduled shift exists (scheduledHours is 0 or null)
 */
export const calculateReviewFlag = (timeIn, timeOut, hoursWorked, scheduledHours) => {
  if (!timeIn || !timeOut) return true;
  if (hoursWorked === 0 || hoursWorked < 0.5) return true; // Flag very short shifts
  if (!scheduledHours || scheduledHours === 0) return true; // Flag if no scheduled shift
  if (hoursWorked > 8) return true;
  if (scheduledHours > 0 && hoursWorked > scheduledHours) return true;
  return false;
};

/**
 * Calculate all timesheet fields
 * This is the main function to auto-populate timesheet data
 */
export const calculateTimesheetFields = async (timesheetData) => {
  const { employeeName, date, timeIn, timeOut, _useSchedule } = timesheetData;

  // Calculate actual duration
  const actualDuration = calculateActualDuration(timeIn, timeOut);

  // Calculate hours worked (with break deduction)
  const hoursWorked = calculateHoursWorked(actualDuration);

  // Calculate ND hours (no break deduction applied to ND hours)
  // ND hours are counted based on actual time worked during ND period (10 PM - 6 AM)
  // We assume breaks are not taken during ND hours, so full ND time is counted
  const ndHours = calculateNDHours(timeIn, timeOut);

  // Look up holiday
  const { isHoliday, holidayType } = await lookupHoliday(date);

  // Look up schedule (hours and shift times) - use provided schedule if available, otherwise match
  let scheduledHours, scheduledStartTime, scheduledEndTime;
  if (_useSchedule) {
    scheduledHours = _useSchedule.scheduledHours;
    scheduledStartTime = _useSchedule.scheduledStartTime;
    scheduledEndTime = _useSchedule.scheduledEndTime;
  } else {
    const scheduleData = await lookupSchedule(employeeName, date, timeIn, timeOut);
    scheduledHours = scheduleData.scheduledHours;
    scheduledStartTime = scheduleData.scheduledStartTime;
    scheduledEndTime = scheduleData.scheduledEndTime;
  }

  // Calculate review flag
  const reviewFlag = calculateReviewFlag(timeIn, timeOut, hoursWorked, scheduledHours);

  // Set adjusted hours worked:
  // - Use actual hoursWorked, but cap at 8 hours (standard day)
  // - We no longer default to scheduledHours because if an employee works LESS than scheduled,
  //   they should only be paid for actual hours.
  const fullAdjustedHours = hoursWorked;

  // Calculate overtime hours: ALWAYS use actual hoursWorked (not scheduled hours)
  // OT should reflect actual work performed, regardless of what was scheduled
  const STANDARD_HOURS_PER_DAY = 8;
  let overtimeHours = 0;
  if (hoursWorked > STANDARD_HOURS_PER_DAY) {
    overtimeHours = hoursWorked - STANDARD_HOURS_PER_DAY;
  }

  // Adjusted hours worked for basic salary calculation: cap at 8 hours
  // Overtime hours are paid separately with premium multipliers
  const adjustedHoursWorked = Math.min(fullAdjustedHours, STANDARD_HOURS_PER_DAY);

  return {
    actualDuration: Math.round(actualDuration * 100) / 100, // Round to 2 decimals
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    ndHours: Math.round(ndHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    isHoliday,
    holidayType,
    scheduledHours: Math.round(scheduledHours * 100) / 100,
    scheduledStartTime,
    scheduledEndTime,
    adjustedHoursWorked: Math.round(adjustedHoursWorked * 100) / 100, // Round to 2 decimals
    reviewFlag
  };
};

