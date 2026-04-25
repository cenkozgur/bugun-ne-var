// External data sources for seeding Events.
//
//  - Football fixtures: pulled from the football-predictor backend at
//    api.cenkozgur.com (already populated nightly from api-football Pro).
//    Why not call api-football directly? Two reasons:
//      1. CORS — api-football blocks browser origins
//      2. We'd duplicate a working ingest pipeline that already runs
//
//  - F1 schedule: pulled from Jolpica (open-source successor to Ergast).
//    Free, no auth, CORS-open.

const FOOTBALL_API_BASE = 'https://api.cenkozgur.com';
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

// League codes used by football-predictor → display labels we want on cards.
const LEAGUE_LABELS = {
  E0: 'Premier League',
  E1: 'Championship',
  SP1: 'La Liga',
  I1: 'Serie A',
  D1: 'Bundesliga',
  F1: 'Ligue 1', // NOTE: clashes with our F1 (Formula 1) category slug — leagues stay in their own namespace
  N1: 'Eredivisie',
  P1: 'Primeira Liga',
};

// Best-guess Türkiye broadcaster per league. Real EPG data is messy —
// these are the "almost always" channels for the major events.
const LEAGUE_BROADCASTERS = {
  E0: 'S Sport / S Sport Plus',
  E1: 'S Sport',
  SP1: 'S Sport',
  I1: 'S Sport',
  D1: 'S Sport / S Sport Plus',
  F1: 'S Sport',
  N1: 'S Sport',
  P1: 'S Sport',
};

/**
 * Fetch upcoming football matches across all supported leagues from our
 * own backend. Returns a flat array of normalised event objects ready to
 * push into Base44 Event entity.
 */
export async function fetchUpcomingFootballMatches({ daysAhead = 2 } = {}) {
  const cutoff = Date.now() + daysAhead * 24 * 60 * 60 * 1000;

  const url = `${FOOTBALL_API_BASE}/matches?upcoming=true&limit=200`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`football API ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const matches = await res.json();

  return matches
    .filter((m) => {
      const t = new Date(m.kickoff).getTime();
      return Number.isFinite(t) && t <= cutoff;
    })
    .map((m) => ({
      title: `${m.home_team} – ${m.away_team}`,
      competition_name: LEAGUE_LABELS[m.league] || m.league,
      start_time: new Date(m.kickoff).toISOString(),
      broadcaster: LEAGUE_BROADCASTERS[m.league] || '',
      venue: '',
      is_live: m.status === 'in_play' || m.status === 'paused',
      live_status: m.live_minute ? `${m.live_minute}'` : '',
      _category_slug: 'futbol',
      _source_id: `football:${m.id}`,
    }));
}

/**
 * Fetch F1 sessions for the next race weekend from Jolpica.
 * Returns 1-5 events (FP1, FP2/Sprint Quali, Sprint, Quali, Race)
 * depending on whether this is a sprint weekend.
 */
export async function fetchUpcomingF1Sessions({ daysAhead = 14 } = {}) {
  const url = `${JOLPICA_BASE}/2026/next.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jolpica F1 API ${res.status}`);
  }
  const data = await res.json();
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race) return [];

  const cutoff = Date.now() + daysAhead * 24 * 60 * 60 * 1000;
  const venue = race.Circuit?.circuitName || '';
  const grandPrix = race.raceName || 'Grand Prix';
  const compName = `Formula 1 2026 — ${grandPrix}`;
  const broadcaster = 'S Sport / S Sport 2';

  const sessions = [];
  // sessionKey is an ASCII identifier (Antrenman1, SprintQuali, Race) used in
  // _source_id so dedupe keys don't depend on Turkish chars. label is the
  // human title in Turkish.
  const addSession = (sessionKey, label, dateStr, timeStr) => {
    if (!dateStr || !timeStr) {
      console.log('[F1 DEBUG] SKIP', sessionKey, '(missing date/time)', dateStr, timeStr);
      return;
    }
    const iso = `${dateStr}T${timeStr}`;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) {
      console.log('[F1 DEBUG] SKIP', sessionKey, '(unparseable)', iso);
      return;
    }
    if (t > cutoff) {
      console.log('[F1 DEBUG] SKIP', sessionKey, '(after cutoff)', new Date(t).toISOString());
      return;
    }
    console.log('[F1 DEBUG] ADD', sessionKey, new Date(t).toISOString());
    sessions.push({
      title: `${grandPrix} — ${label}`,
      competition_name: compName,
      start_time: new Date(iso).toISOString(),
      broadcaster,
      venue,
      is_live: false,
      _category_slug: 'f1',
      _source_id: `f1:${race.season}:${race.round}:${sessionKey}`,
    });
  };

  // Debug — temporary, will remove once we figure out why this returns 2 in
  // production but 5 when called via Node.
  console.log('[F1 DEBUG] race keys:', Object.keys(race));
  console.log('[F1 DEBUG] cutoff:', new Date(cutoff).toISOString(), 'now:', new Date().toISOString());

  if (race.FirstPractice) addSession('FP1', 'Antrenman 1', race.FirstPractice.date, race.FirstPractice.time);
  // SecondPractice is replaced by SprintQualifying on sprint weekends.
  if (race.SecondPractice) addSession('FP2', 'Antrenman 2', race.SecondPractice.date, race.SecondPractice.time);
  if (race.SprintQualifying) addSession('SprintQuali', 'Sprint Sıralama', race.SprintQualifying.date, race.SprintQualifying.time);
  if (race.ThirdPractice) addSession('FP3', 'Antrenman 3', race.ThirdPractice.date, race.ThirdPractice.time);
  if (race.Sprint) addSession('Sprint', 'Sprint', race.Sprint.date, race.Sprint.time);
  if (race.Qualifying) addSession('Quali', 'Sıralama', race.Qualifying.date, race.Qualifying.time);
  addSession('Race', 'Yarış', race.date, race.time);

  console.log('[F1 DEBUG] returning', sessions.length, 'sessions:', sessions.map(s => s._source_id));

  return sessions;
}

// Hand-curated TV events. There's no usable Turkish EPG API, so we keep
// a small list that gets refreshed when the user opens /seed. Add more
// here as new must-watch broadcasts are announced.
export function buildTvEvents({ today, tomorrow }) {
  const at = (date, h, m = 0) => {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  return [
    {
      title: 'Survivor All Star — Eleme Gecesi',
      competition_name: 'Survivor All Star 2026',
      start_time: at(today, 22, 0),
      broadcaster: 'TV8',
      is_live: false,
      _category_slug: 'tv',
      _source_id: 'tv:survivor:today',
    },
    {
      title: 'MasterChef Türkiye',
      competition_name: 'MasterChef Türkiye 2026',
      start_time: at(tomorrow, 20, 0),
      broadcaster: 'TV8',
      is_live: false,
      _category_slug: 'tv',
      _source_id: 'tv:masterchef:tomorrow',
    },
  ];
}
