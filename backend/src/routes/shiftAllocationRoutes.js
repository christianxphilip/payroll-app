import express from 'express';
import ShiftAllocation from '../models/ShiftAllocation.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
    if (req.user.role === 'admin' || req.user.managerScope) return next();
    return res.status(403).json({ error: 'Shift allocations are limited to administrators and Scheduling Leads' });
});

// GET /api/shift-allocations - Get all allocations
router.get('/', async (req, res, next) => {
    try {
        const allocations = await ShiftAllocation.find().populate('shiftId');
        const departments = req.user.managerScope
            ? [req.user.managerScope]
            : ['bar', 'kitchen'];
        const departmentAllocations = allocations.flatMap((allocation) => departments.map((department) => {
            const record = allocation.toObject();
            const departmentCount = department === 'bar' ? record.barRequiredCount : record.kitchenRequiredCount;
            return {
                ...record,
                department,
                requiredCount: departmentCount ?? record.requiredCount ?? 0
            };
        }));
        res.json({
            success: true,
            data: departmentAllocations
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/shift-allocations - Upsert allocations
router.post('/', authorize(['admin']), async (req, res, next) => {
    try {
        const { allocations } = req.body; // Expect array of { dayOfWeek, shiftId, requiredCount }

        if (!Array.isArray(allocations)) {
            return res.status(400).json({ error: 'Allocations must be an array' });
        }

        const results = [];
        for (const alloc of allocations) {
            const { dayOfWeek, shiftId, requiredCount } = alloc;
            const requestedDepartment = String(alloc.department || '').toLowerCase();
            const department = requestedDepartment;
            if (!['bar', 'kitchen'].includes(department)) {
                return res.status(400).json({ error: 'Department must be bar or kitchen' });
            }
            const countField = department === 'bar' ? 'barRequiredCount' : 'kitchenRequiredCount';

            const result = await ShiftAllocation.findOneAndUpdate(
                { dayOfWeek, shiftId },
                { $set: { [countField]: requiredCount }, $setOnInsert: { requiredCount: 0 } },
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
