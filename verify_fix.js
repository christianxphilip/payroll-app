
// Mock dependencies
const Holiday = { findOne: async () => null };
const Schedule = { find: async () => [] };

// Mock calculationService functions locally to test the logic
const calculateActualDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return 0;
    const diffMs = new Date(timeOut) - new Date(timeIn);
    return Math.max(0, diffMs / (1000 * 60 * 60));
};

const calculateHoursWorked = (actualDuration) => {
    if (actualDuration >= 7.5) return actualDuration - 1;
    return actualDuration;
};

// The function we modified, adapted for this test script
const calculateTimesheetFields = async (timesheetData) => {
    const { timeIn, timeOut, _useSchedule } = timesheetData;

    const actualDuration = calculateActualDuration(timeIn, timeOut);
    const hoursWorked = calculateHoursWorked(actualDuration);

    let scheduledHours = 0;
    if (_useSchedule) {
        scheduledHours = _useSchedule.scheduledHours;
    }

    // --- THE FIX IS HERE ---
    // Old logic: const fullAdjustedHours = (scheduledHours && scheduledHours > 0) ? scheduledHours : hoursWorked;
    // New logic:
    const fullAdjustedHours = hoursWorked;
    // -----------------------

    const STANDARD_HOURS_PER_DAY = 8;
    const adjustedHoursWorked = Math.min(fullAdjustedHours, STANDARD_HOURS_PER_DAY);

    return {
        hoursWorked,
        scheduledHours,
        adjustedHoursWorked
    };
};

async function test() {
    console.log('--- Verifying Timesheet Logic Fix ---');

    const mockSchedule = { scheduledHours: 8 };
    const inputData = {
        timeIn: '2025-01-22T09:00:00+08:00',
        timeOut: '2025-01-22T13:00:00+08:00', // 4 hours
        _useSchedule: mockSchedule
    };

    const result = await calculateTimesheetFields(inputData);

    console.log('Scenario: Scheduled 8h, Worked 4h');
    console.log('Result:', result);

    if (result.adjustedHoursWorked === 4) {
        console.log('✅ PASS: Adjusted hours is 4 (Actual)');
    } else {
        console.log('❌ FAIL: Adjusted hours is ' + result.adjustedHoursWorked + ' (Expected 4)');
    }
}

test();
