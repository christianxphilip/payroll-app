import mongoose from 'mongoose';

const timesheetLogSchema = new mongoose.Schema({
  timesheetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timesheet',
    required: false, // Optional for backward compatibility
    index: true
  },
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
  // Full datetime fields (stored as Date, interpreted in Asia/Manila where applicable)
  timeIn: {
    type: Date
  },
  timeOut: {
    type: Date
  },
  // Optional explicit date boundaries for cross-midnight shifts
  dateIn: {
    type: Date,
    index: true
  },
  dateOut: {
    type: Date,
    index: true
  },
  // Calculated fields
  actualDuration: {
    type: Number,
    default: 0
  },
  hoursWorked: {
    type: Number,
    default: 0
  },
  ndHours: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  isHoliday: {
    type: Boolean,
    default: false
  },
  holidayType: {
    type: String,
    enum: ['Regular', 'Special', null],
    default: null
  },
  scheduledHours: {
    type: Number,
    default: 0
  },
  scheduledStartTime: {
    type: String,
    default: null
  },
  scheduledEndTime: {
    type: String,
    default: null
  },
  // Adjustable & review
  adjustedHoursWorked: {
    type: Number,
    default: 0
  },
  reviewFlag: {
    type: Boolean,
    default: false
  },
  reviewNotes: {
    type: String,
    trim: true
  },
  // Metadata
  isSubmitted: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
timesheetLogSchema.index({ employeeName: 1, date: 1 });
timesheetLogSchema.index({ isSubmitted: 1 });
timesheetLogSchema.index({ reviewFlag: 1 });

export default mongoose.model('TimesheetLog', timesheetLogSchema, 'payroll_app_timesheetlogs');

