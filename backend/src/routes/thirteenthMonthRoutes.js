import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import PayRun from '../models/PayRun.js';
import Employee from '../models/Employee.js';
import ThirteenthMonthRun from '../models/ThirteenthMonthRun.js';
import ThirteenthMonthEmployee from '../models/ThirteenthMonthEmployee.js';
import {
  attachThirteenthMonthToPayRun,
  calculateThirteenthMonthRun,
  detachThirteenthMonthFromPayRun
} from '../services/thirteenthMonthService.js';

const router = express.Router();
router.use(authenticate, authorize(['admin']));

const actorName = user => user?.username || user?.employeeName || 'admin';
const dateOnly = value => new Date(`${value}T00:00:00.000Z`);

const validateDates = ({ coverageStart, coverageEnd, actualCutoff, payoutDate }) => {
  if (!coverageStart || !coverageEnd || !actualCutoff || !payoutDate) {
    throw new AppError('Coverage start, coverage end, actual cutoff, and payout date are required', 400);
  }
  const start = dateOnly(coverageStart);
  const end = dateOnly(coverageEnd);
  const cutoff = dateOnly(actualCutoff);
  if ([start, end, cutoff].some(date => Number.isNaN(date.getTime()))) throw new AppError('Invalid date range', 400);
  if (start > end) throw new AppError('Coverage start must be before coverage end', 400);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) throw new AppError('Coverage must stay within one calendar year', 400);
  if (cutoff < start || cutoff > end) throw new AppError('Actual attendance cutoff must be within the coverage range', 400);
  const payout = dateOnly(payoutDate);
  if (cutoff > payout) throw new AppError('Actual attendance cutoff cannot be after the payout date', 400);
  const paymentDeadline = new Date(Date.UTC(end.getUTCFullYear(), 11, 24, 23, 59, 59, 999));
  if (payout > paymentDeadline) throw new AppError('13th-month payout must be scheduled no later than December 24', 400);
  return { start, end, cutoff, payout };
};

const detailResponse = async run => {
  const entries = await ThirteenthMonthEmployee.find({ runId: run._id }).sort({ employeeName: 1 }).lean();
  const totals = entries.reduce((result, entry) => ({
    actualBasicSalary: result.actualBasicSalary + entry.actualBasicSalary,
    projectedBasicSalary: result.projectedBasicSalary + entry.projectedBasicSalary,
    manualAdjustment: result.manualAdjustment + entry.manualAdjustment,
    eligibleBasicSalary: result.eligibleBasicSalary + entry.eligibleBasicSalary,
    thirteenthMonthPay: result.thirteenthMonthPay + entry.thirteenthMonthPay,
    paidAmount: result.paidAmount + entry.paidAmount
  }), { actualBasicSalary: 0, projectedBasicSalary: 0, manualAdjustment: 0, eligibleBasicSalary: 0, thirteenthMonthPay: 0, paidAmount: 0 });
  return { run, entries, totals };
};

