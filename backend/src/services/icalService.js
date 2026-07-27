export const generateICalContent = (schedules, employeeEmailMap = {}) => {
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

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ESPRO Coffee Payroll App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'X-WR-CALNAME:ESPRO SCHEDULES',
    'X-WR-TIMEZONE:Asia/Manila',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Manila',
    'X-LIC-LOCATION:Asia/Manila',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:PST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  schedules.forEach((schedule) => {
    if (schedule.isOff) return; // Skip off days

    const dtStart = parseTime(schedule.date, schedule.scheduledStartTime);
    let dtEnd = parseTime(schedule.date, schedule.scheduledEndTime);

    if (dtStart && dtEnd && dtEnd <= dtStart) {
      const endDate = new Date(schedule.date);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      dtEnd = parseTime(endDate, schedule.scheduledEndTime);
    }

    if (dtStart && dtEnd) {
      const email = employeeEmailMap[schedule.employeeName];
      const eventLines = [
        'BEGIN:VEVENT',
        `UID:schedule-${schedule._id}@espro.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;TZID=Asia/Manila:${dtStart}`,
        `DTEND;TZID=Asia/Manila:${dtEnd}`,
        `SUMMARY:Shift: ${schedule.employeeName} (${schedule.assignmentType || 'GENERAL'})`,
        `DESCRIPTION:Shift: ${schedule.scheduledStartTime || ''} - ${schedule.scheduledEndTime || ''}\\nDuration: ${schedule.scheduledDuration || 8} hrs\\nNotes: ${schedule.notes || 'None'}`,
        'LOCATION:ESPRO Coffee'
      ];

      if (email) {
        eventLines.push(`ORGANIZER;CN="ESPRO Coffee":mailto:esprocoffee@gmail.com`);
        eventLines.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${schedule.employeeName}:mailto:${email}`);
      }

      eventLines.push('END:VEVENT');
      icsLines.push(...eventLines);
    }
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
};
