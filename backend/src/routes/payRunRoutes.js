import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import Timesheet from '../models/Timesheet.js';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import Employee from '../models/Employee.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';
import TimesheetLog from '../models/TimesheetLog.js';
import {
  computePayRunForPeriod,
  recomputePayRunFromEmployees
} from '../services/payrollCalculatorService.js';
import { sendPayslipEmail } from '../services/emailService.js';
import { generatePayslipHTML, getLogoPath } from '../templates/payslipTemplate.js';
import { generatePayrollFinancialReport, formatPayrollFinancialReportAsCSV } from '../services/payrollFinancialService.js';

const STANDARD_HOURS_PER_DAY = 8;
const OT_MULTIPLIER = 1.25;
const ND_MULTIPLIER = 0.1;

const router = express.Router();

// All pay run routes require authentication and admin access
router.use(authenticate);
router.use(authorize(['admin']));


// POST /api-pay-runs - Create a pay run from submitted timesheets
router.post('/', async (req, res, next) => {
  try {
    const { timesheetIds, payrollPeriodStart, payrollPeriodEnd, payoutDate } = req.body;

    if (!Array.isArray(timesheetIds) || timesheetIds.length === 0) {
      throw new AppError('timesheetIds array is required', 400);
    }

    // Load timesheets and ensure they are submitted
    const timesheets = await Timesheet.find({ _id: { $in: timesheetIds } });
    if (timesheets.length !== timesheetIds.length) {
      throw new AppError('One or more timesheets not found', 400);
    }

    const notSubmitted = timesheets.filter(t => t.status !== 'submitted');
    if (notSubmitted.length > 0) {
      throw new AppError('All timesheets must be submitted before creating a pay run', 400);
    }

    // Derive period if not explicitly provided
    const start =
      payrollPeriodStart ||
      new Date(Math.min(...timesheets.map(t => new Date(t.startDate).getTime())));
    const end =
      payrollPeriodEnd ||
      new Date(Math.max(...timesheets.map(t => new Date(t.endDate).getTime())));

    if (!payoutDate) {
      throw new AppError('payoutDate is required', 400);
    }

    const existing = await PayRun.findOne({
      payrollPeriodStart: start,
      payrollPeriodEnd: end
    });

    if (existing) {
      console.warn('[PayRun] Existing pay run found for the same period');
    }

    const payRun = await PayRun.create({
      payrollPeriodStart: start,
      payrollPeriodEnd: end,
      payoutDate: new Date(payoutDate),
      timesheetIds
    });

    // Compute payroll breakdown for this pay run
    const employees = await computePayRunForPeriod(payRun);

    res.status(201).json({
      success: true,
      data: payRun,
      employees,
      warning: existing ? 'A pay run for this period already exists.' : undefined
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/pay-runs - List pay runs
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const payRuns = await PayRun.find(query)
      .populate('timesheetIds', 'name startDate endDate')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: payRuns });
  } catch (error) {
    next(error);
  }
});

// GET /api/pay-runs/financial-report - Generate payroll financial report (compensation breakdown)
// Must be before /:id route to avoid route conflict
router.get('/financial-report', async (req, res, next) => {
  try {
    const { startDate, endDate, employeeName, includeSubmittedOnly, timesheetId, format } = req.query;
    
    console.log('[PayrollFinancialReport] Query params:', req.query);
    
    const filters = {
      startDate,
      endDate,
      employeeName,
      includeSubmittedOnly: includeSubmittedOnly === 'true',
      timesheetId
    };
    
    if (!filters.startDate || !filters.endDate) {
      throw new AppError('Start date and end date are required', 400);
    }
    
    console.log('[PayrollFinancialReport] Filters:', filters);
    
    const reportData = await generatePayrollFinancialReport(filters);
    
    console.log('[PayrollFinancialReport] Generated report:', {
      totalEmployees: reportData.summary.totalEmployees,
      totalRecords: reportData.summary.totalRecords,
      totalNetPay: reportData.summary.totalNetPay
    });
    
    // Return as CSV if requested
    if (format === 'csv') {
      const csv = formatPayrollFinancialReportAsCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=payroll-financial-report-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }
    
    // Return as JSON
    res.json({
      success: true,
      ...reportData
    });
  } catch (error) {
    console.error('[PayrollFinancialReport] Error:', error);
    next(error);
  }
});

