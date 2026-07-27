import express from 'express';
import ShiftAllocation from '../models/ShiftAllocation.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

// GET /api/shift-allocations - Get all allocations
router.get('/', async (req, res, next) => {
    try {
        const allocations = await ShiftAllocation.find().populate('shiftId');
        res.json({
            success: true,
            data: allocations
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/shift-allocations - Upsert allocations
router.post('/', async (req, res, next) => {
    try {
        const { allocations } = req.body; // Expect array of { dayOfWeek, shiftId, requiredCount }

        if (!Array.isArray(allocations)) {
            return res.status(400).json({ error: 'Allocations must be an array' });
        }

        const results = [];
        for (const alloc of allocations) {
            const { dayOfWeek, shiftId, requiredCount } = alloc;

            const result = await ShiftAllocation.findOneAndUpdate(
                { dayOfWeek, shiftId },
                { requiredCount },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            results.push(result);
        }

        res.json({
            success: true,
            data: results,
            message: 'Shift allocations updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

export default router;
