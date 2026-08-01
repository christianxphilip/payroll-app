import { google } from 'googleapis';
import Schedule from '../models/Schedule.js';
import Employee from '../models/Employee.js';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'a9a6f09502aa9eaf64a31fff6ca0133983ddf2760766243967f2d54fbecc3e61@group.calendar.google.com';

const DEFAULT_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "espro-503705",
  private_key_id: "eab8027377f6733e03831e49de571b8a00c01fd8",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDbCbbcG5lbIE0J\nDL5y24qkDD/1XWHWpWmiPmGWLTxaZHyQ+T37jqQFcxurVG1uN0z7mTIKAXnHrmqF\nthC1R05wEl0MJAq0jnPiX+t83pTU3QMx8MMOeuQQe3A1WVm/WujPa2CSuaA+TsSU\nVTM110dLTAeUGzwp0fWKdn5QVp8oueS4BvwWyPYjEAL2MEOEd2uCT7eTvrwk56Mt\nLYtdLskHeQZGh/RdsHXo7khuVWxwo6W8oMbMOhqI34JD1fE8QgKbDzf07HeQbwzd\nHicJKkojlmaaa+9dHSixTBO2c45PY+LkhRq6kFJR0aq9bX1e943ic6pJ+TqT/AFM\n1Zqri0yxAgMBAAECggEAE3DDSA8zB0F7VN2gBvWxUmoRQH0Z8pZvz7SVrgyJxMQS\nbOjnisItkJuXeGy1NwkKzhyEsm/7F7FFRw99Cs8vXlxi4cb5JEQDHl5rui4kgNgK\nMTkwjBfK0iOtNoRIUObdWZDVhhrvkVgls7yeykfhzgRgz9EIVUs17c932o2K8W7p\nmlX9pDBxSDhKU7yGavTzhVnAb3jGcXIP0u5yHMyhzvuZQAt09/lQDcHP8Pw6pjok\ns8SX9wfu5I/xfAisEzr85NnJW6fikuceGktkPCuLsHaDaoXctrDnWAjUImG+tc83\nAg9eIolblWm2Bz0HWOErF76gdsdBKWENUxIiUdbAWQKBgQDy3EVF4Hnx299MNU2J\njkgKlMBJevkdiDDvUekTHXwTGUhqqvID+FetooXwy+gW8/MOQ7iOJ0VXRUV5h9Jn\nGxPctJoOjqspOUYhAEM0eHkUPgjvAbaPjumt/RVttcYAELMvmjw3gXiqJZs4mXVl\nxBeM8h+eQekOEvhD+sBdtTtO2wKBgQDm433CUnFl9FIjdelKwLloKXKn7sLV/4qM\nFcp0DpPvQBPI5YXu1iaFIAkV4CcqmY5H0MFxuqTA1hf+LDTx6bVYhUAaotkirP7r\nY8mN6mWxa/vpc9vQr2jv4T6Io0L4cxEyOMfs6OWCBl1RYi8jso9RNHDoyjIJNU40\njpQbIhnKYwKBgB3HbKcY01sYvtS1ZICNdb/2ZW2dKpa4cGen/5BceS5OV1bdBzf9\nZ6Le3tWb6yWFXDRPkX28yv/cepxgTyhdZZ4Wdx152PsBDtxVD+iLLS2SPb4w05Xe\nzECNW+dL9q9jXNVlcCTON2GFovbZuk90L/8UYVQieNVE9jQ/tv7GjjMpAoGBAL5p\nnq1DkIGknJjiBSPBDSb6B7S3E7eop3of/nb4Dsig77AemfX+ZoYjhVqlIafgO5a+\ncsp4QqdF6UOU8ZUQSJ5YRiWxZ6FRSmqWQQLo7DUF+Rrukbno74HlIM1O10xOmT/x\n0+9totk4pn0XnAi0mb0+ol9ZYSp266gsbbhyxxJBAoGBAO5m1XhGvjFUlyqKKg7j\nurQvGpdb7njJcnauX9BZT28Zg66C/9zk4ugU4wiSZoPhLgitNUm5Wbt74XTFzCrn\n5645KLGhOGTgNwZJ9ccWa7CwAQY6w5Y0MmISrhZByvklwfg637F30UZ2adCQLxTg\nFWoNzhBxYdqptitjoodHqaNn\n-----END PRIVATE KEY-----\n",
  client_email: "espro-calendar-sync@espro-503705.iam.gserviceaccount.com",
  client_id: "110612441459835260101",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/espro-calendar-sync%40espro-503705.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

function getCalendarClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let credentials = DEFAULT_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    try {
      credentials = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
    } catch (err) {
      console.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON env var, falling back to default.');
    }
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
  if (employeeNameFilter && employeeNameFilter.trim() !== '') {
    query.employeeName = { $regex: employeeNameFilter.trim(), $options: 'i' };
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
  let deletedCount = 0;

  // 1. Fetch all existing events in Google Calendar for the target date range
  const timeMin = new Date(startDate).toISOString();
  const timeMaxObj = new Date(endDate);
  timeMaxObj.setUTCHours(23, 59, 59, 999);
  const timeMax = timeMaxObj.toISOString();

  let googleEvents = [];
  try {
    const existingEventsRes = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 2500
    });
    googleEvents = existingEventsRes.data.items || [];
  } catch (err) {
    console.error('Error fetching Google Calendar events:', err.message);
  }

  // Set of Google event IDs that are matched to active Payroll schedules
  const activeGoogleEventIds = new Set();
  // Set of Google event IDs already claimed by a schedule in this sync run
  const claimedGoogleEventIds = new Set();

  const getManilaDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
  };

  // Helper to match a Google Calendar event to a schedule
  const findMatchingGoogleEvent = (sched, startDateTime) => {
    // 1. Check direct googleEventId match
    if (sched.googleEventId) {
      const match = googleEvents.find(e => e.id === sched.googleEventId && !claimedGoogleEventIds.has(e.id));
      if (match) return match;
    }

    // 2. Fallback: Find existing event by employee name and shift date in Manila time
    const targetEmp = sched.employeeName.trim().toLowerCase();
    const targetDateStr = getManilaDateStr(sched.date);

    return googleEvents.find(gEvent => {
      if (claimedGoogleEventIds.has(gEvent.id)) return false;

      const summary = (gEvent.summary || '').toLowerCase();
      const description = (gEvent.description || '').toLowerCase();
      const isShift = summary.startsWith('shift:') || description.includes('staff:');
      if (!isShift) return false;

      const empMatches = summary.includes(targetEmp) || description.includes(targetEmp);
      if (!empMatches) return false;

      const gStart = gEvent.start?.dateTime || gEvent.start?.date || '';
      if (!gStart) return false;

      const gDateStr = getManilaDateStr(gStart);
      return gDateStr === targetDateStr;
    });
  };

  // 2. Process all Payroll schedules
  for (const sched of schedules) {
    // If schedule is marked as OFF: remove from Google Calendar if event exists
    if (sched.isOff) {
      if (sched.googleEventId) {
        try {
          await calendar.events.delete({
            calendarId: CALENDAR_ID,
            eventId: sched.googleEventId
          });
          deletedCount++;
        } catch (err) {
          // Ignore if event was already deleted
        }
        sched.googleEventId = null;
        await sched.save();
      }
      continue;
    }

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
    const eventResource = {
      summary: `Shift: ${sched.employeeName} (${sched.assignmentType || 'GENERAL'})`,
      description: `Staff: ${sched.employeeName} (${attendeeEmail || 'No Email'})\nScheduled Shift: ${sched.scheduledStartTime || ''} - ${sched.scheduledEndTime || ''}\nDuration: ${sched.scheduledDuration || 8} hrs\nNotes: ${sched.notes || 'None'}`,
      location: 'ESPRO Coffee',
      start: { dateTime: startDateTime, timeZone: 'Asia/Manila' },
      end: { dateTime: endDateTime, timeZone: 'Asia/Manila' }
    };

    // Look for existing Google event (by ID or employee+date match)
    const existingEvent = findMatchingGoogleEvent(sched, startDateTime);

    if (existingEvent) {
      try {
        await calendar.events.update({
          calendarId: CALENDAR_ID,
          eventId: existingEvent.id,
          requestBody: eventResource
        });
        activeGoogleEventIds.add(existingEvent.id);
        claimedGoogleEventIds.add(existingEvent.id);

        if (sched.googleEventId !== existingEvent.id) {
          sched.googleEventId = existingEvent.id;
          await sched.save();
        }
        updatedCount++;
        continue;
      } catch (err) {
        console.log(`Could not update existing Google event ${existingEvent.id}, creating new one...`);
      }
    }

    // If no existing event found, insert a new one
    try {
      const createdEvent = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: eventResource
      });

      sched.googleEventId = createdEvent.data.id;
      await sched.save();
      activeGoogleEventIds.add(createdEvent.data.id);
      claimedGoogleEventIds.add(createdEvent.data.id);
      syncedCount++;
    } catch (err) {
      console.error(`Error inserting schedule for ${sched.employeeName}:`, err.message);
      throw err;
    }
  }

  // 3. Source of Truth Cleanup & Deduplication
  // Iterate through all Google Calendar events in date range and delete duplicates / orphaned events
  for (const gEvent of googleEvents) {
    if (activeGoogleEventIds.has(gEvent.id)) {
      continue;
    }

    const summary = gEvent.summary || '';
    const description = gEvent.description || '';
    const isShiftEvent = summary.startsWith('Shift:') || description.includes('Staff:');

    if (!isShiftEvent) continue;

    // If filtering by employee name, verify event belongs to filtered employee
    if (employeeNameFilter && employeeNameFilter.trim() !== '') {
      const filterName = employeeNameFilter.trim().toLowerCase();
      const matchesSummary = summary.toLowerCase().includes(filterName);
      const matchesDesc = description.toLowerCase().includes(filterName);
      if (!matchesSummary && !matchesDesc) {
        continue;
      }
    }

    // Delete duplicate or orphaned event from Google Calendar
    try {
      await calendar.events.delete({
        calendarId: CALENDAR_ID,
        eventId: gEvent.id
      });
      deletedCount++;

      await Schedule.updateMany(
        { googleEventId: gEvent.id },
        { $unset: { googleEventId: 1 } }
      );
    } catch (delErr) {
      console.warn(`Could not delete orphan/duplicate Google event ${gEvent.id}:`, delErr.message);
    }
  }

  return { syncedCount, updatedCount, deletedCount, totalProcessed: schedules.length };
};

