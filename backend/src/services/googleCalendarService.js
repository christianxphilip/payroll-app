import { google } from 'googleapis';
import Schedule from '../models/Schedule.js';
import Employee from '../models/Employee.js';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'a9a6f09502aa9eaf64a31fff6ca0133983ddf2760766243967f2d54fbecc3e61@group.calendar.google.com';

function getCalendarClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set. Please configure your Google Service Account JSON in Render backend environment variables.');
  }

  let credentials;
  try {
    credentials = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Please check formatting.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  return google.calendar({ version: 'v3', auth });
}

export const syncSchedulesToGoogleCalendar = async (startDate, endDate, employeeNameFilter = '') => {
  const calendar = getCalendarClient();

  let query = {
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  if (employeeNameFilter) {
    query.employeeName = employeeNameFilter;
  }

  const schedules = await Schedule.find(query);
  const employees = await Employee.find({}, 'employeeName email');
  const emailMap = {};
  employees.forEach(emp => {
    if (emp.employeeName && emp.email) {
      emailMap[emp.employeeName] = emp.email;
    }
  });

  let syncedCount = 0;
  let updatedCount = 0;

  for (const sched of schedules) {
    if (sched.isOff) continue;

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
      return `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:00:00+08:00`;
    };

    const startDateTime = parseTime(sched.date, sched.scheduledStartTime);
    let endDateTime = parseTime(sched.date, sched.scheduledEndTime);
    if (startDateTime && endDateTime && endDateTime <= startDateTime) {
      const endDateObj = new Date(sched.date);
      endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
      endDateTime = parseTime(endDateObj, sched.scheduledEndTime);
    }

    if (!startDateTime || !endDateTime) continue;

    const attendeeEmail = emailMap[sched.employeeName];
    const attendees = attendeeEmail ? [{ email: attendeeEmail, displayName: sched.employeeName }] : [];

    const eventResource = {
      summary: `Shift: ${sched.employeeName} (${sched.assignmentType || 'GENERAL'})`,
      description: `Scheduled Shift: ${sched.scheduledStartTime || ''} - ${sched.scheduledEndTime || ''}\nDuration: ${sched.scheduledDuration || 8} hrs\nNotes: ${sched.notes || 'None'}`,
      location: 'ESPRO Coffee',
      start: { dateTime: startDateTime, timeZone: 'Asia/Manila' },
      end: { dateTime: endDateTime, timeZone: 'Asia/Manila' },
      attendees: attendees
    };

    if (sched.googleEventId) {
      try {
        await calendar.events.update({
          calendarId: CALENDAR_ID,
          eventId: sched.googleEventId,
          requestBody: eventResource,
          sendUpdates: 'all'
        });
        updatedCount++;
        continue;
      } catch (err) {
        console.log('Existing Google event not found, creating new one...');
      }
    }

    const createdEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: eventResource,
      sendUpdates: 'all'
    });

    sched.googleEventId = createdEvent.data.id;
    await sched.save();
    syncedCount++;
  }

  return { syncedCount, updatedCount, totalProcessed: schedules.length };
};
