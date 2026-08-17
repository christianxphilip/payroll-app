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

const escapeRegex = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to resolve current logged-in employee name/id
async function resolveEmployee(req) {
  let employee = null;

  if (req.user.employeeId) {
    employee = await Employee.findById(req.user.employeeId);
  }

  if (!employee && req.user.username) {
    const cleanUsername = req.user.username.trim().toLowerCase();
    employee = await Employee.findOne({
      $or: [
        { username: cleanUsername },
        { username: { $regex: '^' + escapeRegex(cleanUsername) + '$', $options: 'i' } }
      ]
    });
  }

  if (!employee && req.user.employeeName) {
    employee = await Employee.findOne({
      employeeName: { $regex: '^' + escapeRegex(req.user.employeeName) + '$', $options: 'i' }
    });
  }

  if (!employee) {
    throw new AppError(`Employee profile not found for account "${req.user.username || 'unknown'}".`, 404);
  }

  return { employeeId: employee._id, employeeName: employee.employeeName };
}

// GET /api/employee-portal/payslips - List all PAID pay runs for current employee
router.get('/payslips', async (req, res, next) => {
  try {
    const { employeeId, employeeName } = await resolveEmployee(req);

    // Find all paid pay runs
    const paidPayRuns = await PayRun.find({ status: 'PAID' }).sort({ payPeriodEnd: -1 });
    const payRunIds = paidPayRuns.map(pr => pr._id);

    const nameRegex = new RegExp('^' + escapeRegex(employeeName) + '$', 'i');
    const searchConditions = [{ employeeName: nameRegex }];
    if (employeeId) {
      searchConditions.push({ employeeId: employeeId });
    }

    // Find PayRunEmployee entries for this employee in paid pay runs
    const entries = await PayRunEmployee.find({
      payRunId: { $in: payRunIds },
      $or: searchConditions
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

    const nameRegex = new RegExp('^' + escapeRegex(employeeName) + '$', 'i');
    const searchConditions = [{ employeeName: nameRegex }];
    if (employeeId) {
      searchConditions.push({ employeeId: employeeId });
    }

    // Find employee's entry
    const entry = await PayRunEmployee.findOne({
      payRunId: payRun._id,
      $or: searchConditions
    });

    if (!entry) {
      throw new AppError('Payslip entry not found for this pay period', 404);
    }

    // Fetch timesheet logs for detailed breakdown
    const timesheetLogs = await TimesheetLog.find({
      employeeName: { $regex: '^' + escapeRegex(entry.employeeName) + '$', $options: 'i' },
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
