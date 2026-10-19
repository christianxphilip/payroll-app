import { Outlet } from 'react-router-dom';

const PayrollPage = () => (
  <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <Outlet />
  </section>
);

export default PayrollPage;
