import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeePortalAPI } from '../services/api';
import { formatHours } from '../utils/formatters';

const EmployeePayslipViewPage = () => {
  const { payRunId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPayslipDetail();
  }, [payRunId]);

  const fetchPayslipDetail = async () => {
    try {
      setLoading(true);
      const res = await employeePortalAPI.getPayslipDetail(payRunId);
      const payload = res?.data?.payRun ? res.data : (res?.payRun ? res : res?.data);
      setData(payload);
    } catch (err) {
      console.error('Failed to load payslip detail:', err);
      setError(err.response?.data?.error || 'Failed to load payslip details.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) =>
    Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : '';

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">!</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Unable to Load Payslip</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'Payslip record not found.'}</p>
          <button
            onClick={() => navigate('/employee/payslips')}
            className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700"
          >
            Return to My Payslips
          </button>
        </div>
      </div>
    );
  }

  const { payRun, entry, timesheetLogs = [] } = data;

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      {/* Top Action Bar (hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <button
          onClick={() => navigate('/employee/payslips')}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-300 shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to My Payslips
        </button>

        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 000-4h-6a2 2 0 000 4zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Download PDF
        </button>
      </div>

      {/* Official Payslip Printable Container */}
      <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 rounded-2xl shadow-lg border border-gray-200 print:shadow-none print:border-none print:p-0">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">PAYSLIP</h1>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
              ESPRO Payroll System
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 text-xs font-black bg-emerald-100 text-emerald-800 rounded-md uppercase">
              PAID
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Period: <span className="font-semibold text-gray-800">{formatDate(payRun.payPeriodStart || payRun.payrollPeriodStart)} – {formatDate(payRun.payPeriodEnd || payRun.payrollPeriodEnd)}</span>
            </p>
          </div>
        </div>

        {/* Employee Summary Card */}
        <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 border border-gray-200 text-xs">
          <div>
            <span className="text-gray-500 block font-medium">Employee Name</span>
            <span className="font-bold text-gray-900 text-sm">{entry.employeeName}</span>
          </div>
          <div>
            <span className="text-gray-500 block font-medium">Position</span>
            <span className="font-semibold text-gray-800">{entry.position || 'Staff'}</span>
          </div>
          <div>
            <span className="text-gray-500 block font-medium">Employment Type</span>
            <span className="font-semibold text-gray-800 capitalize">{entry.employmentType ? entry.employmentType.toLowerCase().replace('_', ' ') : 'Full Time'}</span>
          </div>
          <div>
            <span className="text-gray-500 block font-medium">Base Wage Rate</span>
            <span className="font-semibold text-gray-800">
              ₱{formatCurrency(entry.wageRate || (entry.totalHoursWorked ? ((entry.basicSalary || entry.basicPay || 0) / entry.totalHoursWorked) : 0))} / {entry.wageType === 'DAILY' ? 'day' : 'hr'}
            </span>
          </div>
        </div>

        {/* Earnings & Deductions Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Earnings */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2 uppercase tracking-wider">
              Earnings
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2 text-gray-600">Basic Pay</td>
                  <td className="px-4 py-2 font-semibold text-right">₱{formatCurrency(entry.basicSalary !== undefined ? entry.basicSalary : entry.basicPay)}</td>
                </tr>
                {(entry.regularOvertimeHours > 0 || entry.overtimeHours > 0 || entry.overtimePay > 0) && (
                  <tr>
                    <td className="px-4 py-2 text-gray-600">Regular OT ({formatHours(entry.overtimeHours || entry.regularOvertimeHours)} hrs)</td>
                    <td className="px-4 py-2 font-semibold text-right">₱{formatCurrency(entry.overtimePay)}</td>
                  </tr>
                )}
                {(entry.ndHours > 0 || entry.nightDiffHours > 0 || entry.ndPay > 0 || entry.nightDiffPay > 0) && (
                  <tr>
                    <td className="px-4 py-2 text-gray-600">Night Differential ({formatHours(entry.nightDiffHours || entry.ndHours)} hrs)</td>
                    <td className="px-4 py-2 font-semibold text-right">₱{formatCurrency(entry.nightDiffPay !== undefined ? entry.nightDiffPay : entry.ndPay)}</td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-2 text-gray-600">Allowances</td>
                  <td className="px-4 py-2 font-semibold text-right">₱{formatCurrency(entry.allowancesTotal !== undefined ? entry.allowancesTotal : (entry.allowances || 0))}</td>
                </tr>
                <tr className="bg-gray-50 font-bold border-t border-gray-200">
                  <td className="px-4 py-2.5 text-gray-900">GROSS SALARY</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">
                    ₱{formatCurrency(
                      (entry.grossSalary && entry.grossSalary > 0)
                        ? entry.grossSalary
                        : ((entry.basicSalary !== undefined ? entry.basicSalary : (entry.basicPay || 0)) +
                           (entry.overtimePay || 0) +
                           (entry.nightDiffPay !== undefined ? entry.nightDiffPay : (entry.ndPay || 0)) +
                           (entry.allowancesTotal !== undefined ? entry.allowancesTotal : (entry.allowances || 0)))
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deductions */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2 uppercase tracking-wider">
              Deductions
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                {entry.withholdingTax > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-gray-600">Withholding Tax</td>
                    <td className="px-4 py-2 font-semibold text-right">₱{formatCurrency(entry.withholdingTax)}</td>
                  </tr>
                )}
                {entry.otherDeductions > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-gray-600">Other Deductions</td>
                    <td className="px-4 py-2 font-semibold text-right">₱{formatCurrency(entry.otherDeductions)}</td>
                  </tr>
                )}
                <tr className="bg-gray-50 font-bold border-t border-gray-200">
                  <td className="px-4 py-2.5 text-gray-900">TOTAL DEDUCTIONS</td>
                  <td className="px-4 py-2.5 text-right text-rose-600">
                    -₱{formatCurrency(entry.totalDeductions !== undefined ? entry.totalDeductions : (entry.deductionsTotal || 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Net Pay Highlight Banner */}
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 mb-8 flex justify-between items-center">
          <div>
            <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest block">TAKE HOME PAY</span>
            <span className="text-xs text-emerald-700">Gross Salary minus Total Deductions</span>
          </div>
          <span className="text-3xl font-black text-emerald-700 tracking-tight">
            ₱{formatCurrency(entry.netSalary)}
          </span>
        </div>

        {/* Detailed Timesheet Entries Table */}
        {timesheetLogs.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
              Timesheet Breakdown ({timesheetLogs.length} days logged)
            </h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Time In</th>
                    <th className="px-3 py-2">Time Out</th>
                    <th className="px-3 py-2 text-right">Hours</th>
                    <th className="px-3 py-2 text-right">OT Hrs</th>
                    <th className="px-3 py-2 text-right">ND Hrs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {timesheetLogs.map((log) => {
                    const approvedHours = log.adjustedHoursWorked !== undefined && log.adjustedHoursWorked !== null
                      ? log.adjustedHoursWorked
                      : Math.min(log.hoursWorked || 0, 8);
                    const overtimeHours = approvedHours > 8 ? (approvedHours - 8) : 0;
                    return (
                      <tr key={log._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{formatDate(log.date)}</td>
                        <td className="px-3 py-2 text-gray-600">{formatTime(log.timeIn)}</td>
                        <td className="px-3 py-2 text-gray-600">{formatTime(log.timeOut)}</td>
                        <td className="px-3 py-2 font-semibold text-right">{formatHours(approvedHours)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatHours(overtimeHours)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatHours(log.ndHours || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePayslipViewPage;
