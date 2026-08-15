import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI;

const OLD_NAME = 'John Neale Nayve';
const NEW_NAME = 'Neale Nayve';

async function retroFix() {
  console.log(`Starting data retro fix from "${OLD_NAME}" to "${NEW_NAME}"...`);

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db;

    // 1. TimesheetLog
    const timesheetLogsCol = db.collection('payroll_app_timesheetlogs');
    const tsRes = await timesheetLogsCol.updateMany(
      { employeeName: OLD_NAME },
      { $set: { employeeName: NEW_NAME } }
    );
    console.log(`[payroll_app_timesheetlogs] Matched: ${tsRes.matchedCount}, Modified: ${tsRes.modifiedCount}`);

    // 2. PayRunEmployee
    const payRunEmpCol = db.collection('payroll_app_payrunemployees');
    const prRes = await payRunEmpCol.updateMany(
      { employeeName: OLD_NAME },
      { $set: { employeeName: NEW_NAME } }
    );
    console.log(`[payroll_app_payrunemployees] Matched: ${prRes.matchedCount}, Modified: ${prRes.modifiedCount}`);

    // 3. Schedule
    const schedCol = db.collection('payroll_app_schedules');
    const schedRes = await schedCol.updateMany(
      { employeeName: OLD_NAME },
      { $set: { employeeName: NEW_NAME } }
    );
    console.log(`[payroll_app_schedules] Matched: ${schedRes.matchedCount}, Modified: ${schedRes.modifiedCount}`);

    // 4. Availability
    const availCol = db.collection('payroll_app_availabilities');
    const availRes = await availCol.updateMany(
      { employeeName: OLD_NAME },
      { $set: { employeeName: NEW_NAME } }
    );
    console.log(`[payroll_app_availabilities] Matched: ${availRes.matchedCount}, Modified: ${availRes.modifiedCount}`);

    console.log('\n--- Retro Fix Completed Successfully ---');
  } catch (err) {
    console.error('Error executing retro fix:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

retroFix();
