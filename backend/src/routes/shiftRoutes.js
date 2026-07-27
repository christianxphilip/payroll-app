import express from 'express';
import Shift from '../models/Shift.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/shifts - Get all shifts
router.get('/', async (req, res, next) => {
    try {
        const shifts = await Shift.find().sort({ name: 1 });
        res.json({
            success: true,
            data: shifts
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/shifts - Create a new shift
router.post('/', async (req, res, next) => {
    try {
        const shiftData = req.body;
        const shift = await Shift.create(shiftData);
        res.status(201).json({
            success: true,
            data: shift,
            message: 'Shift created successfully'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/shifts/:id - Update a shift
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const shift = await Shift.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        if (!shift) {
            throw new AppError('Shift not found', 404);
        }

        res.json({
            success: true,
            data: shift,
            message: 'Shift updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/shifts/:id - Delete a shift
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const shift = await Shift.findByIdAndDelete(id);

        if (!shift) {
            throw new AppError('Shift not found', 404);
        }

        res.json({
            success: true,
            message: 'Shift deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

export default router;
