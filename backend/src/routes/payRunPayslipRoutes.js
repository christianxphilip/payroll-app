import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import Employee from '../models/Employee.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';
import TimesheetLog from '../models/TimesheetLog.js';

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

    // Pull timesheet logs for this employee in the pay run period
    const timesheetLogs = await TimesheetLog.find({
      employeeName: entry.employeeName,
      date: {
        $gte: payrollPeriodStart,
        $lte: payrollPeriodEnd
      },
      isSubmitted: true
    })
      .sort({ date: 1, timeIn: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        payRun,
        entry,
        employee,
        adjustments,
        timesheetLogs
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;


