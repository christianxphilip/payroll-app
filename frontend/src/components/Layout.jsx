import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('esproSidebarCollapsed') === 'true');

  const toggleSidebar = () => {
    setSidebarCollapsed(current => {
      const next = !current;
      localStorage.setItem('esproSidebarCollapsed', String(next));
      return next;
    });
  };

  const isAdmin = user?.role === 'admin';
  const navGroups = [
    {
      label: 'People',
      items: [
        { path: '/employees', label: 'Employees' },
        ...(isAdmin ? [{ path: '/assignments', label: 'Assignments' }] : []),
        { path: '/schedules', label: 'Schedules' },
        ...(!isAdmin && user?.employeeId ? [{ path: '/employee/payslips', label: 'My Payslips' }] : [])
      ]
    },
    {
      label: 'Time & Attendance',
      items: [
        ...(isAdmin ? [
          { path: '/timesheet-entries', label: 'Timesheet' },
          { path: '/approvals', label: 'Approvals' }
        ] : user?.employeeId ? [{ path: '/employee/timesheet', label: 'My Timesheet' }] : []),
        { path: '/holidays', label: 'Holidays' }
      ]
    },
    ...(isAdmin ? [{
      label: 'Payroll',
      items: [
        { path: '/payroll/pay-runs', label: 'Payroll Processing' },
        { path: '/payroll/13th-month', label: '13th Month' }
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

  const navLinkClass = (path, nested = false) => `flex min-h-[42px] items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${nested ? 'ml-2' : ''} ${
    isActive(path)
      ? 'bg-orange-50 text-orange-700 font-semibold'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Desktop sidebar */}
      <aside className={`print:hidden hidden h-screen shrink-0 flex-col overflow-hidden bg-white transition-[width] duration-200 md:sticky md:top-0 md:flex ${sidebarCollapsed ? 'w-0 border-r-0' : 'w-64 border-r border-gray-200'}`}>
        <div className="flex h-20 min-w-64 items-center justify-between border-b border-gray-100 px-6">
          <Link to={user?.role === 'manager' ? '/schedules' : '/dashboard'}>
            <div className="text-xl font-bold tracking-wide text-gray-900">Espro Payroll</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">Management Suite</div>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Hide navigation sidebar"
            title="Hide sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
        <nav className="min-w-64 flex-1 overflow-y-auto px-3 py-4">
          {directItems.slice(0, 1).map(item => (
            <Link key={item.path} to={item.path} className={navLinkClass(item.path)}>{item.label}</Link>
          ))}
          {navGroups.map(group => (
            <section key={group.label} className="mt-5">
              <div className={`px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${isGroupActive(group) ? 'text-orange-600' : 'text-gray-400'}`}>
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <Link key={item.path} to={item.path} className={navLinkClass(item.path, true)}>{item.label}</Link>
                ))}
              </div>
            </section>
          ))}
          <div className="mt-5 space-y-0.5 border-t border-gray-100 pt-4">
            {directItems.slice(1).map(item => (
              <Link key={item.path} to={item.path} className={navLinkClass(item.path)}>{item.label}</Link>
            ))}
          </div>
        </nav>
        <div className="min-w-64 border-t border-gray-100 p-3">
          <button onClick={logout} className="flex min-h-[42px] w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700">
            Logout
          </button>
        </div>
      </aside>

      {sidebarCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="fixed left-3 top-3 z-50 hidden h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-lg hover:bg-orange-50 hover:text-orange-700 md:flex print:hidden"
          aria-label="Show navigation sidebar"
          title="Show sidebar"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      <div className="min-w-0 flex-1">
        {/* Mobile navigation */}
        <nav className="sticky top-0 z-40 bg-[#f66633] text-white shadow-lg print:hidden md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Link to={user?.role === 'manager' ? '/schedules' : '/dashboard'} className="text-xl font-bold tracking-wide">Espro Payroll</Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-orange-50 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>

        {mobileMenuOpen && (
          <div className="space-y-1 border-t border-orange-500 bg-[#e05526] px-4 pb-4 pt-2 shadow-inner">
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

        <main className={`w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8 ${location.pathname.startsWith('/payroll') ? 'max-w-[1800px]' : 'max-w-7xl'} mx-auto`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
