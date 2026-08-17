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
    const paidPayRuns = await PayRun.find({ status: 'PAID' }).sort({ payrollPeriodEnd: -1, createdAt: -1 });
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
        const start = pr.payrollPeriodStart || pr.payPeriodStart;
        const end = pr.payrollPeriodEnd || pr.payPeriodEnd;
        const payout = pr.payoutDate || pr.paymentDate;

        const basicSalary = entry.basicSalary !== undefined ? entry.basicSalary : (entry.basicPay || 0);
        const overtimePay = entry.overtimePay || 0;
        const nightDiffPay = entry.nightDiffPay !== undefined ? entry.nightDiffPay : (entry.ndPay || 0);
        const regularHolidayPay = entry.regularHolidayPay || 0;
        const specialHolidayPay = entry.specialHolidayPay || 0;
        const overtimeRegularHolidayPay = entry.overtimeRegularHolidayPay || 0;
        const overtimeSpecialHolidayPay = entry.overtimeSpecialHolidayPay || 0;
        const allowancesTotal = entry.allowancesTotal !== undefined ? entry.allowancesTotal : (entry.allowances || 0);
        const deductionsTotal = entry.deductionsTotal !== undefined ? entry.deductionsTotal : (entry.totalDeductions || 0);

        const calculatedGross = basicSalary + overtimePay + nightDiffPay + regularHolidayPay + specialHolidayPay + overtimeRegularHolidayPay + overtimeSpecialHolidayPay + allowancesTotal;
        const grossSalary = (entry.grossSalary && entry.grossSalary > 0) ? entry.grossSalary : calculatedGross;
        const netSalary = entry.netSalary || (grossSalary - deductionsTotal);

        return {
          payRunId: pr._id,
          payPeriodStart: start,
          payPeriodEnd: end,
          payrollPeriodStart: start,
          payrollPeriodEnd: end,
          paymentDate: payout,
          payoutDate: payout,
          payrollType: pr.payrollType,
          status: pr.status,
          entryId: entry._id,
          employeeName: entry.employeeName,
          basicPay: basicSalary,
          overtimePay,
          ndPay: nightDiffPay,
          grossSalary,
          totalDeductions: deductionsTotal,
          netSalary
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

    // Fetch Employee profile to populate wageRate, wageType, position, employmentType
    const empDoc = (entry.employeeId ? await Employee.findById(entry.employeeId) : null) || await Employee.findOne({
      employeeName: { $regex: '^' + escapeRegex(entry.employeeName) + '$', $options: 'i' }
    });

    const start = payRun.payrollPeriodStart || payRun.payPeriodStart;
    const end = payRun.payrollPeriodEnd || payRun.payPeriodEnd;
    const payout = payRun.payoutDate || payRun.paymentDate;

    let timesheetLogs = [];
    if (start && end && !isNaN(new Date(start).getTime()) && !isNaN(new Date(end).getTime())) {
      timesheetLogs = await TimesheetLog.find({
        employeeName: { $regex: '^' + escapeRegex(entry.employeeName) + '$', $options: 'i' },
        date: {
          $gte: new Date(start),
          $lte: new Date(end)
        }
      }).sort({ date: 1 });
    }

    const basicSalary = entry.basicSalary !== undefined ? entry.basicSalary : (entry.basicPay || 0);
    const overtimeHours = entry.overtimeHours || entry.regularOvertimeHours || 0;
    const overtimePay = entry.overtimePay || 0;
    const nightDiffHours = entry.nightDiffHours || entry.ndHours || 0;
    const nightDiffPay = entry.nightDiffPay !== undefined ? entry.nightDiffPay : (entry.ndPay || 0);
    const regularHolidayPay = entry.regularHolidayPay || 0;
    const specialHolidayPay = entry.specialHolidayPay || 0;
    const overtimeRegularHolidayPay = entry.overtimeRegularHolidayPay || 0;
    const overtimeSpecialHolidayPay = entry.overtimeSpecialHolidayPay || 0;
    const allowancesTotal = entry.allowancesTotal !== undefined ? entry.allowancesTotal : (entry.allowances || 0);
    const deductionsTotal = entry.deductionsTotal !== undefined ? entry.deductionsTotal : (entry.totalDeductions || 0);

    const calculatedGross = basicSalary + overtimePay + nightDiffPay + regularHolidayPay + specialHolidayPay + overtimeRegularHolidayPay + overtimeSpecialHolidayPay + allowancesTotal;
    const grossSalary = (entry.grossSalary && entry.grossSalary > 0) ? entry.grossSalary : calculatedGross;
    const netSalary = entry.netSalary || (grossSalary - deductionsTotal);

    // Dynamic SSS, PhilHealth, Pag-IBIG deduction breakdown if present in breakdown object
    const sssContribution = entry.breakdown?.sssDeduction || entry.sssContribution || 0;
    const philhealthContribution = entry.breakdown?.philhealthDeduction || entry.philhealthContribution || 0;
    const pagibigContribution = entry.breakdown?.pagibigDeduction || entry.pagibigContribution || 0;
    const withholdingTax = entry.breakdown?.withholdingTax || entry.withholdingTax || 0;

    const mergedEntry = {
      ...entry.toObject(),
      wageRate: empDoc?.wageRate || entry.wageRate || 0,
      wageType: empDoc?.wageType || entry.wageType || 'HOURLY',
      position: empDoc?.position || entry.position || 'Staff',
      employmentType: empDoc?.employmentType || entry.employmentType || 'FULL_TIME',
      basicSalary,
      basicPay: basicSalary,
      overtimeHours,
      regularOvertimeHours: overtimeHours,
      overtimePay,
      nightDiffHours,
      ndHours: nightDiffHours,
      nightDiffPay,
      ndPay: nightDiffPay,
      regularHolidayPay,
      specialHolidayPay,
      allowancesTotal,
      allowances: allowancesTotal,
      deductionsTotal,
      totalDeductions: deductionsTotal,
      grossSalary,
      netSalary,
      sssContribution,
      philhealthContribution,
      pagibigContribution,
      withholdingTax
    };

    res.json({
      success: true,
      data: {
        payRun: {
          _id: payRun._id,
          payPeriodStart: start,
          payPeriodEnd: end,
          payrollPeriodStart: start,
          payrollPeriodEnd: end,
          paymentDate: payout,
          payoutDate: payout,
          payrollType: payRun.payrollType,
          status: payRun.status
        },
        entry: mergedEntry,
        timesheetLogs
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
