import express from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import TimesheetLog from '../models/TimesheetLog.js';
import Schedule from '../models/Schedule.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculateTimesheetFields } from '../services/calculationService.js';
import { generatePayrollReport, submitTimesheets, formatReportAsCSV } from '../services/payrollService.js';
import { parseAttendanceCSV, validateTimesheets } from '../services/attendanceParserService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

/**
 * Helper: validate that a new or updated time range does not overlap
 * with any existing logs for the same employee.
 */
const assertNoOverlapForEmployee = async ({ employeeName, timeIn, timeOut, excludeId }) => {
  if (!employeeName || !timeIn || !timeOut) {
    return;
  }

  // Basic range sanity
  if (timeOut < timeIn) {
    throw new AppError('Time out must be after time in', 400);
  }

  const overlapQuery = {
    employeeName,
    timeIn: { $lt: new Date(timeOut) },
    timeOut: { $gt: new Date(timeIn) }
  };

  if (excludeId) {
    overlapQuery._id = { $ne: excludeId };
  }

  const overlapping = await TimesheetLog.findOne(overlapQuery).lean();
  if (overlapping) {
    throw new AppError(
      `Overlapping timelog detected for ${employeeName} on ${new Date(overlapping.date).toLocaleDateString()}`,
      400
    );
  }
};