// GET /api/pay-runs/:id - Pay run details with employee breakdown
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payRun = await PayRun.findById(id);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }
    const employees = await PayRunEmployee.find({ payRunId: id }).sort({
      employeeName: 1
    });
    res.json({ success: true, data: payRun, employees });
  } catch (error) {
    next(error);
  }
});

// POST /api/pay-runs/:id/email-payslips - Send payslips to all employees (only for PAID runs)
router.post('/:id/email-payslips', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payRun = await PayRun.findById(id);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }

    if (payRun.status !== 'PAID') {
      throw new AppError('Only PAID pay runs can send payslips by email', 400);
    }

    const employees = await PayRunEmployee.find({ payRunId: id }).lean();
    const employeeDocs = await Employee.find({
      _id: { $in: employees.map((e) => e.employeeId) },
      email: { $ne: null }
    }).lean();
    // Set status to SENDING and save
    payRun.emailStatus = 'SENDING';
    await payRun.save();

    // Return immediately
    res.status(202).json({
      success: true,
      message: 'Email sending started in the background.',
      status: 'SENDING'
    });

    // Process in background
    (async () => {
      try {
        const employees = await PayRunEmployee.find({ payRunId: id }).lean();
        const employeeDocs = await Employee.find({
          _id: { $in: employees.map((e) => e.employeeId) },
          email: { $ne: null }
        }).lean();

        const employeeById = {};
        employeeDocs.forEach((e) => {
          employeeById[e._id.toString()] = e;
        });

        const results = [];

        for (const entry of employees) {
          const employee = employeeById[entry.employeeId.toString()];
          if (!employee || !employee.email) {
            results.push({
              employeeId: entry.employeeId,
              email: employee ? employee.email : 'N/A',
              success: false,
              error: 'Employee email not found or employee not found'
            });
            continue;
          }

          const subject = `Payslip – ${employee.employeeName} – ${new Date(
            payRun.payrollPeriodStart
          ).toLocaleDateString()} to ${new Date(
            payRun.payrollPeriodEnd
          ).toLocaleDateString()}`;

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

          const timesheetLogs = await TimesheetLog.find({
            employeeName: entry.employeeName, // Use employeeName as per original code
            date: {
              $gte: payrollPeriodStart,
              $lte: payrollPeriodEnd
            },
            isSubmitted: true
          })
            .sort({ date: 1, timeIn: 1 })
            .lean();

          const html = generatePayslipHTML({
            payRun,
            entry,
            employee,
            adjustments,
            timesheetLogs
          });

          const result = await sendPayslipEmail({
            to: employee.email,
            subject,
            html,
            attachments: [
              {
                filename: 'logo.png',
                path: getLogoPath(),
                cid: 'payslip-logo'
              }
            ]
          });

          results.push({
            employeeId: employee._id,
            email: employee.email,
            success: result.success,
            error: result.error
          });
        }

        // Update status to COMPLETED
        payRun.emailStatus = 'COMPLETED';
        await payRun.save();
        console.log(`[PayRun] Bulk email completed for pay run ${payRun._id}. Results:`, results);
      } catch (error) {
        console.error(`[PayRun] Bulk email failed for pay run ${payRun._id}:`, error);
        payRun.emailStatus = 'FAILED';
        await payRun.save();
      }
    })();
  } catch (error) {
    next(error);
  }
});

