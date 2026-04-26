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
// ─── Basketball (NBA + EuroLeague + BSL) ────────────────────────────
//
// Backend feeds these via app.ingestion.api_sports_basketball into the
// sport_events table. Read endpoint is /sport-events?sport=basketball.

const BASKETBALL_LEAGUE_DISPLAY = {
  NBA:        '🇺🇸 NBA',
  EuroLeague: '🇪🇺 EuroLeague',
  BSL:        '🇹🇷 Basketbol Süper Ligi',
};

// Internal code → competition_ref + team_ref namespace prefix. These
// MUST match the values used in buildStaticTeamSeeds() so subscriptions
// resolve regardless of whether the team was first registered via the
// static roster or via a fixture.
const BASKETBALL_LEAGUE_REFS = {
  NBA:        { compRef: 'league:nba',        teamSlug: 'nba' },
  EuroLeague: { compRef: 'league:euroleague', teamSlug: 'el' },
  BSL:        { compRef: 'league:bsl',        teamSlug: 'bsl' },
};

// Backend ingest sources currently active for basketball:
//   - NBA: ESPN public scoreboard, team displayName like
//     "Boston Celtics", "Los Angeles Lakers".
// EuroLeague + BSL ingest is intentionally NOT wired (api-sports free
// tier was years out of date, scrape sites all behind Cloudflare). For
// those two leagues users can still subscribe to teams via the static
// roster but won't see fixtures until we either pay for api-sports
// basketball or add a Playwright-based scrape.
//
// This lookup translates each league's "raw upstream team name" → our
// static-roster slug seed + a clean Turkish/English display name. The
// slug seed MUST match what STATIC_LEAGUE_ROSTERS used so subscriptions
// resolve. Unknown names fall back to a slugify in the league's
// namespace — works but won't match a pre-registered TrackedEntity.
const BASKETBALL_TEAM_TO_SLUG = {
  // ── NBA (ESPN displayName → slug seed in STATIC_LEAGUE_ROSTERS.NBA) ──
  'Boston Celtics':           { league: 'NBA', slug: 'bos', display: 'Boston Celtics' },
  'Brooklyn Nets':            { league: 'NBA', slug: 'bkn', display: 'Brooklyn Nets' },
  'New York Knicks':          { league: 'NBA', slug: 'nyk', display: 'New York Knicks' },
  'Philadelphia 76ers':       { league: 'NBA', slug: 'phi', display: 'Philadelphia 76ers' },
  'Toronto Raptors':          { league: 'NBA', slug: 'tor', display: 'Toronto Raptors' },
  'Chicago Bulls':            { league: 'NBA', slug: 'chi', display: 'Chicago Bulls' },
  'Cleveland Cavaliers':      { league: 'NBA', slug: 'cle', display: 'Cleveland Cavaliers' },
  'Detroit Pistons':          { league: 'NBA', slug: 'det', display: 'Detroit Pistons' },
  'Indiana Pacers':           { league: 'NBA', slug: 'ind', display: 'Indiana Pacers' },
  'Milwaukee Bucks':          { league: 'NBA', slug: 'mil', display: 'Milwaukee Bucks' },
  'Atlanta Hawks':            { league: 'NBA', slug: 'atl', display: 'Atlanta Hawks' },
  'Charlotte Hornets':        { league: 'NBA', slug: 'cha', display: 'Charlotte Hornets' },
  'Miami Heat':               { league: 'NBA', slug: 'mia', display: 'Miami Heat' },
  'Orlando Magic':            { league: 'NBA', slug: 'orl', display: 'Orlando Magic' },
  'Washington Wizards':       { league: 'NBA', slug: 'was', display: 'Washington Wizards' },
  'Denver Nuggets':           { league: 'NBA', slug: 'den', display: 'Denver Nuggets' },
  'Minnesota Timberwolves':   { league: 'NBA', slug: 'min', display: 'Minnesota Timberwolves' },
  'Oklahoma City Thunder':    { league: 'NBA', slug: 'okc', display: 'Oklahoma City Thunder' },
  'Portland Trail Blazers':   { league: 'NBA', slug: 'por', display: 'Portland Trail Blazers' },
  'Utah Jazz':                { league: 'NBA', slug: 'uta', display: 'Utah Jazz' },
  'Golden State Warriors':    { league: 'NBA', slug: 'gsw', display: 'Golden State Warriors' },
  'LA Clippers':              { league: 'NBA', slug: 'lac', display: 'LA Clippers' },
  'Los Angeles Clippers':     { league: 'NBA', slug: 'lac', display: 'LA Clippers' }, // ESPN sometimes uses long form
  'Los Angeles Lakers':       { league: 'NBA', slug: 'lal', display: 'Los Angeles Lakers' },
  'Phoenix Suns':             { league: 'NBA', slug: 'phx', display: 'Phoenix Suns' },
  'Sacramento Kings':         { league: 'NBA', slug: 'sac', display: 'Sacramento Kings' },
  'Dallas Mavericks':         { league: 'NBA', slug: 'dal', display: 'Dallas Mavericks' },
  'Houston Rockets':          { league: 'NBA', slug: 'hou', display: 'Houston Rockets' },
  'Memphis Grizzlies':        { league: 'NBA', slug: 'mem', display: 'Memphis Grizzlies' },
  'New Orleans Pelicans':     { league: 'NBA', slug: 'nop', display: 'New Orleans Pelicans' },
  'San Antonio Spurs':        { league: 'NBA', slug: 'sas', display: 'San Antonio Spurs' },
};

