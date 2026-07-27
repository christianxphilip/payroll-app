import fs from 'fs';
import { generatePayslipHTML } from './src/templates/payslipTemplate.js';

const mockData = {
    payRun: {
        payrollPeriodStart: new Date('2025-11-01'),
        payrollPeriodEnd: new Date('2025-11-15')
    },
    entry: {
        employeeName: 'Leanard Nasol',
        totalHoursWorked: 108,
        overtimeHours: 2,
        nightDiffHours: 46.4,
        regularHolidayHours: 0,
        specialHolidayHours: 16,
        netSalary: 4496.25,
        basicSalary: 6750.00,
        overtimePay: 156.25,
        nightDiffPay: 290.00,
        regularHolidayPay: 0.00,
        specialHolidayPay: 300.00,
        allowancesTotal: 0.00,
        deductionsTotal: 3000.00
    },
    employee: {
        position: 'Barista',
        wageRate: 500,
        wageType: 'DAILY',
        employmentType: 'FULL_TIME'
    },
    adjustments: [
        { name: 'Cash Advance', type: 'DEDUCTION', amount: 3000.00 }
    ],
    timesheetLogs: [
        {
            date: new Date('2025-11-01'),
            timeIn: new Date('2025-11-01T18:00:00'),
            timeOut: new Date('2025-11-02T03:00:00'),
            adjustedHoursWorked: 8,
            scheduledHours: 8,
            ndHours: 5,
            isHoliday: true,
            holidayType: 'Special'
        }
    ]
};

try {
    const html = generatePayslipHTML(mockData);
    fs.writeFileSync('test-payslip.html', html);
    console.log('Successfully generated test-payslip.html');
} catch (error) {
    console.error('Error generating HTML:', error);
    process.exit(1);
}
