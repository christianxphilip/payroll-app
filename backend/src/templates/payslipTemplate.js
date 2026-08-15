import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve current directory for loading assets (like the logo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getLogoPath() {
    const envPath = process.env.PAYSLIP_LOGO_PATH;
    const defaultPath = path.resolve(__dirname, '../../assets/logo.png');
    return envPath || defaultPath;
}

// Helper to format money with 2 decimal places and thousands separator
function formatMoney(value) {
    return (value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Helper to format hours like the frontend helper
function formatHours(value) {
    const num = Number(value) || 0;
    return num.toFixed(2);
}

function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila'
    });
}

function formatTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Manila'
    });
}

function computeDisplayRate(employee) {
    if (!employee) return '';
    const rate = employee.wageRate || 0;

    if (employee.employmentType === 'FULL_TIME' && employee.wageType === 'HOURLY') {
        return `Rate: &#8369; ${formatMoney(rate * 8)}`;
    }
    if (employee.wageType === 'HOURLY') {
        return `Rate: &#8369; ${formatMoney(rate)} / hour`;
    }
    return `Rate: &#8369; ${formatMoney(rate)}`;
}

/**
 * Generate payslip HTML using table-based layout for email compatibility
 */
export function generatePayslipHTML({ payRun, entry, employee, adjustments, timesheetLogs }) {
    const periodStart = formatDate(payRun.payrollPeriodStart);
    const periodEnd = formatDate(payRun.payrollPeriodEnd);

    // Use CID for the logo
    const logoSrc = 'cid:payslip-logo';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${entry.employeeName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f3f4f6;
      color: #111827;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background-color: #f3f4f6;
    }
    .header-table {
      width: 100%;
      margin-bottom: 20px;
    }
    .logo {
      height: 60px;
      width: auto;
      display: block;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 5px 0;
      color: #111827;
    }
    .period {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }
    .card {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card-label {
      font-size: 12px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 8px;
      display: block;
    }
    .summary-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 10px 0;
      margin: 0 -10px;
      table-layout: fixed;
    }
    .summary-td {
      width: 33.33%;
      vertical-align: top;
    }
    .totals-row {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.6;
    }
    .totals-val {
      font-weight: bold;
      color: #111827;
    }
    .net-pay {
      font-size: 24px;
      font-weight: bold;
      color: #111827;
    }
    .components-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 10px 0;
      margin: 0 -10px;
    }
    .components-td {
      width: 50%;
      vertical-align: top;
    }
    .component-row {
      width: 100%;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .comp-name {
      float: left;
    }
    .comp-val {
      float: right;
      font-weight: bold;
    }
    .clear {
      clear: both;
    }
    .adjustments-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 10px;
      border-top: 1px solid #e5e7eb;
    }
    .adjustments-table th {
      text-align: left;
      color: #6b7280;
      text-transform: uppercase;
      font-size: 10px;
      padding: 8px 4px;
      border-bottom: 1px solid #e5e7eb;
    }
    .adjustments-table td {
      padding: 8px 4px;
      border-bottom: 1px solid #e5e7eb;
    }
    .badge {
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
      display: inline-block;
    }
    .badge-allowance {
      background-color: #d1fae5;
      color: #065f46;
    }
    .badge-deduction {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .timesheet-section {
      margin-top: 20px;
    }
    .timesheet-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background-color: #ffffff;
    }
    .timesheet-table th {
      text-align: left;
      color: #6b7280;
      text-transform: uppercase;
      font-size: 10px;
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      background-color: #f9fafb;
    }
    .timesheet-table th.text-right {
      text-align: right !important;
    }
    .timesheet-table td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    .timesheet-table td.text-right {
      text-align: right !important;
    }
    .text-right {
      text-align: right !important;
    }
    /* Override email client styles that force left alignment - high specificity */
    table.timesheet-table th.text-right,
    table.timesheet-table td.text-right {
      text-align: right !important;
    }
    /* Override any email client injected classes */
    .timesheet-table th[class*="text-right"],
    .timesheet-table td[class*="text-right"] {
      text-align: right !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td width="80" style="vertical-align: middle;">
          <img src="${logoSrc}" alt="Espro Payroll" class="logo" />
        </td>
        <td style="text-align: right;">
          <h1>Payslip – ${entry.employeeName}</h1>
          <p class="period">Period: ${periodStart} – ${periodEnd}</p>
        </td>
      </tr>
    </table>

    <!-- Summary Section (3 Columns) -->
    <table class="summary-table">
      <tr>
        <td class="summary-td">
          <div class="card" style="min-height: 180px;">
            <span class="card-label">Employee</span>
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">${entry.employeeName}</div>
            ${employee?.position ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${employee.position}</div>` : ''}
            ${employee ? `<div style="font-size: 12px; color: #6b7280;">${computeDisplayRate(employee)}</div>` : ''}
          </div>
        </td>
        <td class="summary-td">
          <div class="card" style="min-height: 180px;">
            <span class="card-label">Totals</span>
            <div class="totals-row">
              Worked Hours: <span class="totals-val">${formatHours(entry.totalHoursWorked)}</span><br>
              OT Hours: <span class="totals-val">${formatHours(entry.regularOvertimeHours !== undefined ? entry.regularOvertimeHours : (entry.overtimeHours || 0))}</span><br>
              OT RH Hours: <span class="totals-val">${formatHours(entry.overtimeRegularHolidayHours || 0)}</span><br>
              OT SH Hours: <span class="totals-val">${formatHours(entry.overtimeSpecialHolidayHours || 0)}</span><br>
              ND Hours: <span class="totals-val">${formatHours(entry.nightDiffHours)}</span><br>
              Reg Holiday Hrs: <span class="totals-val">${formatHours(entry.regularHolidayHours)}</span><br>
              Spl Holiday Hrs: <span class="totals-val">${formatHours(entry.specialHolidayHours)}</span>
            </div>
          </div>
        </td>
        <td class="summary-td">
          <div class="card" style="min-height: 180px;">
            <span class="card-label">Net Pay</span>
            <div class="net-pay">&#8369; ${formatMoney(entry.netSalary)}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Components Section (2 Columns) -->
    <table class="components-table">
      <tr>
        <td class="components-td">
          <div class="card" style="min-height: 340px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">Salary Components</div>
            
            <div class="component-row">
              <span class="comp-name">Basic</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.basicSalary)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">Overtime</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.overtimePay || 0)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">OT Regular Holiday</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.overtimeRegularHolidayPay || 0)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">OT Special Holiday</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.overtimeSpecialHolidayPay || 0)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">Night Diff</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.nightDiffPay)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">Reg Holiday</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.regularHolidayPay)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">Spl Holiday</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.specialHolidayPay)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">Total Allowances</span>
              <span class="comp-val">&#8369; ${formatMoney(entry.allowancesTotal)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row">
              <span class="comp-name">Total Deductions</span>
              <span class="comp-val" style="color: #dc2626;">- &#8369; ${formatMoney(entry.deductionsTotal)}</span>
              <div class="clear"></div>
            </div>
            <div class="component-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
              <span class="comp-name" style="font-weight: bold;">Total Salary Components</span>
              <span class="comp-val" style="font-weight: bold;">&#8369; ${formatMoney(
                (entry.basicSalary || 0) +
                (entry.overtimePay || 0) +
                (entry.overtimeRegularHolidayPay || 0) +
                (entry.overtimeSpecialHolidayPay || 0) +
                (entry.nightDiffPay || 0) +
                (entry.regularHolidayPay || 0) +
                (entry.specialHolidayPay || 0) +
                (entry.allowancesTotal || 0) -
                (entry.deductionsTotal || 0)
              )}</span>
              <div class="clear"></div>
            </div>
          </div>
        </td>
        <td class="components-td">
          <div class="card" style="min-height: 340px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">Allowances & Deductions</div>

            ${adjustments && adjustments.length > 0 ? `
            <table class="adjustments-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style="text-align: center;">Type</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${adjustments.map(a => `
                <tr>
                  <td>${a.name}</td>
                  <td style="text-align: center;">
                    <span class="badge ${a.type === 'ALLOWANCE' ? 'badge-allowance' : 'badge-deduction'}">
                      ${a.type === 'ALLOWANCE' ? 'ALLOWANCE' : 'DEDUCTION'}
                    </span>
                  </td>
                  <td style="text-align: right;">&#8369; ${formatMoney(a.amount)}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<div style="color: #6b7280; font-size: 12px; margin-top: 10px;">No adjustments.</div>'}
          </div>
        </td>
      </tr>
    </table>

    <!-- Timesheet Entries -->
    ${timesheetLogs && timesheetLogs.length > 0 ? `
    <div class="timesheet-section">
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Timesheet Entries</div>
      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="timesheet-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th class="text-right" style="text-align: right !important;">Hours</th>
              <th class="text-right" style="text-align: right !important;">OT Hrs</th>
              <th class="text-right" style="text-align: right !important;">OT RH Hrs</th>
              <th class="text-right" style="text-align: right !important;">OT SH Hrs</th>
              <th class="text-right" style="text-align: right !important;">ND Hrs</th>
              <th style="text-align: center !important;">Holiday</th>
            </tr>
          </thead>
          <tbody>
            ${timesheetLogs.map(log => {
        // Calculate OT breakdown based on approved/adjusted hours worked (only approved OT is counted)
        const effectiveHours = log.adjustedHoursWorked !== undefined ? log.adjustedHoursWorked : (log.hoursWorked || 0);
        const STANDARD_HOURS_PER_DAY = 8;
        let regularOT = 0;
        let otRH = 0;
        let otSH = 0;
        
        if (effectiveHours > STANDARD_HOURS_PER_DAY) {
          const overtimeHours = effectiveHours - STANDARD_HOURS_PER_DAY;
          if (log.isHoliday && log.holidayType === 'Regular') {
            otRH = overtimeHours;
          } else if (log.isHoliday && log.holidayType === 'Special') {
            otSH = overtimeHours;
          } else {
            regularOT = overtimeHours;
          }
        }
        
        const holidayDisplay = log.isHoliday ? (log.holidayType || 'Holiday') : '';
        return `
            <tr>
              <td>${log.date ? formatDate(log.date) : ''}</td>
              <td>${formatTime(log.timeIn)}</td>
              <td>${formatTime(log.timeOut)}</td>
              <td class="text-right" style="text-align: right !important;">${formatHours(log.adjustedHoursWorked || 0)}</td>
              <td class="text-right" style="text-align: right !important;">${formatHours(regularOT)}</td>
              <td class="text-right" style="text-align: right !important; color: #9333ea;">${formatHours(otRH)}</td>
              <td class="text-right" style="text-align: right !important; color: #ec4899;">${formatHours(otSH)}</td>
              <td class="text-right" style="text-align: right !important;">${formatHours(log.ndHours || 0)}</td>
              <td style="text-align: center !important;">${holidayDisplay}</td>
            </tr>
            `;
    }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `;
}
