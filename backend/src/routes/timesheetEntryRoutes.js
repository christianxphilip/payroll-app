import express from 'express';
import Timesheet from '../models/Timesheet.js';
import TimesheetLog from '../models/TimesheetLog.js';
import Schedule from '../models/Schedule.js';
import { calculateTimesheetFields } from '../services/calculationService.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/timesheet-entries - Get all timesheet entries (with pagination and sorting)
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc', status } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Get total count for pagination
    const total = await Timesheet.countDocuments(query);
    
    // Get paginated results
    const timesheets = await Timesheet.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);
    
    // Get time log counts for each timesheet
    const timesheetsWithCounts = await Promise.all(
      timesheets.map(async (timesheet) => {
        const logCount = await TimesheetLog.countDocuments({ timesheetId: timesheet._id });
        return {
          ...timesheet.toObject(),
          logCount
        };
      })
    );
    
    res.json({
      success: true,
      data: timesheetsWithCounts,
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

// GET /api/timesheet-entries/:id - Get single timesheet entry
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const timesheet = await Timesheet.findById(id);
    
    if (!timesheet) {
      throw new AppError('Timesheet not found', 404);
    }
    
    // Get time log count
    const logCount = await TimesheetLog.countDocuments({ timesheetId: id });
    
    res.json({
      success: true,
      data: {
        ...timesheet.toObject(),
        logCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheet-entries - Create new timesheet entry
router.post('/', async (req, res, next) => {
  try {
    const { name, startDate, endDate, notes, generateFromSchedules } = req.body;
    
    // Validate required fields
    if (!name || !startDate || !endDate) {
      throw new AppError('Missing required fields: name, startDate, endDate', 400);
    }
    
    const timesheet = await Timesheet.create({
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || ''
    });

    let generatedLogsCount = 0;

    if (generateFromSchedules) {
      // Find all active schedules in a slightly wider query range to cover timezone shifts
      const queryStart = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000);
      const queryEnd = new Date(new Date(endDate).getTime() + 48 * 60 * 60 * 1000);

      const allSchedules = await Schedule.find({
        date: { $gte: queryStart, $lte: queryEnd },
        isOff: { $ne: true },
        scheduledStartTime: { $exists: true, $ne: null },
        scheduledEndTime: { $exists: true, $ne: null }
      }).lean();

      // Helper function to format date to YYYY-MM-DD in Asia/Manila (UTC+8)
      const getLocalDateString = (dateObj) => {
        const d = new Date(dateObj);
        const phTime = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        const year = phTime.getUTCFullYear();
        const month = String(phTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(phTime.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Filter in-memory to ensure strictly matching local date range
      const schedules = allSchedules.filter(schedule => {
        const localDate = getLocalDateString(schedule.date);
        return localDate >= startDate && localDate <= endDate;
      });

      // Helper function to parse scheduled times on baseDate in Philippines timezone
      const parseScheduledTime = (timeStr, baseDate) => {
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
        
        const baseDateObj = new Date(baseDate);
        const dateStr = baseDateObj.toISOString().split('T')[0];
        
        const isoString = `${dateStr}T${String(hours).padStart(2, '0')}:00:00+08:00`;
        return new Date(isoString);
      };

      for (const schedule of schedules) {
        // Skip if a log already exists for this employee on this date
        const logDateStart = new Date(schedule.date);
        logDateStart.setHours(0, 0, 0, 0);
        const logDateEnd = new Date(schedule.date);
        logDateEnd.setHours(23, 59, 59, 999);

        const existingLog = await TimesheetLog.findOne({
          employeeName: schedule.employeeName,
          date: { $gte: logDateStart, $lte: logDateEnd }
        });

        if (existingLog) {
          continue;
        }

        let timeIn = parseScheduledTime(schedule.scheduledStartTime, schedule.date);
        let timeOut = parseScheduledTime(schedule.scheduledEndTime, schedule.date);

        if (timeIn && timeOut) {
          // Handle overnight shifts
          if (timeOut <= timeIn) {
            timeOut = new Date(timeOut.getTime() + 24 * 60 * 60 * 1000);
          }

          const timesheetData = {
            timesheetId: timesheet._id,
            employeeName: schedule.employeeName,
            date: schedule.date,
            timeIn,
            timeOut
          };

          const calculatedFields = await calculateTimesheetFields(timesheetData);

          const completeData = {
            ...timesheetData,
            ...calculatedFields,
            isSubmitted: false
          };

          await TimesheetLog.create(completeData);
          generatedLogsCount++;
        }
      }
    }
    
    res.status(201).json({
      success: true,
      data: timesheet,
      message: generateFromSchedules
        ? `Timesheet entry created successfully with ${generatedLogsCount} logs generated from schedules.`
        : 'Timesheet entry created successfully.'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/timesheet-entries/:id - Update timesheet entry
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Don't allow updating submitted timesheets
    const existingTimesheet = await Timesheet.findById(id);
    if (existingTimesheet && existingTimesheet.isSubmitted) {
      throw new AppError('Cannot update submitted timesheet', 400);
    }
    
    const timesheet = await Timesheet.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!timesheet) {
      throw new AppError('Timesheet not found', 404);
    }
    
    res.json({
      success: true,
      data: timesheet,
      message: 'Timesheet entry updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/timesheet-entries/:id - Delete timesheet entry
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if timesheet has any logs
    const logCount = await TimesheetLog.countDocuments({ timesheetId: id });
    if (logCount > 0) {
      throw new AppError('Cannot delete timesheet with existing time logs. Delete logs first.', 400);
    }
    
    const timesheet = await Timesheet.findByIdAndDelete(id);
    
    if (!timesheet) {
      throw new AppError('Timesheet not found', 404);
    }
    
    res.json({
      success: true,
      message: 'Timesheet entry deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheet-entries/:id/submit - Submit timesheet for approval
router.post('/:id/submit', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const timesheet = await Timesheet.findByIdAndUpdate(
      id,
      {
        status: 'submitted',
        isSubmitted: true,
        submittedAt: new Date()
      },
      { new: true }
    );
    
    if (!timesheet) {
      throw new AppError('Timesheet not found', 404);
    }
    
    // Also mark all associated time logs as submitted
    await TimesheetLog.updateMany(
      { timesheetId: id },
      {
        isSubmitted: true,
        submittedAt: new Date()
      }
    );
    
    res.json({
      success: true,
      data: timesheet,
      message: 'Timesheet submitted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/timesheet-entries/:id/revert - Revert submitted timesheet back to draft
router.post('/:id/revert', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if this timesheet is connected to any pay run
    const PayRun = (await import('../models/PayRun.js')).default;
    const payRun = await PayRun.findOne({
      timesheetIds: id
    });
    
    if (payRun) {
      throw new AppError(`Cannot revert timesheet: it is connected to pay run "${payRun._id}" (Status: ${payRun.status}). Please delete or revert the pay run first.`, 400);
    }
    
    const timesheet = await Timesheet.findByIdAndUpdate(
      id,
      {
        status: 'draft',
        isSubmitted: false,
        submittedAt: null
      },
      { new: true }
    );
    
    if (!timesheet) {
      throw new AppError('Timesheet not found', 404);
    }
    
    // Also mark all associated time logs as not submitted
    await TimesheetLog.updateMany(
      { timesheetId: id },
      {
        isSubmitted: false,
        submittedAt: null
      }
    );
    
    res.json({
      success: true,
      data: timesheet,
      message: 'Timesheet reverted to draft successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/timesheet-entries/:id/export - Export timelogs as CSV
router.get('/:id/export', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get timesheet entry
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) {
      throw new AppError('Timesheet not found', 404);
    }
    
    // Get all timelogs for this entry
    const logs = await TimesheetLog.find({ timesheetId: id }).sort({ employeeName: 1, date: 1 });
    
    // Format as CSV
    const headers = [
      'Employee Name',
      'Date',
      'Time In',
      'Time Out',
      'Hours Worked (less break)',
      'ND Hours',
      'Scheduled Hours (less break)',
      'Adjusted Hours (payable)',
      'Is Holiday',
      'Holiday Type',
      'Review Flag'
    ];
    
    const rows = logs.map(log => {
      // Format datetime in Philippines timezone (UTC+8) as "YYYY-MM-DD HH:MM:SS"
      const formatDateTime = (date) => {
        if (!date) return '';
        const d = new Date(date);
        
        // Get UTC time and add 8 hours for Philippines timezone
        const utcTime = d.getTime();
        const phTime = new Date(utcTime + (8 * 60 * 60 * 1000));
        
        const year = phTime.getUTCFullYear();
        const month = String(phTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(phTime.getUTCDate()).padStart(2, '0');
        const hour = String(phTime.getUTCHours()).padStart(2, '0');
        const minute = String(phTime.getUTCMinutes()).padStart(2, '0');
        const second = String(phTime.getUTCSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      };
      
      const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' });
      };
      
      return [
        log.employeeName,
        formatDate(log.date),
        formatDateTime(log.timeIn),
        formatDateTime(log.timeOut),
        (log.hoursWorked || 0).toFixed(2),
        (log.ndHours || 0).toFixed(2),
        (log.scheduledHours || 0).toFixed(2),
        (log.adjustedHoursWorked || 0).toFixed(2),
        log.isHoliday ? 'Yes' : 'No',
        log.holidayType || '',
        log.reviewFlag ? 'Yes' : 'No'
      ].map(field => {
        // Escape fields with commas or quotes
        if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });
    });
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Set response headers
    const filename = `${timesheet.name.replace(/[^a-z0-9]/gi, '_')}_timelogs.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
