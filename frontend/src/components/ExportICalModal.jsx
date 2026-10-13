import React, { useState } from 'react';
import Modal from './Modal';
import { scheduleAPI } from '../services/api';

const ExportICalModal = ({ isOpen, onClose, initialStartDate, initialEndDate }) => {
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [employeeName, setEmployeeName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setError('Please select both Start Date and End Date.');
      return;
    }
    try {
      setIsExporting(true);
      setError('');
      setSuccessMsg('');
      await scheduleAPI.exportICal(startDate, endDate, employeeName);
      setSuccessMsg('✓ .ics file downloaded! Import it into Google Calendar.');
    } catch (err) {
      setError('Failed to generate .ics file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGoogleOAuthSync = async () => {
    if (!startDate || !endDate) {
      setError('Please select both Start Date and End Date.');
      return;
    }
    try {
      setIsSyncing(true);
      setError('');
      setSuccessMsg('');
      const response = await scheduleAPI.syncGoogleCalendar(startDate, endDate, employeeName);
      const result = response.data || response;
      setSuccessMsg(`✓ Calendar synchronized: ${result.syncedCount || 0} added, ${result.updatedCount || 0} updated, ${result.deletedCount || 0} removed.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Calendar sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClear = async () => {
    if (!startDate || !endDate) {
      setError('Please select both Start Date and End Date.');
      return;
    }

    const confirmMsg = employeeName
      ? `Are you sure you want to CLEAR all Google Calendar shifts for "${employeeName}" from ${startDate} to ${endDate}?`
      : `Are you sure you want to CLEAR ALL Google Calendar shift events from ${startDate} to ${endDate}?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setIsClearing(true);
      setError('');
      setSuccessMsg('');

      const res = await scheduleAPI.clearGoogleCalendar(startDate, endDate, employeeName);
      const clearedCount = res.data?.data?.clearedCount || res.data?.clearedCount || 0;

      setSuccessMsg(`🗑️ Successfully cleared ${clearedCount} shift event(s) from Google Calendar!`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to clear Google Calendar shifts.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Sync to Google Calendar" maxWidth="xl">
      <div className="space-y-4">

        {/* Server-managed manual sync banner */}
        <div className="rounded-xl p-4 border flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold bg-emerald-500">
              ✓
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Google Calendar Sync
              </p>
              <p className="text-xs mt-0.5 text-emerald-600 dark:text-emerald-400">
                Pindutin ang Sync Now kapag final na ang schedule. Hindi kailangan ang paulit-ulit na Google sign-in.
              </p>
            </div>
          </div>
        </div>

        {/* Active operation loading banner */}
        {(isClearing || isSyncing || isExporting) && (
          <div className="p-3 bg-blue-50 border border-blue-300 text-blue-800 rounded-lg text-sm flex items-center gap-3 animate-pulse">
            <svg className="animate-spin h-5 w-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="font-semibold">
              {isClearing && '⏳ Clearing schedules from Google Calendar... Please wait.'}
              {isSyncing && '⏳ Syncing schedules to Google Calendar... Please wait.'}
              {isExporting && '⏳ Generating .ics calendar export file...'}
            </span>
          </div>
        )}

        {/* Error & Success messages */}
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm whitespace-pre-line">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-100 border border-emerald-400 text-emerald-800 rounded-lg text-sm whitespace-pre-line">
            {successMsg}
          </div>
        )}

        {/* Date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setSuccessMsg(''); setError(''); }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">End Date *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setSuccessMsg(''); setError(''); }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Employee filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Employee Filter <span className="font-normal text-slate-500">(Optional — leave empty to sync all)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Leanard, Joana, Mark..."
            value={employeeName}
            onChange={(e) => { setEmployeeName(e.target.value); setSuccessMsg(''); }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing || isSyncing || isExporting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing || isSyncing || isExporting}
            className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isClearing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Clearing...
              </>
            ) : (
              '🗑️ Clear Google Sched'
            )}
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || isSyncing || isClearing}
            className="px-4 py-2 text-sm font-medium bg-slate-600 hover:bg-slate-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Generating...' : '⬇ Download .ics'}
          </button>

          <button
            type="button"
            onClick={handleGoogleOAuthSync}
            disabled={isSyncing || isExporting || isClearing}
            className="px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Syncing...
              </>
            ) : '⚡ Sync Now'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportICalModal;
