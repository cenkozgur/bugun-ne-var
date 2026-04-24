// ICS (iCalendar) file generator + download.
// Works on iOS Safari (opens Calendar.app), Android Chrome (opens Google Cal),
// desktop (downloads .ics which double-clicks to calendar).

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIcsDate(d) {
  // YYYYMMDDTHHMMSSZ (UTC)
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function buildIcsForEvent(event, { defaultDurationMinutes = 120 } = {}) {
  const start = new Date(event.start_time);
  // We don't store end_time on Event; pick a safe default window by category if needed later.
  const end = new Date(start.getTime() + defaultDurationMinutes * 60 * 1000);

  const uid = `${event.id || Math.random().toString(36).slice(2)}@bugun-ne-var.base44.app`;
  const now = new Date();

  const title = escapeIcs(event.title || 'Etkinlik');
  const descParts = [];
  if (event.competition_name) descParts.push(event.competition_name);
  if (event.broadcaster) descParts.push(`📺 ${event.broadcaster}`);
  const description = escapeIcs(descParts.join(' • '));
  const location = escapeIcs(event.venue || event.broadcaster || '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bugün Ne Var//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${title}`,
    description && `DESCRIPTION:${description}`,
    location && `LOCATION:${location}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function slugify(text) {
  return String(text || 'etkinlik')
    .toLowerCase()
    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function downloadIcsForEvent(event) {
  const ics = buildIcsForEvent(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(event.title)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Give the browser a moment before revoking so mobile Safari can read it.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
