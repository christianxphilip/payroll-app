import express from 'express';
import Availability from '../models/Availability.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/availability - Get availability
router.get('/', async (req, res, next) => {
    try {
        const { employeeName, startDate, endDate } = req.query;
        let query = {};

        if (employeeName) {
            query.employeeName = employeeName;
        }

        // For calendar view, we might want to fetch all availability that overlaps with the current week
        // This is a bit complex due to different types (WEEKLY, MONTHLY, etc.)
        // For now, let's just return all and filter on the frontend, or add basic date filtering

        const availability = await Availability.find(query).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: availability
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/availability - Create availability
router.post('/', async (req, res, next) => {
    try {
        const availabilityData = req.body;
        const availability = await Availability.create(availabilityData);
        res.status(201).json({
            success: true,
            data: availability,
            message: 'Availability created successfully'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/availability/:id - Update availability
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const availability = await Availability.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        if (!availability) {
            throw new AppError('Availability not found', 404);
        }

        res.json({
            success: true,
            data: availability,
            message: 'Availability updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/availability/:id - Delete availability
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const availability = await Availability.findByIdAndDelete(id);

        if (!availability) {
            throw new AppError('Availability not found', 404);
        }

        res.json({
            success: true,
            message: 'Availability deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

export default router;
