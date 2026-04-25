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

// League codes used by football-predictor → display labels we want on
// cards. Country flag emoji prefix so the user can spot leagues at a
// glance (especially in onboarding step 2 with 8+ ligs stacked).
const LEAGUE_LABELS = {
  T1:  '🇹🇷 Süper Lig',
  E0:  '🇬🇧 Premier League',
  E1:  '🇬🇧 Championship',
  SP1: '🇪🇸 La Liga',
  I1:  '🇮🇹 Serie A',
  D1:  '🇩🇪 Bundesliga',
  F1:  '🇫🇷 Ligue 1', // NOTE: clashes with our F1 (Formula 1) category slug — leagues stay in their own namespace
  N1:  '🇳🇱 Eredivisie',
  P1:  '🇵🇹 Primeira Liga',
};

// Best-guess Türkiye broadcaster per league. Real EPG data is messy —
// these are the "almost always" channels for the major events.
const LEAGUE_BROADCASTERS = {
  T1: 'beIN Sports HD 1',
  E0: 'S Sport / S Sport Plus',
  E1: 'S Sport',
  SP1: 'S Sport',
  I1: 'S Sport',
  D1: 'S Sport / S Sport Plus',
  F1: 'S Sport',
  N1: 'S Sport',
  P1: 'S Sport',
};

// Backend stores team names ASCII-normalized for slug stability
// (Besiktas, Goztep, Kasimpasa). For UI we want the proper Turkish or
// native spelling. This lookup converts upstream names → display names
// without changing the slug — ref keys still resolve identically.
const TEAM_DISPLAY_OVERRIDES = {
  // Süper Lig
  'Besiktas': 'Beşiktaş',
  'Fenerbahce': 'Fenerbahçe',
  'Goztep': 'Göztepe',
  'Kasimpasa': 'Kasımpaşa',
  'Eyupspor': 'Eyüpspor',
  'Gaziantep': 'Gaziantep FK',
  'Basaksehir': 'Başakşehir',
  // Big-5 quirks
  "Nott'm Forest": 'Nottingham Forest',
  'Man United': 'Manchester United',
  'Man City': 'Manchester City',
  'Wolves': 'Wolverhampton',
  'Sociedad': 'Real Sociedad',
  'Vallecano': 'Rayo Vallecano',
  'Sp Lisbon': 'Sporting Lisbon',
  'Sp Braga': 'Sporting Braga',
  "M'gladbach": "Borussia M'gladbach",
  'Paris SG': 'Paris Saint-Germain',
};

export function displayName(rawName) {
  if (!rawName) return rawName;
  return TEAM_DISPLAY_OVERRIDES[rawName] || rawName;
}

// Stable team key: ASCII slug derived from team name + league. Slug
// always uses the upstream raw name so refs stay identical regardless
// of whether we're emitting from a fixture or the static roster.
// Example: "Fenerbahçe" or "Fenerbahce" in T1 → "team:T1:fenerbahce"
function teamRef(league, name) {
  if (!name) return '';
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `team:${league}:${slug}`;
}

function competitionRef(league) {
  return `league:${league}`;
}

/**
 * Fetch upcoming football matches across all supported leagues from our
 * own backend. Returns a flat array of normalised event objects ready to
 * push into Base44 Event entity. Each event carries home/away/competition
 * external_refs so the subscription filter can match at any level
 * (league or specific team).
 */
// Hard-coded 14-day window. Was previously a destructured default param
// (`{ daysAhead = 14 } = {}`) but Base44's bundle cache pinned the old
// value of 2 and the new value never propagated, so the seed kept
// returning the closer slate. Inlining as a const sidesteps that.
export async function fetchUpcomingFootballMatches() {
  const FOOTBALL_WINDOW_DAYS = 14;
  const cutoff = Date.now() + FOOTBALL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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
    .map((m) => {
      const home = displayName(m.home_team);
      const away = displayName(m.away_team);
      return {
        title: `${home} – ${away}`,
        competition_name: LEAGUE_LABELS[m.league] || m.league,
        start_time: new Date(m.kickoff).toISOString(),
        broadcaster: LEAGUE_BROADCASTERS[m.league] || '',
        venue: '',
        is_live: m.status === 'in_play' || m.status === 'paused',
        live_status: m.live_minute ? `${m.live_minute}'` : '',
        _category_slug: 'futbol',
        _source_id: `football:${m.id}`,
        _competition_ref: competitionRef(m.league),
        _competition_name: LEAGUE_LABELS[m.league] || m.league,
        _home_entity_ref: teamRef(m.league, m.home_team),
        _home_entity_name: home,
        _away_entity_ref: teamRef(m.league, m.away_team),
        _away_entity_name: away,
      };
    });
}

/**
 * Fetch F1 sessions for the next race weekend from Jolpica.
 * Returns 1-5 events (FP1, FP2/Sprint Quali, Sprint, Quali, Race)
 * depending on whether this is a sprint weekend.
 *
 * No date cutoff — the next race is always relevant to display, even if
 * it's 10 days out. The Home page's time-scope chips ("bu hafta", "tümü")
 * decide visibility downstream.
 */
