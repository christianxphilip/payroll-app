import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Bar */}
      <nav
        className="shadow-lg print:hidden sticky top-0 z-40"
        style={{ backgroundColor: '#f66633', color: '#ffffff' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="text-xl font-bold tracking-wide">Espro Payroll</Link>
            </div>

            {/* Desktop Nav Items */}
            <div className="hidden md:flex space-x-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-white text-orange-600 font-semibold shadow-sm'
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

            {/* Mobile Hamburger Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-orange-50 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle navigation menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-orange-500 bg-[#e05526] px-4 pt-2 pb-4 space-y-1 shadow-inner">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-3 rounded-md text-base font-medium transition-colors min-h-[44px] flex items-center ${
                  isActive(item.path)
                    ? 'bg-white text-orange-600 font-semibold'
                    : 'text-white hover:bg-orange-500'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="w-full text-left block px-3 py-3 rounded-md text-base font-medium text-white hover:bg-red-600 transition-colors mt-2 border-t border-orange-400 min-h-[44px]"
            >
              Logout
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

