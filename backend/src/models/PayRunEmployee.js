import mongoose from 'mongoose';

const payRunEmployeeSchema = new mongoose.Schema({
  payRunId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayRun',
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  totalHoursWorked: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  regularOvertimeHours: {
    type: Number,
    default: 0
  },
  overtimeRegularHolidayHours: {
    type: Number,
    default: 0
  },
  overtimeSpecialHolidayHours: {
    type: Number,
    default: 0
  },
  nightDiffHours: {
    type: Number,
    default: 0
  },
  regularHolidayHours: {
    type: Number,
    default: 0
  },
  specialHolidayHours: {
    type: Number,
    default: 0
  },
  basicSalary: {
    type: Number,
    default: 0
  },
  overtimePay: {
    type: Number,
    default: 0
  },
  overtimeRegularHolidayPay: {
    type: Number,
    default: 0
  },
  overtimeSpecialHolidayPay: {
    type: Number,
    default: 0
  },
  nightDiffPay: {
    type: Number,
    default: 0
  },
  regularHolidayPay: {
    type: Number,
    default: 0
  },
  specialHolidayPay: {
    type: Number,
    default: 0
  },
  allowancesTotal: {
    type: Number,
    default: 0
  },
  deductionsTotal: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    default: 0
  },
  breakdown: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

payRunEmployeeSchema.index({ payRunId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model('PayRunEmployee', payRunEmployeeSchema, 'payroll_app_payrunemployees');


