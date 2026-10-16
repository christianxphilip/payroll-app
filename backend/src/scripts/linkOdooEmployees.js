import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import { findOdooEmployeeByName } from '../services/odooAttendanceService.js';

dotenv.config();

const apply = process.argv.includes('--apply');

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  const employees = await Employee.find({ status: { $ne: 'RESIGNED' } }).sort({ employeeName: 1 });
  let linked = 0;
  let unmatched = 0;

  for (const employee of employees) {
    if (employee.odooEmployeeId) {
      console.log(`SKIP ${employee.employeeName}: already linked to Odoo #${employee.odooEmployeeId}`);
      continue;
    }
    try {
      const match = await findOdooEmployeeByName(employee.employeeName);
      if (!match) {
        unmatched += 1;
        console.log(`MISS ${employee.employeeName}`);
        continue;
      }
      console.log(`${apply ? 'LINK' : 'MATCH'} ${employee.employeeName} -> Odoo #${match.id} (${match.name})`);
      if (apply) await Employee.updateOne({ _id: employee._id }, { $set: { odooEmployeeId: match.id } });
      linked += 1;
    } catch (error) {
      unmatched += 1;
      console.error(`ERROR ${employee.employeeName}: ${error.message}`);
    }
  }

  console.log(`${apply ? 'Applied' : 'Dry run'}: ${linked} matched, ${unmatched} unmatched/errors.`);
  if (!apply) console.log('Run again with --apply to persist these links.');
};

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

