export function generateGmailPayslipUrl({
  recipientEmail = '',
  employeeName = '',
  periodStart = '',
  periodEnd = '',
  basicPay = 0,
  overtimePay = 0,
  ndPay = 0,
  grossSalary = 0,
  totalDeductions = 0,
  netSalary = 0,
  payslipUrl = ''
}) {
  const formatCurrency = (val) =>
    Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : '';

  const subject = `Payslip for ${employeeName} (${formatDate(periodStart)} - ${formatDate(periodEnd)})`;

  const body = `Hi ${employeeName},

Here is a summary of your payslip for the pay period ${formatDate(periodStart)} to ${formatDate(periodEnd)}:

- Pay Period: ${formatDate(periodStart)} - ${formatDate(periodEnd)}
- Basic Pay: ₱${formatCurrency(basicPay)}
- Overtime Pay: ₱${formatCurrency(overtimePay)}
- Night Diff Pay: ₱${formatCurrency(ndPay)}
- Gross Salary: ₱${formatCurrency(grossSalary)}
- Total Deductions: ₱${formatCurrency(totalDeductions)}
----------------------------------------
NET PAY: ₱${formatCurrency(netSalary)}

View Detailed Payslip:
${payslipUrl || window.location.href}

Thank you,
ESPRO Payroll`;

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    recipientEmail
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openGmailPayslip(params) {
  const url = generateGmailPayslipUrl(params);
  window.open(url, '_blank');
}
