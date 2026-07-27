import React, { useState } from 'react';
import Modal from './Modal';
import { scheduleAPI, employeeAPI } from '../services/api';

const ExportICalModal = ({ isOpen, onClose, initialStartDate, initialEndDate }) => {
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [employeeName, setEmployeeName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [shiftList, setShiftList] = useState([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);

  const handleExport = async (e) => {
    if (e) e.preventDefault();
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
      const msg = err.response?.data?.error || 'Failed to sync with Google Calendar API.';
      setError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchShiftsForGuests = async () => {
    if (!startDate || !endDate) {
      setError('Please select Start Date and End Date to fetch shifts.');
      return;
    }

    try {
      setIsLoadingShifts(true);
      setError('');
      const [schedRes, empRes] = await Promise.all([
        scheduleAPI.getAll({ startDate, endDate, limit: 200 }),
        employeeAPI.getAll()
      ]);

      const schedules = schedRes.data || [];
      const employees = empRes.data || [];
      const emailMap = {};
      employees.forEach(emp => {
        if (emp.employeeName && emp.email) {
          emailMap[emp.employeeName] = emp.email;
        }
      });

      let filtered = schedules.filter(s => !s.isOff);
      if (employeeName && employeeName.trim() !== '') {
        const term = employeeName.trim().toLowerCase();
        filtered = filtered.filter(s => s.employeeName && s.employeeName.toLowerCase().includes(term));
      }

      const items = filtered.map(s => {
        const email = emailMap[s.employeeName] || '';
        const title = encodeURIComponent(`Shift: ${s.employeeName} (${s.assignmentType || 'BAR'})`);
        const details = encodeURIComponent(`Staff: ${s.employeeName}\nScheduled Shift: ${s.scheduledStartTime || ''} - ${s.scheduledEndTime || ''}\nDuration: ${s.scheduledDuration || 8} hrs\nNotes: ${s.notes || 'None'}`);
        const location = encodeURIComponent('ESPRO Coffee');

        const parseTime = (dateStr, timeStr) => {
          if (!timeStr) return null;
          const date = new Date(dateStr);
          const match = timeStr.trim().toUpperCase().match(/(\d+)(AM|PM)/);
          if (!match) return null;
          let hour = parseInt(match[1], 10);
          const period = match[2];
          if (period === 'AM' && hour === 12) hour = 0;
          if (period === 'PM' && hour !== 12) hour += 12;

          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          return `${year}${month}${day}T${String(hour).padStart(2, '0')}0000`;
        };

        const dtStart = parseTime(s.date, s.scheduledStartTime) || '20260727T160000';
        let dtEnd = parseTime(s.date, s.scheduledEndTime) || '20260728T010000';
        if (dtStart && dtEnd && dtEnd <= dtStart) {
          const endDateObj = new Date(s.date);
          endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
          dtEnd = parseTime(endDateObj, s.scheduledEndTime) || dtEnd;
        }

        let link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;
        if (email) {
          link += `&add=${encodeURIComponent(email)}`;
        }

        return {
          id: s._id,
          employeeName: s.employeeName,
          email,
          date: s.date ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          time: `${s.scheduledStartTime} - ${s.scheduledEndTime}`,
          assignment: s.assignmentType || 'GENERAL',
          link
        };
      });

      setShiftList(items);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch shifts.');
    } finally {
      setIsLoadingShifts(false);
    }
  };

  const handleOpenGoogleCalendarImport = () => {
    window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Sync / Export to Google Calendar" maxWidth="xl">
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">⚡ Direct Google Sync & 1-Click Guest Invites</p>
          <p>Sync shifts to <strong>ESPRO SCHEDULES</strong> Google Calendar or open 1-click links with employee emails pre-filled directly into the <strong>Guests</strong> field.</p>
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
              onChange={(e) => { setStartDate(e.target.value); setSuccessMsg(''); setError(''); setShiftList([]); }}
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
              onChange={(e) => { setEndDate(e.target.value); setSuccessMsg(''); setError(''); setShiftList([]); }}
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
            placeholder="Type employee name (e.g. Leanard, Joana, Mark)"
            value={employeeName}
            onChange={(e) => { setEmployeeName(e.target.value); setShiftList([]); }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* 1-Click Guest Invites Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              1-Click Guest Invites (Pre-fills Guests Field)
            </span>
            <button
              type="button"
              onClick={handleFetchShiftsForGuests}
              disabled={isLoadingShifts}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
            >
              {isLoadingShifts ? 'Loading shifts...' : 'Load Shift Links 🔄'}
            </button>
          </div>

          {shiftList.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-900/50">
              {shiftList.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-xs gap-2">
                  <div className="truncate">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.employeeName}</span>
                    <span className="text-slate-500 ml-1.5">({item.date} • {item.time} • {item.assignment})</span>
                    {item.email && <div className="text-[11px] text-amber-600 dark:text-amber-400 truncate">📧 {item.email}</div>}
                  </div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    ➕ Open Event with Guest ↗
                  </a>
                </div>
              ))}
            </div>
          )}
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
            {isSyncing ? 'Syncing to Google...' : '⚡ Bulk Sync to ESPRO SCHEDULES'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportICalModal;
