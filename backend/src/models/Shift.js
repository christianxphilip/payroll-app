import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Shift name is required'],
        trim: true
    },
    startTime: {
        type: String,
        required: [true, 'Start time is required'],
        trim: true
    },
    endTime: {
        type: String,
        required: [true, 'End time is required'],
        trim: true
    },
    daysOfWeek: {
        type: [String],
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        default: []
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

export default mongoose.model('Shift', shiftSchema, 'payroll_app_shifts');
