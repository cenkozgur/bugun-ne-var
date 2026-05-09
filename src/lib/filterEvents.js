import { parseISO, isToday, isTomorrow, isAfter } from 'date-fns';

export const TIME_FILTERS = ['today', 'tomorrow', 'week', 'all'];

export function applyTimeFilter(events, timeFilter, now = new Date()) {
  return events
    .filter((e) => {
      const d = parseISO(e.start_time);
      if (timeFilter === 'today') return isToday(d) || e.is_live;
      if (timeFilter === 'tomorrow') return isTomorrow(d) && !e.is_live;
      if (timeFilter === 'week') {
        const weekEnd = now.getTime() + 7 * 24 * 60 * 60 * 1000;
        return isAfter(d, now) && d.getTime() <= weekEnd;
      }
      if (timeFilter === 'all') return isAfter(d, now) || e.is_live;
      return true;
    })
    .sort((a, b) => {
      if (a.is_live && !b.is_live) return -1;
      if (!a.is_live && b.is_live) return 1;
      return new Date(a.start_time) - new Date(b.start_time);
    });
}

export function partitionToday(filtered) {
  return {
    live: filtered.filter((e) => e.is_live),
    upcoming: filtered.filter(
      (e) => !e.is_live && isToday(parseISO(e.start_time))
    ),
  };
}

export function tomorrowPreview(events, limit = 3) {
  return events
    .filter((e) => isTomorrow(parseISO(e.start_time)) && !e.is_live)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, limit);
}

export function todayCount(events) {
  return events.filter(
    (e) => isToday(parseISO(e.start_time)) || e.is_live
  ).length;
}