// GET /api/timesheets - Get timesheet logs (with pagination and sorting)
router.get('/', async (req, res, next) => {
  try {
    const { timesheetId, startDate, endDate, employeeName, isSubmitted, reviewFlag, page = 1, limit = 100, sortBy = 'date', sortOrder = 'desc' } = req.query;
    
    let query = {};
    
    // Filter by timesheetId if provided
    if (timesheetId) {
      query.timesheetId = timesheetId;
    }
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (employeeName) {
      query.employeeName = employeeName;
    }
    
    if (isSubmitted !== undefined && isSubmitted !== '') {
      query.isSubmitted = isSubmitted === 'true';
    }
    
    if (reviewFlag !== undefined && reviewFlag !== '') {
      query.reviewFlag = reviewFlag === 'true';
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    // Add secondary sort by date and name if not already sorting by them
    // If sorting by employeeName, use ascending date (earliest first)
    if (sortBy !== 'date') {
      sortObj.date = sortBy === 'employeeName' ? 1 : -1;
    }
    if (sortBy !== 'employeeName') sortObj.employeeName = 1;
    
    // Get total count for pagination
    const total = await TimesheetLog.countDocuments(query);
    
    // Get paginated results
    const timesheets = await TimesheetLog.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);
    
    res.json({
      success: true,
      data: timesheets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + timesheets.length < total
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheets - Create timesheet log entry
router.post('/', async (req, res, next) => {
  try {
    const timesheetData = req.body;
    
    if (!timesheetData.employeeName || !timesheetData.date) {
      throw new AppError('Employee name and date are required', 400);
    }
    
    // Normalise and validate time range for overlap checks
    const baseDate = new Date(timesheetData.date);
    let timeIn = timesheetData.timeIn ? new Date(timesheetData.timeIn) : null;
    let timeOut = timesheetData.timeOut ? new Date(timesheetData.timeOut) : null;

    // If client sent only times for same calendar date, keep as-is; cross‑midnight
    // handling is performed client-side when constructing ISO strings.
    if (timeIn && !timesheetData.dateIn) {
      timesheetData.dateIn = new Date(baseDate);
    }
    if (timeOut && !timesheetData.dateOut) {
      // If timeOut is before timeIn and no explicit dateOut provided, assume next day
      if (timeIn && timeOut <= timeIn) {
        const nextDay = new Date(baseDate);
        nextDay.setDate(nextDay.getDate() + 1);
        timesheetData.dateOut = nextDay;
      } else {
        timesheetData.dateOut = new Date(baseDate);
      }
    }

    if (timeIn && timeOut) {
      await assertNoOverlapForEmployee({
        employeeName: timesheetData.employeeName,
        timeIn,
        timeOut
      });
    }
    // If scheduleId is provided, use that specific schedule for calculation
    let calculatedFields;
    if (timesheetData.scheduleId) {
      const schedule = await Schedule.findById(timesheetData.scheduleId);
      if (schedule && schedule.employeeName === timesheetData.employeeName) {
        // Use the specific schedule's data
        const scheduleDate = new Date(schedule.date);
        const timesheetDate = new Date(timesheetData.date);
        
        // Check if dates match
        if (scheduleDate.toISOString().split('T')[0] === timesheetDate.toISOString().split('T')[0]) {
          // Calculate fields with the specific schedule
          calculatedFields = await calculateTimesheetFields({
            ...timesheetData,
            // Override lookupSchedule to use this specific schedule
            _useSchedule: {
              scheduledHours: schedule.scheduledDuration || 0,
              scheduledStartTime: schedule.scheduledStartTime,
              scheduledEndTime: schedule.scheduledEndTime
            }
          });
        } else {
          calculatedFields = await calculateTimesheetFields(timesheetData);
        }
      } else {
        calculatedFields = await calculateTimesheetFields(timesheetData);
      }
    } else {
      // Calculate all fields automatically
      calculatedFields = await calculateTimesheetFields(timesheetData);
    }
    
    // Merge with input data (remove scheduleId as it's not part of the model)
    const { scheduleId, ...dataWithoutScheduleId } = timesheetData;
    const completeData = {
      ...dataWithoutScheduleId,
      ...calculatedFields
    };
    
    const timesheet = await TimesheetLog.create(completeData);
    
    res.status(201).json({
      success: true,
      data: timesheet,
      message: 'Timesheet log created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheets/upload-csv - Upload attendance/timesheet CSV
router.post('/upload-csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }
    
    const { timesheetId } = req.body;
    
    const csvContent = req.file.buffer.toString('utf-8');
    
    console.log('=== Timesheet CSV Upload Handler ===');
    console.log('File size:', req.file.size);
    console.log('Timesheet ID:', timesheetId);
    
    // Parse CSV using papaparse
    const parseResult = Papa.parse(csvContent, {
      header: false,
      skipEmptyLines: true
    });
    
    console.log('Parse result - rows:', parseResult.data.length);
    
    if (parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors);
    }
    
    // Convert array rows to object format
    const dataRows = parseResult.data.map(row => {
      const obj = {};
      row.forEach((cell, idx) => {
        obj[String(idx)] = cell;
      });
      return obj;
    });
    
    // Parse attendance data
    const timesheets = parseAttendanceCSV(dataRows);
    
    if (timesheets.length === 0) {
      throw new AppError('No valid timesheet data found in CSV', 400);
    }
    
    // Add timesheetId to all parsed records if provided
    if (timesheetId) {
      timesheets.forEach(ts => {
        ts.timesheetId = timesheetId;
      });
    }
    
    // Validate timesheets
    const validationErrors = validateTimesheets(timesheets);
    if (validationErrors.length > 0) {
      throw new AppError(`Validation errors: ${validationErrors.slice(0, 3).join(', ')}...`, 400);
    }
    
    // Check for multiple schedules and skip those entries
    const skippedEntries = [];
    const entriesToProcess = [];
    
    for (const timesheetData of timesheets) {
      // Check if employee has multiple schedules on this date
      const date = new Date(timesheetData.date);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const scheduleCount = await Schedule.countDocuments({
        employeeName: timesheetData.employeeName,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        isOff: { $ne: true }
      });
      
      if (scheduleCount > 1) {
        skippedEntries.push({
          employeeName: timesheetData.employeeName,
          date: date.toISOString().split('T')[0],
          reason: 'Multiple schedules on this date - requires manual entry'
        });
      } else {
        entriesToProcess.push(timesheetData);
      }
    }
    
    // Process each timesheet with calculations (UPSERT mode)
    const processedTimesheets = [];
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const timesheetData of entriesToProcess) {
      try {
        // Calculate all fields automatically
        const calculatedFields = await calculateTimesheetFields(timesheetData);
        
        // Merge with input data
        const completeData = {
          ...timesheetData,
          ...calculatedFields
        };
        
        // Upsert: Update if exists (same employee + date + timesheetId), insert if new
        // Match only on employee, date, and timesheetId to allow correcting times on re-upload
        const matchCriteria = {
          employeeName: completeData.employeeName,
          date: {
            $gte: new Date(new Date(completeData.date).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date(completeData.date).setHours(23, 59, 59, 999))
          }
          // Removed timeIn/timeOut from matching criteria
          // This allows updating records with corrected times on re-upload
        };
        
        // Add timesheetId to match criteria if provided
        if (completeData.timesheetId) {
          matchCriteria.timesheetId = completeData.timesheetId;
        }
        
        const result = await TimesheetLog.findOneAndUpdate(
          matchCriteria,
          completeData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        
        processedTimesheets.push(result);
        
        // Check if it was an insert or update based on whether document was created
        if (result && result.__v === 0) {
          createdCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        errorCount++;
        errors.push(`Error for ${timesheetData.employeeName}: ${error.message}`);
      }
    }
    
    console.log(`Processed: ${createdCount} created, ${updatedCount} updated, ${errorCount} errors, ${skippedEntries.length} skipped`);
    
    const messageParts = [
      `Parsed ${timesheets.length} records`,
      `created ${createdCount} new timesheets`,
      `updated ${updatedCount} existing timesheets`
    ];
    
    if (skippedEntries.length > 0) {
      messageParts.push(`${skippedEntries.length} skipped (multiple schedules - requires manual entry)`);
    }
    
    if (errorCount > 0) {
      messageParts.push(`${errorCount} errors`);
    }
    
    res.status(201).json({
      success: true,
      parsed: timesheets.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedEntries.length,
      errors: errorCount,
      message: messageParts.join(', '),
      skippedEntries: skippedEntries,
      errorDetails: errors.slice(0, 10), // Return first 10 errors
      preview: processedTimesheets.slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/timesheets/:id - Update timesheet log
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('[Update Timesheet] ID:', id);
    console.log('[Update Timesheet] Update data:', updateData);
    
    // Fetch existing timesheet
    const existing = await TimesheetLog.findById(id);
    
    if (!existing) {
      throw new AppError('Timesheet log not found', 404);
    }
    
    // Check if this timesheet log is connected to a pay run
    // Pay runs use submitted timesheet logs within the payroll period
    if (existing.isSubmitted) {
      const PayRun = (await import('../models/PayRun.js')).default;
      const payRun = await PayRun.findOne({
        payrollPeriodStart: { $lte: existing.date },
        payrollPeriodEnd: { $gte: existing.date }
      });
      
      if (payRun) {
        throw new AppError(`Cannot update timesheet log: it is connected to pay run "${payRun._id}" (Status: ${payRun.status}). Please delete or revert the pay run first.`, 400);
      }
    }
    
    console.log('[Update Timesheet] Existing data:', {
      employeeName: existing.employeeName,
      date: existing.date,
      timeIn: existing.timeIn,
      timeOut: existing.timeOut,
      hoursWorked: existing.hoursWorked,
      ndHours: existing.ndHours
    });
    
    // Merge update data
    const mergedData = {
      ...existing.toObject(),
      ...updateData
    };
    
    console.log('[Update Timesheet] Merged data before calculation:', {
      employeeName: mergedData.employeeName,
      date: mergedData.date,
      timeIn: mergedData.timeIn,
      timeOut: mergedData.timeOut
    });
    
    // Always recalculate fields to ensure OT is correct
    // This ensures overtimeHours is always calculated correctly based on latest schedule data
    const shouldRecalculate = updateData.timeIn || updateData.timeOut || updateData.date || updateData.scheduleId || updateData.adjustedHoursWorked !== undefined;
    
    if (shouldRecalculate) {
      console.log('[Update Timesheet] Recalculating fields...');
      const calculatedFields = await calculateTimesheetFields(mergedData);
      console.log('[Update Timesheet] Calculated fields:', calculatedFields);
      
      // If adjustedHoursWorked was manually changed, keep it but recalculate OT
      if (updateData.adjustedHoursWorked !== undefined) {
        mergedData.adjustedHoursWorked = updateData.adjustedHoursWorked;
        // Recalculate OT based on approved adjustedHoursWorked
        const STANDARD_HOURS_PER_DAY = 8;
        mergedData.overtimeHours = (mergedData.adjustedHoursWorked || 0) > STANDARD_HOURS_PER_DAY
          ? Math.round(((mergedData.adjustedHoursWorked || 0) - STANDARD_HOURS_PER_DAY) * 100) / 100
          : 0;
        console.log('[Update Timesheet] Manual adjustedHoursWorked - Recalculated OT:', {
          scheduledHours: calculatedFields.scheduledHours,
          hoursWorked: calculatedFields.hoursWorked,
          adjustedHoursWorked: mergedData.adjustedHoursWorked,
          overtimeHours: mergedData.overtimeHours
        });
      } else {
        // Use all calculated fields including overtimeHours
        Object.assign(mergedData, calculatedFields);
      }
      
      // Update scheduledHours to ensure it's current
      mergedData.scheduledHours = calculatedFields.scheduledHours;

      // Overlap validation for updated range
      if (mergedData.timeIn && mergedData.timeOut && (updateData.timeIn || updateData.timeOut)) {
        await assertNoOverlapForEmployee({
          employeeName: mergedData.employeeName,
          timeIn: mergedData.timeIn,
          timeOut: mergedData.timeOut,
          excludeId: existing._id
        });
      }
    }
    
    // Safety check - calculate overtimeHours based on approved adjustedHoursWorked
    const STANDARD_HOURS_PER_DAY = 8;
    const approvedHours = mergedData.adjustedHoursWorked !== undefined ? mergedData.adjustedHoursWorked : Math.min(mergedData.hoursWorked || 0, STANDARD_HOURS_PER_DAY);
    mergedData.overtimeHours = approvedHours > STANDARD_HOURS_PER_DAY
      ? Math.round((approvedHours - STANDARD_HOURS_PER_DAY) * 100) / 100
      : 0;
    console.log('[Update Timesheet] Safety check - Recalculated OT:', {
      scheduledHours: mergedData.scheduledHours,
      hoursWorked: mergedData.hoursWorked,
      overtimeHours: mergedData.overtimeHours
    });
    
    // Update timesheet
    const timesheet = await TimesheetLog.findByIdAndUpdate(
      id,
      mergedData,
      { new: true, runValidators: true }
    );
    
    console.log('[Update Timesheet] Final updated timesheet:', {
      employeeName: timesheet.employeeName,
      date: timesheet.date,
      timeIn: timesheet.timeIn,
      timeOut: timesheet.timeOut,
      hoursWorked: timesheet.hoursWorked,
      ndHours: timesheet.ndHours,
      scheduledHours: timesheet.scheduledHours,
      adjustedHoursWorked: timesheet.adjustedHoursWorked,
      overtimeHours: timesheet.overtimeHours
    });
    
    res.json({
      success: true,
      data: timesheet,
      message: 'Timesheet log updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/timesheets/:id - Delete timesheet log
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Fetch the timesheet log first to check if it's connected to a pay run
    const timesheet = await TimesheetLog.findById(id);
    
    if (!timesheet) {
      throw new AppError('Timesheet log not found', 404);
    }
    
    // Check if this timesheet log is connected to a pay run
    // Pay runs use submitted timesheet logs within the payroll period
    if (timesheet.isSubmitted) {
      const PayRun = (await import('../models/PayRun.js')).default;
      const payRun = await PayRun.findOne({
        payrollPeriodStart: { $lte: timesheet.date },
        payrollPeriodEnd: { $gte: timesheet.date }
      });
      
      if (payRun) {
        throw new AppError(`Cannot delete timesheet log: it is connected to pay run "${payRun._id}" (Status: ${payRun.status}). Please delete or revert the pay run first.`, 400);
      }
    }
    
    // Delete the timesheet log
    await TimesheetLog.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Timesheet log deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheets/batch-adjust - Batch update adjustedHoursWorked
router.post('/batch-adjust', async (req, res, next) => {
  try {
    const { timesheetIds, action } = req.body;
    
    if (!Array.isArray(timesheetIds) || timesheetIds.length === 0) {
      throw new AppError('Timesheet IDs array is required', 400);
    }
    
    if (!action || !['cap8', 'approve', 'clearFlag', 'applyScheduled'].includes(action)) {
      throw new AppError('Valid action is required (cap8, approve, clearFlag, applyScheduled)', 400);
    }
    
    const timesheets = await TimesheetLog.find({ _id: { $in: timesheetIds } });
    
    let updateCount = 0;
    
    for (const timesheet of timesheets) {
      let updated = false;
      
      if (action === 'cap8' && timesheet.hoursWorked > 8) {
        timesheet.adjustedHoursWorked = 8.0;
        timesheet.overtimeHours = 0.0;
        updated = true;
      } else if (action === 'approve' && timesheet.hoursWorked > 8) {
        timesheet.adjustedHoursWorked = timesheet.hoursWorked;
        timesheet.overtimeHours = Math.round((timesheet.hoursWorked - 8) * 100) / 100;
        updated = true;
      } else if (action === 'clearFlag') {
        timesheet.reviewFlag = false;
        updated = true;
      } else if (action === 'applyScheduled') {
        // Apply scheduled shift times to timeIn/timeOut and recalculate
        console.log(`[Apply Scheduled] Processing timesheet for ${timesheet.employeeName} on ${timesheet.date}`);
        console.log(`[Apply Scheduled] scheduledStartTime: ${timesheet.scheduledStartTime}, scheduledEndTime: ${timesheet.scheduledEndTime}, scheduledHours: ${timesheet.scheduledHours}`);
        
        if (timesheet.scheduledStartTime && timesheet.scheduledEndTime && timesheet.scheduledHours > 0) {
          // Parse scheduled times in Philippines timezone (UTC+8)
          const parseScheduledTime = (timeStr, baseDate) => {
            const match = timeStr.match(/(\d{1,2})(AM|PM)/i);
            if (!match) {
              console.log(`[Apply Scheduled] Failed to parse time: ${timeStr}`);
              return null;
            }
            
            let hours = parseInt(match[1]);
            const isPM = match[2].toUpperCase() === 'PM';
            
            // Convert to 24-hour format (Philippines time)
            if (isPM && hours !== 12) {
              hours += 12;
            } else if (!isPM && hours === 12) {
              hours = 0;
            }
            
            // Get the date in YYYY-MM-DD format from baseDate
            // The baseDate is stored in UTC but represents the Philippines date
            const baseDateObj = new Date(baseDate);
            const dateStr = baseDateObj.toISOString().split('T')[0]; // Get YYYY-MM-DD
            
            // Create date string in Philippines time format: YYYY-MM-DDTHH:MM:SS+08:00
            const isoString = `${dateStr}T${String(hours).padStart(2, '0')}:00:00+08:00`;
            console.log(`[Apply Scheduled] Created ISO string: ${isoString} for time ${timeStr} on date ${dateStr}`);
            
            return new Date(isoString);
          };
          
          const date = new Date(timesheet.date);
          let schedStartTime = parseScheduledTime(timesheet.scheduledStartTime, date);
          let schedEndTime = parseScheduledTime(timesheet.scheduledEndTime, date);
          
          console.log(`[Apply Scheduled] Parsed start: ${schedStartTime}, end: ${schedEndTime}`);
          
          // Handle overnight shifts (end time is next day)
          if (schedEndTime && schedStartTime && schedEndTime <= schedStartTime) {
            // Add one day to the end time
            schedEndTime = new Date(schedEndTime.getTime() + (24 * 60 * 60 * 1000));
            console.log(`[Apply Scheduled] Adjusted end time for overnight shift: ${schedEndTime}`);
          }
          
          if (schedStartTime && schedEndTime) {
            // Update timeIn and timeOut to scheduled times
            timesheet.timeIn = schedStartTime;
            timesheet.timeOut = schedEndTime;
            
            console.log(`[Apply Scheduled] Updated timeIn: ${timesheet.timeIn}, timeOut: ${timesheet.timeOut}`);
            
            // Recalculate all fields
            const calculatedFields = await calculateTimesheetFields({
              employeeName: timesheet.employeeName,
              date: timesheet.date,
              timeIn: schedStartTime,
              timeOut: schedEndTime
            });
            
            console.log(`[Apply Scheduled] Calculated fields:`, calculatedFields);
            
            // Update timesheet with calculated fields
            Object.assign(timesheet, calculatedFields);
            updated = true;
            console.log(`[Apply Scheduled] Successfully updated timesheet`);
          }
        } else {
          console.log(`[Apply Scheduled] Skipping - missing scheduled data`);
        }
      }
      
      if (updated) {
        await timesheet.save();
        updateCount++;
      }
    }
    
    res.json({
      success: true,
      updatedCount: updateCount,
      message: `${updateCount} timesheets updated successfully`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheets/submit - Submit/archive timesheets for payroll
router.post('/submit', async (req, res, next) => {
  try {
    const { timesheetIds } = req.body;
    
    if (!Array.isArray(timesheetIds) || timesheetIds.length === 0) {
      throw new AppError('Timesheet IDs array is required', 400);
    }
    
    const result = await submitTimesheets(timesheetIds);
    
    res.json({
      success: true,
      ...result,
      message: `${result.modifiedCount} timesheets submitted successfully`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/timesheets/report - Generate timesheet consolidation report (hours-focused)
router.get('/report', async (req, res, next) => {
  try {
    const { startDate, endDate, employeeName, includeSubmittedOnly, timesheetId, format } = req.query;
    
    console.log('[TimesheetReport] Query params:', req.query);
    
    const filters = {
      startDate,
      endDate,
      employeeName,
      includeSubmittedOnly: includeSubmittedOnly === 'true',
      timesheetId
    };
    
    console.log('[TimesheetReport] Filters:', filters);
    
    const reportData = await generatePayrollReport(filters);
    
    console.log('[TimesheetReport] Generated report:', {
      totalEmployees: reportData.totalEmployees,
      totalRecords: reportData.totalRecords,
      reportLength: reportData.report?.length
    });
    
    // Return as CSV if requested
    if (format === 'csv') {
      const csv = formatReportAsCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=timesheet-report.csv');
      return res.send(csv);
    }
    
    // Return as JSON
    res.json({
      success: true,
      ...reportData
    });
  } catch (error) {
    console.error('[TimesheetReport] Error:', error);
    next(error);
  }
});

export default router;