export const clearGoogleCalendarSchedules = async (startDate, endDate, employeeNameFilter = '') => {
  const calendar = getCalendarClient();

  const timeMin = new Date(startDate).toISOString();
  const timeMaxObj = new Date(endDate);
  timeMaxObj.setUTCHours(23, 59, 59, 999);
  const timeMax = timeMaxObj.toISOString();

  let googleEvents = [];
  try {
    const listRes = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 2500
    });
    googleEvents = listRes.data.items || [];
  } catch (err) {
    console.error('Error fetching Google Calendar events for clearing:', err.message);
    throw err;
  }

  let clearedCount = 0;

  for (const gEvent of googleEvents) {
    const summary = gEvent.summary || '';
    const description = gEvent.description || '';
    const isShiftEvent = summary.startsWith('Shift:') || description.includes('Staff:');

    if (!isShiftEvent) continue;

    if (employeeNameFilter && employeeNameFilter.trim() !== '') {
      const filterName = employeeNameFilter.trim().toLowerCase();
      const matchesSummary = summary.toLowerCase().includes(filterName);
      const matchesDesc = description.toLowerCase().includes(filterName);
      if (!matchesSummary && !matchesDesc) {
        continue;
      }
    }

    try {
      await calendar.events.delete({
        calendarId: CALENDAR_ID,
        eventId: gEvent.id
      });
      clearedCount++;
    } catch (delErr) {
      console.warn(`Error deleting Google event ${gEvent.id}:`, delErr.message);
    }
  }

  // Clear googleEventId in MongoDB for schedules in date range
  let query = {
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  if (employeeNameFilter && employeeNameFilter.trim() !== '') {
    query.employeeName = { $regex: employeeNameFilter.trim(), $options: 'i' };
  }

  await Schedule.updateMany(query, { $unset: { googleEventId: 1 } });

  return { clearedCount };
};
