import mongoose from 'mongoose';

const attendanceApprovalSchema = new mongoose.Schema({
  odooAttendanceId: {
    type: Number,
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  date: {
    type: String,
    trim: true
  },
  checkIn: {
    type: Date
  },
  checkOut: {
    type: Date
  },
  correctedCheckIn: {
    type: Date
  },
  correctedCheckOut: {
    type: Date
  },
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Valid', 'Invalid', 'For L1 Approval', 'For L2 Approval'],
    default: 'For L1 Approval',
    index: true
  },
  history: [{
    action: {
      type: String,
      enum: ['SUBMITTED', 'L1_APPROVED', 'L2_APPROVED', 'REJECTED'],
      required: true
    },
    byRole: {
      type: String
    },
    byId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    byName: {
      type: String
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  l1ApprovedAt: {
    type: Date
  },
  l1ApprovedBy: {
    type: String
  },
  l2ApprovedAt: {
    type: Date
  },
  l2ApprovedBy: {
    type: String
  },
  rejectedAt: {
    type: Date
  },
  rejectedBy: {
    type: String
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

attendanceApprovalSchema.index({ employeeId: 1, odooAttendanceId: 1 });

const AttendanceApproval = mongoose.model('AttendanceApproval', attendanceApprovalSchema, 'payroll_app_attendance_approvals');

export default AttendanceApproval;
