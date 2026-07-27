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

