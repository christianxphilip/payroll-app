import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Holiday type is required'],
    enum: ['Regular', 'Special']
  }
}, {
  timestamps: true
});

// Index for efficient date lookups
holidaySchema.index({ date: 1 });

export default mongoose.model('Holiday', holidaySchema, 'payroll_app_holidays');

