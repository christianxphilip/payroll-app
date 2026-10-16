import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { employeePortalAPI } from '../services/api';

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const odooDate = (value) => value ? new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`) : null;

const EmployeeTimesheetPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [page, setPage] = useState(0);
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [limits, setLimits] = useState(null);
  const [records, setRecords] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getPageRange = (pageNumber, earliestDate) => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - (pageNumber * 7));
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    if (earliestDate) {
      const earliest = new Date(`${earliestDate}T00:00:00`);
      if (start < earliest) start.setTime(earliest.getTime());
    }
    return { startDate: localDate(start), endDate: localDate(end) };
  };

  const loadAttendance = async (requestedRange) => {
    try {
      setLoading(true);
      setError('');
      const response = await employeePortalAPI.getAttendance(requestedRange.startDate, requestedRange.endDate);
      setRecords(response.data || []);
      setEmployee(response.employee || null);
      setLimits(response.limits || null);
    } catch (err) {
      setRecords([]);
      setError(err.response?.data?.error || 'Failed to load attendance from Odoo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const requestedRange = getPageRange(page, limits?.earliestDate);
    setRange(requestedRange);
    loadAttendance(requestedRange);
  }, [page]);

  const formatDateTime = (value) => {
    const date = odooDate(value);
    return date ? date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Missing';
  };

  const totalHours = records.reduce((sum, record) => sum + Number(record.workedHours || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-slate-900 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold">ESPRO Employee Portal</h1>
            <p className="text-xs text-slate-300">Logged in as <span className="font-semibold text-white">{employee?.name || user?.employeeName || user?.username}</span></p>
          </div>
          <button onClick={logout} className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white">Sign Out</button>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 text-sm">
          <button onClick={() => navigate('/employee/payslips')} className="rounded-lg px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white">Payslips</button>
          <button className="rounded-lg bg-white px-3 py-2 font-semibold text-slate-900">Timesheet</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-8">
        <div className="mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">My Timesheet</h2>
          <p className="mt-1 text-sm text-gray-500">Attendance records synchronized from Odoo.</p>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Seven-day attendance window</div>
            <div className="mt-1 text-sm font-bold text-gray-900">{range.startDate} – {range.endDate}</div>
            <div className="mt-1 text-xs text-gray-500">Only attendance from the latest month is available.</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading || Boolean(limits?.earliestDate && range.startDate <= limits.earliestDate)}
              onClick={() => setPage(current => current + 1)}
              className="h-10 rounded-lg border border-gray-300 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              ← Previous 7 Days
            </button>
            <button
              type="button"
              disabled={loading || page === 0}
              onClick={() => setPage(current => Math.max(0, current - 1))}
              className="h-10 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Newer 7 Days →
            </button>
          </div>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!error && !loading && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-white p-4"><div className="text-xs font-semibold uppercase text-gray-500">Records</div><div className="mt-1 text-2xl font-bold text-gray-900">{records.length}</div></div>
            <div className="rounded-xl border bg-white p-4"><div className="text-xs font-semibold uppercase text-gray-500">Total Hours</div><div className="mt-1 text-2xl font-bold text-gray-900">{totalHours.toFixed(2)}</div></div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>
        ) : !error && records.length === 0 ? (
          <div className="rounded-2xl border bg-white p-12 text-center text-sm text-gray-500">No attendance records found for this date range.</div>
        ) : !error && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="hidden grid-cols-[1.25fr_1.25fr_.6fr_.5fr] gap-3 border-b bg-gray-50 px-4 py-3 text-xs font-bold uppercase text-gray-500 sm:grid"><span>Time In</span><span>Time Out</span><span>Hours</span><span>Status</span></div>
            <div className="divide-y">
              {records.map(record => (
                <div key={record.id} className={`grid gap-2 px-4 py-4 text-sm sm:grid-cols-[1.25fr_1.25fr_.6fr_.5fr] sm:items-center ${record.isInvalid ? 'border-l-4 border-red-500 bg-red-50' : ''}`}>
                  <div><span className="mr-2 text-[10px] font-bold uppercase text-gray-400 sm:hidden">In</span>{formatDateTime(record.checkIn)}</div>
                  <div className={record.checkOut ? '' : 'font-semibold text-red-600'}><span className="mr-2 text-[10px] font-bold uppercase text-gray-400 sm:hidden">Out</span>{formatDateTime(record.checkOut)}</div>
                  <div><span className="mr-2 text-[10px] font-bold uppercase text-gray-400 sm:hidden">Hours</span>{Number(record.workedHours || 0).toFixed(2)}</div>
                  <div>{record.isInvalid ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Needs correction</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Valid</span>}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeTimesheetPage;
