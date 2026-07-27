
import { calculateTimesheetFields } from './backend/src/services/calculationService.js';

// Mock Schedule model for the test since we can't easily connect to DB in this script
// We'll mock the lookupSchedule function instead or just pass the _useSchedule param which bypasses DB

async function testTimesheetCalculation() {
    console.log('--- Testing Timesheet Calculation Bug ---');

    // Scenario: Employee has a schedule (9am-6pm, 8 hours)
    // But they only worked 4 hours (9am-1pm)
    
    const mockSchedule = {
        scheduledHours: 8,
        scheduledStartTime: '9:00 AM',
        scheduledEndTime: '6:00 PM'
    };

    const inputData = {
        employeeName: 'Test Employee',
        date: new Date('2025-01-22'),
        timeIn: new Date('2025-01-22T09:00:00+08:00'),
        timeOut: new Date('2025-01-22T13:00:00+08:00'), // 4 hours worked
        _useSchedule: mockSchedule // Simulate finding a schedule
    };

    console.log('Input:', {
        scheduledHours: mockSchedule.scheduledHours,
        actualHours: 4
    });

    const result = await calculateTimesheetFields(inputData);

    console.log('Result:', {
        hoursWorked: result.hoursWorked,
        scheduledHours: result.scheduledHours,
        adjustedHoursWorked: result.adjustedHoursWorked
    });

    if (result.adjustedHoursWorked === 8) {
        console.log('❌ BUG REPRODUCED: Adjusted hours defaulted to scheduled hours (8) instead of actual hours (4).');
    } else if (result.adjustedHoursWorked === 4) {
        console.log('✅ CORRECT BEHAVIOR: Adjusted hours reflects actual hours (4).');
    } else {
        console.log('❓ UNEXPECTED RESULT');
    }
}

testTimesheetCalculation().catch(console.error);