// POST /api/pay-runs/:id/email-payslips/:entryId - Send payslip for a single employee (only for PAID runs)
router.post('/:id/email-payslips/:entryId', async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    const payRun = await PayRun.findById(id);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }

    if (payRun.status !== 'PAID') {
      throw new AppError('Only PAID pay runs can send payslips by email', 400);
    }

    const entry = await PayRunEmployee.findById(entryId);
    if (!entry || String(entry.payRunId) !== String(id)) {
      throw new AppError('Payslip entry not found for this pay run', 404);
    }

    const employee = await Employee.findById(entry.employeeId);
    if (!employee || !employee.email) {
      throw new AppError('Employee email not found', 400);
    }

    const subject = `Payslip – ${employee.employeeName} – ${new Date(
      payRun.payrollPeriodStart
    ).toLocaleDateString()} to ${new Date(
      payRun.payrollPeriodEnd
    ).toLocaleDateString()}`;

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

    const html = generatePayslipHTML({
      payRun,
      entry,
      employee,
      adjustments,
      timesheetLogs
    });

    const result = await sendPayslipEmail({
      to: employee.email,
      subject,
      html,
      attachments: [
        {
          filename: 'logo.png',
          path: getLogoPath(),
          cid: 'payslip-logo'
        }
      ]
    });

    res.json({
      success: result.success,
      recipient: {
        employeeId: employee._id,
        name: employee.employeeName,
        email: employee.email
      },
      error: result.error
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/pay-runs/:id/recalculate - Recompute payroll using existing hours but refreshed adjustments
router.post('/:id/recalculate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payRun = await PayRun.findById(id);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }

    // Recompute based on current PayRunEmployee hours (including overrides)
    const employees = await recomputePayRunFromEmployees(payRun);

    res.json({ success: true, data: payRun, employees });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/pay-runs/:id/status - Update pay run status (and record timestamps)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['DRAFT', 'APPROVED', 'PAID'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const payRun = await PayRun.findById(id);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }

    // Allow simple flow with ability to revert APPROVED -> DRAFT
    const allowedTransitions = {
      DRAFT: ['APPROVED'],
      APPROVED: ['DRAFT', 'PAID'],
      PAID: []
    };

    if (!allowedTransitions[payRun.status].includes(status)) {
      throw new AppError(`Cannot change status from ${payRun.status} to ${status}`, 400);
    }

    // Track when a pay run was approved/paid
    if (status === 'APPROVED' && payRun.status === 'DRAFT') {
      payRun.metadata = {
        ...(payRun.metadata || {}),
        approvedAt: new Date()
      };
    }
    if (status === 'PAID' && payRun.status === 'APPROVED') {
      payRun.metadata = {
        ...(payRun.metadata || {}),
        paidAt: new Date()
      };
    }
    payRun.status = status;
    await payRun.save();

    res.json({ success: true, data: payRun });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/pay-runs/employees/:id - Override hours for a single pay run employee
router.patch('/employees/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      totalHoursWorked,
      regularOvertimeHours,
      overtimeHours, // Keep for backward compatibility
      nightDiffHours,
      regularHolidayHours,
      specialHolidayHours
    } = req.body;

    const pre = await PayRunEmployee.findById(id);
    if (!pre) {
      throw new AppError('Pay run employee not found', 404);
    }

    if (totalHoursWorked !== undefined) pre.totalHoursWorked = totalHoursWorked;
    // Handle regularOvertimeHours (preferred) or overtimeHours (backward compatibility)
    if (regularOvertimeHours !== undefined) {
      pre.regularOvertimeHours = regularOvertimeHours;
      // Update total overtime hours to include holiday OT if they exist
      pre.overtimeHours = regularOvertimeHours + (pre.overtimeRegularHolidayHours || 0) + (pre.overtimeSpecialHolidayHours || 0);
    } else if (overtimeHours !== undefined) {
      // Backward compatibility: if only total OT is provided, assume it's all regular OT
      pre.overtimeHours = overtimeHours;
      pre.regularOvertimeHours = overtimeHours;
    }
    if (nightDiffHours !== undefined) pre.nightDiffHours = nightDiffHours;
    if (regularHolidayHours !== undefined)
      pre.regularHolidayHours = regularHolidayHours;
    if (specialHolidayHours !== undefined)
      pre.specialHolidayHours = specialHolidayHours;

    // Recompute pay using current overrides + latest adjustments
    const employee = await Employee.findById(pre.employeeId);
    if (!employee) {
      throw new AppError('Employee not found for pay run entry', 404);
    }

    const payRun = await PayRun.findById(pre.payRunId);
    if (!payRun) {
      throw new AppError('Parent pay run not found', 404);
    }

    const totalHrs = pre.totalHoursWorked || 0;
    const otHrs = pre.regularOvertimeHours || pre.overtimeHours || 0;
    const ndHrs = pre.nightDiffHours || 0;
    const regHolHrs = pre.regularHolidayHours || 0;
    const specHolHrs = pre.specialHolidayHours || 0;

    const hourlyRate =
      employee.wageType === 'DAILY'
        ? (employee.wageRate || 0) / STANDARD_HOURS_PER_DAY
        : employee.wageRate || 0;

    const basicSalary =
      employee.wageType === 'DAILY'
        ? (employee.wageRate || 0) * (totalHrs / STANDARD_HOURS_PER_DAY)
        : totalHrs * (hourlyRate || 0);

    const overtimePay = otHrs * (hourlyRate || 0) * OT_MULTIPLIER;
    const nightDiffPay = ndHrs * (hourlyRate || 0) * ND_MULTIPLIER;
    const regularHolidayPay = regHolHrs * (hourlyRate || 0) * 1.0;
    const specialHolidayPay = specHolHrs * (hourlyRate || 0) * 0.3;

    // Pull latest allowances/deductions for this employee in the pay run period
    const { payrollPeriodStart, payrollPeriodEnd } = payRun;
    const adjustments = await AllowanceDeduction.find({
      employeeId: pre.employeeId,
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
    }).lean();

    let allowancesTotal = 0;
    let deductionsTotal = 0;
    adjustments.forEach((adj) => {
      if (adj.type === 'ALLOWANCE') {
        allowancesTotal += adj.amount || 0;
      } else if (adj.type === 'DEDUCTION') {
        deductionsTotal += adj.amount || 0;
      }
    });

    // Get OT RH and OT SH hours and pay if they exist
    const otRHHours = pre.overtimeRegularHolidayHours || 0;
    const otSHHours = pre.overtimeSpecialHolidayHours || 0;
    
    // Get settings multipliers
    const Settings = (await import('../models/Settings.js')).default;
    const settings = await Settings.getSettings();
    
    // Calculate OT RH and OT SH pay (only for full-time employees)
    const otRHMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeRegularHolidayMultiplier : 1.0;
    const otSHMultiplier = employee.employmentType === 'FULL_TIME' ? settings.overtimeSpecialHolidayMultiplier : 1.0;
    const overtimeRegularHolidayPay = otRHHours * hourlyRate * otRHMultiplier;
    const overtimeSpecialHolidayPay = otSHHours * hourlyRate * otSHMultiplier;
    
    pre.basicSalary = basicSalary;
    pre.overtimePay = overtimePay;
    pre.overtimeRegularHolidayPay = overtimeRegularHolidayPay;
    pre.overtimeSpecialHolidayPay = overtimeSpecialHolidayPay;
    pre.nightDiffPay = nightDiffPay;
    pre.regularHolidayPay = regularHolidayPay;
    pre.specialHolidayPay = specialHolidayPay;
    pre.allowancesTotal = allowancesTotal;
    pre.deductionsTotal = deductionsTotal;
    pre.netSalary =
      basicSalary +
      overtimePay +
      overtimeRegularHolidayPay +
      overtimeSpecialHolidayPay +
      nightDiffPay +
      regularHolidayPay +
      specialHolidayPay +
      allowancesTotal -
      deductionsTotal;

    await pre.save();

    res.json({ success: true, data: pre });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/pay-runs/:id - Delete pay run and related employee breakdowns
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payRun = await PayRun.findById(id);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }

    if (payRun.status !== 'DRAFT') {
      throw new AppError('Only DRAFT pay runs can be deleted', 400);
    }

    await PayRunEmployee.deleteMany({ payRunId: id });
    await PayRun.findByIdAndDelete(id);

    res.json({ success: true, message: 'Pay run deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
