import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { thirteenthMonthAPI } from '../services/api';
import Modal from '../components/Modal';

const money = value => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ThirteenthMonthDetailPage = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [offDaysEntry, setOffDaysEntry] = useState(null);
  const [weeklyOffDays, setWeeklyOffDays] = useState([]);
  const [useWeeklyOffDays, setUseWeeklyOffDays] = useState(true);

  const load = async () => {
    try { const response = await thirteenthMonthAPI.getById(runId); setData(response.data || response); }
    catch (error) { setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load calculation' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [runId]);
  const action = async callback => { setBusy(true); try { const response = await callback(); if (response?.data?.run) setData(response.data); else await load(); return true; } catch (error) { setMessage({ type:'error', text:error.response?.data?.error || 'Operation failed' }); return false; } finally { setBusy(false); } };
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
  const editOffDays = entry => {
    setOffDaysEntry(entry);
    setWeeklyOffDays(entry.weeklyOffDays || []);
    setUseWeeklyOffDays(entry.projectionUsesWeeklyOffDays !== false);
  };
  const saveOffDays = async () => {
    if (!offDaysEntry) return;
    const saved = await action(() => thirteenthMonthAPI.updateEmployee(runId, offDaysEntry._id, {
      weeklyOffDays,
      projectionUsesWeeklyOffDays: useWeeklyOffDays
    }));
    if (saved) setOffDaysEntry(null);
  };
  const auditFinalPayroll = async () => {
    if (!window.confirm('Audit this paid 13th-month run against all finalized payrolls in the coverage year? This creates a reconciliation report and will not deduct any overpayment.')) return;
    const saved = await action(() => thirteenthMonthAPI.finalAudit(runId));
    if (saved) setMessage({ type: 'success', text: 'Final December payroll audit completed.' });
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
          {run.status === 'PAID' && <button disabled={busy} onClick={auditFinalPayroll} className="px-3 py-2 bg-purple-700 text-white rounded-lg text-sm">Audit Final December Payroll</button>}
        </div>
      </div>
      {message.text && <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
      {run.paymentMethod === 'PAY_RUN' && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Attached to Draft pay run <button className="font-semibold underline" onClick={() => navigate(`/payroll/pay-runs/${run.attachedPayRunId?._id || run.attachedPayRunId}`)}>View Pay Run</button>. Approval and payment status follow that pay run.</div>}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Actual',totals.actualBasicSalary],['Projected',totals.projectedBasicSalary],['Adjustments',totals.manualAdjustment],['Eligible Basic',totals.eligibleBasicSalary],['13th Month',totals.thirteenthMonthPay]].map(([label,value]) => <div key={label} className="rounded-xl border bg-white p-3"><div className="text-[11px] uppercase font-bold text-gray-500">{label}</div><div className="text-lg font-bold text-gray-900 mt-1">{money(value)}</div></div>)}
      </div>
      {run.status === 'PAID' && <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><h2 className="font-bold text-purple-950">Final December Payroll Audit</h2><p className="text-sm text-purple-800">Compares the amount paid with actual eligible basic from all finalized payrolls in the coverage year. Overpayments are reported only and are never deducted automatically.</p></div>{run.finalAuditAt && <div className="text-xs text-purple-700 whitespace-nowrap">Audited {new Date(run.finalAuditAt).toLocaleString()}</div>}</div>
        {run.finalAuditAt ? <>
          <div className="grid grid-cols-3 gap-3">{[['Final entitlement', totals.finalThirteenthMonthPay], ['Top-up required', totals.topUpAmount], ['Overpayment review', totals.overpaymentAmount]].map(([label, value]) => <div key={label} className="rounded-lg bg-white border border-purple-100 p-3"><div className="text-[10px] uppercase font-bold text-purple-700">{label}</div><div className="font-bold mt-1">{money(value)}</div></div>)}</div>
          <div className="overflow-x-auto bg-white rounded-lg border"><table className="min-w-full text-sm"><thead className="bg-purple-100 text-xs uppercase text-purple-900"><tr><th className="text-left p-3">Employee</th><th className="text-right p-3">Paid</th><th className="text-right p-3">Final actual basic</th><th className="text-right p-3">Final entitlement</th><th className="text-right p-3">Top-up</th><th className="text-right p-3">Overpayment review</th></tr></thead><tbody className="divide-y">{entries.map(entry => <tr key={entry._id}><td className="p-3 font-semibold">{entry.employeeName}<div className="text-[10px] font-normal text-gray-500">{entry.finalAuditPayRunCount || 0} finalized pay runs</div></td><td className="p-3 text-right">{money(entry.paidAmount)}</td><td className="p-3 text-right">{money(entry.finalActualBasicSalary)}</td><td className="p-3 text-right font-semibold">{money(entry.finalThirteenthMonthPay)}</td><td className="p-3 text-right text-green-700 font-semibold">{money(entry.topUpAmount)}</td><td className="p-3 text-right text-amber-700">{money(entry.overpaymentAmount)}</td></tr>)}</tbody></table></div>
        </> : <p className="text-sm text-purple-800">Run this after the final December payroll has been approved or paid and the coverage period has ended.</p>}
      </div>}
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="text-left p-3">Employee</th><th className="text-right p-3">Actual Basic</th><th className="text-right p-3">Projected</th><th className="text-right p-3">Adjustment</th><th className="text-right p-3">Eligible Basic</th><th className="text-right p-3">13th Month</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y">{entries.map(entry => <tr key={entry._id}><td className="p-3 font-semibold">{entry.employeeName}<div className="text-[10px] font-normal text-gray-400">{entry.actualPayRunCount || 0} finalized pay runs · {entry.projectedDays} projected days</div>{entry.projectionUsesWeeklyOffDays && <div className="text-[10px] font-normal text-amber-700">Weekly off: {entry.weeklyOffDays?.length ? entry.weeklyOffDays.join(', ') : 'None'}</div>}</td><td className="p-3 text-right">{money(entry.actualBasicSalary)}</td><td className="p-3 text-right">{money(entry.projectedBasicSalary)}</td><td className="p-3 text-right">{money(entry.manualAdjustment)}</td><td className="p-3 text-right">{money(entry.eligibleBasicSalary)}</td><td className="p-3 text-right font-bold">{money(entry.thirteenthMonthPay)}</td><td className="p-3"><div className="flex justify-center gap-2">{run.status === 'DRAFT' && <><button onClick={() => editOffDays(entry)} className="text-amber-700">Off days</button><button onClick={() => adjust(entry)} className="text-blue-600">Adjust</button></>}<button onClick={() => navigate(`/payroll/13th-month/${runId}/payslips/${entry._id}`)} className="text-gray-700">Payslip</button></div></td></tr>)}</tbody></table></div>
      <div className="md:hidden space-y-3">{entries.map(entry => <div key={entry._id} className="rounded-xl border bg-white p-4"><div className="flex justify-between"><div className="font-bold">{entry.employeeName}</div><div className="font-bold">{money(entry.thirteenthMonthPay)}</div></div><div className="grid grid-cols-2 gap-2 text-xs mt-3 text-gray-600"><div>Actual: {money(entry.actualBasicSalary)}</div><div>Projected: {money(entry.projectedBasicSalary)}</div><div>Adjustment: {money(entry.manualAdjustment)}</div><div>Eligible: {money(entry.eligibleBasicSalary)}</div></div>{entry.projectionUsesWeeklyOffDays && <div className="text-xs text-amber-700 mt-2">Weekly off: {entry.weeklyOffDays?.length ? entry.weeklyOffDays.join(', ') : 'None'}</div>}<div className="flex gap-2 mt-3 pt-3 border-t">{run.status === 'DRAFT' && <><button onClick={() => editOffDays(entry)} className="flex-1 py-2 border rounded-lg text-sm">Off days</button><button onClick={() => adjust(entry)} className="flex-1 py-2 border rounded-lg text-sm">Adjust</button></>}<button onClick={() => navigate(`/payroll/13th-month/${runId}/payslips/${entry._id}`)} className="flex-1 py-2 bg-gray-800 text-white rounded-lg text-sm">Payslip</button></div></div>)}</div>
      <Modal isOpen={!!offDaysEntry} onClose={() => setOffDaysEntry(null)} title={offDaysEntry ? `Weekly Off-Days – ${offDaysEntry.employeeName}` : 'Weekly Off-Days'}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Published schedules are used first. These weekly off-days fill only future dates without a schedule.</p>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={useWeeklyOffDays} onChange={event => setUseWeeklyOffDays(event.target.checked)} />Use weekly off-days for unscheduled dates</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{WEEKDAYS.map(day => <button key={day} type="button" disabled={!useWeeklyOffDays} onClick={() => setWeeklyOffDays(current => current.includes(day) ? current.filter(value => value !== day) : [...current, day])} className={`px-3 py-2 rounded-lg border text-sm ${weeklyOffDays.includes(day) ? 'bg-amber-100 border-amber-500 text-amber-900' : 'bg-white'} disabled:opacity-50`}>{day}</button>)}</div>
          <div className="flex justify-end gap-2 pt-3 border-t"><button type="button" onClick={() => setOffDaysEntry(null)} className="px-4 py-2 border rounded-lg">Cancel</button><button type="button" disabled={busy} onClick={saveOffDays} className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50">Save & Recalculate</button></div>
        </div>
      </Modal>
    </div>
  );
};

export default ThirteenthMonthDetailPage;
