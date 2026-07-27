import express from 'express';
import Settings from '../models/Settings.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(authorize(['admin']));


// GET /api/settings - Get current settings
router.get('/', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res, next) => {
  try {
    const {
      overtimeMultiplier,
      nightDifferentialMultiplier,
      regularHolidayMultiplier,
      specialHolidayMultiplier,
      overtimeRegularHolidayMultiplier,
      overtimeSpecialHolidayMultiplier
    } = req.body;

    // Validate multipliers
    if (overtimeMultiplier !== undefined && (overtimeMultiplier < 0 || typeof overtimeMultiplier !== 'number')) {
      throw new AppError('Overtime multiplier must be a non-negative number', 400);
    }
    if (nightDifferentialMultiplier !== undefined && (nightDifferentialMultiplier < 0 || typeof nightDifferentialMultiplier !== 'number')) {
      throw new AppError('Night differential multiplier must be a non-negative number', 400);
    }
    if (regularHolidayMultiplier !== undefined && (regularHolidayMultiplier < 0 || typeof regularHolidayMultiplier !== 'number')) {
      throw new AppError('Regular holiday multiplier must be a non-negative number', 400);
    }
    if (specialHolidayMultiplier !== undefined && (specialHolidayMultiplier < 0 || typeof specialHolidayMultiplier !== 'number')) {
      throw new AppError('Special holiday multiplier must be a non-negative number', 400);
    }
    if (overtimeRegularHolidayMultiplier !== undefined && (overtimeRegularHolidayMultiplier < 0 || typeof overtimeRegularHolidayMultiplier !== 'number')) {
      throw new AppError('Overtime regular holiday multiplier must be a non-negative number', 400);
    }
    if (overtimeSpecialHolidayMultiplier !== undefined && (overtimeSpecialHolidayMultiplier < 0 || typeof overtimeSpecialHolidayMultiplier !== 'number')) {
      throw new AppError('Overtime special holiday multiplier must be a non-negative number', 400);
    }

    // Get or create settings document
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    // Update fields if provided
    if (overtimeMultiplier !== undefined) {
      settings.overtimeMultiplier = overtimeMultiplier;
    }
    if (nightDifferentialMultiplier !== undefined) {
      settings.nightDifferentialMultiplier = nightDifferentialMultiplier;
    }
    if (regularHolidayMultiplier !== undefined) {
      settings.regularHolidayMultiplier = regularHolidayMultiplier;
    }
    if (specialHolidayMultiplier !== undefined) {
      settings.specialHolidayMultiplier = specialHolidayMultiplier;
    }
    if (overtimeRegularHolidayMultiplier !== undefined) {
      settings.overtimeRegularHolidayMultiplier = overtimeRegularHolidayMultiplier;
    }
    if (overtimeSpecialHolidayMultiplier !== undefined) {
      settings.overtimeSpecialHolidayMultiplier = overtimeSpecialHolidayMultiplier;
    }

    await settings.save();

    res.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

