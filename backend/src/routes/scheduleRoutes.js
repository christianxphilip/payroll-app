import express from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import Schedule from '../models/Schedule.js';
import Employee from '../models/Employee.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { parseScheduleCSV, validateSchedules } from '../services/scheduleParserService.js';
import { calculateEstimatedSalary } from '../services/estimatedSalaryService.js';
import { generateICalContent } from '../services/icalService.js';
import { syncSchedulesToGoogleCalendar, clearGoogleCalendarSchedules } from '../services/googleCalendarService.js';
import { assertManagerCanManageEmployee, isDualPosition, managerAssignmentType, managerEmployeeQuery } from '../utils/managerScope.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const calendarSyncTimers = new Map();

// All routes require authentication
router.use(authenticate);

const queueCalendarSync = (dateInput) => {
  if (process.env.AUTO_SYNC_GOOGLE_CALENDAR === 'false' || !dateInput) return;
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return;
  const day = date.toISOString().split('T')[0];
  clearTimeout(calendarSyncTimers.get(day));
  calendarSyncTimers.set(day, setTimeout(async () => {
    calendarSyncTimers.delete(day);
    try {
      await syncSchedulesToGoogleCalendar(day, day);
      console.log(`[Calendar auto-sync] Completed ${day}`);
    } catch (error) {
      console.error(`[Calendar auto-sync] Failed ${day}:`, error.message);
    }
  }, 750));
};

const getManagerEmployees = async (reqUser) => {
  if (reqUser.role !== 'manager') return null;
  return Employee.find(managerEmployeeQuery(reqUser.managerScope), 'employeeName position');
};

const assertManagerScheduleWrite = async (reqUser, scheduleData, existingSchedule = null) => {
  if (reqUser.role !== 'manager') return;
  const employeeName = scheduleData.employeeName || existingSchedule?.employeeName;
  const scheduleDate = scheduleData.date || existingSchedule?.date;
  const employee = await Employee.findOne({ employeeName }, 'employeeName position');
  if (!employee) throw new AppError('Employee not found', 404);
  assertManagerCanManageEmployee(employee, reqUser);

  const requiredType = managerAssignmentType(reqUser.managerScope);
  if (scheduleData.assignmentType && scheduleData.assignmentType !== requiredType) {
    throw new AppError(`Managers can only create ${requiredType.toLowerCase()} schedules`, 403);
  }
  scheduleData.assignmentType = requiredType;

  if (isDualPosition(employee.position) && scheduleDate) {
    const date = new Date(scheduleDate);
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    const conflict = await Schedule.findOne({
      _id: existingSchedule?._id ? { $ne: existingSchedule._id } : { $exists: true },
      employeeName,
      date: { $gte: start, $lte: end },
      assignmentType: { $ne: requiredType }
    });
    if (conflict) throw new AppError(`Already assigned to ${conflict.assignmentType || 'the other department'} on this date`, 409);
  }
};

