import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { thirteenthMonthAPI } from '../services/api';

const money = value => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ThirteenthMonthDetailPage = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = async () => {
    try { const response = await thirteenthMonthAPI.getById(runId); setData(response.data || response); }
    catch (error) { setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load calculation' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [runId]);
  const action = async callback => { setBusy(true); try { const response = await callback(); if (response?.data?.run) setData(response.data); else await load(); } catch (error) { setMessage({ type:'error', text:error.response?.data?.error || 'Operation failed' }); } finally { setBusy(false); } };
  const deleteRun = async () => {
    const attachedWarning = run.paymentMethod === 'PAY_RUN'
      ? '\n\nThe 13th-month credits will also be removed from the attached Draft pay run.'
      : '';
    if (!window.confirm(`Delete this Draft 13th-month calculation?${attachedWarning}\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await thirteenthMonthAPI.delete(runId);
      navigate('/payroll/13th-month', { replace: true });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete calculation' });
      setBusy(false);
    }
  };
  const adjust = entry => {
    const amount = window.prompt(`Eligible basic-salary adjustment for ${entry.employeeName}`, String(entry.manualAdjustment || 0));
    if (amount === null || Number.isNaN(Number(amount))) return;
    const reason = Number(amount) !== 0 ? window.prompt('Reason for this adjustment', entry.adjustmentReason || '') : '';
    if (Number(amount) !== 0 && !reason) return;
    action(() => thirteenthMonthAPI.updateEmployee(runId, entry._id, { manualAdjustment: Number(amount), adjustmentReason: reason }));
  };
  if (loading) return <div className="p-6">Loading calculation…</div>;
  if (!data) return <div className="p-6 text-red-700">{message.text || 'Calculation not found.'}</div>;
  const { run, entries, totals } = data;
  return (
    <div className="px-1 sm:px-4 py-4 sm:py-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div><button onClick={() => navigate('/payroll/13th-month')} className="text-sm text-blue-600 mb-2">← 13th Month Pay</button><h1 className="text-2xl sm:text-3xl font-bold text-gray-900">13th Month Pay Details</h1><p className="text-sm text-gray-600 mt-1">{new Date(run.coverageStart).toLocaleDateString()} – {new Date(run.coverageEnd).toLocaleDateString()} · Actual cutoff {new Date(run.actualCutoff).toLocaleDateString()}</p></div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-2 rounded-lg bg-blue-100 text-blue-800 text-sm font-bold">{run.status}</span>
          {run.status === 'DRAFT' && <button disabled={busy} onClick={() => action(() => thirteenthMonthAPI.recalculate(runId))} className="px-3 py-2 border rounded-lg text-sm">Recalculate</button>}
          {run.status === 'DRAFT' && <button disabled={busy} onClick={deleteRun} className="px-3 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm">Delete</button>}
          {run.paymentMethod === 'SEPARATE' && run.status === 'DRAFT' && <button disabled={busy} onClick={() => action(() => thirteenthMonthAPI.updateStatus(runId,'APPROVED'))} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">Approve</button>}
          {run.paymentMethod === 'SEPARATE' && run.status === 'APPROVED' && <button disabled={busy} onClick={() => action(() => thirteenthMonthAPI.updateStatus(runId,'PAID'))} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm">Mark Paid</button>}
        </div>
      </div>
      {message.text && <div className="p-3 rounded-lg bg-red-100 text-red-800">{message.text}</div>}
      {run.paymentMethod === 'PAY_RUN' && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Attached to Draft pay run <button className="font-semibold underline" onClick={() => navigate(`/payroll/pay-runs/${run.attachedPayRunId?._id || run.attachedPayRunId}`)}>View Pay Run</button>. Approval and payment status follow that pay run.</div>}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Actual',totals.actualBasicSalary],['Projected',totals.projectedBasicSalary],['Adjustments',totals.manualAdjustment],['Eligible Basic',totals.eligibleBasicSalary],['13th Month',totals.thirteenthMonthPay]].map(([label,value]) => <div key={label} className="rounded-xl border bg-white p-3"><div className="text-[11px] uppercase font-bold text-gray-500">{label}</div><div className="text-lg font-bold text-gray-900 mt-1">{money(value)}</div></div>)}
      </div>
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="text-left p-3">Employee</th><th className="text-right p-3">Actual Basic</th><th className="text-right p-3">Projected</th><th className="text-right p-3">Adjustment</th><th className="text-right p-3">Eligible Basic</th><th className="text-right p-3">13th Month</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y">{entries.map(entry => <tr key={entry._id}><td className="p-3 font-semibold">{entry.employeeName}<div className="text-[10px] font-normal text-gray-400">{entry.actualDays} actual days · {entry.projectedDays} projected days</div></td><td className="p-3 text-right">{money(entry.actualBasicSalary)}</td><td className="p-3 text-right">{money(entry.projectedBasicSalary)}</td><td className="p-3 text-right">{money(entry.manualAdjustment)}</td><td className="p-3 text-right">{money(entry.eligibleBasicSalary)}</td><td className="p-3 text-right font-bold">{money(entry.thirteenthMonthPay)}</td><td className="p-3"><div className="flex justify-center gap-2">{run.status === 'DRAFT' && <button onClick={() => adjust(entry)} className="text-blue-600">Adjust</button>}<button onClick={() => navigate(`/payroll/13th-month/${runId}/payslips/${entry._id}`)} className="text-gray-700">Payslip</button></div></td></tr>)}</tbody></table></div>
      <div className="md:hidden space-y-3">{entries.map(entry => <div key={entry._id} className="rounded-xl border bg-white p-4"><div className="flex justify-between"><div className="font-bold">{entry.employeeName}</div><div className="font-bold">{money(entry.thirteenthMonthPay)}</div></div><div className="grid grid-cols-2 gap-2 text-xs mt-3 text-gray-600"><div>Actual: {money(entry.actualBasicSalary)}</div><div>Projected: {money(entry.projectedBasicSalary)}</div><div>Adjustment: {money(entry.manualAdjustment)}</div><div>Eligible: {money(entry.eligibleBasicSalary)}</div></div><div className="flex gap-2 mt-3 pt-3 border-t">{run.status === 'DRAFT' && <button onClick={() => adjust(entry)} className="flex-1 py-2 border rounded-lg text-sm">Adjust</button>}<button onClick={() => navigate(`/payroll/13th-month/${runId}/payslips/${entry._id}`)} className="flex-1 py-2 bg-gray-800 text-white rounded-lg text-sm">Payslip</button></div></div>)}</div>
    </div>
  );
};

export default ThirteenthMonthDetailPage;
