import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
    employeeName: {
        type: String,
        required: [true, 'Employee name is required'],
        index: true
    },
    type: {
        type: String,
        enum: ['WEEKLY', 'MONTHLY', 'INDEFINITE', 'SPECIFIC_DATES'],
        required: true
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    daysOfWeek: {
        type: [String],
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        default: []
    },
    specificDates: {
        type: [Date],
        default: []
    },
    shiftType: {
        type: String,
        default: 'Any' // e.g., "Opening only", "Any", "Closing only"
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index for efficient lookups
availabilitySchema.index({ employeeName: 1 });

export default mongoose.model('Availability', availabilitySchema, 'payroll_app_availabilities');
