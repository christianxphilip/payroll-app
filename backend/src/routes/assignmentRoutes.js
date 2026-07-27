import express from 'express';
import Assignment from '../models/Assignment.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/assignments - Get all assignments
router.get('/', async (req, res, next) => {
  try {
    const { isActive } = req.query;
    
    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const assignments = await Assignment.find(query)
      .sort({ order: 1, label: 1 })
      .lean();
    
    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/assignments/:id - Get single assignment
router.get('/:id', async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }
    
    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/assignments - Create assignment
router.post('/', async (req, res, next) => {
  try {
    const { code, label, color, isActive, order } = req.body;
    
    if (!code || !label || !color) {
      throw new AppError('Code, label, and color are required', 400);
    }
    
    // Check if code already exists
    const existing = await Assignment.findOne({ code: code.toUpperCase() });
    if (existing) {
      throw new AppError('Assignment code already exists', 400);
    }
    
    const assignment = await Assignment.create({
      code: code.toUpperCase(),
      label,
      color,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0
    });
    
    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Assignment created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/assignments/:id - Update assignment
router.put('/:id', async (req, res, next) => {
  try {
    const { code, label, color, isActive, order } = req.body;
    
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }
    
    // If code is being changed, check for duplicates
    if (code && code.toUpperCase() !== assignment.code) {
      const existing = await Assignment.findOne({ code: code.toUpperCase() });
      if (existing) {
        throw new AppError('Assignment code already exists', 400);
      }
      assignment.code = code.toUpperCase();
    }
    
    if (label !== undefined) assignment.label = label;
    if (color !== undefined) assignment.color = color;
    if (isActive !== undefined) assignment.isActive = isActive;
    if (order !== undefined) assignment.order = order;
    
    await assignment.save();
    
    res.json({
      success: true,
      data: assignment,
      message: 'Assignment updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/assignments/:id - Delete assignment
router.delete('/:id', async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }
    
    await Assignment.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

