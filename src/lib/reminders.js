// Reminder system — tiered:
//  1. Persist the intent via base44 Reminder entity (always, so record exists server-side).
//  2. If browser supports Notification API and permission granted, schedule an in-tab timer
//     that fires a notification `minutes_before` the event.
//  3. Fallback: just a toast confirming it's been recorded.
//
// Limitation: in-tab timer only fires while this tab is alive. A true push setup will come
// when we move to native mobile. For now this at least works for users who keep the app open
// (e.g. on a phone home-screen PWA).

import { base44 } from '@/api/base44Client';

const LS_KEY = 'bnv.scheduledReminders'; // { [eventId]: { timerId, minutesBefore } }

function readScheduled() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeScheduled(map) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function hasNotificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function ensureNotificationPermission() {
  if (!hasNotificationSupport()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return 'denied';
  }
}

function scheduleInTabNotification(event, minutesBefore) {
  if (!hasNotificationSupport() || Notification.permission !== 'granted') return null;

  const start = new Date(event.start_time).getTime();
  const fireAt = start - minutesBefore * 60 * 1000;
  const delay = fireAt - Date.now();
  if (delay <= 0) return null; // already passed

  // Cap at ~24 days — setTimeout max is ~24.8d (2^31 ms). Most events are under a week anyway.
  const MAX_DELAY = 2_000_000_000;
  if (delay > MAX_DELAY) return null;

  const timerId = setTimeout(() => {
    try {
      const title = event.title || 'Etkinlik başlamak üzere';
      const body = event.broadcaster
        ? `📺 ${event.broadcaster} — ${minutesBefore} dk sonra`
        : `${minutesBefore} dakika sonra`;
      const n = new Notification(title, {
        body,
        tag: `bnv-${event.id}`,
        icon: '/favicon.ico',
      });
      n.onclick = () => {
        window.focus();
        window.location.href = `/event/${event.id}`;
      };
    } catch { /* ignore */ }
    // cleanup
    const map = readScheduled();
    delete map[event.id];
    writeScheduled(map);
  }, delay);

  const map = readScheduled();
  map[event.id] = { minutesBefore, fireAt };
  writeScheduled(map);
  return timerId;
}

export function isEventReminded(eventId) {
  const map = readScheduled();
  return Boolean(map[eventId]);
}

export async function createReminder(event, { minutesBefore = 15 } = {}) {
  // 1. Persist to Base44 (best-effort; don't block UX on failure)
  try {
    await base44.entities.Reminder.create({
      event_id: event.id,
      minutes_before: minutesBefore,
      enabled: true,
    });
  } catch (err) {
    console.warn('Reminder persist failed:', err);
  }

  // 2. Ask for notification permission + schedule in-tab timer
  let permission = 'unsupported';
  if (hasNotificationSupport()) {
    permission = await ensureNotificationPermission();
    if (permission === 'granted') {
      scheduleInTabNotification(event, minutesBefore);
    }
  }

  return {
    persisted: true,
    permission,
    willFireInTab: permission === 'granted',
  };
}

export async function removeReminder(event) {
  // Clear in-tab timer state
  const map = readScheduled();
  if (map[event.id]) {
    delete map[event.id];
    writeScheduled(map);
  }

  // Mark existing Reminder entities as disabled (safer than hard-delete)
  try {
    const all = await base44.entities.Reminder.list();
    const mine = all.filter((r) => r.event_id === event.id && r.enabled);
    await Promise.all(
      mine.map((r) => base44.entities.Reminder.update(r.id, { enabled: false }))
    );
  } catch (err) {
    console.warn('Reminder remove failed:', err);
  }
}

// Rehydrate in-tab timers from localStorage when the app boots.
// Otherwise reloading the page cancels pending reminders.
export function rehydrateReminders(eventsById) {
  if (!hasNotificationSupport() || Notification.permission !== 'granted') return;
  const map = readScheduled();
  for (const [eventId, rec] of Object.entries(map)) {
    const event = eventsById[eventId];
    if (!event) continue;
    // Re-schedule if still upcoming
    if (rec.fireAt > Date.now()) {
      scheduleInTabNotification(event, rec.minutesBefore);
    } else {
      delete map[eventId];
    }
  }
  writeScheduled(map);
}