function resolveBasketballTeamRef(rawName, fallbackLeague) {
  const known = BASKETBALL_TEAM_TO_SLUG[rawName];
  if (known) {
    const ns = BASKETBALL_LEAGUE_REFS[known.league];
    return { ref: `team:${ns.teamSlug}:${known.slug}`, display: known.display };
  }
  const ns = BASKETBALL_LEAGUE_REFS[fallbackLeague] || BASKETBALL_LEAGUE_REFS.NBA;
  const slug = rawName
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return { ref: `team:${ns.teamSlug}:${slug}`, display: rawName };
}

/**
 * Fetch upcoming basketball games (NBA / EuroLeague / BSL) from our
 * backend. Returns events normalised for the Base44 Event schema with
 * competition + home/away entity refs that resolve against the static
 * basketball rosters seeded in buildStaticTeamSeeds().
 */
export async function fetchUpcomingBasketball() {
  const url = `${FOOTBALL_API_BASE}/sport-events?sport=basketball&upcoming=true&limit=300`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`basketball API ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const games = await res.json();
  return games.map((g) => {
    const leagueCode = g.league;
    const compRef = BASKETBALL_LEAGUE_REFS[leagueCode]?.compRef
      || `league:${leagueCode.toLowerCase()}`;
    const compName = BASKETBALL_LEAGUE_DISPLAY[leagueCode] || leagueCode;
    const home = resolveBasketballTeamRef(g.home_team, leagueCode);
    const away = resolveBasketballTeamRef(g.away_team || '', leagueCode);
    return {
      title: `${home.display} – ${away.display}`,
      competition_name: compName,
      start_time: new Date(g.kickoff).toISOString(),
      broadcaster: g.broadcaster || '',
      venue: g.venue || '',
      is_live: g.status === 'in_play',
      _category_slug: 'nba',
      _source_id: g.external_ref,
      _competition_ref: compRef,
      _competition_name: compName,
      _home_entity_ref: home.ref,
      _home_entity_name: home.display,
      _away_entity_ref: away.ref,
      _away_entity_name: away.display,
    };
  });
}

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
  // Single season-level competition so onboarding step 2 reads as
  // "🏎 Formula 1" and the user can subscribe to the championship as a
  // whole (not race-by-race).
  const F1_COMP_REF = 'series:f1:2026';
  const F1_COMP_NAME = '🏎 Formula 1 2026';
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
      competition_name: F1_COMP_NAME,
      start_time: new Date(iso).toISOString(),
      broadcaster,
      venue,
      is_live: false,
      _category_slug: 'f1',
      _source_id: `f1:${race.season}:${race.round}:${sessionKey}`,
      _competition_ref: F1_COMP_REF,
      _competition_name: F1_COMP_NAME,
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
  // Big-5 + Eredivisie + Liga Portugal full rosters. Slug seeds match
  // what football-data.co.uk / api-football emit so subscriptions resolve
  // identically whether the team is in this week's fixture or not.
  E0: [
    ['Liverpool', 'Liverpool'], ['Arsenal', 'Arsenal'],
    ['Manchester City', 'Man City'], ['Manchester United', 'Man United'],
    ['Chelsea', 'Chelsea'], ['Tottenham', 'Tottenham'],
    ['Newcastle', 'Newcastle'], ['Aston Villa', 'Aston Villa'],
    ['Brighton', 'Brighton'], ['West Ham', 'West Ham'],
    ['Crystal Palace', 'Crystal Palace'], ['Brentford', 'Brentford'],
    ['Fulham', 'Fulham'], ['Wolves', 'Wolves'],
    ['Everton', 'Everton'], ['Bournemouth', 'Bournemouth'],
    ['Nottingham Forest', "Nott'm Forest"], ['Leeds', 'Leeds'],
    ['Burnley', 'Burnley'], ['Sunderland', 'Sunderland'],
  ],
  SP1: [
    ['Real Madrid', 'Real Madrid'], ['Barcelona', 'Barcelona'],
    ['Atletico Madrid', 'Ath Madrid'], ['Athletic Bilbao', 'Ath Bilbao'],
    ['Real Sociedad', 'Sociedad'], ['Real Betis', 'Betis'],
    ['Sevilla', 'Sevilla'], ['Villarreal', 'Villarreal'],
    ['Valencia', 'Valencia'], ['Celta Vigo', 'Celta'],
    ['Getafe', 'Getafe'], ['Osasuna', 'Osasuna'],
    ['Mallorca', 'Mallorca'], ['Girona', 'Girona'],
    ['Espanyol', 'Espanyol'], ['Rayo Vallecano', 'Vallecano'],
    ['Alaves', 'Alaves'], ['Levante', 'Levante'],
    ['Real Oviedo', 'Oviedo'], ['Elche', 'Elche'],
  ],
  I1: [
    ['Inter', 'Inter'], ['Juventus', 'Juventus'],
    ['Milan', 'Milan'], ['Napoli', 'Napoli'],
    ['Roma', 'Roma'], ['Lazio', 'Lazio'],
    ['Atalanta', 'Atalanta'], ['Fiorentina', 'Fiorentina'],
    ['Bologna', 'Bologna'], ['Torino', 'Torino'],
    ['Udinese', 'Udinese'], ['Genoa', 'Genoa'],
    ['Cagliari', 'Cagliari'], ['Lecce', 'Lecce'],
    ['Hellas Verona', 'Verona'], ['Parma', 'Parma'],
    ['Como', 'Como'], ['Pisa', 'Pisa'],
    ['Cremonese', 'Cremonese'], ['Sassuolo', 'Sassuolo'],
  ],
  D1: [
    ['Bayern München', 'Bayern Munich'], ['Borussia Dortmund', 'Dortmund'],
    ['RB Leipzig', 'RB Leipzig'], ['Bayer Leverkusen', 'Leverkusen'],
    ['Eintracht Frankfurt', 'Ein Frankfurt'], ['VfB Stuttgart', 'Stuttgart'],
    ['Werder Bremen', 'Werder Bremen'], ['Wolfsburg', 'Wolfsburg'],
    ['Hoffenheim', 'Hoffenheim'], ['Mainz', 'Mainz'],
    ['Augsburg', 'Augsburg'], ['Freiburg', 'Freiburg'],
    ["Borussia M'gladbach", "M'gladbach"], ['Union Berlin', 'Union Berlin'],
    ['Heidenheim', 'Heidenheim'], ['St Pauli', 'St Pauli'],
    ['Köln', 'Koln'], ['Hamburger SV', 'Hamburg'],
  ],
  F1: [
    ['Paris Saint-Germain', 'Paris SG'], ['Marseille', 'Marseille'],
    ['Monaco', 'Monaco'], ['Lyon', 'Lyon'],
    ['Lille', 'Lille'], ['Nice', 'Nice'],
    ['Rennes', 'Rennes'], ['Lens', 'Lens'],
    ['Strasbourg', 'Strasbourg'], ['Toulouse', 'Toulouse'],
    ['Brest', 'Brest'], ['Nantes', 'Nantes'],
    ['Auxerre', 'Auxerre'], ['Le Havre', 'Le Havre'],
    ['Angers', 'Angers'], ['Metz', 'Metz'],
    ['Lorient', 'Lorient'], ['Paris FC', 'Paris FC'],
  ],
  N1: [
    ['Ajax', 'Ajax'], ['PSV Eindhoven', 'PSV Eindhoven'],
    ['Feyenoord', 'Feyenoord'], ['AZ Alkmaar', 'AZ Alkmaar'],
    ['FC Twente', 'Twente'], ['FC Utrecht', 'Utrecht'],
    ['SC Heerenveen', 'Heerenveen'], ['NEC Nijmegen', 'NEC Nijmegen'],
    ['Sparta Rotterdam', 'Sparta Rotterdam'], ['Go Ahead Eagles', 'Go Ahead Eagles'],
  ],
  P1: [
    ['Benfica', 'Benfica'], ['Porto', 'Porto'],
    ['Sporting Lisbon', 'Sp Lisbon'], ['Sporting Braga', 'Sp Braga'],
    ['Vitoria Guimaraes', 'Guimaraes'], ['Famalicao', 'Famalicao'],
    ['Rio Ave', 'Rio Ave'], ['Estoril', 'Estoril'],
    ['Moreirense', 'Moreirense'], ['Casa Pia', 'Casa Pia'],
  ],
};

// Basketball — three leagues sharing the 'nba' category slug for the
// time being (Base44 Category row was originally created as "NBA"; the
// display name should be renamed to "Basketbol" via the dashboard now
// that we span EuroLeague + BSL too). Slug stays so existing user
// subscriptions don't break.
//
// Each league's roster: [displayName, shortCode]. shortCode goes into
// the team_ref slug, so it must be stable across seasons.

const NBA_TEAMS = [
  // Eastern
  ['Boston Celtics', 'BOS'], ['Brooklyn Nets', 'BKN'],
  ['New York Knicks', 'NYK'], ['Philadelphia 76ers', 'PHI'],
  ['Toronto Raptors', 'TOR'], ['Chicago Bulls', 'CHI'],
  ['Cleveland Cavaliers', 'CLE'], ['Detroit Pistons', 'DET'],
  ['Indiana Pacers', 'IND'], ['Milwaukee Bucks', 'MIL'],
  ['Atlanta Hawks', 'ATL'], ['Charlotte Hornets', 'CHA'],
  ['Miami Heat', 'MIA'], ['Orlando Magic', 'ORL'],
  ['Washington Wizards', 'WAS'],
  // Western
  ['Denver Nuggets', 'DEN'], ['Minnesota Timberwolves', 'MIN'],
  ['Oklahoma City Thunder', 'OKC'], ['Portland Trail Blazers', 'POR'],
  ['Utah Jazz', 'UTA'], ['Golden State Warriors', 'GSW'],
  ['LA Clippers', 'LAC'], ['Los Angeles Lakers', 'LAL'],
  ['Phoenix Suns', 'PHX'], ['Sacramento Kings', 'SAC'],
  ['Dallas Mavericks', 'DAL'], ['Houston Rockets', 'HOU'],
  ['Memphis Grizzlies', 'MEM'], ['New Orleans Pelicans', 'NOP'],
  ['San Antonio Spurs', 'SAS'],
];

// EuroLeague 2025/26 — 18 clubs.
const EUROLEAGUE_TEAMS = [
  ['Anadolu Efes',                'EFES'],
  ['Fenerbahçe Beko',             'FBB'],
  ['Real Madrid',                 'RMB'],
  ['FC Barcelona',                'BAR_B'],
  ['Olympiacos',                  'OLY'],
  ['Panathinaikos AKTOR',         'PAO'],
  ['Maccabi Tel Aviv',            'MAC'],
  ['Žalgiris Kaunas',             'ZAL'],
  ['Crvena zvezda',               'CZV'],
  ['Partizan',                    'PAR'],
  ['Olimpia Milano',              'MIL_B'],
  ['Virtus Bologna',              'VIRT'],
  ['ASVEL',                       'ASV'],
  ['AS Monaco',                   'MON_B'],
  ['Paris Basketball',            'PAR_B'],
  ['Bayern München',              'BAY_B'],
  ['ALBA Berlin',                 'ALBA'],
  ['Baskonia',                    'BAS'],
];

// Türkiye Basketbol Süper Ligi (BSL) 2025/26 — 16 clubs.
const BSL_TEAMS = [
  ['Anadolu Efes',                'BSL_EFES'],
  ['Fenerbahçe Beko',             'BSL_FBB'],
  ['Galatasaray MCT Technic',     'BSL_GS'],
  ['Beşiktaş Fibabanka',          'BSL_BJK'],
  ['TOFAŞ',                       'BSL_TOFAS'],
  ['Bahçeşehir Koleji',           'BSL_BAH'],
  ['Türk Telekom',                'BSL_TTEL'],
  ['Pınar Karşıyaka',             'BSL_KSK'],
  ['Aliağa Petkimspor',           'BSL_PETKIM'],
  ['Manisa Büyükşehir Belediye',  'BSL_MAN'],
  ['Bandırma B.İ.K.',             'BSL_BAND'],
  ['Yukatel Merkezefendi',        'BSL_MERK'],
  ['Mersin Spor',                 'BSL_MER'],
  ['Onvo Büyükçekmece Basketbol', 'BSL_BCEK'],
  ['Samsunspor',                  'BSL_SAM'],
  ['Esenler Erokspor',            'BSL_ESN'],
];

// Volleyball — top Turkish clubs (Sultanlar Ligi + Efeler Ligi)
// plus the international titans users tend to track during EuroLeague /
// CEV final stages.
const VOLLEYBALL_TEAMS = [
  // Türk kadın (Sultanlar Ligi)
  ['VakıfBank',           'VBK_W'],
  ['Eczacıbaşı Dynavit',  'ECZ_W'],
  ['Fenerbahçe Opet',     'FB_W'],
  ['Galatasaray Daikin',  'GS_W'],
  ['Türk Hava Yolları',   'THY_W'],
  ['Beşiktaş Kadın',      'BJK_W'],
  // Türk erkek (Efeler Ligi)
  ['Halkbank',            'HALK_M'],
  ['Ziraat Bankkart',     'ZB_M'],
  ['Fenerbahçe HDI',      'FB_M'],
  ['Galatasaray HDI',     'GS_M'],
  ['Arkasspor',           'ARK_M'],
  ['Tokat Belediye Plevne','TOKAT_M'],
];

// Tennis — top current ATP/WTA players. Onboarding lets users pick
// favorites; tournament fixtures will surface their matches once
// api-sports tennis is wired.
const TENNIS_PLAYERS = [
  // ATP
  ['Jannik Sinner',     'sinner'],
  ['Carlos Alcaraz',    'alcaraz'],
  ['Novak Djokovic',    'djokovic'],
  ['Daniil Medvedev',   'medvedev'],
  ['Alexander Zverev',  'zverev'],
  ['Stefanos Tsitsipas','tsitsipas'],
  ['Andrey Rublev',     'rublev'],
  ['Holger Rune',       'rune'],
  ['Taylor Fritz',      'fritz'],
  ['Casper Ruud',       'ruud'],
  // WTA
  ['Iga Świątek',       'swiatek'],
  ['Aryna Sabalenka',   'sabalenka'],
  ['Coco Gauff',        'gauff'],
  ['Elena Rybakina',    'rybakina'],
  ['Jessica Pegula',    'pegula'],
  ['Ons Jabeur',        'jabeur'],
  ['Madison Keys',      'keys'],
  ['Qinwen Zheng',      'zheng'],
  ['Jasmine Paolini',   'paolini'],
  ['Mirra Andreeva',    'andreeva'],
];

// Tennis tournaments — Grand Slams + key ATP/WTA Masters where TR
// broadcast usually lights up. Static dates per year so users can opt
// in even before per-match fixtures land.
const TENNIS_TOURNAMENTS_2026 = [
  // [name, start, end, broadcaster]
  ['Roland Garros',        '2026-05-24', '2026-06-07', 'S Sport / S Sport 2'],
  ['Wimbledon',            '2026-06-29', '2026-07-12', 'S Sport'],
  ['US Open',              '2026-08-24', '2026-09-06', 'S Sport'],
  ['ATP Finals (Torino)',  '2026-11-08', '2026-11-15', 'S Sport'],
  ['WTA Finals',           '2026-11-01', '2026-11-08', 'S Sport'],
  ['Madrid Open',          '2026-04-22', '2026-05-04', 'S Sport'],
  ['Roma Masters',         '2026-05-06', '2026-05-18', 'S Sport'],
  ['Cincinnati Masters',   '2026-08-09', '2026-08-17', 'S Sport'],
];

export function buildStaticTeamSeeds() {
  const out = [];

  // Football clubs (Big-5 + T1 + N1 + P1)
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

  // Basketball leagues — share the 'nba' category slug
  // (see comment on the team arrays for why the slug is named 'nba'
  // historically). Each league gets its own competition_ref so a user
  // following EuroLeague doesn't see NBA preseason noise and vice versa.
  const BASKETBALL_LEAGUES = [
    { compRef: 'league:nba',       teams: NBA_TEAMS,        teamSlug: 'nba' },
    { compRef: 'league:euroleague',teams: EUROLEAGUE_TEAMS, teamSlug: 'el' },
    { compRef: 'league:bsl',       teams: BSL_TEAMS,        teamSlug: 'bsl' },
  ];
  for (const lg of BASKETBALL_LEAGUES) {
    for (const [name, code] of lg.teams) {
      out.push({
        _category_slug: 'nba', // intentional: see team-array comment
        // Onboarding step 3 already groups teams under their league
        // header, so we don't suffix the league here — would be redundant
        // ("Anadolu Efes" under "EuroLeague" header is enough).
        _entity_name: name,
        _entity_ref: `team:${lg.teamSlug}:${code.toLowerCase()}`,
        _competition_ref: lg.compRef,
      });
    }
  }

  // Volleyball clubs
  for (const [name, code] of VOLLEYBALL_TEAMS) {
    out.push({
      _category_slug: 'voleybol',
      _entity_name: name,
      _entity_ref: `team:tr_vb:${code.toLowerCase()}`,
      _competition_ref: 'league:tr_volleyball',
    });
  }

  // Tennis players (TrackedEntity type=player)
  for (const [name, slug] of TENNIS_PLAYERS) {
    out.push({
      _category_slug: 'tenis',
      _entity_name: name,
      _entity_ref: `player:atp_wta:${slug}`,
      _competition_ref: 'tour:atp_wta',
      _entity_type: 'player',
    });
  }

  return out;
}

// Standalone competition definitions for sources that have no live
// fixtures yet. Without these, /seed creates Competition rows with
// blank `name` (since name normally comes from the first fixture's
// _competition_name). Onboarding step 2 then shows blank labels.
//
// Each row: [external_ref, displayName, categorySlug]. /seed seeds
// these as Competition rows with no events attached; the events come
// later when an API key + fetcher is wired.
export const STATIC_COMPETITIONS = [
  ['league:nba',         '🇺🇸 NBA',                   'nba'],
  ['league:euroleague',  '🇪🇺 EuroLeague',            'nba'],
  ['league:bsl',         '🇹🇷 Basketbol Süper Ligi',  'nba'],
  ['league:tr_volleyball','🇹🇷 Voleybol (Sultanlar + Efeler)', 'voleybol'],
  ['tour:atp_wta',       '🎾 ATP / WTA Tour',         'tenis'],
  ['series:f1:2026',     '🏎 Formula 1 2026',         'f1'],
  ['series:motogp:2026', '🏍 MotoGP 2026',            'motogp'],
  ['series:moto2:2026',  '🏍 Moto2 2026',             'motogp'],
  ['series:moto3:2026',  '🏍 Moto3 2026',             'motogp'],
  ['series:wsbk:2026',   '🏍 WorldSBK 2026',          'motogp'],
  ['tv:turkiye',         '📺 Türkiye TV Etkinlikleri', 'tv'],
];

// Standalone tournament + special-event builder. Tennis Slams etc.
// emit a single "tournament starts" event so users can subscribe to
// the umbrella and get reminded when it kicks off.
export function buildStaticTournamentEvents() {
  const events = [];
  const now = Date.now();

  // Tennis tournaments — emit one event per tournament marking its start
  // date. So a user who picks "Wimbledon" gets reminded when it begins.
  for (const [name, startStr, endStr, broadcaster] of TENNIS_TOURNAMENTS_2026) {
    const t = new Date(`${startStr}T13:00:00+03:00`).getTime();
    if (!Number.isFinite(t) || t < now - 24 * 60 * 60 * 1000) continue;
    events.push({
      title: `${name} — Başlangıç`,
      competition_name: name,
      start_time: new Date(t).toISOString(),
      broadcaster,
      venue: '',
      is_live: false,
      _category_slug: 'tenis',
      _source_id: `tennis:tournament:${name.toLowerCase().replace(/\s+/g, '-')}:start`,
      _competition_ref: `tournament:tennis:${name.toLowerCase().replace(/\s+/g, '-')}`,
      _competition_name: name,
    });
  }

  return events;
}

// MotoGP 2026 calendar. Source: en.wikipedia.org/wiki/2026_MotoGP_World_Championship.
// We seed RACE events for all three classes (MotoGP, Moto2, Moto3) on the
// Sunday of each weekend. Practice + qualifying are intentionally skipped
// — most users follow the race, not Friday FP1. Race time defaults to
// 14:00 local TR (typical EU race window); precise times can be patched
// later if upstream API surfaces them.
const MOTOGP_2026 = [
  // [round, gpName, circuit, country, raceISO]
  [1,  'Tayland GP',            'Chang Uluslararası',          'Tayland',     '2026-03-01'],
  [2,  'Brezilya GP',            'Autódromo Ayrton Senna',      'Brezilya',    '2026-03-22'],
  [3,  'Amerika GP',             'Circuit of the Americas',     'ABD',         '2026-03-29'],
  [4,  'İspanya GP',             'Jerez',                       'İspanya',     '2026-04-26'],
  [5,  'Fransa GP',              'Le Mans',                     'Fransa',      '2026-05-10'],
  [6,  'Katalonya GP',           'Barcelona-Catalunya',         'İspanya',     '2026-05-17'],
  [7,  'İtalya GP',              'Mugello',                     'İtalya',      '2026-05-31'],
  [8,  'Macaristan GP',          'Balaton Park',                'Macaristan',  '2026-06-07'],
  [9,  'Çekya GP',               'Brno',                        'Çekya',       '2026-06-21'],
  [10, 'Hollanda GP',            'TT Circuit Assen',            'Hollanda',    '2026-06-28'],
  [11, 'Almanya GP',             'Sachsenring',                 'Almanya',     '2026-07-12'],
  [12, 'Britanya GP',            'Silverstone',                 'Birleşik Krallık','2026-08-09'],
  [13, 'Aragon GP',              'MotorLand Aragón',            'İspanya',     '2026-08-30'],
  [14, 'San Marino GP',          'Misano',                      'San Marino',  '2026-09-13'],
  [15, 'Avusturya GP',           'Red Bull Ring',               'Avusturya',   '2026-09-20'],
  [16, 'Japonya GP',             'Motegi',                      'Japonya',     '2026-10-04'],
  [17, 'Endonezya GP',           'Mandalika',                   'Endonezya',   '2026-10-11'],
  [18, 'Avustralya GP',          'Phillip Island',              'Avustralya',  '2026-10-25'],
  [19, 'Malezya GP',             'Sepang',                      'Malezya',     '2026-11-01'],
  [20, 'Katar GP',               'Lusail',                      'Katar',       '2026-11-08'],
  [21, 'Portekiz GP',            'Portimão',                    'Portekiz',    '2026-11-22'],
  [22, 'Valencia GP',            'Ricardo Tormo',               'İspanya',     '2026-11-29'],
];

// Three classes share the same race weekend. Times are typical broadcast
// slots in TR (UTC+3); some flyaways shift earlier.
const MOTO_CLASSES = [
  { slug: 'motogp', label: 'MotoGP',  hour: 14, broadcaster: 'S Sport 2' },
  { slug: 'moto2',  label: 'Moto2',   hour: 12, broadcaster: 'S Sport 2' },
  { slug: 'moto3',  label: 'Moto3',   hour: 11, broadcaster: 'S Sport 2' },
];

/**
 * Build MotoGP / Moto2 / Moto3 race events for the season.
 * Each round produces 3 events (one per class). The competition_ref
 * groups rounds by class so a user who only wants Moto3 can pick that
 * competition and ignore the premier class.
 */
export function buildMotoGpEvents() {
  const events = [];
  for (const [round, gpName, circuit, country, dateStr] of MOTOGP_2026) {
    for (const cls of MOTO_CLASSES) {
      // Skip events more than 12 months old (housekeeping; current code
      // only ever has the future season).
      const t = new Date(`${dateStr}T${String(cls.hour).padStart(2, '0')}:00:00+03:00`).getTime();
      if (!Number.isFinite(t)) continue;
      events.push({
        title: `${gpName} — ${cls.label} Yarışı`,
        competition_name: `${cls.label} 2026`,
        start_time: new Date(t).toISOString(),
        broadcaster: cls.broadcaster,
        venue: `${circuit}, ${country}`,
        is_live: false,
        _category_slug: 'motogp',
        _source_id: `${cls.slug}:2026:${round}:Race`,
        _competition_ref: `series:${cls.slug}:2026`,
        _competition_name: `${cls.label} 2026`,
      });
    }
  }
  return events;
}

// World Superbike 2026 calendar. Source: Wikipedia. Each round has
// Race 1 (Sat), Superpole + Race 2 (Sun) — we seed Sunday's main race
// only to keep the list lean. Race 1 / Superpole can be added later if
// users ask.
const WSBK_2026 = [
  [1,  'Avustralya',     'Phillip Island',          'Avustralya', '2026-02-22'],
  [2,  'Portekiz',       'Algarve',                  'Portekiz',  '2026-03-29'],
  [3,  'Hollanda',       'TT Circuit Assen',         'Hollanda',  '2026-04-19'],
  [4,  'Macaristan',     'Balaton Park',             'Macaristan','2026-05-03'],
  [5,  'Çekya',          'Autodrom Most',            'Çekya',     '2026-05-17'],
  [6,  'Aragón',         'MotorLand Aragón',         'İspanya',   '2026-05-31'],
  [7,  'Emilia-Romagna', 'Misano',                   'İtalya',    '2026-06-14'],
  [8,  'Birleşik Krallık','Donington Park',          'Birleşik Krallık','2026-07-12'],
  [9,  'Fransa',         'Magny-Cours',              'Fransa',    '2026-09-06'],
  [10, 'İtalya',         'Cremona',                  'İtalya',    '2026-09-27'],
  [11, 'Estoril',        'Estoril',                  'Portekiz',  '2026-10-11'],
  [12, 'İspanya',        'Jerez',                    'İspanya',   '2026-10-18'],
];

// WSBK weekend has 3 broadcast sessions: Race 1 Sat afternoon,
// Superpole Race Sun morning (10-lap sprint), Race 2 Sun afternoon.
// All seeded so users can hatırlat all three. Sat date = Sunday - 1.
const WSBK_SESSIONS = [
  { key: 'Race1',     label: 'Yarış 1',         dayOffset: -1, hour: 14 }, // Saturday afternoon TR
  { key: 'Superpole', label: 'Superpole Yarış', dayOffset:  0, hour: 13 }, // Sunday lunchtime TR
  { key: 'Race2',     label: 'Yarış 2',         dayOffset:  0, hour: 16 }, // Sunday afternoon TR
];

export function buildWsbkEvents() {
  const events = [];
  for (const [round, roundName, circuit, country, dateStr] of WSBK_2026) {
    const sundayMs = new Date(`${dateStr}T00:00:00+03:00`).getTime();
    if (!Number.isFinite(sundayMs)) continue;
    for (const s of WSBK_SESSIONS) {
      const t = sundayMs + s.dayOffset * 24 * 60 * 60 * 1000 + s.hour * 60 * 60 * 1000;
      events.push({
        title: `${roundName} — ${s.label}`,
        competition_name: 'WorldSBK 2026',
        start_time: new Date(t).toISOString(),
        broadcaster: 'S Sport',
        venue: `${circuit}, ${country}`,
        is_live: false,
        _category_slug: 'motogp', // share the moto category — same audience
        _source_id: `wsbk:2026:${round}:${s.key}`,
        _competition_ref: 'series:wsbk:2026',
        _competition_name: 'WorldSBK 2026',
      });
    }
  }
  return events;
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

  // Single 'Türkiye TV Etkinlikleri' competition under the TV category.
  // Lets users subscribe at the umbrella level instead of per-show.
  const TV_COMP_REF = 'tv:turkiye';
  const TV_COMP_NAME = '📺 Türkiye TV Etkinlikleri';
  return [
    {
      title: 'Survivor All Star — Eleme Gecesi',
      competition_name: TV_COMP_NAME,
      start_time: at(today, 22, 0),
      broadcaster: 'TV8',
      is_live: false,
      _category_slug: 'tv',
      _source_id: 'tv:survivor:today',
      _competition_ref: TV_COMP_REF,
      _competition_name: TV_COMP_NAME,
    },
    {
      title: 'MasterChef Türkiye',
      competition_name: TV_COMP_NAME,
      start_time: at(tomorrow, 20, 0),
      broadcaster: 'TV8',
      is_live: false,
      _category_slug: 'tv',
      _source_id: 'tv:masterchef:tomorrow',
      _competition_ref: TV_COMP_REF,
      _competition_name: TV_COMP_NAME,
    },
  ];
}
