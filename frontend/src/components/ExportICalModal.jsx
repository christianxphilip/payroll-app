import React, { useState } from 'react';
import Modal from './Modal';
import { scheduleAPI, employeeAPI } from '../services/api';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';

const ExportICalModal = ({ isOpen, onClose, initialStartDate, initialEndDate }) => {
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [employeeName, setEmployeeName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [progress, setProgress] = useState(null);

  const { isSignedIn, isConnecting, connect, disconnect, syncShiftsWithGuests, clearGoogleCalendarShifts } = useGoogleCalendar();

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
    if (!isSignedIn) {
      setError('Please connect your Google Account first.');
      return;
    }

    try {
      setIsSyncing(true);
      setError('');
      setSuccessMsg('');
      setProgress({ done: 0, total: 0 });

      // Fetch schedules and employee emails from our backend
      const [schedRes, empRes] = await Promise.all([
        scheduleAPI.getAll({
          startDate,
          endDate,
          ...(employeeName ? { employeeName } : {}),
          limit: 500
        }),
        employeeAPI.getAll()
      ]);

      const schedules = (schedRes.data || []).filter(s => !s.isOff);
      const employees = empRes.data || [];

      const emailMap = {};
      employees.forEach(emp => {
        if (emp.employeeName && emp.email) {
          emailMap[emp.employeeName] = emp.email;
        }
      });

      // Filter by employee name if provided
      const filtered = employeeName
        ? schedules.filter(s => s.employeeName?.toLowerCase().includes(employeeName.toLowerCase()))
        : schedules;

      if (filtered.length === 0) {
        setError('No shifts found for the selected date range.');
        setIsSyncing(false);
        setProgress(null);
        return;
      }

      setProgress({ done: 0, total: filtered.length });

      const result = await syncShiftsWithGuests(
        filtered,
        emailMap,
        (done, total) => setProgress({ done, total })
      );

      setSuccessMsg(
        `🎉 Success! Synced ${result.synced} new shifts, updated ${result.updated} existing.\n` +
        `${result.failed > 0 ? `⚠️ ${result.failed} shifts failed.` : ''}` +
        `\n✅ Employee emails added to Guests — invitation emails sent!`
      );
    } catch (err) {
      console.error(err);
      setError(err.message || 'Sync failed. Please reconnect Google and try again.');
    } finally {
      setIsSyncing(false);
      setProgress(null);
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

      let clearedCount = 0;
      if (isSignedIn) {
        const res = await clearGoogleCalendarShifts(startDate, endDate, employeeName);
        clearedCount = res.clearedCount;
      } else {
        const res = await scheduleAPI.clearGoogleCalendar(startDate, endDate, employeeName);
        clearedCount = res.data?.data?.clearedCount || res.data?.clearedCount || 0;
      }

      setSuccessMsg(`🗑️ Successfully cleared ${clearedCount} shift event(s) from Google Calendar!`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to clear Google Calendar shifts.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleOpenGoogleCalendarImport = () => {
    window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Sync to Google Calendar" maxWidth="xl">
      <div className="space-y-4">

        {/* Google Account Connection Banner */}
        <div className={`rounded-xl p-4 border flex items-center justify-between gap-3 transition-all ${
          isSignedIn
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
            : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold ${
              isSignedIn ? 'bg-emerald-500' : 'bg-blue-500'
            }`}>
              {isSignedIn ? '✓' : 'G'}
            </div>
            <div>
              <p className={`text-sm font-semibold ${isSignedIn ? 'text-emerald-800 dark:text-emerald-300' : 'text-blue-800 dark:text-blue-300'}`}>
                {isSignedIn ? 'Google Calendar Connected' : 'Connect Google Calendar'}
              </p>
              <p className={`text-xs mt-0.5 ${isSignedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {isSignedIn
                  ? '✅ Employee emails will be added directly to Guests field with invite notifications'
                  : 'Sign in once to sync shifts with employee guest invitations and email notifications'
                }
              </p>
            </div>
          </div>
          {isSignedIn ? (
            <button
              onClick={disconnect}
              className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 underline transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {isConnecting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
          )}
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

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Syncing shifts to Google Calendar...</span>
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                style={{ width: progress.total ? `${Math.round((progress.done / progress.total) * 100)}%` : '0%' }}
              />
            </div>
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
            disabled={isSyncing || isExporting || isClearing || !isSignedIn}
            className={`px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 ${
              isSignedIn
                ? 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
            }`}
            title={!isSignedIn ? 'Connect Google first' : ''}
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Syncing...
              </>
            ) : '⚡ Sync with Guest Invites'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportICalModal;
