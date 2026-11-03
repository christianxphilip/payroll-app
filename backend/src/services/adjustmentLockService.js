import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import { AppError } from '../middleware/errorHandler.js';

export const findLockedPayRunForAdjustment = async ({
  employeeId,
  appliesFrom,
  appliesTo
}) => {
  const periodQuery = {
    status: { $ne: 'DRAFT' },
    payrollPeriodEnd: { $gte: appliesFrom }
  };

  if (appliesTo) {
    periodQuery.payrollPeriodStart = { $lte: appliesTo };
  }

  const candidateRuns = await PayRun.find(periodQuery).select('_id status').lean();
  if (candidateRuns.length === 0) return null;

  const entry = await PayRunEmployee.findOne({
    employeeId,
    payRunId: { $in: candidateRuns.map((run) => run._id) }
  }).select('payRunId').lean();

  if (!entry) return null;

  return candidateRuns.find(
    (run) => String(run._id) === String(entry.payRunId)
  ) || null;
};

export const assertAdjustmentPeriodEditable = async (adjustment) => {
  const lockedPayRun = await findLockedPayRunForAdjustment(adjustment);
  if (!lockedPayRun) return;

  throw new AppError(
    `Allowances and deductions cannot be changed because they affect a ${lockedPayRun.status} pay run`,
    400
  );
};
