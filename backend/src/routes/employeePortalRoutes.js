import express from 'express';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import TimesheetLog from '../models/TimesheetLog.js';
import Employee from '../models/Employee.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All employee portal routes require authentication
router.use(authenticate);

// Helper to resolve current logged-in employee name/id
async function resolveEmployee(req) {
  let employeeId = req.user.employeeId;
  let employeeName = req.user.employeeName;

  if (!employeeName && req.user.username) {
    const emp = await Employee.findOne({ username: req.user.username });
    if (emp) {
      employeeId = emp._id;
      employeeName = emp.employeeName;
    }
  }

  if (!employeeName) {
    throw new AppError('Employee profile not found', 404);
  }

  return { employeeId, employeeName };
}

// GET /api/employee-portal/payslips - List all PAID pay runs for current employee
router.get('/payslips', async (req, res, next) => {
  try {
    const { employeeId, employeeName } = await resolveEmployee(req);

    // Find all paid pay runs
    const paidPayRuns = await PayRun.find({ status: 'PAID' }).sort({ payPeriodEnd: -1 });

    const payRunIds = paidPayRuns.map(pr => pr._id);

    // Find PayRunEmployee entries for this employee in paid pay runs
    const entries = await PayRunEmployee.find({
      payRunId: { $in: payRunIds },
      $or: [
        { employeeId: employeeId },
        { employeeName: employeeName }
      ]
    });

    const entryMap = new Map();
    entries.forEach(entry => {
      entryMap.set(entry.payRunId.toString(), entry);
    });

    const result = paidPayRuns
      .filter(pr => entryMap.has(pr._id.toString()))
      .map(pr => {
        const entry = entryMap.get(pr._id.toString());
        return {
          payRunId: pr._id,
          payPeriodStart: pr.payPeriodStart,
          payPeriodEnd: pr.payPeriodEnd,
          paymentDate: pr.paymentDate,
          payrollType: pr.payrollType,
          status: pr.status,
          entryId: entry._id,
          employeeName: entry.employeeName,
          basicPay: entry.basicPay,
          overtimePay: entry.overtimePay,
          ndPay: entry.ndPay,
          grossSalary: entry.grossSalary,
          totalDeductions: entry.totalDeductions,
          netSalary: entry.netSalary
        };
      });

    res.json({
      success: true,
      data: result,
      employeeName
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employee-portal/payslips/:payRunId - Detailed payslip view for employee
router.get('/payslips/:payRunId', async (req, res, next) => {
  try {
    const { payRunId } = req.params;
    const { employeeId, employeeName } = await resolveEmployee(req);

    // Verify pay run exists and is PAID
    const payRun = await PayRun.findById(payRunId);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }
    if (payRun.status !== 'PAID') {
      throw new AppError('Access denied: Only paid payslips can be viewed', 403);
    }

    // Find employee's entry
    const entry = await PayRunEmployee.findOne({
      payRunId: payRun._id,
      $or: [
        { employeeId: employeeId },
        { employeeName: employeeName }
      ]
    });

    if (!entry) {
      throw new AppError('Payslip entry not found for this pay period', 404);
    }

    // Fetch timesheet logs for detailed breakdown
    const timesheetLogs = await TimesheetLog.find({
      employeeName: entry.employeeName,
      date: {
        $gte: new Date(payRun.payPeriodStart),
        $lte: new Date(payRun.payPeriodEnd)
      }
    }).sort({ date: 1 });

    res.json({
      success: true,
      data: {
        payRun: {
          _id: payRun._id,
          payPeriodStart: payRun.payPeriodStart,
          payPeriodEnd: payRun.payPeriodEnd,
          paymentDate: payRun.paymentDate,
          payrollType: payRun.payrollType,
          status: payRun.status
        },
        entry,
        timesheetLogs
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
