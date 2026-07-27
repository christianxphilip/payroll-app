import { useState } from 'react';
import Modal from './Modal';

const CalendarFeedModal = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api';
  const feedUrl = `${rawApiUrl}/schedules/ical/feed.ics`;

  // Convert http/https URL for Google Calendar cid link
  const googleCalendarSubscribeUrl = `https://calendar.google.com/calendar/r/settings/addcalendar?cid=${encodeURIComponent(feedUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Live Google Calendar Sync">
      <div className="space-y-5 text-gray-700">
        <p className="text-sm">
          Connect your <strong>ESPRO Payroll Application</strong> schedules directly to your <strong>Google Calendar</strong> ("ESPRO SCHEDULES"). Once subscribed, all finalized shifts will sync automatically in real-time across all your devices!
        </p>

        {/* Live Feed URL Container */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
            Live iCal Subscription Feed URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={feedUrl}
              className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-800 select-all"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 min-h-[38px] whitespace-nowrap"
            >
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <a
            href={googleCalendarSubscribeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-green-600 text-white text-center py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>📅 Add to Google Calendar</span>
          </a>
        </div>

        {/* Setup Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-xs text-blue-900">
          <h4 className="font-bold text-sm text-blue-950">How to add to your "ESPRO SCHEDULES" Google Calendar:</h4>
          <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>Click the green <strong>"Add to Google Calendar"</strong> button above (or open Google Calendar).</li>
            <li>In Google Calendar, look at the left sidebar under <strong>"Other calendars"</strong> and click <strong>+</strong> &gt; <strong>From URL</strong>.</li>
            <li>Paste the copied Live Feed URL into the field.</li>
            <li>Click <strong>Add Calendar</strong>. All employee shifts will instantly appear and update automatically!</li>
          </ol>
        </div>

        <div className="flex justify-end pt-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 min-h-[40px]"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CalendarFeedModal;
