import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  employeeName: {
    type: String,
    required: [true, 'Employee name is required'],
    unique: true,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  birthday: {
    type: Date
  },
  address: {
    type: String,
    trim: true
  },
  hiredDate: {
    type: Date
  },
  resignedDate: {
    type: Date
  },
  lastWorkingDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'RESIGNED', 'RENDERING'],
    default: 'ACTIVE',
    index: true
  },
  employmentType: {
    type: String,
    enum: ['FULL_TIME', 'PART_TIME', 'ON_CALL'],
    default: 'FULL_TIME'
  },
  wageType: {
    type: String,
    enum: ['HOURLY', 'DAILY'],
    default: 'HOURLY'
  },
  wageRate: {
    type: Number,
    default: 0
  },
  username: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  password: {
    type: String,
    select: false
  }
}, {
  timestamps: true
});

employeeSchema.index({ email: 1 }, { unique: true, sparse: true });
employeeSchema.index({ username: 1 }, { unique: true, sparse: true });

employeeSchema.pre('save', function(next) {
  // Auto-derive status based on resigned/last working dates if not explicitly set
  const now = new Date();
  if (this.lastWorkingDate || this.resignedDate) {
    const last = this.lastWorkingDate || this.resignedDate;
    if (last > now) {
      this.status = 'RENDERING';
    } else {
      this.status = 'RESIGNED';
    }
  } else if (!this.status) {
    this.status = 'ACTIVE';
  }

  // Basic date consistency: resignedDate should not be after lastWorkingDate if both exist
  if (this.resignedDate && this.lastWorkingDate && this.resignedDate > this.lastWorkingDate) {
    return next(new Error('Resigned date cannot be after last working date'));
  }

  next();
});

export default mongoose.model('Employee', employeeSchema, 'payroll_app_employees');

