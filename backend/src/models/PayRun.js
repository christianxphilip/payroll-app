import mongoose from 'mongoose';

const payRunSchema = new mongoose.Schema({
  payrollPeriodStart: {
    type: Date,
    required: true,
    index: true
  },
  payrollPeriodEnd: {
    type: Date,
    required: true,
    index: true
  },
  payoutDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'APPROVED', 'PAID'],
    default: 'DRAFT',
    index: true
  },
  emailStatus: {
    type: String,
    enum: ['IDLE', 'SENDING', 'COMPLETED', 'FAILED'],
    default: 'IDLE'
  },
  timesheetIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timesheet'
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

export default mongoose.model('PayRun', payRunSchema, 'payroll_app_payruns');


