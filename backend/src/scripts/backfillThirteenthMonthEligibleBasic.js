import 'dotenv/config';
import mongoose from 'mongoose';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import { deriveLegacyThirteenthMonthEligibleBasic } from '../services/thirteenthMonthEligibleBasicService.js';

const applyChanges = process.argv.includes('--apply');

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is required');
}

await mongoose.connect(process.env.MONGODB_URI);

try {
  const finalizedRuns = await PayRun.find(
    { status: { $in: ['APPROVED', 'PAID'] } },
    '_id status payrollPeriodStart payrollPeriodEnd'
  ).lean();
  const runById = new Map(finalizedRuns.map(run => [String(run._id), run]));
  const entries = await PayRunEmployee.find({
    payRunId: { $in: finalizedRuns.map(run => run._id) },
    $or: [
      { thirteenthMonthEligibleBasic: { $exists: false } },
      { thirteenthMonthEligibleBasic: null }
    ]
  }).lean();

  const operations = [];
  const flagged = [];
  const runSummaries = new Map();
  const calculatedAt = new Date();

  for (const entry of entries) {
    const derived = deriveLegacyThirteenthMonthEligibleBasic(entry);
    if (!derived.reliable) {
      flagged.push({
        entryId: String(entry._id),
        payRunId: String(entry.payRunId),
        employeeName: entry.employeeName,
        reason: derived.reason
      });
      continue;
    }

    operations.push({
      updateOne: {
        filter: {
          _id: entry._id,
          $or: [
            { thirteenthMonthEligibleBasic: { $exists: false } },
            { thirteenthMonthEligibleBasic: null }
          ]
        },
        update: {
          $set: {
            thirteenthMonthEligibleBasic: derived.amount,
            compensationVersion: 1,
            thirteenthMonthEligibleBasicCalculatedAt: calculatedAt
          }
        }
      }
    });

    const runId = String(entry.payRunId);
    const current = runSummaries.get(runId) || {
      payRunId: runId,
      status: runById.get(runId)?.status,
      payrollPeriodStart: runById.get(runId)?.payrollPeriodStart,
      payrollPeriodEnd: runById.get(runId)?.payrollPeriodEnd,
      employees: 0,
      recordedBasic: 0,
      eligibleBasic: 0
    };
    current.employees += 1;
    current.recordedBasic += Number(entry.basicSalary) || 0;
    current.eligibleBasic += derived.amount;
    runSummaries.set(runId, current);
  }

  let modifiedCount = 0;
  if (applyChanges && operations.length) {
    const result = await PayRunEmployee.collection.bulkWrite(operations, { ordered: false });
    modifiedCount = result.modifiedCount;
  }

  const report = {
    mode: applyChanges ? 'APPLY' : 'DRY_RUN',
    finalizedPayRuns: finalizedRuns.length,
    entriesExamined: entries.length,
    entriesReady: operations.length,
    entriesFlagged: flagged.length,
    modifiedCount,
    payRuns: [...runSummaries.values()].map(summary => ({
      ...summary,
      recordedBasic: Math.round(summary.recordedBasic * 100) / 100,
      eligibleBasic: Math.round(summary.eligibleBasic * 100) / 100,
      excludedAmount: Math.round((summary.recordedBasic - summary.eligibleBasic) * 100) / 100
    })),
    flagged: flagged.slice(0, 100)
  };

  console.log(JSON.stringify(report, null, 2));
  if (!applyChanges) {
    console.log('\nDry run only. Re-run with --apply after reviewing this report.');
  }
} finally {
  await mongoose.disconnect();
}