// GET /api/schedules - Get schedules
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, employeeName, page = 1, limit = 100, sortBy = 'date', sortOrder = 'asc' } = req.query;
    
    let query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (employeeName) {
      query.employeeName = employeeName;
    }
    const managerEmployees = await getManagerEmployees(req.user);
    if (managerEmployees) {
      query.employeeName = { $in: managerEmployees.map(employee => employee.employeeName) };
      if (employeeName) query.employeeName = { $in: managerEmployees.filter(employee => employee.employeeName === employeeName).map(employee => employee.employeeName) };
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    // Add secondary sort by date and name if not already sorting by them
    if (sortBy !== 'date') sortObj.date = 1;
    if (sortBy !== 'employeeName') sortObj.employeeName = 1;
    
    // Get total count for pagination
    const total = await Schedule.countDocuments(query);
    
    // Get paginated results
    const schedules = await Schedule.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);
    
    res.json({
      success: true,
      data: schedules,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + schedules.length < total
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/export-ical - Export schedules as .ics file
router.get('/export-ical', async (req, res, next) => {
  try {
    const { startDate, endDate, employeeName } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    let query = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (employeeName && employeeName.trim() !== '') {
      query.employeeName = { $regex: employeeName.trim(), $options: 'i' };
    }

    const schedules = await Schedule.find(query).sort({ date: 1, employeeName: 1 });
    const employees = await Employee.find({}, 'employeeName email');
    const employeeEmailMap = {};
    employees.forEach(emp => {
      if (emp.employeeName && emp.email) {
        employeeEmailMap[emp.employeeName] = emp.email;
      }
    });

    const icsContent = generateICalContent(schedules, employeeEmailMap);

    const filename = `espro-schedules-${startDate}-to-${endDate}.ics`;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(icsContent);
  } catch (error) {
    next(error);
  }
});

// POST /api/schedules/sync-google-calendar - Direct Google Calendar API sync
router.post('/sync-google-calendar', async (req, res, next) => {
  try {
    const { startDate, endDate, employeeName } = req.body;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    const result = await syncSchedulesToGoogleCalendar(startDate, endDate, employeeName);

    const messageParts = [`Synced ${result.syncedCount} new shifts`, `updated ${result.updatedCount} existing shifts`];
    if (result.deletedCount > 0) {
      messageParts.push(`removed ${result.deletedCount} outdated shift(s)`);
    }

    res.json({
      success: true,
      data: result,
      message: `Successfully ${messageParts.join(', ')} in Google Calendar!`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/schedules/clear-google-calendar - Clear Google Calendar events in date range
router.post('/clear-google-calendar', async (req, res, next) => {
  try {
    const { startDate, endDate, employeeName } = req.body;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    const result = await clearGoogleCalendarSchedules(startDate, endDate, employeeName);

    res.json({
      success: true,
      data: result,
      message: `Successfully cleared ${result.clearedCount} shift(s) from Google Calendar!`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/schedules - Add single schedule entry
router.post('/', async (req, res, next) => {
  try {
    const scheduleData = req.body;
    
    if (!scheduleData.employeeName || !scheduleData.date) {
      throw new AppError('Employee name and date are required', 400);
    }
    await assertManagerScheduleWrite(req.user, scheduleData);
    
    // Allow multiple schedules per employee per date
    const schedule = await Schedule.create(scheduleData);
    queueCalendarSync(schedule.date);
    
    res.status(201).json({
      success: true,
      data: schedule,
      message: 'Schedule created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/schedules/bulk - Bulk create schedules
router.post('/bulk', async (req, res, next) => {
  try {
    const { schedules } = req.body;
    
    if (!Array.isArray(schedules) || schedules.length === 0) {
      throw new AppError('Schedules array is required', 400);
    }
    for (const schedule of schedules) await assertManagerScheduleWrite(req.user, schedule);
    
    // Validate schedules
    const errors = validateSchedules(schedules);
    if (errors.length > 0) {
      throw new AppError(`Validation errors: ${errors.join(', ')}`, 400);
    }
    
    // Use insertMany with ordered: false to continue on duplicates
    const result = await Schedule.insertMany(schedules, { ordered: false })
      .catch(error => {
        // Handle duplicate key errors
        if (error.code === 11000) {
          return { insertedCount: error.result?.nInserted || 0 };
        }
        throw error;
      });
    
    const insertedCount = Array.isArray(result) ? result.length : result.insertedCount;
    schedules.forEach(schedule => queueCalendarSync(schedule.date));
    
    res.status(201).json({
      success: true,
      count: insertedCount,
      message: `${insertedCount} schedules created successfully`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/schedules/upload-csv - Parse and import CSV schedule
router.post('/upload-csv', upload.single('file'), async (req, res, next) => {
  try {
    if (req.user.role === 'manager') throw new AppError('CSV schedule import is only available to admins', 403);
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }
    
    const csvContent = req.file.buffer.toString('utf-8');
    const year = req.body.year || new Date().getFullYear();
    
    console.log('=== CSV Upload Handler ===');
    console.log('File size:', req.file.size);
    console.log('Year:', year);
    
    // Parse CSV using papaparse - DO NOT use header: true
    // We need raw rows to properly detect the date header row
    const parseResult = Papa.parse(csvContent, {
      header: false, // Changed to false to get raw rows
      skipEmptyLines: true
    });
    
    console.log('Parse result - rows:', parseResult.data.length);
    console.log('Parse errors:', parseResult.errors);
    
    if (parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors);
    }
    
    // Convert array rows to object format with numeric keys for compatibility
    const dataRows = parseResult.data.map(row => {
      const obj = {};
      row.forEach((cell, idx) => {
        obj[String(idx)] = cell;
      });
      return obj;
    });
    
    console.log('Converted to', dataRows.length, 'row objects');
    
    // Parse and normalize schedule data
    const schedules = parseScheduleCSV(dataRows, parseInt(year));
    
    if (schedules.length === 0) {
      throw new AppError('No valid schedule data found in CSV. Check that employee names and dates are in the expected format.', 400);
    }
    
    // Upsert schedules (insert new, update existing)
    let insertedCount = 0;
    let updatedCount = 0;
    
    for (const schedule of schedules) {
      const result = await Schedule.findOneAndUpdate(
        {
          employeeName: schedule.employeeName,
          date: {
            $gte: new Date(new Date(schedule.date).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date(schedule.date).setHours(23, 59, 59, 999))
          }
        },
        schedule,
        { upsert: true, new: true }
      );
      
      // Check if it was an insert or update
      if (result && result.__v === 0) {
        insertedCount++;
      } else {
        updatedCount++;
      }
      queueCalendarSync(schedule.date);
    }
    
    res.status(201).json({
      success: true,
      parsed: schedules.length,
      inserted: insertedCount,
      updated: updatedCount,
      message: `Parsed ${schedules.length} records, inserted ${insertedCount} new schedules, updated ${updatedCount} existing schedules`,
      preview: schedules.slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/schedules/:id - Update schedule
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const existingSchedule = await Schedule.findById(id);
    if (!existingSchedule) throw new AppError('Schedule not found', 404);
    await assertManagerScheduleWrite(req.user, updateData, existingSchedule);
    
    const schedule = await Schedule.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    queueCalendarSync(existingSchedule.date);
    queueCalendarSync(schedule.date);
    
    if (!schedule) {
      throw new AppError('Schedule not found', 404);
    }
    
    res.json({
      success: true,
      data: schedule,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/schedules/:id - Delete schedule
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingSchedule = await Schedule.findById(id);
    if (existingSchedule && req.user.role === 'manager') {
      const employee = await Employee.findOne({ employeeName: existingSchedule.employeeName }, 'position');
      assertManagerCanManageEmployee(employee, req.user);
      if (existingSchedule.assignmentType !== managerAssignmentType(req.user.managerScope)) {
        throw new AppError('You cannot delete another department\'s schedule', 403);
      }
    }
    const schedule = await Schedule.findByIdAndDelete(id);
    
    if (!schedule) {
      throw new AppError('Schedule not found', 404);
    }
    queueCalendarSync(schedule.date);
    
    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/schedules/range - Delete schedules by date range
router.delete('/range/delete', async (req, res, next) => {
  try {
    if (req.user.role === 'manager') throw new AppError('Bulk schedule deletion is only available to admins', 403);
    const { startDate, endDate, employeeName } = req.body;
    
    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }
    
    let query = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    if (employeeName) {
      query.employeeName = employeeName;
    }
    
    const result = await Schedule.deleteMany(query);
    const cursor = new Date(startDate);
    const last = new Date(endDate);
    while (cursor <= last) {
      queueCalendarSync(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} schedules deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/estimated-salary - Calculate estimated salary for schedules without timesheets
router.get('/estimated-salary', authorize(['admin']), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }
    
    const result = await calculateEstimatedSalary(startDate, endDate);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
