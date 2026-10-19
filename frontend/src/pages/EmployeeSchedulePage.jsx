import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SchedulesPage from './SchedulesPage';

const EmployeeSchedulePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user?.managerScope) return <Navigate to="/employee/payslips" replace />;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 font-bold text-white shadow-sm">
              {(user?.employeeName || user?.username || 'L').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-white">ESPRO Employee Portal</h1>
              <p className="text-xs text-slate-300">
                {user?.managerScope === 'bar' ? 'Bar Lead' : 'Kitchen Lead'} · {user?.employeeName || user?.username}
              </p>
            </div>
          </div>
          <button onClick={logout} className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white">
            Sign Out
          </button>
        </div>
        <div className="mx-auto flex max-w-[1800px] gap-2 overflow-x-auto px-4 pb-3 text-sm">
          <button onClick={() => navigate('/employee/schedules')} className="rounded-lg bg-white px-3 py-2 font-semibold text-slate-900 shadow-sm">Schedule</button>
          <button onClick={() => navigate('/employee/payslips')} className="rounded-lg px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white">Payslips</button>
          <button onClick={() => navigate('/employee/timesheet')} className="rounded-lg px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white">Timesheet</button>
          <button onClick={() => navigate('/employee/timesheet?tab=approvals')} className="rounded-lg px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white">Approvals</button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] px-2 py-3 sm:px-4">
        <SchedulesPage />
      </main>
    </div>
  );
};

export default EmployeeSchedulePage;
