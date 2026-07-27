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

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

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

// POST /api/schedules - Add single schedule entry
router.post('/', async (req, res, next) => {
  try {
    const scheduleData = req.body;
    
    if (!scheduleData.employeeName || !scheduleData.date) {
      throw new AppError('Employee name and date are required', 400);
    }
    
    // Allow multiple schedules per employee per date
    const schedule = await Schedule.create(scheduleData);
    
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
    
    const schedule = await Schedule.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
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
    
    const schedule = await Schedule.findByIdAndDelete(id);
    
    if (!schedule) {
      throw new AppError('Schedule not found', 404);
    }
    
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

    if (employeeName) {
      query.employeeName = employeeName;
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

export default router;

