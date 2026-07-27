import express from 'express';
import OperatingHours from '../models/OperatingHours.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/operating-hours - Get operating hours for date range
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }
    
    const operatingHours = await OperatingHours.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).lean();
    
    // Convert to object with date string as key
    const hoursMap = {};
    operatingHours.forEach(oh => {
      const dateStr = oh.date.toISOString().split('T')[0];
      hoursMap[dateStr] = oh.hours;
    });
    
    res.json({
      success: true,
      data: hoursMap
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/operating-hours - Create or update operating hours for a date
router.post('/', async (req, res, next) => {
  try {
    const { date, hours } = req.body;
    
    if (!date || !hours) {
      throw new AppError('Date and hours are required', 400);
    }
    
    // Use upsert to create or update
    const operatingHour = await OperatingHours.findOneAndUpdate(
      { date: new Date(date) },
      { hours: hours.trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    res.json({
      success: true,
      data: {
        date: operatingHour.date.toISOString().split('T')[0],
        hours: operatingHour.hours
      },
      message: 'Operating hours saved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/operating-hours/:date - Delete operating hours for a specific date
router.delete('/:date', async (req, res, next) => {
  try {
    const { date } = req.params;
    
    if (!date) {
      throw new AppError('Date is required', 400);
    }
    
    const result = await OperatingHours.deleteOne({ date: new Date(date) });
    
    res.json({
      success: true,
      message: 'Operating hours deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/operating-hours/bulk - Bulk create/update operating hours
router.post('/bulk', async (req, res, next) => {
  try {
    const { hours } = req.body; // { "2024-12-01": "3PM - 12AM", ... }
    
    if (!hours || typeof hours !== 'object') {
      throw new AppError('Hours object is required', 400);
    }
    
    const operations = Object.entries(hours).map(([dateStr, hoursValue]) => ({
      updateOne: {
        filter: { date: new Date(dateStr) },
        update: { hours: hoursValue.trim() },
        upsert: true
      }
    }));
    
    if (operations.length > 0) {
      await OperatingHours.bulkWrite(operations);
    }
    
    res.json({
      success: true,
      message: `${operations.length} operating hours saved successfully`
    });
  } catch (error) {
    next(error);
  }
});

export default router;

