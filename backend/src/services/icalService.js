/**
 * Native RFC 5545 iCalendar Service
 * Generates .ics calendar feeds for Google Calendar / Apple Calendar / Outlook
 * and parses uploaded .ics files.
 */

// Helper to convert time string (e.g. "3PM", "4:30PM", "15:00") to hours and minutes
function parseTimeString(timeStr) {
  if (!timeStr) return { hours: 0, minutes: 0 };
  const str = timeStr.trim().toUpperCase();
  
  // Match 12-hour format e.g. "3PM", "3:30PM", "12AM"
  const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const period = match12[3];

    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours !== 12) hours += 12;

    return { hours, minutes };
  }

  // Match 24-hour format e.g. "15:00", "09:30"
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return {
      hours: parseInt(match24[1], 10),
      minutes: parseInt(match24[2], 10)
    };
  }

  return { hours: 0, minutes: 0 };
}

// Format a Date object to UTC string for ICS format: YYYYMMDDTHHMMSSZ
function formatICSDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate iCal (.ics) string from array of schedule documents
 */
export function generateICalFeed(schedules = [], options = {}) {
  const calName = options.calendarName || 'ESPRO SCHEDULES';

  let icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ESPRO Coffee//Payroll App Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:Asia/Manila'
  ];

  const nowUTC = formatICSDate(new Date());

  schedules.forEach((sch) => {
    if (sch.isOff) return; // Skip OFF days

    const scheduleDate = new Date(sch.date);
    const dateStr = scheduleDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const startTime = parseTimeString(sch.scheduledStartTime);
    const endTime = parseTimeString(sch.scheduledEndTime);

    // Combine date + time in Asia/Manila (UTC+8) offset
    // Note: ISO format string with +08:00
    const startISO = `${dateStr}T${String(startTime.hours).padStart(2, '0')}:${String(startTime.minutes).padStart(2, '0')}:00+08:00`;
    let endISO = `${dateStr}T${String(endTime.hours).padStart(2, '0')}:${String(endTime.minutes).padStart(2, '0')}:00+08:00`;

    let startObj = new Date(startISO);
    let endObj = new Date(endISO);

    // If end time is before/equal to start time, assume overnight shift (ends next day)
    if (endObj <= startObj) {
      endObj.setDate(endObj.getDate() + 1);
    }

    const summary = `Shift: ${sch.employeeName} (${sch.assignmentType || 'GENERAL'})`;
    const description = [
      `Employee: ${sch.employeeName}`,
      `Time: ${sch.scheduledStartTime || ''} - ${sch.scheduledEndTime || ''}`,
      `Duration: ${sch.scheduledDuration || 0} hrs`,
      `Assignment: ${sch.assignmentType || 'GENERAL'}`,
      sch.notes ? `Notes: ${sch.notes}` : ''
    ].filter(Boolean).join('\\n');

    const uid = `schedule-${sch._id || Math.random().toString(36).substring(2)}@espro-payroll.app`;

    icsLines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUTC}`,
      `DTSTART:${formatICSDate(startObj)}`,
      `DTEND:${formatICSDate(endObj)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  icsLines.push('END:VCALENDAR', '');
  return icsLines.join('\r\n');
}

/**
 * Parse .ics string into structured events
 */
export function parseICSFile(icsContent) {
  const events = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (trimmed === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const keyPart = trimmed.substring(0, colonIdx).split(';')[0];
        const val = trimmed.substring(colonIdx + 1);
        currentEvent[keyPart] = val;
      }
    }
  });

  return events;
}
