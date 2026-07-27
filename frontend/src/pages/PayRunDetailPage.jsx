import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { payRunAPI, employeeAPI } from '../services/api';
import { formatHours } from '../utils/formatters';
import Modal from '../components/Modal';
import ResponsiveTableWrapper from '../components/ResponsiveTableWrapper';

const PayRunDetailPage = () => {
  const { payRunId } = useParams();
  const navigate = useNavigate();
  const [payRun, setPayRun] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [adjustEmployee, setAdjustEmployee] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({
    type: 'ALLOWANCE',
    name: '',
    amount: '',
    frequency: 'ONE_TIME'
  });
  const [sort, setSort] = useState({ field: 'employeeName', direction: 'asc' });
  const [sendingEmailId, setSendingEmailId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await payRunAPI.getById(payRunId);
        setPayRun(res.data || res);
        setEmployees(res.employees || res.employees || []);
      } catch (error) {
        setMessage({
          type: 'error',
          text: error.response?.data?.error || 'Failed to load pay run'
        });
      } finally {
        setLoading(false);
      }
    };
    load();

    // Polling for email status
    const pollInterval = setInterval(async () => {
      if (!payRunId) return;
      try {
        const res = await payRunAPI.getById(payRunId);
        const data = res.data || res;

        // Update payRun state if status changed
        setPayRun(prev => {
          if (!prev) return data;
          if (prev.emailStatus !== data.emailStatus) {
            if (data.emailStatus === 'COMPLETED') {
              setMessage({ type: 'success', text: 'All payslips sent successfully!' });
            } else if (data.emailStatus === 'FAILED') {
              setMessage({ type: 'error', text: 'Email sending failed. Check server logs.' });
            }
            return data;
          }
          return prev;
        });
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [payRunId]);

  const formatMoney = (value) =>
    (value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const handleSort = (field) => {
    setSort((prev) => {
      const direction =
        prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc';
      return { field, direction };
    });
  };

  const getSortIcon = (field) => {
    if (sort.field !== field) return '';
    return sort.direction === 'asc' ? '↑' : '↓';
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    const { field, direction } = sort;
    const dir = direction === 'asc' ? 1 : -1;
    const va = a[field] ?? 0;
    const vb = b[field] ?? 0;
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * dir;
    }
    return (Number(va) - Number(vb)) * dir;
  });

  const totals = (() => {
    if (!employees || employees.length === 0) {
      return {
        totalGross: 0,
        totalNet: 0,
        totalAllowances: 0,
        totalDeductions: 0
      };
    }
    return employees.reduce(
      (acc, emp) => {
        const gross =
          (emp.basicSalary || 0) +
          (emp.overtimePay || 0) +
          (emp.overtimeRegularHolidayPay || 0) +
          (emp.overtimeSpecialHolidayPay || 0) +
          (emp.nightDiffPay || 0) +
          (emp.regularHolidayPay || 0) +
          (emp.specialHolidayPay || 0) +
          (emp.allowancesTotal || 0);
        acc.totalGross += gross;
        acc.totalNet += emp.netSalary || 0;
        acc.totalAllowances += emp.allowancesTotal || 0;
        acc.totalDeductions += emp.deductionsTotal || 0;
        return acc;
      },
      {
        totalGross: 0,
        totalNet: 0,
        totalAllowances: 0,
        totalDeductions: 0
      }
    );
  })();

  const handleRecalculate = async () => {
    try {
      const res = await payRunAPI.recalculate(payRunId);
      setPayRun(res.data || res);
      setEmployees(res.employees || res.employees || []);
      setMessage({ type: 'success', text: 'Pay run recalculated successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to recalculate pay run'
      });
    }
  };

  const openAdjustModal = async (emp) => {
    setAdjustEmployee(emp);
    setAdjForm({
      type: 'ALLOWANCE',
      name: '',
      amount: '',
      frequency: 'ONE_TIME'
    });
    try {
      const res = await employeeAPI.getAdjustments(emp.employeeId);
      // Filter to items active in this pay run period
      const all = res.data || res;
      const start = new Date(payRun.payrollPeriodStart);
      const end = new Date(payRun.payrollPeriodEnd);
      const filtered = all.filter((a) => {
        const from = a.appliesFrom ? new Date(a.appliesFrom) : null;
        const to = a.appliesTo ? new Date(a.appliesTo) : null;
        if (!from) return false;
        const withinStart = from <= end;
        const withinEnd = !to || to >= start;
        return withinStart && withinEnd;
      });
      setAdjustments(filtered);
      setIsAdjustModalOpen(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load adjustments'
      });
    }
  };

  const handleAddAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustEmployee) return;
    try {
      const payload = {
        type: adjForm.type,
        name: adjForm.name,
        amount: parseFloat(adjForm.amount || '0'),
        frequency: 'ONE_TIME',
        appliesFrom: payRun.payrollPeriodStart,
        appliesTo: payRun.payrollPeriodEnd
      };
      const res = await employeeAPI.createAdjustment(
        adjustEmployee.employeeId,
        payload
      );
      const item = res.data || res;
      setAdjustments((prev) => [item, ...prev]);
      setAdjForm({
        ...adjForm,
        name: '',
        amount: ''
      });
      const updatedRes = await payRunAPI.updateEmployee(
        adjustEmployee._id,
        {}
      );
      const updatedEmp = updatedRes.data || updatedRes;
      setAdjustEmployee(updatedEmp);
      setEmployees((prev) =>
        prev.map((e) => (e._id === updatedEmp._id ? updatedEmp : e))
      );
      setMessage({ type: 'success', text: 'Adjustment added.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to add adjustment'
      });
    }
  };

  const handleDeleteAdjustment = async (id) => {
    if (!confirm('Delete this adjustment?')) return;
    try {
      await employeeAPI.deleteAdjustment(id);
      setAdjustments((prev) => prev.filter((a) => a._id !== id));
      const updatedRes = await payRunAPI.updateEmployee(
        adjustEmployee._id,
        {}
      );
      const updatedEmp = updatedRes.data || updatedRes;
      setAdjustEmployee(updatedEmp);
      setEmployees((prev) =>
        prev.map((e) => (e._id === updatedEmp._id ? updatedEmp : e))
      );
      setMessage({ type: 'success', text: 'Adjustment deleted.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to delete adjustment'
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading pay run...</div>;
  }

  if (!payRun) {
    return <div className="p-6">Pay run not found.</div>;
  }

  return (
    <div className="px-4 py-6 w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pay Run Details</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {payRun.status === 'DRAFT' && (
            <>
              <button
                onClick={handleRecalculate}
                className="flex-1 sm:flex-none px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium min-h-[40px]"
              >
                Recalculate
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await payRunAPI.updateStatus(
                      payRunId,
                      'APPROVED'
                    );
                    const updated = res.data || res;
                    setPayRun(updated);
                    setMessage({
                      type: 'success',
                      text: 'Pay run approved.'
                    });
                  } catch (error) {
                    setMessage({
                      type: 'error',
                      text:
                        error.response?.data?.error ||
                        'Failed to approve pay run'
                    });
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium min-h-[40px]"
              >
                Approve
              </button>
            </>
          )}

          {payRun.status === 'APPROVED' && (
            <>
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Revert back to draft
                    const res = await payRunAPI.updateStatus(
                      payRunId,
                      'DRAFT'
                    );
                    const updated = res.data || res;
                    setPayRun(updated);
                    setMessage({
                      type: 'success',
                      text: 'Pay run reverted to draft.'
                    });
                  } catch (error) {
                    setMessage({
                      type: 'error',
                      text:
                        error.response?.data?.error ||
                        'Failed to revert pay run to draft'
                    });
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium min-h-[40px]"
              >
                Revert to Draft
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await payRunAPI.updateStatus(
                      payRunId,
                      'PAID'
                    );
                    const updated = res.data || res;
                    setPayRun(updated);
                    setMessage({
                      type: 'success',
                      text: 'Pay run marked as paid.'
                    });
                  } catch (error) {
                    setMessage({
                      type: 'error',
                      text:
                        error.response?.data?.error ||
                        'Failed to mark pay run as paid'
                    });
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium min-h-[40px]"
              >
                Mark as Paid
              </button>
            </>
          )}

          {payRun.status === 'PAID' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await payRunAPI.emailAllPayslips(payRunId);
                  const payload = res.data || res;
                  const count = payload.recipients?.length ?? 0;
                  setMessage({
                    type: 'success',
                    text:
                      count > 0
                        ? `Email stub: ${count} employees would receive payslips.`
                        : 'Email stub: no employees with email found.'
                  });
                  setPayRun(prev => ({ ...prev, emailStatus: 'SENDING' }));
                } catch (error) {
                  setMessage({
                    type: 'error',
                    text:
                      error.response?.data?.error ||
                      'Failed to trigger email stub for payslips'
                  });
                }
              }}
              className="w-full sm:w-auto px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-medium min-h-[40px]"
            >
              Email All Payslips
            </button>
          )}

          {payRun.emailStatus === 'SENDING' && (
            <span className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg border border-gray-200 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending Emails...
            </span>
          )}
        </div>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${message.type === 'success'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
            }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-sm text-gray-700">
          <div>
            <div className="font-medium text-gray-500">Period</div>
            <div className="text-xs sm:text-sm">
              {payRun.payrollPeriodStart &&
                new Date(payRun.payrollPeriodStart).toLocaleDateString()}{' '}
              -{' '}
              {payRun.payrollPeriodEnd &&
                new Date(payRun.payrollPeriodEnd).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-500">Payout Date</div>
            <div className="text-xs sm:text-sm">
              {payRun.payoutDate &&
                new Date(payRun.payoutDate).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-500">Status</div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              {payRun.status}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-500">Employees</div>
            <div className="font-semibold">{employees.length}</div>
          </div>
          <div>
            <div className="font-medium text-gray-500">Total Gross</div>
            <div className="font-semibold text-green-700">
              {formatMoney(totals.totalGross)}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-500">Total Net</div>
            <div className="font-semibold text-blue-700">
              {formatMoney(totals.totalNet)}
            </div>
          </div>
        </div>
      </div>

      <ResponsiveTableWrapper stickyFirstColumn={true}>
        <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('employeeName')}
                    className="flex items-center gap-1"
                  >
                    <span>Employee</span>
                    <span className="text-[10px]">
                      {getSortIcon('employeeName')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('totalHoursWorked')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>Hours</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('totalHoursWorked')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('regularOvertimeHours')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>OT Hrs</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('regularOvertimeHours')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('overtimeRegularHolidayHours')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>OT RH Hrs</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('overtimeRegularHolidayHours')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('overtimeSpecialHolidayHours')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>OT SH Hrs</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('overtimeSpecialHolidayHours')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('nightDiffHours')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>ND Hrs</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('nightDiffHours')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('regularHolidayHours')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>RH Hrs</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('regularHolidayHours')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('specialHolidayHours')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>SH Hrs</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('specialHolidayHours')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('basicSalary')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>Basic</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('basicSalary')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('overtimePay')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>OT Pay</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('overtimePay')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('overtimeRegularHolidayPay')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>OT RH Pay</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('overtimeRegularHolidayPay')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('overtimeSpecialHolidayPay')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>OT SH Pay</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('overtimeSpecialHolidayPay')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('nightDiffPay')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>ND Pay</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('nightDiffPay')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('regularHolidayPay')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>Reg Holiday</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('regularHolidayPay')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('specialHolidayPay')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>Spec Holiday</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('specialHolidayPay')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('allowancesTotal')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>Allw</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('allowancesTotal')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <button
                    type="button"
                    onClick={() => handleSort('deductionsTotal')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>Ded</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('deductionsTotal')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">
                  <button
                    type="button"
                    onClick={() => handleSort('netSalary')}
                    className="flex items-center gap-2 w-full justify-end"
                  >
                    <span>Net</span>
                    <span className="text-[10px] flex-shrink-0">
                      {getSortIcon('netSalary')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-28">
                  Payslip
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan="14"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No employees found for this pay run.
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((emp) => (
                  <tr
                    key={emp._id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => openAdjustModal(emp)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {emp.employeeName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatHours(emp.totalHoursWorked)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatHours(
                        emp.regularOvertimeHours !== undefined
                          ? emp.regularOvertimeHours
                          : Math.max(0, (emp.overtimeHours || 0) - (emp.overtimeRegularHolidayHours || 0) - (emp.overtimeSpecialHolidayHours || 0))
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-purple-600">
                      {formatHours(emp.overtimeRegularHolidayHours || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-pink-600">
                      {formatHours(emp.overtimeSpecialHolidayHours || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatHours(emp.nightDiffHours)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatHours(emp.regularHolidayHours)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatHours(emp.specialHolidayHours)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(emp.basicSalary)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(emp.overtimePay)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-purple-600">
                      {formatMoney(emp.overtimeRegularHolidayPay || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-pink-600">
                      {formatMoney(emp.overtimeSpecialHolidayPay || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(emp.nightDiffPay)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(emp.regularHolidayPay)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(emp.specialHolidayPay)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(emp.allowancesTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatMoney(emp.deductionsTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold w-24">
                      {formatMoney(emp.netSalary)}
                    </td>
                    <td className="px-4 py-3 text-sm w-28">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/pay-runs/${payRunId}/payslips/${emp._id}`);
                          }}
                          className="w-24 px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                        >
                          View
                        </button>
                        {payRun.status === 'PAID' && (
                          <button
                            type="button"
                            disabled={sendingEmailId === emp._id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setSendingEmailId(emp._id);
                              try {
                                const res =
                                  await payRunAPI.emailPayslipForEmployee(
                                    payRunId,
                                    emp._id
                                  );
                                const payload = res.data || res;
                                setMessage({
                                  type: 'success',
                                  text:
                                    'Email stub: payslip would be sent to ' +
                                    (payload.recipient?.email ||
                                      'employee email')
                                });
                              } catch (error) {
                                setMessage({
                                  type: 'error',
                                  text:
                                    error.response?.data?.error ||
                                    'Failed to trigger email stub for this payslip'
                                });
                              } finally {
                                setSendingEmailId(null);
                              }
                            }}
                            className={`w-24 px-3 py-1.5 text-xs text-white rounded-lg ${sendingEmailId === emp._id
                              ? 'bg-indigo-400 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                          >
                            {sendingEmailId === emp._id ? 'Sending...' : 'Email'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveTableWrapper>

      {/* Adjustments & Overrides Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={
          adjustEmployee
            ? `Adjustments – ${adjustEmployee.employeeName}`
            : 'Adjustments'
        }
      >
        {adjustEmployee && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              <div className="font-semibold">
                Period:{' '}
                {new Date(payRun.payrollPeriodStart).toLocaleDateString()} –{' '}
                {new Date(payRun.payrollPeriodEnd).toLocaleDateString()}
              </div>
              <div className="text-xs text-gray-500">
                Add ONE-TIME allowances or deductions for this pay run. Click
                "Recalculate" afterward to update amounts.
              </div>
            </div>

            {/* Override hours for this pay run */}
            <div className="border-t pt-3 space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Override Hours (this pay run only)
              </h3>
              <form
                className="grid grid-cols-2 md:grid-cols-3 gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!adjustEmployee) return;
                  try {
                    const payload = {
                      totalHoursWorked: Number(
                        adjustEmployee.totalHoursWorked || 0
                      ),
                      regularOvertimeHours: Number(
                        adjustEmployee.regularOvertimeHours || adjustEmployee.overtimeHours || 0
                      ),
                      nightDiffHours: Number(
                        adjustEmployee.nightDiffHours || 0
                      ),
                      regularHolidayHours: Number(
                        adjustEmployee.regularHolidayHours || 0
                      ),
                      specialHolidayHours: Number(
                        adjustEmployee.specialHolidayHours || 0
                      )
                    };

                    const res = await payRunAPI.updateEmployee(
                      adjustEmployee._id,
                      payload
                    );
                    const updated = res.data || res;
                    setAdjustEmployee(updated);
                    setEmployees((prev) =>
                      prev.map((e) => (e._id === updated._id ? updated : e))
                    );
                    setMessage({
                      type: 'success',
                      text: 'Overrides saved.'
                    });
                  } catch (error) {
                    setMessage({
                      type: 'error',
                      text:
                        error.response?.data?.error ||
                        'Failed to save overrides'
                    });
                  }
                }}
              >
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Hours
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustEmployee.totalHoursWorked ?? ''}
                    onChange={(e) =>
                      setAdjustEmployee({
                        ...adjustEmployee,
                        totalHoursWorked: e.target.value
                      })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    OT Hours
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustEmployee.regularOvertimeHours ?? adjustEmployee.overtimeHours ?? ''}
                    onChange={(e) =>
                      setAdjustEmployee({
                        ...adjustEmployee,
                        regularOvertimeHours: e.target.value
                      })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ND Hours
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustEmployee.nightDiffHours ?? ''}
                    onChange={(e) =>
                      setAdjustEmployee({
                        ...adjustEmployee,
                        nightDiffHours: e.target.value
                      })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reg Holiday Hrs
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustEmployee.regularHolidayHours ?? ''}
                    onChange={(e) =>
                      setAdjustEmployee({
                        ...adjustEmployee,
                        regularHolidayHours: e.target.value
                      })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Spec Holiday Hrs
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustEmployee.specialHolidayHours ?? ''}
                    onChange={(e) =>
                      setAdjustEmployee({
                        ...adjustEmployee,
                        specialHolidayHours: e.target.value
                      })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Save Overrides
                  </button>
                </div>
              </form>
            </div>

            {/* Add adjustment */}
            <form onSubmit={handleAddAdjustment} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={adjForm.type}
                    onChange={(e) =>
                      setAdjForm({ ...adjForm, type: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="ALLOWANCE">Allowance</option>
                    <option value="DEDUCTION">Deduction</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={adjForm.name}
                    onChange={(e) =>
                      setAdjForm({ ...adjForm, name: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="e.g., Special Holiday, Gas Allowance"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjForm.amount}
                    onChange={(e) =>
                      setAdjForm({ ...adjForm, amount: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Adjustment
                </button>
              </div>
            </form>

            {/* Existing adjustments */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Existing Adjustments in this Period
              </h3>
              {adjustments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No allowances or deductions yet.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="px-2 py-1 text-left">Name</th>
                        <th className="px-2 py-1 text-left">Type</th>
                        <th className="px-2 py-1 text-right">Amount</th>
                        <th className="px-2 py-1 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((a) => (
                        <tr key={a._id} className="border-t">
                          <td className="px-2 py-1">{a.name}</td>
                          <td className="px-2 py-1 text-xs">
                            <span
                              className={`px-1.5 py-0.5 rounded-full font-semibold ${a.type === 'ALLOWANCE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                                }`}
                            >
                              {a.type}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-right">
                            {formatMoney(a.amount)}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <button
                              onClick={() => handleDeleteAdjustment(a._id)}
                              className="text-xs text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PayRunDetailPage;


