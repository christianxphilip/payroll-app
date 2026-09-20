import { useEffect, useState } from 'react';
import Modal from './Modal';
import { payrollAdjustmentAPI } from '../services/api';

const emptyForm = {
  type: 'PRIOR_PERIOD_OT',
  correctionType: 'LATE_OT_APPROVAL',
  sourceTimesheetId: '',
  sourcePayRunId: '',
  sourceTimeLogId: '',
  originalWorkDate: '',
  correctedTimeIn: '',
  correctedTimeOut: '',
  breakMinutes: '0',
  regularHours: '0',
  overtimeHours: '',
  nightDiffHours: '0',
  holidayType: 'NONE',
  approvedBy: '',
  approvedAt: '',
  approvalReference: '',
  reason: ''
};

const money = (value) => Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const PayrollAdjustmentModal = ({ isOpen, onClose, payRun, employee, onUpdated }) => {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !employee || !payRun) return;
    setForm(emptyForm);
    setError('');
    setLoading(true);
    payrollAdjustmentAPI.getForEmployee(payRun._id, employee._id)
      .then((res) => setItems(res.data || res || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load prior-period adjustments'))
      .finally(() => setLoading(false));
  }, [isOpen, employee?._id, payRun?._id]);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const changeType = (type) => {
    setForm((current) => ({
      ...current,
      type,
      correctionType: type === 'PRIOR_PERIOD_OT' ? 'LATE_OT_APPROVAL' : 'MISSING_LOG',
      regularHours: type === 'PRIOR_PERIOD_OT' ? '0' : current.regularHours,
      overtimeHours: type === 'PRIOR_PERIOD_OT' ? current.overtimeHours : '0'
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        regularHours: Number(form.regularHours || 0),
        overtimeHours: Number(form.overtimeHours || 0),
        nightDiffHours: Number(form.nightDiffHours || 0),
        breakMinutes: Number(form.breakMinutes || 0),
        sourceTimesheetId: form.sourceTimesheetId || undefined,
        sourcePayRunId: form.sourcePayRunId || undefined,
        sourceTimeLogId: form.sourceTimeLogId || undefined,
        correctedTimeIn: form.correctedTimeIn || undefined,
        correctedTimeOut: form.correctedTimeOut || undefined
      };
      const res = await payrollAdjustmentAPI.create(payRun._id, employee._id, payload);
      setItems((current) => [...current, res.data || res]);
      setForm(emptyForm);
      onUpdated?.(res.employee);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add prior-period adjustment');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm('Remove this prior-period adjustment from the draft pay run?')) return;
    try {
      const res = await payrollAdjustmentAPI.remove(item._id);
      setItems((current) => current.filter((entry) => entry._id !== item._id));
      onUpdated?.(res.employee);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove adjustment');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={employee ? `Prior-period pay - ${employee.employeeName}` : 'Prior-period pay'}
      maxWidth="3xl"
    >
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="space-y-5">
        <div className="flex gap-2 border-b border-gray-200 pb-4">
          <button type="button" onClick={() => changeType('PRIOR_PERIOD_OT')} className={`px-3 py-2 text-sm rounded-lg ${form.type === 'PRIOR_PERIOD_OT' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>
            Prior-period OT
          </button>
          <button type="button" onClick={() => changeType('ATTENDANCE_CORRECTION')} className={`px-3 py-2 text-sm rounded-lg ${form.type === 'ATTENDANCE_CORRECTION' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>
            Attendance correction
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-medium text-gray-700">Original work date
            <input type="date" required value={form.originalWorkDate} onChange={(e) => setField('originalWorkDate', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-700">Correction type
            <select value={form.correctionType} onChange={(e) => setField('correctionType', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {form.type === 'PRIOR_PERIOD_OT' ? (
                <option value="LATE_OT_APPROVAL">Late OT approval</option>
              ) : (
                <>
                  <option value="MISSING_LOG">Missing log</option>
                  <option value="MISSING_TIME_IN">Missing time-in</option>
                  <option value="MISSING_TIME_OUT">Missing time-out</option>
                  <option value="INCORRECT_TIME">Incorrect time</option>
                  <option value="OVERNIGHT_SHIFT">Overnight shift</option>
                  <option value="OTHER">Other</option>
                </>
              )}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-700">Holiday type
            <select value={form.holidayType} onChange={(e) => setField('holidayType', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="NONE">Not a holiday</option>
              <option value="REGULAR">Regular holiday</option>
              <option value="SPECIAL">Special holiday</option>
            </select>
          </label>
        </div>

        {form.type === 'ATTENDANCE_CORRECTION' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs font-medium text-gray-700">Corrected time-in
              <input type="datetime-local" value={form.correctedTimeIn} onChange={(e) => setField('correctedTimeIn', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-700">Corrected time-out
              <input type="datetime-local" value={form.correctedTimeOut} onChange={(e) => setField('correctedTimeOut', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-700">Unpaid break (minutes)
              <input type="number" min="0" value={form.breakMinutes} onChange={(e) => setField('breakMinutes', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {form.type === 'ATTENDANCE_CORRECTION' && (
            <label className="text-xs font-medium text-gray-700">Additional regular hours
              <input type="number" min="0" step="0.01" value={form.regularHours} onChange={(e) => setField('regularHours', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
          )}
          <label className="text-xs font-medium text-gray-700">Additional OT hours
            <input type="number" min="0" step="0.01" required={form.type === 'PRIOR_PERIOD_OT'} value={form.overtimeHours} onChange={(e) => setField('overtimeHours', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-700">Additional ND hours
            <input type="number" min="0" step="0.01" value={form.nightDiffHours} onChange={(e) => setField('nightDiffHours', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-medium text-gray-700">Source timesheet ID
            <input type="text" value={form.sourceTimesheetId} onChange={(e) => setField('sourceTimesheetId', e.target.value.trim())} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-700">Source pay-run ID
            <input type="text" value={form.sourcePayRunId} onChange={(e) => setField('sourcePayRunId', e.target.value.trim())} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-700">Source time-log ID
            <input type="text" value={form.sourceTimeLogId} onChange={(e) => setField('sourceTimeLogId', e.target.value.trim())} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-medium text-gray-700">Approved by
            <input type="text" required value={form.approvedBy} onChange={(e) => setField('approvedBy', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-700">Approval date
            <input type="date" required value={form.approvedAt} onChange={(e) => setField('approvedAt', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-700">Approval reference
            <input type="text" value={form.approvalReference} onChange={(e) => setField('approvalReference', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Form, email, or ticket" />
          </label>
        </div>

        <label className="block text-xs font-medium text-gray-700">Reason and payroll notes
          <textarea required rows="3" value={form.reason} onChange={(e) => setField('reason', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </label>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg">
            {saving ? 'Adding...' : 'Add to draft pay run'}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Included prior-period earnings</h4>
        {loading ? <p className="text-sm text-gray-500">Loading...</p> : items.length === 0 ? (
          <p className="text-sm text-gray-500">No prior-period earnings added.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-gray-500"><tr><th className="py-2 text-left">Work date</th><th className="py-2 text-left">Type</th><th className="py-2 text-right">Hours</th><th className="py-2 text-right">Amount</th><th className="py-2 text-right"></th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item._id}>
                    <td className="py-2">{new Date(item.originalWorkDate).toLocaleDateString()}</td>
                    <td className="py-2">{item.type === 'PRIOR_PERIOD_OT' ? 'Prior-period OT' : 'Attendance correction'}</td>
                    <td className="py-2 text-right">{Number((item.regularHours || 0) + (item.overtimeHours || 0)).toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold">₱{money(item.totalAmount)}</td>
                    <td className="py-2 text-right"><button type="button" onClick={() => remove(item)} className="text-red-600 hover:text-red-800">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PayrollAdjustmentModal;
