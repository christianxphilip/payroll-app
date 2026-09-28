import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import PayrollAdjustment from '../models/PayrollAdjustment.js';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import Employee from '../models/Employee.js';
import TimesheetLog from '../models/TimesheetLog.js';
import Timesheet from '../models/Timesheet.js';
import Settings from '../models/Settings.js';
import { calculateActualDuration, calculateNDHours } from '../services/calculationService.js';
import {
  calculatePayrollAdjustment,
  syncPayRunEmployeeAdjustments
} from '../services/payrollAdjustmentService.js';

const router = express.Router();
router.use(authenticate);
router.use(authorize(['admin']));

router.get('/pay-runs/:payRunId/employees/:entryId/sources', async (req, res, next) => {
  try {
    const currentPayRun = await PayRun.findById(req.params.payRunId).lean();
    const entry = await PayRunEmployee.findById(req.params.entryId).lean();
    if (!currentPayRun || !entry || String(entry.payRunId) !== req.params.payRunId) {
      throw new AppError('Pay run employee not found', 404);
    }

    const historicalEntries = await PayRunEmployee.find({
      employeeId: entry.employeeId,
      payRunId: { $ne: currentPayRun._id }
    }).select('payRunId').lean();
    const historicalPayRunIds = historicalEntries.map((item) => item.payRunId);
    const payRuns = await PayRun.find({
      _id: { $in: historicalPayRunIds },
      payrollPeriodEnd: { $lt: currentPayRun.payrollPeriodStart },
      status: { $in: ['APPROVED', 'PAID'] }
    }).sort({ payrollPeriodEnd: -1 }).lean();

    const timesheetIds = [...new Set(payRuns.flatMap((item) => item.timesheetIds || []).map(String))];
    const [timesheets, logs] = await Promise.all([
      Timesheet.find({ _id: { $in: timesheetIds } }).sort({ endDate: -1 }).lean(),
      TimesheetLog.find({
        timesheetId: { $in: timesheetIds },
        employeeName: entry.employeeName,
        isSubmitted: true
      }).sort({ date: -1, timeIn: -1 }).lean()
    ]);

    res.json({ success: true, data: { payRuns, timesheets, logs } });
  } catch (error) {
    next(error);
  }
});

router.get('/pay-runs/:payRunId/employees/:entryId', async (req, res, next) => {
  try {
    const entry = await PayRunEmployee.findById(req.params.entryId);
    if (!entry || String(entry.payRunId) !== req.params.payRunId) {
      throw new AppError('Pay run employee not found', 404);
    }
    const adjustments = await PayrollAdjustment.find({
      includedPayRunId: req.params.payRunId,
      employeeId: entry.employeeId,
      status: { $ne: 'CANCELLED' }
    }).sort({ originalWorkDate: 1, createdAt: 1 });
    res.json({ success: true, data: adjustments });
  } catch (error) {
    next(error);
  }
});

