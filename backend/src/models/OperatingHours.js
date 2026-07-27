import mongoose from 'mongoose';

const operatingHoursSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Date is required'],
    unique: true,
    index: true
  },
  hours: {
    type: String,
    required: [true, 'Operating hours are required'],
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient date lookups
operatingHoursSchema.index({ date: 1 });

export default mongoose.model('OperatingHours', operatingHoursSchema, 'payroll_app_operatinghours');

