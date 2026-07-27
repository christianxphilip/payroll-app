import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';

const router = express.Router();

// GET /api/employees/:employeeId/adjustments - List allowances/deductions for an employee
router.get('/employees/:employeeId/adjustments', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const items = await AllowanceDeduction.find({ employeeId }).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

// POST /api/employees/:employeeId/adjustments - Create allowance/deduction for an employee
router.post('/employees/:employeeId/adjustments', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { type, name, amount, frequency, appliesFrom, appliesTo } = req.body;

    if (!type || !['ALLOWANCE', 'DEDUCTION'].includes(type)) {
      throw new AppError('type must be ALLOWANCE or DEDUCTION', 400);
    }
    if (!name || !name.trim()) {
      throw new AppError('name is required', 400);
    }
    if (amount === undefined || amount === null) {
      throw new AppError('amount is required', 400);
    }
    if (!frequency || !['WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME'].includes(frequency)) {
      throw new AppError('Invalid frequency', 400);
    }
    if (!appliesFrom) {
      throw new AppError('appliesFrom is required', 400);
    }

    const item = await AllowanceDeduction.create({
      employeeId,
      type,
      name: name.trim(),
      amount,
      frequency,
      appliesFrom,
      appliesTo: appliesTo || null
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

// PUT /api/adjustments/:id - Update allowance/deduction
router.put('/adjustments/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.name && !updateData.name.trim()) {
      throw new AppError('name cannot be empty', 400);
    }
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }

    const item = await AllowanceDeduction.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new AppError('Allowance/Deduction not found', 404);
    }

    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/adjustments/:id - Delete allowance/deduction
router.delete('/adjustments/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await AllowanceDeduction.findByIdAndDelete(id);
    if (!item) {
      throw new AppError('Allowance/Deduction not found', 404);
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;


