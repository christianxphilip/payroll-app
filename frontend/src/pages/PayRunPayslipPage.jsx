import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { payRunAPI } from '../services/api';
import { formatHours } from '../utils/formatters';

const PayRunPayslipPage = () => {
  const { payRunId, entryId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await payRunAPI.getPayslip(payRunId, entryId);
        const payload = res.data || res;
        setData(payload);
      } catch (error) {
        setMessage({
          type: 'error',
          text: error.response?.data?.error || 'Failed to load payslip'
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [payRunId, entryId]);

  const formatMoney = (value) =>
    (value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  if (loading) {
    return <div className="p-6">Loading payslip...</div>;
  }

  if (!data) {
    return <div className="p-6">Payslip not found.</div>;
  }

  const { payRun, entry, employee, adjustments, timesheetLogs } = data;

  const computeDisplayRate = () => {
    if (!employee) return '';
    const rate = employee.wageRate || 0;
    if (employee.employmentType === 'FULL_TIME' && employee.wageType === 'HOURLY') {
      // Full-time hourly: show daily rate = hourly * 8
      return `Rate: ₱ ${formatMoney(rate * 8)}`;
    }
    if (employee.wageType === 'HOURLY') {
      // Part-time hourly: show hourly rate
      return `Rate: ₱ ${formatMoney(rate)} / hour`;
    }
    // Fallback: show raw wage rate (e.g., daily)
    return `Rate: ₱ ${formatMoney(rate)}`;
  };

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Print styles */}
      <style>
        {`@media print {
            .no-print {
              display: none !important;
            }
            /* Keep tiles side-by-side on print, similar to in-app layout */
            .payslip-grid-3 {
              display: grid !important;
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              grid-auto-rows: 1fr !important;
              gap: 1rem !important;
            }
            .payslip-grid-2 {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              grid-auto-rows: 1fr !important;
              gap: 1rem !important;
            }
            .payslip-grid-3,
            .payslip-grid-2 {
              align-items: stretch !important;
            }
            .payslip-grid-3 > div,
            .payslip-grid-2 > div {
              height: 100% !important;
              display: flex !important;
              flex-direction: column !important;
            }
            /* Let browser decide page breaks; avoid forced breaks */
            .page-break {
              page-break-before: auto !important;
              page-break-inside: avoid;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }`}
      </style>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <img
            src="/Text Logo - Transparent Black.png"
            alt="Espro Payroll"
            className="h-20 object-contain"
          />
          <div>
            <button
              onClick={() => navigate(`/pay-runs/${payRunId}`)}
              className="text-sm text-blue-600 hover:underline mb-1 no-print"
            >
              ← Back to Pay Run
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Payslip – {entry.employeeName}
            </h1>
            <p className="text-sm text-gray-600">
              Period:{' '}
              {new Date(payRun.payrollPeriodStart).toLocaleDateString()} –{' '}
              {new Date(payRun.payrollPeriodEnd).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          {payRun.status === 'PAID' && (
            <button
              onClick={async () => {
                if (!confirm('Send payslip via email to this employee?')) return;
                setSendingEmail(true);
                try {
                  const res = await payRunAPI.emailPayslipForEmployee(payRunId, entryId);
                  const payload = res.data || res;
                  if (payload.stub) {
                    setMessage({
                      type: 'success',
                      text: `Email stub: payslip would be sent to ${entry.employeeName}`
                    });
                  } else {
                    setMessage({
                      type: 'success',
                      text: `Payslip email sent successfully to ${entry.employeeName}`
                    });
                  }
                } catch (error) {
                  setMessage({
                    type: 'error',
                    text: error.response?.data?.error || 'Failed to send payslip email'
                  });
                } finally {
                  setSendingEmail(false);
                }
              }}
              disabled={sendingEmail}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingEmail ? 'Sending...' : 'Email'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            Print
          </button>
        </div>
      </div>

      {message.text && (
        <div
          className={`p-3 rounded ${
            message.type === 'error'
              ? 'bg-red-100 text-red-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 payslip-grid-3">
        <div className="bg-white shadow rounded-lg p-4 flex flex-col h-full">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
            Employee
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {entry.employeeName}
          </div>
          {employee?.position && (
            <div className="text-xs text-gray-600">{employee.position}</div>
          )}
          {employee && (
            <div className="mt-1 text-xs text-gray-500">
              {computeDisplayRate()}
            </div>
          )}
          <div className="flex-grow"></div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 flex flex-col h-full">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
            Totals
          </div>
          <div className="text-xs text-gray-600 flex flex-col gap-1 flex-grow">
            <span>
              Worked Hours:{' '}
              <span className="font-semibold">
                {formatHours(entry.totalHoursWorked)}
              </span>
            </span>
            <span>
              OT Hours:{' '}
              <span className="font-semibold">
                {formatHours(entry.regularOvertimeHours !== undefined ? entry.regularOvertimeHours : (entry.overtimeHours || 0))}
              </span>
            </span>
            <span>
              OT RH Hours:{' '}
              <span className="font-semibold">
                {formatHours(entry.overtimeRegularHolidayHours || 0)}
              </span>
            </span>
            <span>
              OT SH Hours:{' '}
              <span className="font-semibold">
                {formatHours(entry.overtimeSpecialHolidayHours || 0)}
              </span>
            </span>
            <span>
              ND Hours:{' '}
              <span className="font-semibold">
                {formatHours(entry.nightDiffHours)}
              </span>
            </span>
            <span>
              Regular Holiday Hours:{' '}
              <span className="font-semibold">
                {formatHours(entry.regularHolidayHours)}
              </span>
            </span>
            <span>
              Special Holiday Hours:{' '}
              <span className="font-semibold">
                {formatHours(entry.specialHolidayHours)}
              </span>
            </span>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 flex flex-col h-full">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
            Net Pay
          </div>
          <div className="text-2xl font-bold text-gray-900 flex-grow flex items-center">
            ₱ {formatMoney(entry.netSalary)}
          </div>
        </div>
      </div>

      {/* Computation breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 payslip-grid-2">
        <div className="bg-white shadow rounded-lg p-4 flex flex-col h-full">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
            Salary Components
          </h2>
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between">
              <span>Basic</span>
              <span>₱ {formatMoney(entry.basicSalary)}</span>
            </div>
            <div className="flex justify-between">
              <span>Overtime</span>
              <span>₱ {formatMoney(entry.overtimePay || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>OT Regular Holiday</span>
              <span>₱ {formatMoney(entry.overtimeRegularHolidayPay || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>OT Special Holiday</span>
              <span>₱ {formatMoney(entry.overtimeSpecialHolidayPay || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Night Differential</span>
              <span>₱ {formatMoney(entry.nightDiffPay)}</span>
            </div>
            <div className="flex justify-between">
              <span>Regular Holiday Premium</span>
              <span>₱ {formatMoney(entry.regularHolidayPay)}</span>
            </div>
            <div className="flex justify-between">
              <span>Special Holiday Premium</span>
              <span>₱ {formatMoney(entry.specialHolidayPay)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Allowances</span>
              <span>₱ {formatMoney(entry.allowancesTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Deductions</span>
              <span className="text-red-600">- ₱ {formatMoney(entry.deductionsTotal)}</span>
            </div>
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between font-semibold">
              <span>Total Salary Components</span>
              <span>
                ₱ {formatMoney(
                  (entry.basicSalary || 0) +
                  (entry.overtimePay || 0) +
                  (entry.overtimeRegularHolidayPay || 0) +
                  (entry.overtimeSpecialHolidayPay || 0) +
                  (entry.nightDiffPay || 0) +
                  (entry.regularHolidayPay || 0) +
                  (entry.specialHolidayPay || 0) +
                  (entry.allowancesTotal || 0) -
                  (entry.deductionsTotal || 0)
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4 flex flex-col h-full">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
            Allowances & Deductions
          </h2>
          <div className="flex-grow max-h-48 overflow-y-auto border-t pt-2 text-sm">
            {adjustments.length === 0 ? (
              <div className="text-gray-500 text-sm">
                No allowances or deductions for this period.
              </div>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase">
                    <th className="px-1 py-1 text-left">Name</th>
                    <th className="px-1 py-1 text-left">Type</th>
                    <th className="px-1 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a._id} className="border-t">
                      <td className="px-1 py-1">{a.name}</td>
                      <td className="px-1 py-1">
                        <span
                          className={`px-1.5 py-0.5 rounded-full font-semibold ${
                            a.type === 'ALLOWANCE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {a.type}
                        </span>
                      </td>
                      <td className="px-1 py-1 text-right">
                        ₱ {formatMoney(a.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Timesheet entries - appear after summary; print may spill to next page if needed */}
      <div className="page-break">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Timesheet Entries
        </h2>
        <div className="bg-white shadow rounded-lg p-4">
          {(!timesheetLogs || timesheetLogs.length === 0) ? (
            <div className="text-sm text-gray-500">
              No timesheet entries for this employee in this period.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 uppercase border-b">
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">Time In</th>
                  <th className="px-2 py-1 text-left">Time Out</th>
                  <th className="px-2 py-1 text-right">Hours</th>
                  <th className="px-2 py-1 text-right">OT Hrs</th>
                  <th className="px-2 py-1 text-right">OT RH Hrs</th>
                  <th className="px-2 py-1 text-right">OT SH Hrs</th>
                  <th className="px-2 py-1 text-right">ND Hrs</th>
                  <th className="px-2 py-1 text-right">Holiday</th>
                </tr>
              </thead>
              <tbody>
                {timesheetLogs.map((log) => {
                  // Calculate OT breakdown based on approved hours worked (only approved OT > 8 hrs is counted)
                  const STANDARD_HOURS_PER_DAY = 8;
                  const approvedHours = log.adjustedHoursWorked !== undefined && log.adjustedHoursWorked !== null
                    ? log.adjustedHoursWorked
                    : Math.min(log.hoursWorked || 0, STANDARD_HOURS_PER_DAY);
                  let regularOT = 0;
                  let otRH = 0;
                  let otSH = 0;
                  
                  if (approvedHours > STANDARD_HOURS_PER_DAY) {
                    const overtimeHours = approvedHours - STANDARD_HOURS_PER_DAY;
                    if (log.isHoliday && log.holidayType === 'Regular') {
                      otRH = overtimeHours;
                    } else if (log.isHoliday && log.holidayType === 'Special') {
                      otSH = overtimeHours;
                    } else {
                      regularOT = overtimeHours;
                    }
                  }
                  
                  return (
                    <tr key={log._id} className="border-b">
                      <td className="px-2 py-1">
                        {log.date && new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-1">
                        {log.timeIn &&
                          new Date(log.timeIn).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                      </td>
                      <td className="px-2 py-1">
                        {log.timeOut &&
                          new Date(log.timeOut).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {formatHours(log.adjustedHoursWorked || 0)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {formatHours(regularOT)}
                      </td>
                      <td className="px-2 py-1 text-right font-medium text-purple-600">
                        {formatHours(otRH)}
                      </td>
                      <td className="px-2 py-1 text-right font-medium text-pink-600">
                        {formatHours(otSH)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {formatHours(log.ndHours || 0)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {log.isHoliday
                          ? (log.holidayType || 'Holiday')
                          : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayRunPayslipPage;


