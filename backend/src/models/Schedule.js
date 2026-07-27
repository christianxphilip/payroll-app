import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  employeeName: {
    type: String,
    required: [true, 'Employee name is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  scheduledStartTime: {
    type: String,
    trim: true
  },
  scheduledEndTime: {
    type: String,
    trim: true
  },
  scheduledDuration: {
    type: Number,
    default: 0
  },
  isOff: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true
  },
  assignmentType: {
    type: String,
    default: 'GENERAL'
  },
  shiftName: {
    type: String,
    trim: true
  },
  googleEventId: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries (non-unique to allow multiple schedules per date)
scheduleSchema.index({ employeeName: 1, date: 1 });

export default mongoose.model('Schedule', scheduleSchema, 'payroll_app_schedules');

