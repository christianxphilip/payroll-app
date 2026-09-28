import mongoose from 'mongoose';

const payrollAdjustmentSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  employeeName: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['PRIOR_PERIOD_OT', 'ATTENDANCE_CORRECTION'],
    required: true
  },
  correctionType: {
    type: String,
    enum: ['LATE_OT_APPROVAL', 'MISSING_LOG', 'MISSING_TIME_IN', 'MISSING_TIME_OUT', 'INCORRECT_TIME', 'OVERNIGHT_SHIFT', 'OTHER'],
    required: true
  },
  status: {
    type: String,
    enum: ['APPROVED_UNPAID', 'INCLUDED_IN_PAYRUN', 'PAID', 'CANCELLED'],
    default: 'INCLUDED_IN_PAYRUN',
    index: true
  },
  sourceTimesheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timesheet', default: null },
  sourcePayRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayRun', default: null },
  sourceTimeLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimesheetLog', default: null },
  includedPayRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayRun', default: null, index: true },
  originalWorkDate: { type: Date, required: true },
  correctedTimeIn: { type: Date, default: null },
  correctedTimeOut: { type: Date, default: null },
  breakMinutes: { type: Number, default: 0, min: 0 },
  regularHours: { type: Number, default: 0, min: 0 },
  overtimeHours: { type: Number, default: 0, min: 0 },
  nightDiffHours: { type: Number, default: 0, min: 0 },
  holidayType: { type: String, enum: ['NONE', 'REGULAR', 'SPECIAL'], default: 'NONE' },
  hourlyRate: { type: Number, required: true, min: 0 },
  overtimeMultiplier: { type: Number, default: 1.25, min: 0 },
  nightDiffMultiplier: { type: Number, default: 0.1, min: 0 },
  holidayMultiplier: { type: Number, default: 0, min: 0 },
  regularPay: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  nightDiffPay: { type: Number, default: 0 },
  holidayPay: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true },
  approvedBy: { type: String, required: true, trim: true },
  approvedAt: { type: Date, required: true },
  approvalReference: { type: String, trim: true, default: '' },
  createdBy: { type: String, trim: true, default: '' },
  paidAt: { type: Date, default: null }
}, { timestamps: true });

payrollAdjustmentSchema.index(
  { sourceTimeLogId: 1, type: 1, status: 1 },
  { partialFilterExpression: { sourceTimeLogId: { $type: 'objectId' }, status: { $in: ['APPROVED_UNPAID', 'INCLUDED_IN_PAYRUN', 'PAID'] } } }
);

export default mongoose.model('PayrollAdjustment', payrollAdjustmentSchema, 'payroll_app_payrolladjustments');
