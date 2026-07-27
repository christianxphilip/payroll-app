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

  const syncShiftsWithGuests = useCallback(async (schedules, emailMap, onProgress) => {
    const token = accessTokenRef.current;
    if (!token) throw new Error('Not connected to Google. Please sign in first.');

    let synced = 0;
    let updated = 0;
    let failed = 0;

    for (const sched of schedules) {
      if (sched.isOff) continue;

      const startDateTime = parseTime(sched.date, sched.scheduledStartTime);
      let endDateTime = parseTime(sched.date, sched.scheduledEndTime);

      if (startDateTime && endDateTime && endDateTime <= startDateTime) {
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
        let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
        let method = 'POST';

        if (sched.googleEventId) {
          url += `/${sched.googleEventId}?sendUpdates=all`;
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
          // Token expired - reconnect
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

        // Save googleEventId back to our backend
        if (!sched.googleEventId && created.id) {
          try {
            await fetch(`${import.meta.env.VITE_API_URL}/schedules/${sched._id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ googleEventId: created.id })
            });
          } catch (e) {
            // Non-critical - event still created
          }
          synced++;
        } else {
          updated++;
        }

        if (onProgress) onProgress(synced + updated, schedules.length);
      } catch (err) {
        if (err.message.includes('Google session expired')) throw err;
        console.error('Failed event:', sched.employeeName, err);
        failed++;
      }
    }

    return { synced, updated, failed };
  }, []);

  return {
    isSignedIn,
    isConnecting,
    connect,
    disconnect,
    syncShiftsWithGuests
  };
}
