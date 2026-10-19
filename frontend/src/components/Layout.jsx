import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const navGroups = [
    {
      label: 'People',
      items: [
        { path: '/employees', label: 'Employees' },
        ...(isAdmin ? [{ path: '/assignments', label: 'Assignments' }] : []),
        { path: '/schedules', label: 'Schedules' }
      ]
    },
    {
      label: 'Time & Attendance',
      items: [
        ...(isAdmin ? [
          { path: '/timesheet-entries', label: 'Timesheet' },
          { path: '/approvals', label: 'Approvals' }
        ] : []),
        { path: '/holidays', label: 'Holidays' }
      ]
    },
    ...(isAdmin ? [{
      label: 'Payroll',
      items: [
        { path: '/payroll/pay-runs', label: 'Payroll Processing' },
        { path: '/payroll/pay-runs?view=history', label: 'Payroll History' },
        { path: '/reports?view=payroll', label: 'Payroll Reports' }
      ]
    }] : [])
  ];

  const directItems = [
    ...(isAdmin ? [{ path: '/dashboard', label: 'Dashboard' }] : []),
    ...(isAdmin ? [{ path: '/reports', label: 'Reports' }, { path: '/settings', label: 'Settings' }] : [])
  ];

  const pathOnly = (path) => path.split('?')[0];
  const isActive = (path) => {
    const baseMatches = location.pathname === pathOnly(path) || location.pathname.startsWith(`${pathOnly(path)}/`);
    if (!baseMatches) return false;
    const query = path.split('?')[1];
    if (query) return location.search === `?${query}`;
    return !location.search.includes('view=');
  };
  const isGroupActive = (group) => group.items.some(item => isActive(item.path));

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
              <Link to={user?.role === 'manager' ? '/schedules' : '/dashboard'} className="text-xl font-bold tracking-wide">Espro Payroll</Link>
            </div>

            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center space-x-1">
              {directItems.slice(0, 1).map((item) => (
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
              {navGroups.map(group => (
                <div key={group.label} className="group relative">
                  <button className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isGroupActive(group) ? 'bg-white text-orange-600 font-semibold shadow-sm' : 'text-orange-50 hover:bg-orange-500'}`}>
                    {group.label}
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <div className="invisible absolute left-0 top-full z-50 mt-1 min-w-52 translate-y-1 rounded-xl border border-gray-200 bg-white p-1.5 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group.label}</div>
                    {group.items.map(item => (
                      <Link key={item.path} to={item.path} className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(item.path) ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {directItems.slice(1).map((item) => (
                <Link key={item.path} to={item.path} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.path) ? 'bg-white text-orange-600 font-semibold shadow-sm' : 'text-orange-50 hover:bg-orange-500'}`}>
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
            {directItems.slice(0, 1).map((item) => (
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
            {navGroups.map(group => (
              <div key={group.label} className="pt-2">
                <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-orange-200">{group.label}</div>
                {group.items.map(item => (
                  <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)} className={`ml-2 flex min-h-[44px] items-center rounded-md px-3 py-2.5 text-base font-medium ${isActive(item.path) ? 'bg-white text-orange-600 font-semibold' : 'text-white hover:bg-orange-500'}`}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
            {directItems.slice(1).map(item => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)} className={`block min-h-[44px] rounded-md px-3 py-3 text-base font-medium ${isActive(item.path) ? 'bg-white text-orange-600 font-semibold' : 'text-white hover:bg-orange-500'}`}>
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
      <main className={`flex-1 py-4 sm:py-6 px-3 sm:px-6 lg:px-8 w-full mx-auto ${location.pathname.startsWith('/payroll') ? 'max-w-[1800px]' : 'max-w-7xl'}`}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
