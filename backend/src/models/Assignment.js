import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Assignment code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  label: {
    type: String,
    required: [true, 'Assignment label is required'],
    trim: true
  },
  color: {
    type: String,
    required: [true, 'Assignment color is required'],
    match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color code']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
assignmentSchema.index({ isActive: 1, order: 1 });

export default mongoose.model('Assignment', assignmentSchema, 'payroll_app_assignments');

