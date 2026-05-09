import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { applyTimeFilter, todayCount, tomorrowPreview } from './filterEvents.js';

const FROZEN_NOW = new Date('2026-05-09T15:00:00+03:00');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

const ev = (id, start_time, extra = {}) => ({
  id,
  title: id,
  start_time,
  is_live: false,
  ...extra,
});

describe('applyTimeFilter — happy path', () => {
  it('today filter returns only today calendar-day events', () => {
    const events = [
      ev('today-noon',     '2026-05-09T12:00:00+03:00'),
      ev('today-late',     '2026-05-09T22:00:00+03:00'),
      ev('tomorrow-early', '2026-05-10T01:00:00+03:00'),
      ev('tomorrow-noon',  '2026-05-10T14:00:00+03:00'),
      ev('day-after',      '2026-05-11T10:00:00+03:00'),
    ];
    const ids = applyTimeFilter(events, 'today').map((e) => e.id);
    expect(ids).toEqual(['today-noon', 'today-late']);
  });

  it('tomorrow filter returns only tomorrow calendar-day events', () => {
    const events = [
      ev('today-late',     '2026-05-09T22:00:00+03:00'),
      ev('tomorrow-early', '2026-05-10T01:00:00+03:00'),
      ev('tomorrow-noon',  '2026-05-10T14:00:00+03:00'),
      ev('day-after',      '2026-05-11T10:00:00+03:00'),
    ];
    const ids = applyTimeFilter(events, 'tomorrow').map((e) => e.id);
    expect(ids).toEqual(['tomorrow-early', 'tomorrow-noon']);
  });
});

describe('applyTimeFilter — leak regressions', () => {
  it('REGRESSION: a live event with tomorrow start_time must NOT appear in tomorrow filter', () => {
    // This is the exact bug that prompted the test agent setup:
    // an event whose `start_time` happens to land on the user's tomorrow
    // calendar day but is flagged is_live by upstream (ESPN basketball,
    // rescheduled match, stale status row) was leaking into BOTH the
    // today filter (via is_live short-circuit) AND the tomorrow filter
    // (via isTomorrow). Tomorrow filter must explicitly exclude is_live.
    const events = [
      ev('live-leak', '2026-05-10T05:00:00+03:00', { is_live: true }),
      ev('clean-tomorrow', '2026-05-10T18:00:00+03:00'),
    ];

    const today = applyTimeFilter(events, 'today').map((e) => e.id);
    const tomorrow = applyTimeFilter(events, 'tomorrow').map((e) => e.id);

    // Live event should appear under today (because it's happening NOW)
    expect(today).toContain('live-leak');
    // …but never under tomorrow.
    expect(tomorrow).not.toContain('live-leak');
    // Clean tomorrow event still shows on tomorrow.
    expect(tomorrow).toContain('clean-tomorrow');
  });

  it('a live event with today start_time appears in today filter only', () => {
    const events = [
      ev('live-today', '2026-05-09T14:00:00+03:00', { is_live: true }),
    ];
    expect(applyTimeFilter(events, 'today').map((e) => e.id)).toEqual(['live-today']);
    expect(applyTimeFilter(events, 'tomorrow')).toEqual([]);
  });

  it('a live event whose start_time was yesterday still surfaces under today', () => {
    const events = [
      ev('long-running', '2026-05-08T22:00:00+03:00', { is_live: true }),
    ];
    expect(applyTimeFilter(events, 'today').map((e) => e.id)).toEqual(['long-running']);
    expect(applyTimeFilter(events, 'tomorrow')).toEqual([]);
  });
});

describe('applyTimeFilter — sort order', () => {
  it('live events sort before non-live, then by start_time ascending', () => {
    const events = [
      ev('a', '2026-05-09T20:00:00+03:00'),
      ev('b', '2026-05-09T18:00:00+03:00'),
      ev('c', '2026-05-09T19:00:00+03:00', { is_live: true }),
    ];
    const ids = applyTimeFilter(events, 'today').map((e) => e.id);
    expect(ids).toEqual(['c', 'b', 'a']);
  });
});

describe('todayCount + tomorrowPreview', () => {
  it('todayCount counts today calendar-day events + any live event', () => {
    const events = [
      ev('today-1', '2026-05-09T12:00:00+03:00'),
      ev('today-2', '2026-05-09T20:00:00+03:00'),
      ev('live-anywhere', '2026-05-10T05:00:00+03:00', { is_live: true }),
      ev('tomorrow', '2026-05-10T14:00:00+03:00'),
    ];
    // 2 today calendar-day + 1 live = 3. Tomorrow non-live not counted.
    expect(todayCount(events)).toBe(3);
  });

  it('tomorrowPreview returns up to limit, sorted, excludes live', () => {
    const events = [
      ev('t1', '2026-05-10T20:00:00+03:00'),
      ev('t2', '2026-05-10T08:00:00+03:00'),
      ev('t3', '2026-05-10T14:00:00+03:00'),
      ev('t4', '2026-05-10T22:00:00+03:00'),
      ev('live-leak', '2026-05-10T03:00:00+03:00', { is_live: true }),
    ];
    const ids = tomorrowPreview(events, 3).map((e) => e.id);
    expect(ids).toEqual(['t2', 't3', 't1']);
  });
});

describe('applyTimeFilter — week + all', () => {
  it('week filter covers next 7 days, excludes past', () => {
    const events = [
      ev('past',  '2026-05-08T10:00:00+03:00'),
      ev('soon',  '2026-05-10T10:00:00+03:00'),
      ev('edge',  '2026-05-16T14:00:00+03:00'),
      ev('after', '2026-05-17T10:00:00+03:00'),
    ];
    const ids = applyTimeFilter(events, 'week').map((e) => e.id);
    expect(ids).toEqual(['soon', 'edge']);
  });

  it('all filter shows future + live', () => {
    const events = [
      ev('past',   '2026-05-08T10:00:00+03:00'),
      ev('future', '2026-05-12T10:00:00+03:00'),
      ev('live',   '2026-05-08T22:00:00+03:00', { is_live: true }),
    ];
    const ids = applyTimeFilter(events, 'all').map((e) => e.id);
    expect(ids).toContain('future');
    expect(ids).toContain('live');
    expect(ids).not.toContain('past');
  });
});
