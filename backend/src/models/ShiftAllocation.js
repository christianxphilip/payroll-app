import mongoose from 'mongoose';

const shiftAllocationSchema = new mongoose.Schema({
    dayOfWeek: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    shiftId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift',
        required: true
    },
    requiredCount: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index to ensure unique allocation per day + shift
shiftAllocationSchema.index({ dayOfWeek: 1, shiftId: 1 }, { unique: true });

export default mongoose.model('ShiftAllocation', shiftAllocationSchema, 'payroll_app_shiftallocations');
