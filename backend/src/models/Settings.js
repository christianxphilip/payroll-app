import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Overtime multiplier (e.g., 1.25 = 125%)
  overtimeMultiplier: {
    type: Number,
    default: 1.25,
    min: 0
  },
  // Night differential multiplier (e.g., 0.1 = 10%)
  nightDifferentialMultiplier: {
    type: Number,
    default: 0.1,
    min: 0
  },
  // Regular holiday multiplier (e.g., 1.0 = 100% premium)
  regularHolidayMultiplier: {
    type: Number,
    default: 1.0,
    min: 0
  },
  // Special holiday multiplier (e.g., 0.3 = 30% premium)
  specialHolidayMultiplier: {
    type: Number,
    default: 0.3,
    min: 0
  },
  // Overtime on regular holiday multiplier (e.g., 2.6 = 260%)
  overtimeRegularHolidayMultiplier: {
    type: Number,
    default: 2.6,
    min: 0
  },
  // Overtime on special holiday multiplier (e.g., 1.69 = 169%)
  overtimeSpecialHolidayMultiplier: {
    type: Number,
    default: 1.69,
    min: 0
  },
  // Employees cannot submit new attendance correction requests whose work
  // date is on or before this date. Stored as YYYY-MM-DD to avoid timezone drift.
  attendanceRequestLockedThrough: {
    type: String,
    default: null,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  attendanceRequestLockUpdatedAt: {
    type: Date,
    default: null
  },
  attendanceRequestLockUpdatedBy: {
    type: String,
    trim: true,
    default: ''
  },
  attendanceRequestScheduledLockedThrough: {
    type: String,
    default: null,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  attendanceRequestLockScheduledAt: {
    type: Date,
    default: null
  },
  attendanceRequestAutoLockEnabled: {
    type: Boolean,
    default: false
  },
  attendanceRequestFirstCutoffGraceDays: {
    type: Number,
    default: 3,
    min: 0,
    max: 30
  },
  attendanceRequestFirstCutoffLockTime: {
    type: String,
    default: '23:59',
    match: /^([01]\d|2[0-3]):[0-5]\d$/
  },
  attendanceRequestMonthEndGraceDays: {
    type: Number,
    default: 3,
    min: 0,
    max: 30
  },
  attendanceRequestMonthEndLockTime: {
    type: String,
    default: '23:59',
    match: /^([01]\d|2[0-3]):[0-5]\d$/
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    // Create default settings if none exist
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model('Settings', settingsSchema, 'payroll_app_settings');
