import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/employees', label: 'Employees' },
    { path: '/holidays', label: 'Holidays' },
    { path: '/schedules', label: 'Schedules' },
    { path: '/assignments', label: 'Assignment' },
    { path: '/timesheet-entries', label: 'Timesheet' },
    ...(user?.role === 'admin' ? [{ path: '/pay-runs', label: 'Payruns' }] : []),
    { path: '/reports', label: 'Reports' },
    ...(user?.role === 'admin' ? [{ path: '/settings', label: 'Settings' }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav
        className="shadow-lg print:hidden"
        style={{ backgroundColor: '#f66633', color: '#ffffff' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Espro Payroll</h1>
            </div>
            <div className="flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-white text-orange-600'
                      : 'text-orange-50 hover:bg-orange-500'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={logout}
                className="px-3 py-2 rounded-md text-sm font-medium text-orange-50 hover:bg-red-500 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

