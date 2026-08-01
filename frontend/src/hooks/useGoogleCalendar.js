import { useRef, useCallback, useState } from 'react';

const GOOGLE_CLIENT_ID = '784614121768-ur3lp53mmlv7v4vmi9e4ssge7ldiqume.apps.googleusercontent.com';
const CALENDAR_ID = 'a9a6f09502aa9eaf64a31fff6ca0133983ddf2760766243967f2d54fbecc3e61@group.calendar.google.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

export function useGoogleCalendar() {
  const tokenClientRef = useRef(null);
  const accessTokenRef = useRef(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const getTokenClient = useCallback(() => {
    if (tokenClientRef.current) return tokenClientRef.current;
    if (!window.google) throw new Error('Google Identity Services not loaded yet.');

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('OAuth error:', response.error);
          setIsConnecting(false);
          return;
        }
        accessTokenRef.current = response.access_token;
        setIsSignedIn(true);
        setIsConnecting(false);
      }
    });

    return tokenClientRef.current;
  }, []);

  const connect = useCallback(() => {
    setIsConnecting(true);
    const client = getTokenClient();
    client.requestAccessToken({ prompt: 'consent' });
  }, [getTokenClient]);

  const disconnect = useCallback(() => {
    if (accessTokenRef.current) {
      window.google?.accounts.oauth2.revoke(accessTokenRef.current);
      accessTokenRef.current = null;
    }
    setIsSignedIn(false);
  }, []);

  // Returns floating local datetime (no UTC offset) so Google Calendar
  // interprets it using the event's timeZone: 'Asia/Manila' field.
  const parseTime = (dateStr, timeStr) => {
    if (!timeStr) return null;
    const date = new Date(dateStr);
    // Support formats: "4PM", "4:00PM", "4:00 PM", "16:00", "16"
    const upper = timeStr.trim().toUpperCase();
    let hour, minute = 0;

    const ampmMatch = upper.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    const h24Match  = upper.match(/^(\d{1,2})(?::(\d{2}))?$/);

    if (ampmMatch) {
      hour   = parseInt(ampmMatch[1], 10);
      minute = parseInt(ampmMatch[2] || '0', 10);
      const period = ampmMatch[3];
      if (period === 'AM' && hour === 12) hour = 0;
      if (period === 'PM' && hour !== 12) hour += 12;
    } else if (h24Match) {
      hour   = parseInt(h24Match[1], 10);
      minute = parseInt(h24Match[2] || '0', 10);
    } else {
      return null;
    }

    const year  = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day   = String(date.getUTCDate()).padStart(2, '0');
    // Floating local time — no +08:00 suffix. timeZone field handles interpretation.
    return `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  };

  const toMinutes = (dt) => {
    if (!dt) return 0;
    const [, h, m] = dt.match(/T(\d{2}):(\d{2})/) || [];
    return parseInt(h || 0) * 60 + parseInt(m || 0);
  };

  const getManilaDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
  };

  const syncShiftsWithGuests = useCallback(async (schedules, emailMap, onProgress) => {
    const token = accessTokenRef.current;
    if (!token) throw new Error('Not connected to Google. Please sign in first.');

    let synced = 0;
    let updated = 0;
    let failed = 0;

    // Determine min/max date from schedules array
    const validDates = schedules.map(s => new Date(s.date)).filter(d => !isNaN(d.getTime()));
    if (validDates.length === 0) return { synced, updated, failed };

    const minDateObj = new Date(Math.min(...validDates));
    const maxDateObj = new Date(Math.max(...validDates));
    const timeMin = minDateObj.toISOString();
    maxDateObj.setUTCHours(23, 59, 59, 999);
    const timeMax = maxDateObj.toISOString();

    // Fetch existing Google Calendar events in date range
    let googleEvents = [];
    try {
      const listUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=2500&singleEvents=true`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        googleEvents = listData.items || [];
      }
    } catch (err) {
      console.warn('Could not fetch existing Google Calendar events:', err);
    }

    const claimedEventIds = new Set();
    const activeEventIds = new Set();

    const findMatchingEvent = (sched) => {
      if (sched.googleEventId) {
        const match = googleEvents.find(e => e.id === sched.googleEventId && !claimedEventIds.has(e.id));
        if (match) return match;
      }
      const targetEmp = (sched.employeeName || '').trim().toLowerCase();
      const targetDateStr = getManilaDateStr(sched.date);

      return googleEvents.find(gEvent => {
        if (claimedEventIds.has(gEvent.id)) return false;
        const summary = (gEvent.summary || '').toLowerCase();
        const description = (gEvent.description || '').toLowerCase();
        const isShift = summary.startsWith('shift:') || description.includes('staff:');
        if (!isShift) return false;

        const empMatches = summary.includes(targetEmp) || description.includes(targetEmp);
        if (!empMatches) return false;

        const gStart = gEvent.start?.dateTime || gEvent.start?.date || '';
        if (!gStart) return false;

        return getManilaDateStr(gStart) === targetDateStr;
      });
    };

    for (const sched of schedules) {
      if (sched.isOff) continue;

      const startDateTime = parseTime(sched.date, sched.scheduledStartTime);
      let endDateTime = parseTime(sched.date, sched.scheduledEndTime);

      if (startDateTime && endDateTime && toMinutes(endDateTime) <= toMinutes(startDateTime)) {
        const nextDay = new Date(sched.date);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        endDateTime = parseTime(nextDay, sched.scheduledEndTime);
      }

      if (!startDateTime || !endDateTime) continue;

      const attendeeEmail = emailMap[sched.employeeName];
      const attendees = attendeeEmail
        ? [{ email: attendeeEmail, displayName: sched.employeeName }]
        : [];

      const eventBody = {
        summary: `Shift: ${sched.employeeName} (${sched.assignmentType || 'GENERAL'})`,
        description: `Staff: ${sched.employeeName}${attendeeEmail ? ` (${attendeeEmail})` : ''}\nShift: ${sched.scheduledStartTime || ''} - ${sched.scheduledEndTime || ''}\nDuration: ${sched.scheduledDuration || 8} hrs\nNotes: ${sched.notes || 'None'}`,
        location: 'ESPRO Coffee',
        start: { dateTime: startDateTime, timeZone: 'Asia/Manila' },
        end: { dateTime: endDateTime, timeZone: 'Asia/Manila' },
        attendees
      };

      try {
        const existing = findMatchingEvent(sched);
        let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
        let method = 'POST';

        if (existing) {
          url += `/${existing.id}?sendUpdates=all`;
          method = 'PUT';
        } else {
          url += '?sendUpdates=all';
        }

        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventBody)
        });

        if (res.status === 401) {
          accessTokenRef.current = null;
          setIsSignedIn(false);
          throw new Error('Google session expired. Please sign in again and retry.');
        }

        if (!res.ok) {
          const err = await res.json();
          console.error('Event error:', err);
          failed++;
          continue;
        }

        const created = await res.json();
        const eventId = created.id || existing?.id;
        if (eventId) {
          claimedEventIds.add(eventId);
          activeEventIds.add(eventId);
        }

        if (!existing) {
          synced++;
        } else {
          updated++;
        }

        // Save googleEventId back to backend
        if (eventId && sched.googleEventId !== eventId) {
          try {
            await fetch(`${import.meta.env.VITE_API_URL}/schedules/${sched._id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ googleEventId: eventId })
            });
          } catch (e) {
            // Non-critical
          }
        }

        if (onProgress) onProgress(synced + updated, schedules.length);
      } catch (err) {
        if (err.message.includes('Google session expired')) throw err;
        console.error('Failed event:', sched.employeeName, err);
        failed++;
      }
    }

    // Clean up any remaining duplicate events in Google Calendar
    for (const gEvent of googleEvents) {
      if (activeEventIds.has(gEvent.id)) continue;
      const summary = (gEvent.summary || '').toLowerCase();
      const description = (gEvent.description || '').toLowerCase();
      const isShift = summary.startsWith('shift:') || description.includes('staff:');
      if (!isShift) continue;

      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${gEvent.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // Ignore
      }
    }

    return { synced, updated, failed };
  }, []);

  const clearGoogleCalendarShifts = useCallback(async (startDate, endDate, employeeNameFilter = '') => {
    const token = accessTokenRef.current;
    if (!token) throw new Error('Not connected to Google. Please sign in first.');

    const timeMin = new Date(startDate).toISOString();
    const timeMaxObj = new Date(endDate);
    timeMaxObj.setUTCHours(23, 59, 59, 999);
    const timeMax = timeMaxObj.toISOString();

    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=2500&singleEvents=true`;
    
    const listRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!listRes.ok) {
      throw new Error('Failed to list Google Calendar events.');
    }

    const data = await listRes.json();
    const googleEvents = data.items || [];
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
        const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${gEvent.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
          clearedCount++;
        }
      } catch (err) {
        console.warn(`Failed to delete event ${gEvent.id}:`, err);
      }
    }

    return { clearedCount };
  }, []);

  return {
    isSignedIn,
    isConnecting,
    connect,
    disconnect,
    syncShiftsWithGuests,
    clearGoogleCalendarShifts
  };
}
