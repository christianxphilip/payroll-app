import express from 'express';
import Holiday from '../models/Holiday.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/holidays - List all holidays
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    let query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (type) {
      query.type = type;
    }
    
    const holidays = await Holiday.find(query).sort({ date: 1 });
    
    res.json({
      success: true,
      data: holidays,
      count: holidays.length
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/holidays - Add holiday
router.post('/', async (req, res, next) => {
  try {
    const { date, description, type } = req.body;
    
    if (!date || !description || !type) {
      throw new AppError('Date, description, and type are required', 400);
    }
    
    const holiday = await Holiday.create({ date, description, type });
    
    res.status(201).json({
      success: true,
      data: holiday,
      message: 'Holiday created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/holidays/bulk - Bulk create holidays
router.post('/bulk', async (req, res, next) => {
  try {
    const { holidays } = req.body;
    
    if (!Array.isArray(holidays) || holidays.length === 0) {
      throw new AppError('Holidays array is required', 400);
    }
    
    const created = await Holiday.insertMany(holidays, { ordered: false });
    
    res.status(201).json({
      success: true,
      data: created,
      count: created.length,
      message: `${created.length} holidays created successfully`
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/holidays/:id - Update holiday
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, description, type } = req.body;
    
    const holiday = await Holiday.findByIdAndUpdate(
      id,
      { date, description, type },
      { new: true, runValidators: true }
    );
    
    if (!holiday) {
      throw new AppError('Holiday not found', 404);
    }
    
    res.json({
      success: true,
      data: holiday,
      message: 'Holiday updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/holidays/:id - Delete holiday
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const holiday = await Holiday.findByIdAndDelete(id);
    
    if (!holiday) {
      throw new AppError('Holiday not found', 404);
    }
    
    res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/holidays/fetch-external - Fetch and import holidays for a specific year
router.post('/fetch-external', async (req, res, next) => {
  try {
    const year = parseInt(req.body.year) || new Date().getFullYear();
    const { fetchHolidaysFromExternal } = await import('../services/holidayCrawlerService.js');
    const holidays = await fetchHolidaysFromExternal(year);
    
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const h of holidays) {
      // Find existing holiday on the same date (ignoring time)
      const startOfDay = new Date(h.date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(h.date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      
      const existing = await Holiday.findOne({
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      if (existing) {
        existing.description = h.description;
        existing.type = h.type;
        await existing.save();
        updatedCount++;
      } else {
        await Holiday.create({
          date: h.date,
          description: h.description,
          type: h.type
        });
        createdCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Holidays processed successfully for year ${year}`,
      data: {
        total: holidays.length,
        created: createdCount,
        updated: updatedCount
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;