router.get('/', async (_req, res, next) => {
  try {
    const runs = await ThirteenthMonthRun.find().populate('attachedPayRunId', 'payrollPeriodStart payrollPeriodEnd payoutDate status').sort({ createdAt: -1 }).lean();
    const result = await Promise.all(runs.map(async run => {
      const entries = await ThirteenthMonthEmployee.find({ runId: run._id }, 'thirteenthMonthPay paidAmount').lean();
      return {
        ...run,
        employeeCount: entries.length,
        totalAmount: entries.reduce((sum, entry) => sum + entry.thirteenthMonthPay, 0),
        paidAmount: entries.reduce((sum, entry) => sum + entry.paidAmount, 0)
      };
    }));
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.get('/draft-pay-runs', async (_req, res, next) => {
  try {
    const alreadyAttached = await ThirteenthMonthRun.find({ attachedPayRunId: { $ne: null } }).distinct('attachedPayRunId');
    const runs = await PayRun.find({ status: 'DRAFT', _id: { $nin: alreadyAttached } }).sort({ payoutDate: 1 }).lean();
    res.json({ success: true, data: runs });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { coverageStart, coverageEnd, actualCutoff, payoutDate, paymentMethod, attachedPayRunId } = req.body;
    const dates = validateDates({ coverageStart, coverageEnd, actualCutoff, payoutDate });
    if (!['PAY_RUN', 'SEPARATE'].includes(paymentMethod)) throw new AppError('Choose a valid payment method', 400);
    if (paymentMethod === 'PAY_RUN') {
      if (!attachedPayRunId) throw new AppError('Select a Draft pay run', 400);
      const payRun = await PayRun.findById(attachedPayRunId);
      if (!payRun || payRun.status !== 'DRAFT') throw new AppError('Selected pay run must be Draft', 400);
      const attachedPayout = new Date(payRun.payoutDate);
      const deadline = new Date(Date.UTC(dates.end.getUTCFullYear(), 11, 24, 23, 59, 59, 999));
      if (attachedPayout > deadline) throw new AppError('The selected pay run pays out after the December 24 deadline', 400);
      dates.payout = attachedPayout;
      const existingAttachment = await ThirteenthMonthRun.findOne({ attachedPayRunId });
      if (existingAttachment) throw new AppError('That pay run already has a 13th-month calculation', 409);
    }

    const run = await ThirteenthMonthRun.create({
      coverageStart: dates.start,
      coverageEnd: dates.end,
      actualCutoff: dates.cutoff,
      payoutDate: dates.payout,
      paymentMethod,
      attachedPayRunId: paymentMethod === 'PAY_RUN' ? attachedPayRunId : null,
      createdBy: actorName(req.user)
    });
    await calculateThirteenthMonthRun(run);
    if (run.attachedPayRunId) await attachThirteenthMonthToPayRun(run);
    res.status(201).json({ success: true, data: await detailResponse(run) });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const run = await ThirteenthMonthRun.findById(req.params.id).populate('attachedPayRunId', 'payrollPeriodStart payrollPeriodEnd payoutDate status');
    if (!run) throw new AppError('13th-month run not found', 404);
    res.json({ success: true, data: await detailResponse(run) });
  } catch (error) { next(error); }
});

router.post('/:id/recalculate', async (req, res, next) => {
  try {
    const run = await ThirteenthMonthRun.findById(req.params.id);
    if (!run) throw new AppError('13th-month run not found', 404);
    if (run.status !== 'DRAFT') throw new AppError('Only Draft calculations can be recalculated', 400);
    await calculateThirteenthMonthRun(run);
    if (run.attachedPayRunId) await attachThirteenthMonthToPayRun(run);
    res.json({ success: true, data: await detailResponse(run) });
  } catch (error) { next(error); }
});

router.patch('/:id/employees/:entryId', async (req, res, next) => {
  try {
    const run = await ThirteenthMonthRun.findById(req.params.id);
    if (!run) throw new AppError('13th-month run not found', 404);
    if (run.status !== 'DRAFT') throw new AppError('Only Draft calculations can be adjusted', 400);
    const amount = Number(req.body.manualAdjustment) || 0;
    const reason = String(req.body.adjustmentReason || '').trim();
    if (amount !== 0 && !reason) throw new AppError('Adjustment reason is required', 400);
    const entry = await ThirteenthMonthEmployee.findOne({ _id: req.params.entryId, runId: run._id });
    if (!entry) throw new AppError('Employee calculation not found', 404);
    entry.manualAdjustment = amount;
    entry.adjustmentReason = reason;
    entry.eligibleBasicSalary = Math.round(Math.max(0, entry.actualBasicSalary + entry.projectedBasicSalary + amount) * 100) / 100;
    entry.thirteenthMonthPay = Math.round((entry.eligibleBasicSalary / 12) * 100) / 100;
    await entry.save();
    if (run.attachedPayRunId) await attachThirteenthMonthToPayRun(run);
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const run = await ThirteenthMonthRun.findById(req.params.id);
    if (!run) throw new AppError('13th-month run not found', 404);
    if (run.paymentMethod === 'PAY_RUN') throw new AppError('Attached 13th-month status follows its pay run', 400);
    const transitions = { DRAFT: ['APPROVED'], APPROVED: ['DRAFT', 'PAID'], PAID: [] };
    if (!transitions[run.status].includes(req.body.status)) throw new AppError(`Cannot change status from ${run.status} to ${req.body.status}`, 400);
    run.status = req.body.status;
    if (run.status === 'APPROVED') run.approvedAt = new Date();
    if (run.status === 'DRAFT') run.approvedAt = undefined;
    if (run.status === 'PAID') {
      run.paidAt = new Date();
      await ThirteenthMonthEmployee.updateMany({ runId: run._id }, [{ $set: { paidAmount: '$thirteenthMonthPay' } }]);
    }
    await run.save();
    res.json({ success: true, data: await detailResponse(run) });
  } catch (error) { next(error); }
});

router.get('/:id/payslips/:entryId', async (req, res, next) => {
  try {
    const run = await ThirteenthMonthRun.findById(req.params.id).populate('attachedPayRunId', 'payrollPeriodStart payrollPeriodEnd payoutDate status');
    const entry = await ThirteenthMonthEmployee.findOne({ _id: req.params.entryId, runId: req.params.id });
    if (!run || !entry) throw new AppError('13th-month payslip not found', 404);
    const employee = await Employee.findById(entry.employeeId);
    res.json({ success: true, data: { run, entry, employee } });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const run = await ThirteenthMonthRun.findById(req.params.id);
    if (!run) throw new AppError('13th-month run not found', 404);
    if (run.status !== 'DRAFT') throw new AppError('Only Draft calculations can be deleted', 400);
    await detachThirteenthMonthFromPayRun(run);
    await ThirteenthMonthEmployee.deleteMany({ runId: run._id });
    await run.deleteOne();
    res.json({ success: true, message: '13th-month calculation deleted' });
  } catch (error) { next(error); }
});

export default router;