export async function fetchUpcomingF1Sessions() {
  const url = `${JOLPICA_BASE}/2026/next.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jolpica F1 API ${res.status}`);
  }
  const data = await res.json();
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race) return [];

  const venue = race.Circuit?.circuitName || '';
  const grandPrix = race.raceName || 'Grand Prix';
  const compName = `Formula 1 2026 — ${grandPrix}`;
  const broadcaster = 'S Sport / S Sport 2';

  const sessions = [];
  // sessionKey is an ASCII identifier (FP1, SprintQuali, Race) used in
  // _source_id so dedupe keys don't depend on Turkish chars. label is the
  // human title in Turkish.
  const addSession = (sessionKey, label, dateStr, timeStr) => {
    if (!dateStr || !timeStr) return;
    const iso = `${dateStr}T${timeStr}`;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return;
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

  if (race.FirstPractice) addSession('FP1', 'Antrenman 1', race.FirstPractice.date, race.FirstPractice.time);
  // SecondPractice is replaced by SprintQualifying on sprint weekends.
  if (race.SecondPractice) addSession('FP2', 'Antrenman 2', race.SecondPractice.date, race.SecondPractice.time);
  if (race.SprintQualifying) addSession('SprintQuali', 'Sprint Sıralama', race.SprintQualifying.date, race.SprintQualifying.time);
  if (race.ThirdPractice) addSession('FP3', 'Antrenman 3', race.ThirdPractice.date, race.ThirdPractice.time);
  if (race.Sprint) addSession('Sprint', 'Sprint', race.Sprint.date, race.Sprint.time);
  if (race.Qualifying) addSession('Quali', 'Sıralama', race.Qualifying.date, race.Qualifying.time);
  addSession('Race', 'Yarış', race.date, race.time);

  return sessions;
}

// Static team rosters per league. /seed pulls fixture data from
// football-predictor which only includes teams currently scheduled, so a
// freshly-promoted club or a quiet week leaves gaps. These rosters fill
// the onboarding selection list so users see the full league regardless
// of what's on the fixture today. Teams added here are just registered
// in TrackedEntity — their event coverage still depends on the upstream
// fixture pipeline.
//
// Each entry is [displayName, slugSeed]. slugSeed is what teamRef()
// hashes — it must match what the upstream fixture pipeline emits, so
// "Beşiktaş" the user sees and "Besiktas" the slug both resolve to
// team:T1:besiktas.
const STATIC_LEAGUE_ROSTERS = {
  T1: [
    ['Galatasaray', 'Galatasaray'],
    ['Fenerbahçe', 'Fenerbahce'],
    ['Beşiktaş', 'Besiktas'],
    ['Trabzonspor', 'Trabzonspor'],
    ['Başakşehir', 'Basaksehir'],
    ['Adana Demirspor', 'Adana Demirspor'],
    ['Antalyaspor', 'Antalyaspor'],
    ['Konyaspor', 'Konyaspor'],
    ['Kasımpaşa', 'Kasimpasa'],
    ['Alanyaspor', 'Alanyaspor'],
    ['Sivasspor', 'Sivasspor'],
    ['Kayserispor', 'Kayserispor'],
    ['Rizespor', 'Rizespor'],
    ['Samsunspor', 'Samsunspor'],
    ['Eyüpspor', 'Eyupspor'],
    ['Göztepe', 'Goztep'],
    ['Gaziantep FK', 'Gaziantep'],
    ['Kocaelispor', 'Kocaelispor'],
  ],
  // Big-5: top clubs only (full rosters can come later). Slug seeds
  // match what football-predictor stores so subscriptions resolve.
  E0: [
    ['Liverpool', 'Liverpool'], ['Arsenal', 'Arsenal'],
    ['Manchester City', 'Man City'], ['Manchester United', 'Man United'],
    ['Chelsea', 'Chelsea'], ['Tottenham', 'Tottenham'],
    ['Newcastle', 'Newcastle'], ['Aston Villa', 'Aston Villa'],
  ],
  SP1: [
    ['Real Madrid', 'Real Madrid'], ['Barcelona', 'Barcelona'],
    ['Atletico Madrid', 'Ath Madrid'], ['Athletic Bilbao', 'Ath Bilbao'],
    ['Real Sociedad', 'Sociedad'], ['Real Betis', 'Betis'],
    ['Sevilla', 'Sevilla'], ['Villarreal', 'Villarreal'],
  ],
  I1: [
    ['Inter', 'Inter'], ['Juventus', 'Juventus'],
    ['Milan', 'Milan'], ['Napoli', 'Napoli'],
    ['Roma', 'Roma'], ['Lazio', 'Lazio'],
    ['Atalanta', 'Atalanta'], ['Fiorentina', 'Fiorentina'],
  ],
  D1: [
    ['Bayern München', 'Bayern Munich'], ['Borussia Dortmund', 'Dortmund'],
    ['RB Leipzig', 'RB Leipzig'], ['Bayer Leverkusen', 'Leverkusen'],
    ['Eintracht Frankfurt', 'Ein Frankfurt'], ['VfB Stuttgart', 'Stuttgart'],
    ['Werder Bremen', 'Werder Bremen'], ['Wolfsburg', 'Wolfsburg'],
  ],
  F1: [
    ['Paris Saint-Germain', 'Paris SG'], ['Marseille', 'Marseille'],
    ['Monaco', 'Monaco'], ['Lyon', 'Lyon'],
    ['Lille', 'Lille'], ['Nice', 'Nice'],
    ['Rennes', 'Rennes'], ['Lens', 'Lens'],
  ],
};

export function buildStaticTeamSeeds() {
  const out = [];
  for (const [league, roster] of Object.entries(STATIC_LEAGUE_ROSTERS)) {
    for (const [name, slugSeed] of roster) {
      out.push({
        _category_slug: 'futbol',
        _entity_name: name,
        _entity_ref: teamRef(league, slugSeed),
        _competition_ref: competitionRef(league),
      });
    }
  }
  return out;
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
