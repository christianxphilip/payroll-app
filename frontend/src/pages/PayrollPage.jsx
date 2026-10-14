import { NavLink, Outlet } from 'react-router-dom';

const modules = [
  { to: '/payroll/pay-runs', icon: '🧾', title: 'Pay Runs', description: 'Regular payroll and payslips' },
  { to: '/payroll/13th-month', icon: '🎁', title: '13th Month Pay', description: 'Annual benefit calculations' }
];

const PayrollPage = () => (
  <div className="-mx-1 sm:-mx-3 lg:-mx-5 -my-1 sm:-my-2">
    <div className="mb-3 px-1 sm:px-3 lg:px-5">
      <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
      <p className="mt-0.5 text-sm text-gray-600">Regular payroll and employee benefits</p>
    </div>

    {/* Compact module tabs on phones */}
    <nav className="md:hidden grid grid-cols-2 gap-2 px-1 sm:px-3 mb-3" aria-label="Payroll modules">
      {modules.map(module => (
        <NavLink
          key={module.to}
          to={module.to}
          className={({ isActive }) => `min-h-[48px] rounded-lg border px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${isActive ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-700'}`}
        >
          <span aria-hidden="true">{module.icon}</span>{module.title}
        </NavLink>
      ))}
    </nav>

    <div className="md:grid md:grid-cols-[190px_minmax(0,1fr)] md:gap-4 items-start">
      {/* Persistent desktop module sidebar */}
      <aside className="hidden md:block sticky top-20 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Modules</div>
        <nav className="space-y-1" aria-label="Payroll modules">
          {modules.map(module => (
            <NavLink
              key={module.to}
              to={module.to}
              className={({ isActive }) => `block rounded-lg px-3 py-3 transition-colors ${isActive ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-2 font-semibold"><span aria-hidden="true">{module.icon}</span>{module.title}</div>
              <div className="mt-1 pl-7 text-[11px] leading-4 text-gray-500">{module.description}</div>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Outlet />
      </section>
    </div>
  </div>
);

export default PayrollPage;
