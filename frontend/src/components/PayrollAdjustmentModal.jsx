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

const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short', day: 'numeric'
}) : '';

const timeLabel = (value) => value ? new Date(value).toLocaleTimeString('en-US', {
  hour: 'numeric', minute: '2-digit'
}) : '--';

const localDateTimeValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const calculateNightHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return 0;
  const start = new Date(timeIn);
  const end = new Date(timeOut);
  if (end <= start) return 0;
  let total = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - 1);
  cursor.setHours(0, 0, 0, 0);
  while (cursor < end) {
    const nightStart = new Date(cursor);
    nightStart.setHours(22, 0, 0, 0);
    const nightEnd = new Date(cursor);
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(6, 0, 0, 0);
    const overlapStart = Math.max(start.getTime(), nightStart.getTime());
    const overlapEnd = Math.min(end.getTime(), nightEnd.getTime());
    if (overlapEnd > overlapStart) total += (overlapEnd - overlapStart) / 3600000;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
};

const PayrollAdjustmentModal = ({ isOpen, onClose, payRun, employee, onUpdated }) => {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState({ payRuns: [], timesheets: [], logs: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !employee || !payRun) return;
    setForm(emptyForm);
    setError('');
    setLoading(true);
    Promise.all([
      payrollAdjustmentAPI.getForEmployee(payRun._id, employee._id),
      payrollAdjustmentAPI.getSources(payRun._id, employee._id)
    ])
      .then(([itemsRes, sourcesRes]) => {
        setItems(itemsRes.data || itemsRes || []);
        setSources(sourcesRes.data || sourcesRes || { payRuns: [], timesheets: [], logs: [] });
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load prior-period adjustments'))
      .finally(() => setLoading(false));
  }, [isOpen, employee?._id, payRun?._id]);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const selectPayRun = (sourcePayRunId) => {
    const selected = sources.payRuns.find((item) => item._id === sourcePayRunId);
    const allowedTimesheets = (selected?.timesheetIds || []).map(String);
    setForm((current) => ({
      ...current,
      sourcePayRunId,
      sourceTimesheetId: allowedTimesheets.includes(current.sourceTimesheetId) ? current.sourceTimesheetId : '',
      sourceTimeLogId: ''
    }));
  };

  const selectTimesheet = (sourceTimesheetId) => {
    setForm((current) => ({ ...current, sourceTimesheetId, sourceTimeLogId: '' }));
  };

  const selectLog = (sourceTimeLogId) => {
    const log = sources.logs.find((item) => item._id === sourceTimeLogId);
    if (!log) {
      setField('sourceTimeLogId', '');
      return;
    }
    const approvedHours = Number(log.adjustedHoursWorked || 0);
    const actualHours = Number(log.hoursWorked || 0);
    const unpaidOvertime = Math.max(0, actualHours - Math.max(8, approvedHours));
    setForm((current) => ({
      ...current,
      sourceTimeLogId,
      originalWorkDate: new Date(log.date).toISOString().slice(0, 10),
      overtimeHours: current.type === 'PRIOR_PERIOD_OT' && unpaidOvertime > 0
        ? unpaidOvertime.toFixed(2)
        : current.overtimeHours,
      correctedTimeIn: current.type === 'ATTENDANCE_CORRECTION' ? localDateTimeValue(log.timeIn) : current.correctedTimeIn,
      correctedTimeOut: current.type === 'ATTENDANCE_CORRECTION' ? localDateTimeValue(log.timeOut) : current.correctedTimeOut,
      holidayType: log.isHoliday ? String(log.holidayType || 'NONE').toUpperCase() : 'NONE'
    }));
  };

  const selectedPayRun = sources.payRuns.find((item) => item._id === form.sourcePayRunId);
  const availableTimesheets = sources.timesheets.filter((item) =>
    !selectedPayRun || (selectedPayRun.timesheetIds || []).map(String).includes(item._id)
  );
  const availableLogs = sources.logs.filter((item) =>
    !form.sourceTimesheetId || String(item.timesheetId) === form.sourceTimesheetId
  );
  const selectedLog = sources.logs.find((item) => item._id === form.sourceTimeLogId);
  const correctionHours = (() => {
    if (form.type !== 'ATTENDANCE_CORRECTION' || !form.correctedTimeIn || !form.correctedTimeOut) {
      return { regular: 0, overtime: 0, night: 0 };
    }
    const start = new Date(form.correctedTimeIn);
    const end = new Date(form.correctedTimeOut);
    const total = Math.max(0, (end - start) / 3600000 - Number(form.breakMinutes || 0) / 60);
    const previous = Number(selectedLog?.adjustedHoursWorked || 0);
    return {
      regular: Math.max(0, Math.min(total, 8) - Math.min(previous, 8)),
      overtime: Math.max(0, Math.max(0, total - 8) - Math.max(0, previous - 8)),
      night: Math.max(0, calculateNightHours(start, end) - Number(selectedLog?.ndHours || 0))
    };
  })();

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
        regularHours: form.type === 'ATTENDANCE_CORRECTION' ? correctionHours.regular : 0,
        overtimeHours: form.type === 'ATTENDANCE_CORRECTION' ? correctionHours.overtime : Number(form.overtimeHours || 0),
        nightDiffHours: form.type === 'ATTENDANCE_CORRECTION' ? correctionHours.night : Number(form.nightDiffHours || 0),
        breakMinutes: Number(form.breakMinutes || 0),
        sourceTimesheetId: form.sourceTimesheetId || undefined,
        sourcePayRunId: form.sourcePayRunId || undefined,
        sourceTimeLogId: form.sourceTimeLogId || undefined,
        correctedTimeIn: form.correctedTimeIn ? new Date(form.correctedTimeIn).toISOString() : undefined,
        correctedTimeOut: form.correctedTimeOut ? new Date(form.correctedTimeOut).toISOString() : undefined
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
          <label className="text-xs font-medium text-gray-700">Source pay run
            <select required={form.type === 'PRIOR_PERIOD_OT'} value={form.sourcePayRunId} onChange={(e) => selectPayRun(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Select pay run</option>
              {sources.payRuns.map((item) => (
                <option key={item._id} value={item._id}>{dateLabel(item.payrollPeriodStart)} - {dateLabel(item.payrollPeriodEnd)} ({item.status})</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-700">Source timesheet
            <select required={form.type === 'PRIOR_PERIOD_OT'} value={form.sourceTimesheetId} onChange={(e) => selectTimesheet(e.target.value)} disabled={!form.sourcePayRunId} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100">
              <option value="">Select timesheet</option>
              {availableTimesheets.map((item) => (
                <option key={item._id} value={item._id}>{item.name} ({dateLabel(item.startDate)} - {dateLabel(item.endDate)})</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-700">Source attendance log
            <select required={form.type === 'PRIOR_PERIOD_OT'} value={form.sourceTimeLogId} onChange={(e) => selectLog(e.target.value)} disabled={!form.sourceTimesheetId} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100">
              <option value="">{form.type === 'ATTENDANCE_CORRECTION' ? 'No source log / missing log' : 'Select attendance log'}</option>
              {availableLogs.map((item) => (
                <option key={item._id} value={item._id}>{dateLabel(item.date)} | {timeLabel(item.timeIn)} - {timeLabel(item.timeOut)} | Actual {Number(item.hoursWorked || 0).toFixed(2)}h / Approved {Number(item.adjustedHoursWorked || 0).toFixed(2)}h</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {form.type === 'ATTENDANCE_CORRECTION' && (
            <label className="text-xs font-medium text-gray-700">Work date
              <input type="date" required value={form.originalWorkDate} onChange={(e) => setField('originalWorkDate', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
          )}
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
              <input type="datetime-local" required value={form.correctedTimeIn} onChange={(e) => setField('correctedTimeIn', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-700">Corrected time-out
              <input type="datetime-local" required value={form.correctedTimeOut} onChange={(e) => setField('correctedTimeOut', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-700">Unpaid break (minutes)
              <input type="number" min="0" value={form.breakMinutes} onChange={(e) => setField('breakMinutes', e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {form.type === 'ATTENDANCE_CORRECTION' && (
            <label className="text-xs font-medium text-gray-700">Additional regular hours
              <input type="text" readOnly value={correctionHours.regular.toFixed(2)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm" />
            </label>
          )}
          <label className="text-xs font-medium text-gray-700">Additional OT hours
            <input type={form.type === 'PRIOR_PERIOD_OT' ? 'number' : 'text'} min="0" step="0.01" readOnly={form.type === 'ATTENDANCE_CORRECTION'} required={form.type === 'PRIOR_PERIOD_OT'} value={form.type === 'ATTENDANCE_CORRECTION' ? correctionHours.overtime.toFixed(2) : form.overtimeHours} onChange={(e) => setField('overtimeHours', e.target.value)} className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${form.type === 'ATTENDANCE_CORRECTION' ? 'bg-gray-100' : ''}`} />
          </label>
          <label className="text-xs font-medium text-gray-700">Additional ND hours
            <input type="text" readOnly={form.type === 'ATTENDANCE_CORRECTION'} value={form.type === 'ATTENDANCE_CORRECTION' ? correctionHours.night.toFixed(2) : form.nightDiffHours} onChange={(e) => setField('nightDiffHours', e.target.value)} className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${form.type === 'ATTENDANCE_CORRECTION' ? 'bg-gray-100' : ''}`} />
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
