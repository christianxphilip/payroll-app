import { Link } from 'react-router-dom';

const PayrollPage = () => (
  <div className="px-1 sm:px-4 py-4 sm:py-6">
    <div className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payroll</h1>
      <p className="mt-1 text-sm text-gray-600">Process regular payroll and annual 13th-month payments.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Link to="/payroll/pay-runs" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
        <div className="text-2xl mb-3">🧾</div>
        <h2 className="text-lg font-bold text-gray-900">Pay Runs</h2>
        <p className="mt-1 text-sm text-gray-600">Create payroll from submitted timesheets, review earnings, and issue payslips.</p>
      </Link>
      <Link to="/payroll/13th-month" className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm hover:border-orange-400 hover:shadow-md transition-all">
        <div className="text-2xl mb-3">🎁</div>
        <h2 className="text-lg font-bold text-gray-900">13th Month Pay</h2>
        <p className="mt-1 text-sm text-gray-600">Calculate actual and projected eligible basic salary, attach it to payroll, or pay separately.</p>
      </Link>
    </div>
  </div>
);

export default PayrollPage;
