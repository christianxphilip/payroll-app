import React, { useState } from 'react';
import Modal from './Modal';
import { scheduleAPI } from '../services/api';

const ExportICalModal = ({ isOpen, onClose, initialStartDate, initialEndDate }) => {
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [employeeName, setEmployeeName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleExport = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError('Please select both Start Date and End Date.');
      return;
    }

    try {
      setIsExporting(true);
      setError('');
      setSuccessMsg('');
      await scheduleAPI.exportICal(startDate, endDate, employeeName);
      setSuccessMsg('✓ .ics file downloaded successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to generate .ics calendar file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDirectApiSync = async () => {
    if (!startDate || !endDate) {
      setError('Please select both Start Date and End Date.');
      return;
    }

    try {
      setIsSyncing(true);
      setError('');
      setSuccessMsg('');
      const res = await scheduleAPI.syncGoogleCalendar(startDate, endDate, employeeName);
      setSuccessMsg(`🚀 ${res.message || 'Successfully synced shifts directly to ESPRO SCHEDULES Google Calendar!'}`);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to sync with Google Calendar API. Ensure GOOGLE_SERVICE_ACCOUNT_JSON is set in Render environment variables.';
      setError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenGoogleCalendarImport = () => {
    window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Sync / Export to Google Calendar">
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">⚡ Direct Google Calendar API Sync & .ics Export</p>
          <p>Sync finalized schedules directly to your <strong>ESPRO SCHEDULES</strong> Google Calendar with pre-filled guests and auto-notifications, or download an <code>.ics</code> file.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm whitespace-pre-line">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-100 border border-emerald-400 text-emerald-800 rounded text-sm space-y-2">
            <p className="font-semibold">{successMsg}</p>
            {successMsg.includes('.ics') && (
              <div>
                <p className="text-xs mb-1">Click below to open Google Calendar's Import page and upload the file to your <strong>ESPRO SCHEDULES</strong> calendar.</p>
                <button
                  type="button"
                  onClick={handleOpenGoogleCalendarImport}
                  className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium shadow-sm transition-colors"
                >
                  Open Google Calendar Import ↗
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setSuccessMsg(''); setError(''); }}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              End Date *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setSuccessMsg(''); setError(''); }}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Employee Filter (Optional)
          </label>
          <input
            type="text"
            placeholder="Leave empty for ALL employees"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close
          </button>
          
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || isSyncing}
            className="px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExporting ? 'Generating...' : 'Download .ics File'}
          </button>

          <button
            type="button"
            onClick={handleDirectApiSync}
            disabled={isExporting || isSyncing}
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSyncing ? 'Syncing to Google...' : '⚡ Sync via Google API'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportICalModal;
