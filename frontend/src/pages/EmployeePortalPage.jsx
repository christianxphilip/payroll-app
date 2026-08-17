import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeePortalAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const EmployeePortalPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [employeeName, setEmployeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPayslips();
  }, []);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const res = await employeePortalAPI.getPayslips();
      const list = Array.isArray(res)
        ? res
        : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []));

      const empName = res?.employeeName || res?.data?.employeeName || user?.employeeName || user?.username || 'Employee';

      setPayslips(list);
      setEmployeeName(empName);
    } catch (err) {
      console.error('Failed to load payslips:', err);
      setError(err.response?.data?.error || 'Failed to load your payslips.');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Employee Top Navbar */}
      <header className="bg-slate-900 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
              {(employeeName || 'E').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                ESPRO Employee Portal
              </h1>
              <p className="text-xs text-slate-300">
                Logged in as <span className="font-semibold text-white">{employeeName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 pt-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">My Payslips</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              View, print, and download your payslips.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : payslips.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No Payslips Available</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              You don't have any paid payslips yet. Your finalized payslips will automatically appear here once marked as paid by payroll.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {payslips.map((item) => (
              <div
                key={item.payRunId}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                      PAID
                    </span>
                    {item.paymentDate && (
                      <span className="text-xs text-gray-500">
                        Paid on {formatDate(item.paymentDate)}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-1">
                    {formatDate(item.payPeriodStart)} – {formatDate(item.payPeriodEnd)}
                  </h4>
                  <p className="text-xs text-gray-500 mb-4 capitalize">
                    {item.payrollType ? `${item.payrollType.toLowerCase()} payroll` : 'Regular Payroll'}
                  </p>

                  <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
                    <div className="flex justify-between text-gray-600 text-xs">
                      <span>Gross Salary</span>
                      <span className="font-medium">₱{formatCurrency(item.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-xs">
                      <span>Total Deductions</span>
                      <span className="font-medium text-rose-600">-₱{formatCurrency(item.totalDeductions)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200">
                      <span className="font-bold text-gray-900 text-xs uppercase tracking-wider">NET PAY</span>
                      <span className="text-lg font-black text-emerald-600">
                        ₱{formatCurrency(item.netSalary)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/employee/payslips/${item.payRunId}`)}
                    className="w-full py-2 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View & Print Payslip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeePortalPage;
