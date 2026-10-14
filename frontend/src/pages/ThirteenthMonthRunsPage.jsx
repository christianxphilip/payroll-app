import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { thirteenthMonthAPI } from '../services/api';
import Modal from '../components/Modal';

const dateValue = date => date ? new Date(date).toISOString().slice(0, 10) : '';
const money = value => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ThirteenthMonthRunsPage = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [runs, setRuns] = useState([]);
  const [draftPayRuns, setDraftPayRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    coverageStart: `${year}-06-05`, coverageEnd: `${year}-12-31`, actualCutoff: `${year}-12-23`,
    payoutDate: `${year}-12-24`, paymentMethod: 'PAY_RUN', attachedPayRunId: ''
  });

  const load = async () => {
    try {
      const [runRes, payRunRes] = await Promise.all([thirteenthMonthAPI.getAll(), thirteenthMonthAPI.getDraftPayRuns()]);
      setRuns(runRes.data || runRes);
      setDraftPayRuns(payRunRes.data || payRunRes);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load 13th-month records' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, attachedPayRunId: form.paymentMethod === 'PAY_RUN' ? form.attachedPayRunId : null };
      const response = await thirteenthMonthAPI.create(payload);
      const created = response.data || response;
      setOpen(false);
      navigate(`/payroll/13th-month/${created.run._id}`);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to create calculation' });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-6">Loading 13th-month payments…</div>;
  return (
    <div className="px-1 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div><h1 className="text-2xl sm:text-3xl font-bold text-gray-900">13th Month Pay</h1><p className="text-sm text-gray-600 mt-1">Actual attendance plus scheduled projection through the coverage end.</p></div>
        <button onClick={() => setOpen(true)} className="min-h-[44px] px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700">Create 13th Month Pay</button>
      </div>
      {message.text && <div className={`mb-4 p-3 rounded-lg ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{message.text}</div>}
      <div className="space-y-3">
        {runs.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-gray-500">No 13th-month calculations yet.</div>}
        {runs.map(run => (
          <button key={run._id} onClick={() => navigate(`/payroll/13th-month/${run._id}`)} className="w-full text-left rounded-xl border bg-white p-4 hover:border-orange-300 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="font-bold text-gray-900">{new Date(run.coverageStart).toLocaleDateString()} – {new Date(run.coverageEnd).toLocaleDateString()}</div><div className="text-xs text-gray-500 mt-1">{run.paymentMethod === 'PAY_RUN' ? 'Attached to pay run' : 'Separate payment'} · {run.employeeCount} employees</div></div>
              <div className="text-right"><span className="inline-flex rounded-full bg-blue-100 text-blue-800 px-2.5 py-1 text-xs font-bold">{run.status}</span><div className="font-bold text-gray-900 mt-2">{money(run.totalAmount)}</div></div>
            </div>
          </button>
        ))}
      </div>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create 13th Month Pay" maxWidth="xl">
        <form onSubmit={create} className="space-y-4 text-left">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">Uses eligible basic salary only. Actual submitted attendance is used through the cutoff; schedules are used after the cutoff through the coverage end.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[['coverageStart','Coverage Start'],['coverageEnd','Coverage End'],['actualCutoff','Actual Attendance Cutoff'],['payoutDate','Payout Date']].map(([key,label]) => <label key={key} className="text-sm font-semibold text-gray-700">{label}<input type="date" required value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} className="mt-1 w-full min-h-[44px] border rounded-lg px-3 text-base" /></label>)}
          </div>
          <div><div className="text-sm font-semibold text-gray-700 mb-2">Payment Method</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm({...form,paymentMethod:'PAY_RUN'})} className={`p-3 rounded-lg border text-left ${form.paymentMethod === 'PAY_RUN' ? 'border-blue-500 bg-blue-50' : ''}`}><div className="font-semibold">Attach to Draft Pay Run</div><div className="text-xs text-gray-500">Included in the regular payroll and payslip.</div></button>
            <button type="button" onClick={() => setForm({...form,paymentMethod:'SEPARATE',attachedPayRunId:''})} className={`p-3 rounded-lg border text-left ${form.paymentMethod === 'SEPARATE' ? 'border-blue-500 bg-blue-50' : ''}`}><div className="font-semibold">Separate Payment</div><div className="text-xs text-gray-500">Creates its own payment and payslip.</div></button>
          </div></div>
          {form.paymentMethod === 'PAY_RUN' && <label className="block text-sm font-semibold text-gray-700">Draft Pay Run<select required value={form.attachedPayRunId} onChange={e => { const selected = draftPayRuns.find(run => run._id === e.target.value); setForm({...form,attachedPayRunId:e.target.value,payoutDate:selected ? dateValue(selected.payoutDate) : form.payoutDate}); }} className="mt-1 w-full min-h-[44px] border rounded-lg px-3 bg-white"><option value="">Select a Draft pay run</option>{draftPayRuns.map(run => <option key={run._id} value={run._id}>{dateValue(run.payrollPeriodStart)} to {dateValue(run.payrollPeriodEnd)} · payout {dateValue(run.payoutDate)}</option>)}</select></label>}
          <div className="flex justify-end gap-2 pt-3 border-t"><button type="button" onClick={() => setOpen(false)} className="min-h-[44px] px-4 border rounded-lg">Cancel</button><button disabled={saving} className="min-h-[44px] px-4 rounded-lg bg-orange-600 text-white disabled:opacity-50">{saving ? 'Calculating…' : 'Create & Calculate'}</button></div>
        </form>
      </Modal>
    </div>
  );
};

export default ThirteenthMonthRunsPage;
