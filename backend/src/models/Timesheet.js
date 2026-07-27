import mongoose from 'mongoose';

const timesheetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved'],
    default: 'draft',
  },
  isSubmitted: {
    type: Boolean,
    default: false,
  },
  submittedAt: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

const Timesheet = mongoose.model('Timesheet', timesheetSchema, 'payroll_app_timesheets');

export default Timesheet;
