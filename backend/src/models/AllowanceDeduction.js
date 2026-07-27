import mongoose from 'mongoose';

const allowanceDeductionSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['ALLOWANCE', 'DEDUCTION'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  frequency: {
    type: String,
    enum: ['WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME'],
    required: true
  },
  appliesFrom: {
    type: Date,
    required: true
  },
  appliesTo: {
    type: Date
  },
  payRunId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayRun',
    default: null,
    index: true
  }
}, {
  timestamps: true
});

allowanceDeductionSchema.index({ employeeId: 1, frequency: 1 });

export default mongoose.model('AllowanceDeduction', allowanceDeductionSchema, 'payroll_app_allowancedeductions');


