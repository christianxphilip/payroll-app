import 'dotenv/config';
import mongoose from 'mongoose';

const SOURCE_TIMESHEET_ID = new mongoose.Types.ObjectId('6aa8adf642130104c230c30e');
const SOURCE_PAYRUN_ID = new mongoose.Types.ObjectId('6aa8fe088771c59291a83e6f');

const replaceDatabaseName = (uri, databaseName) => uri.replace(
  /\/([^/?]+)(\?|$)/,
  `/${databaseName}$2`
);

const sourceUri = process.env.SOURCE_MONGODB_URI || process.env.MONGODB_URI;
const testUri = process.env.TEST_MONGODB_URI || (
  process.env.ALLOW_DERIVED_TEST_DB === 'true' && sourceUri
    ? replaceDatabaseName(sourceUri, 'espro_payroll_test')
    : null
);

if (!sourceUri || !testUri) {
  throw new Error('Set SOURCE_MONGODB_URI and TEST_MONGODB_URI, or explicitly enable ALLOW_DERIVED_TEST_DB=true');
}

const sourceDbName = sourceUri.match(/\/([^/?]+)(?:\?|$)/)?.[1];
const testDbName = testUri.match(/\/([^/?]+)(?:\?|$)/)?.[1];
if (!testDbName?.endsWith('_test') || testDbName === sourceDbName) {
  throw new Error('Refusing to seed: target database must be different and end in _test');
}

const source = await mongoose.createConnection(sourceUri).asPromise();
const target = await mongoose.createConnection(testUri).asPromise();

const sourceTimesheet = await source.collection('payroll_app_timesheets').findOne({ _id: SOURCE_TIMESHEET_ID });
const sourcePayRun = await source.collection('payroll_app_payruns').findOne({ _id: SOURCE_PAYRUN_ID });
const logs = await source.collection('payroll_app_timesheetlogs').find({ timesheetId: SOURCE_TIMESHEET_ID }).toArray();
const sourceEntries = await source.collection('payroll_app_payrunemployees').find({ payRunId: SOURCE_PAYRUN_ID }).toArray();
const employeeIds = sourceEntries.map((entry) => entry.employeeId);
const employees = await source.collection('payroll_app_employees').find({ _id: { $in: employeeIds } }).toArray();
const settings = await source.collection('payroll_app_settings').find({}).toArray();

if (!sourceTimesheet || !sourcePayRun || !logs.length || !sourceEntries.length) {
  throw new Error('The requested August source data is incomplete');
}

const resetCollections = [
  'payroll_app_payrolladjustments',
  'payroll_app_payrunemployees',
  'payroll_app_payruns',
  'payroll_app_timesheetlogs',
  'payroll_app_timesheets',
  'payroll_app_employees',
  'payroll_app_settings'
];
for (const name of resetCollections) {
  await target.collection(name).deleteMany({});
}

await target.collection('payroll_app_timesheets').insertOne(sourceTimesheet);
await target.collection('payroll_app_payruns').insertOne(sourcePayRun);
await target.collection('payroll_app_timesheetlogs').insertMany(logs);
await target.collection('payroll_app_payrunemployees').insertMany(sourceEntries);
await target.collection('payroll_app_employees').insertMany(employees);
if (settings.length) await target.collection('payroll_app_settings').insertMany(settings);

const draftPayRunId = new mongoose.Types.ObjectId();
await target.collection('payroll_app_payruns').insertOne({
  _id: draftPayRunId,
  payrollPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
  payrollPeriodEnd: new Date('2026-09-15T00:00:00.000Z'),
  payoutDate: new Date('2026-09-30T00:00:00.000Z'),
  status: 'DRAFT',
  emailStatus: 'IDLE',
  timesheetIds: [],
  metadata: { testFixture: true, sourcePayRunId: SOURCE_PAYRUN_ID },
  createdAt: new Date(),
  updatedAt: new Date(),
  __v: 0
});

const draftEntries = sourceEntries.map((entry) => ({
  ...entry,
  _id: new mongoose.Types.ObjectId(),
  payRunId: draftPayRunId,
  totalHoursWorked: 0,
  overtimeHours: 0,
  regularOvertimeHours: 0,
  overtimeRegularHolidayHours: 0,
  overtimeSpecialHolidayHours: 0,
  nightDiffHours: 0,
  regularHolidayHours: 0,
  specialHolidayHours: 0,
  basicSalary: 0,
  overtimePay: 0,
  overtimeRegularHolidayPay: 0,
  overtimeSpecialHolidayPay: 0,
  nightDiffPay: 0,
  regularHolidayPay: 0,
  specialHolidayPay: 0,
  allowancesTotal: 0,
  deductionsTotal: 0,
  priorPeriodAdjustmentTotal: 0,
  priorPeriodAdjustments: [],
  netSalary: 0,
  breakdown: {
    hourlyRate: entry.breakdown?.hourlyRate || 0,
    wageType: entry.breakdown?.wageType,
    employmentType: entry.breakdown?.employmentType,
    adjustments: [],
    testFixture: true
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  __v: 0
}));
await target.collection('payroll_app_payrunemployees').insertMany(draftEntries);

console.log(JSON.stringify({
  database: testDbName,
  sourceTimesheetId: String(SOURCE_TIMESHEET_ID),
  sourcePayRunId: String(SOURCE_PAYRUN_ID),
  draftPayRunId: String(draftPayRunId),
  copiedLogs: logs.length,
  copiedEmployees: employees.length
}, null, 2));

await source.close();
await target.close();
