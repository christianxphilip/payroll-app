import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { thirteenthMonthAPI } from '../services/api';

const money = value => `₱ ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ThirteenthMonthPayslipPage = () => {
  const { runId, entryId } = useParams(); const navigate = useNavigate();
  const [data,setData] = useState(null); const [error,setError] = useState('');
  useEffect(() => { thirteenthMonthAPI.getPayslip(runId,entryId).then(response => setData(response.data || response)).catch(err => setError(err.response?.data?.error || 'Failed to load payslip')); },[runId,entryId]);
  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!data) return <div className="p-6">Loading payslip…</div>;
  const { run,entry,employee } = data;
  return <div className="max-w-3xl mx-auto px-2 sm:px-4 py-5"><style>{`@media print{.no-print{display:none!important}body{background:white}}`}</style>
    <div className="no-print flex justify-between mb-4"><button onClick={() => navigate(`/payroll/13th-month/${runId}`)} className="text-blue-600">← Back</button><button onClick={() => window.print()} className="px-4 py-2 bg-gray-900 text-white rounded-lg">Print Payslip</button></div>
    <div className="bg-white border shadow-sm rounded-xl p-5 sm:p-8"><div className="text-center border-b pb-5"><div className="text-xl font-bold text-orange-600">ESPRO Coffee</div><h1 className="text-2xl font-bold mt-2">13th Month Pay Payslip</h1><div className="text-sm text-gray-500">Coverage: {new Date(run.coverageStart).toLocaleDateString()} – {new Date(run.coverageEnd).toLocaleDateString()}</div></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 text-sm"><div><div className="text-xs uppercase text-gray-500 font-bold">Employee</div><div className="font-bold text-lg">{entry.employeeName}</div><div className="text-gray-500">{employee?.position || ''}</div></div><div className="sm:text-right"><div className="text-xs uppercase text-gray-500 font-bold">Payment</div><div>Status: <strong>{run.status}</strong></div><div>Payout: {new Date(run.payoutDate).toLocaleDateString()}</div><div>{run.paymentMethod === 'PAY_RUN' ? 'Included in regular pay run' : 'Separate payment'}</div></div></div>
      <div className="rounded-lg border divide-y text-sm"><div className="flex justify-between p-3"><span>Actual eligible basic salary</span><strong>{money(entry.actualBasicSalary)}</strong></div><div className="flex justify-between p-3"><span>Projected basic salary through coverage end</span><strong>{money(entry.projectedBasicSalary)}</strong></div>{entry.manualAdjustment !== 0 && <div className="flex justify-between p-3"><span>Adjustment {entry.adjustmentReason && `(${entry.adjustmentReason})`}</span><strong>{money(entry.manualAdjustment)}</strong></div>}<div className="flex justify-between p-3 bg-gray-50"><span>Total eligible basic salary</span><strong>{money(entry.eligibleBasicSalary)}</strong></div><div className="flex justify-between p-4 bg-orange-50 text-lg"><span className="font-bold">13th Month Pay</span><strong className="text-orange-700">{money(entry.thirteenthMonthPay)}</strong></div></div>
      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">Computed as eligible basic salary divided by 12. Projected amounts use published work schedules after the actual-attendance cutoff and may require reconciliation against final attendance.</p>
    </div></div>;
};
export default ThirteenthMonthPayslipPage;
