import mongoose from 'mongoose';

const thirteenthMonthEmployeeSchema = new mongoose.Schema({
  runId: { type: mongoose.Schema.Types.ObjectId, ref: 'ThirteenthMonthRun', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  employeeName: { type: String, required: true },
  actualBasicSalary: { type: Number, default: 0 },
  projectedBasicSalary: { type: Number, default: 0 },
  manualAdjustment: { type: Number, default: 0 },
  adjustmentReason: { type: String, trim: true },
  eligibleBasicSalary: { type: Number, default: 0 },
  thirteenthMonthPay: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  actualDays: { type: Number, default: 0 },
  projectedDays: { type: Number, default: 0 },
  calculationNotes: [{ type: String }]
}, { timestamps: true });

thirteenthMonthEmployeeSchema.index({ runId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model('ThirteenthMonthEmployee', thirteenthMonthEmployeeSchema, 'payroll_app_13thmonthemployees');
