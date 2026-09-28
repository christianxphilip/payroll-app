import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import Employee from '../models/Employee.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';
import PayrollAdjustment from '../models/PayrollAdjustment.js';
import { getPayRunTimesheetLogs } from '../services/payslipTimesheetService.js';

const router = express.Router();

// GET /api/pay-runs/:payRunId/payslips/:entryId
router.get('/pay-runs/:payRunId/payslips/:entryId', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { payRunId, entryId } = req.params;

    const payRun = await PayRun.findById(payRunId);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }

    const entry = await PayRunEmployee.findById(entryId);
    if (!entry || String(entry.payRunId) !== String(payRunId)) {
      throw new AppError('Payslip entry not found for this pay run', 404);
    }

    const employee = await Employee.findById(entry.employeeId);

    // Pull allowances/deductions that apply within this pay run period
    const { payrollPeriodStart, payrollPeriodEnd } = payRun;
    const adjustments = await AllowanceDeduction.find({
      employeeId: entry.employeeId,
      $or: [
        {
          appliesFrom: { $lte: payrollPeriodEnd },
          appliesTo: { $gte: payrollPeriodStart }
        },
        {
          appliesFrom: { $lte: payrollPeriodEnd },
          appliesTo: null
        }
      ]
    }).sort({ appliesFrom: 1 });

    const timesheetLogs = await getPayRunTimesheetLogs(payRun, entry.employeeName);

    const payrollAdjustments = await PayrollAdjustment.find({
      includedPayRunId: payRun._id,
      employeeId: entry.employeeId,
      status: { $in: ['INCLUDED_IN_PAYRUN', 'PAID'] }
    }).sort({ originalWorkDate: 1, createdAt: 1 }).lean();

    res.json({
      success: true,
      data: {
        payRun,
        entry,
        employee,
        adjustments,
        payrollAdjustments,
        timesheetLogs
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