router.post('/pay-runs/:payRunId/employees/:entryId', async (req, res, next) => {
  try {
    const payRun = await PayRun.findById(req.params.payRunId);
    if (!payRun) throw new AppError('Pay run not found', 404);
    if (payRun.status !== 'DRAFT') {
      throw new AppError('Prior-period adjustments can only be added to a DRAFT pay run', 400);
    }

    const entry = await PayRunEmployee.findById(req.params.entryId);
    if (!entry || String(entry.payRunId) !== req.params.payRunId) {
      throw new AppError('Pay run employee not found', 404);
    }
    const employee = await Employee.findById(entry.employeeId);
    if (!employee) throw new AppError('Employee not found', 404);

    const {
      type,
      correctionType,
      sourceTimesheetId,
      sourcePayRunId,
      sourceTimeLogId,
      originalWorkDate,
      correctedTimeIn,
      correctedTimeOut,
      breakMinutes = 0,
      regularHours = 0,
      overtimeHours = 0,
      nightDiffHours = 0,
      holidayType = 'NONE',
      approvedBy,
      approvedAt,
      approvalReference = '',
      reason
    } = req.body;

    if (!['PRIOR_PERIOD_OT', 'ATTENDANCE_CORRECTION'].includes(type)) {
      throw new AppError('Invalid adjustment type', 400);
    }
    if (!originalWorkDate || !approvedBy || !approvedAt || !reason) {
      throw new AppError('Work date, approver, approval date, and reason are required', 400);
    }
    if (type === 'PRIOR_PERIOD_OT' && Number(overtimeHours) <= 0) {
      throw new AppError('Approved overtime hours must be greater than zero', 400);
    }
    if (type === 'PRIOR_PERIOD_OT' && (!sourcePayRunId || !sourceTimesheetId || !sourceTimeLogId)) {
      throw new AppError('Source pay run, timesheet, and attendance log are required for prior-period OT', 400);
    }
    let sourceLog = null;
    if (sourceTimeLogId) {
      sourceLog = await TimesheetLog.findById(sourceTimeLogId);
      if (!sourceLog) throw new AppError('Source time log not found', 404);
      if (sourceLog.employeeName !== entry.employeeName) {
        throw new AppError('Source time log does not belong to this employee', 400);
      }
      if (sourceTimesheetId && String(sourceLog.timesheetId) !== String(sourceTimesheetId)) {
        throw new AppError('Source time log does not belong to the selected timesheet', 400);
      }
      const duplicate = await PayrollAdjustment.findOne({
        sourceTimeLogId,
        type,
        status: { $in: ['APPROVED_UNPAID', 'INCLUDED_IN_PAYRUN', 'PAID'] }
      });
      if (duplicate) {
        throw new AppError('An active payroll adjustment already exists for this time log', 409);
      }
    }

    let hourlyRate = entry.breakdown?.hourlyRate || 0;
    if (sourcePayRunId) {
      const historicalEntry = await PayRunEmployee.findOne({
        payRunId: sourcePayRunId,
        employeeId: entry.employeeId
      }).lean();
      hourlyRate = historicalEntry?.breakdown?.hourlyRate || hourlyRate;
    }
    if (!hourlyRate) {
      hourlyRate = employee.wageType === 'DAILY' ? (employee.wageRate || 0) / 8 : employee.wageRate || 0;
    }

    const settings = await Settings.getSettings();
    const normalizedHolidayType = String(holidayType || 'NONE').toUpperCase();
    const overtimeMultiplier = normalizedHolidayType === 'REGULAR'
      ? settings.overtimeRegularHolidayMultiplier
      : normalizedHolidayType === 'SPECIAL'
        ? settings.overtimeSpecialHolidayMultiplier
        : settings.overtimeMultiplier;
    const holidayMultiplier = normalizedHolidayType === 'REGULAR'
      ? settings.regularHolidayMultiplier
      : normalizedHolidayType === 'SPECIAL'
        ? settings.specialHolidayMultiplier
        : 0;

    let approvedRegularHours = type === 'PRIOR_PERIOD_OT' ? 0 : Number(regularHours) || 0;
    let approvedOvertimeHours = Number(overtimeHours) || 0;
    let approvedNightDiffHours = Number(nightDiffHours) || 0;

    if (type === 'ATTENDANCE_CORRECTION') {
      if (!correctedTimeIn || !correctedTimeOut) {
        throw new AppError('Corrected time-in and time-out are required for attendance corrections', 400);
      }
      const duration = calculateActualDuration(correctedTimeIn, correctedTimeOut);
      const correctedHours = Math.max(0, duration - (Number(breakMinutes) || 0) / 60);
      const correctedRegularHours = Math.min(correctedHours, 8);
      const correctedOvertimeHours = Math.max(0, correctedHours - 8);
      const correctedNightHours = calculateNDHours(correctedTimeIn, correctedTimeOut);
      const previouslyApprovedHours = Number(sourceLog?.adjustedHoursWorked || 0);

      approvedRegularHours = Math.max(0, correctedRegularHours - Math.min(previouslyApprovedHours, 8));
      approvedOvertimeHours = Math.max(0, correctedOvertimeHours - Math.max(0, previouslyApprovedHours - 8));
      approvedNightDiffHours = Math.max(0, correctedNightHours - Number(sourceLog?.ndHours || 0));
    }

    if (approvedRegularHours + approvedOvertimeHours + approvedNightDiffHours <= 0) {
      throw new AppError('The correction does not add any payable hours', 400);
    }
    const amounts = calculatePayrollAdjustment({
      hourlyRate,
      regularHours: approvedRegularHours,
      overtimeHours: approvedOvertimeHours,
      nightDiffHours: approvedNightDiffHours,
      overtimeMultiplier: employee.employmentType === 'FULL_TIME' ? overtimeMultiplier : 1,
      nightDiffMultiplier: settings.nightDifferentialMultiplier,
      holidayMultiplier
    });

    const adjustment = await PayrollAdjustment.create({
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      type,
      correctionType,
      sourceTimesheetId: sourceTimesheetId || sourceLog?.timesheetId || null,
      sourcePayRunId: sourcePayRunId || null,
      sourceTimeLogId: sourceTimeLogId || null,
      includedPayRunId: payRun._id,
      originalWorkDate,
      correctedTimeIn: correctedTimeIn || null,
      correctedTimeOut: correctedTimeOut || null,
      breakMinutes: Number(breakMinutes) || 0,
      regularHours: approvedRegularHours,
      overtimeHours: approvedOvertimeHours,
      nightDiffHours: approvedNightDiffHours,
      holidayType: normalizedHolidayType,
      hourlyRate,
      overtimeMultiplier: employee.employmentType === 'FULL_TIME' ? overtimeMultiplier : 1,
      nightDiffMultiplier: settings.nightDifferentialMultiplier,
      holidayMultiplier,
      ...amounts,
      reason,
      approvedBy,
      approvedAt,
      approvalReference,
      createdBy: req.user?.username || req.user?.employeeName || ''
    });

    const updatedEntry = await syncPayRunEmployeeAdjustments(entry._id);
    res.status(201).json({ success: true, data: adjustment, employee: updatedEntry });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const adjustment = await PayrollAdjustment.findById(req.params.id);
    if (!adjustment) throw new AppError('Payroll adjustment not found', 404);
    const payRun = await PayRun.findById(adjustment.includedPayRunId);
    if (!payRun || payRun.status !== 'DRAFT') {
      throw new AppError('Only adjustments in a DRAFT pay run can be removed', 400);
    }
    adjustment.status = 'CANCELLED';
    await adjustment.save();
    const entry = await PayRunEmployee.findOne({
      payRunId: payRun._id,
      employeeId: adjustment.employeeId
    });
    const updatedEntry = entry ? await syncPayRunEmployeeAdjustments(entry._id) : null;
    res.json({ success: true, data: adjustment, employee: updatedEntry });
  } catch (error) {
    next(error);
  }
});

export default router;
