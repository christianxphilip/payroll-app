import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import { assertAdjustmentPeriodEditable } from '../services/adjustmentLockService.js';

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
    const { type, name, amount, frequency, appliesFrom, appliesTo, payRunId } = req.body;

    if (!type || !['ALLOWANCE', 'DEDUCTION'].includes(type)) {
      throw new AppError('type must be ALLOWANCE or DEDUCTION', 400);
    }
    if (!name || !name.trim()) {
      throw new AppError('name is required', 400);
    }
    if (amount === undefined || amount === null) {
      throw new AppError('amount is required', 400);
    }
    if (!frequency || !['HOURLY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME'].includes(frequency)) {
      throw new AppError('Invalid frequency', 400);
    }
    if (frequency === 'HOURLY' && type !== 'ALLOWANCE') {
      throw new AppError('Hourly frequency is available for allowances only', 400);
    }
    if (!appliesFrom) {
      throw new AppError('appliesFrom is required', 400);
    }

    if (payRunId) {
      const payRun = await PayRun.findById(payRunId);
      if (!payRun) throw new AppError('Pay run not found', 404);
      if (payRun.status !== 'DRAFT') {
        throw new AppError('Allowances and deductions can only be changed while the pay run is DRAFT', 400);
      }
      const entry = await PayRunEmployee.exists({ payRunId, employeeId });
      if (!entry) throw new AppError('Employee is not included in this pay run', 400);
    }

    await assertAdjustmentPeriodEditable({
      employeeId,
      appliesFrom: new Date(appliesFrom),
      appliesTo: appliesTo ? new Date(appliesTo) : null
    });

    const item = await AllowanceDeduction.create({
      employeeId,
      type,
      name: name.trim(),
      amount,
      frequency,
      appliesFrom,
      appliesTo: appliesTo || null,
      payRunId: payRunId || null
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
    const { payRunId: _ignoredPayRunId, ...updateData } = req.body;

    if (updateData.name && !updateData.name.trim()) {
      throw new AppError('name cannot be empty', 400);
    }
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }
    const existing = await AllowanceDeduction.findById(id);
    if (!existing) throw new AppError('Allowance/Deduction not found', 404);
    await assertAdjustmentPeriodEditable(existing);

    const nextType = updateData.type || existing.type;
    const nextFrequency = updateData.frequency || existing.frequency;
    if (nextFrequency === 'HOURLY' && nextType !== 'ALLOWANCE') {
      throw new AppError('Hourly frequency is available for allowances only', 400);
    }

    await assertAdjustmentPeriodEditable({
      employeeId: existing.employeeId,
      appliesFrom: updateData.appliesFrom || existing.appliesFrom,
      appliesTo: updateData.appliesTo === undefined ? existing.appliesTo : updateData.appliesTo
    });

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
    const item = await AllowanceDeduction.findById(id);
    if (!item) {
      throw new AppError('Allowance/Deduction not found', 404);
    }
    await assertAdjustmentPeriodEditable(item);
    await item.deleteOne();
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
