#!/usr/bin/env node
/**
 * Daily sync — pulls fresh fixtures from upstream sources and writes them
 * into Base44 via the REST API. This is the production replacement for
 * the manual /seed page; once GitHub Actions runs this on a schedule,
 * users never have to open /seed again.
 *
 * Auth: Base44 dashboard → API → "API Key". Pass it as BASE44_API_KEY
 * in the environment. Locally:
 *
 *     export BASE44_API_KEY="…"
 *     node scripts/sync.mjs
 *
 * In CI it comes from a GitHub Actions repo secret of the same name.
 *
 * Side effects:
 *   - Deletes Event rows older than 2 days
 *   - Deletes Event rows in the next 48h that are about to be re-seeded
 *     (dedupe on external_ref)
 *   - Creates / updates Competition + TrackedEntity rows so onboarding
 *     subscriptions resolve cleanly
 *   - Creates Event rows for the next ~7 days from football-predictor +
 *     Jolpica F1 + static MotoGP/WSBK/tournaments + hand-curated TV
 *
 * Most of the logic is shared with src/pages/Seed.jsx — both files build
 * the same payload shape from the same dataSources.js helpers. We can't
 * directly import that module here because it's an .js file inside a
 * Vite/React project, but the helpers it exposes are pure JS + use only
 * `fetch` (Node 18+ has it natively), so we re-import via path alias.
 */

import {
  fetchUpcomingFootballMatches,
  fetchUpcomingBasketball,
  fetchUpcomingF1Sessions,
  buildMotoGpEvents,
  buildWsbkEvents,
  buildStaticTournamentEvents,
  buildTvEvents,
  buildStaticTeamSeeds,
  STATIC_COMPETITIONS,
} from '../src/lib/dataSources.js';

const APP_ID = '69ebd11fe74b0ffcc2427b1b';
const BASE_URL = `https://app.base44.com/api/apps/${APP_ID}`;
const API_KEY = process.env.BASE44_API_KEY;

if (!API_KEY) {
  console.error('❌ BASE44_API_KEY environment variable is empty.');
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────
// Tiny REST helper — Base44 wants `api_key: <KEY>` (lowercase header).
// Probe-tested against /entities/Category and /entities/Event with both
// reads and writes succeeding. We add a retry-on-429 loop because bulk
// runs (60+ events) trip the rate limiter otherwise.
// ───────────────────────────────────────────────────────────────────
const HEADERS = {
  'Content-Type': 'application/json',
  'api_key': API_KEY,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, { retries = 3, baseDelay = 1500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message || err);
      const isRateLimit =
        msg.includes('429') || msg.toLowerCase().includes('rate limit');
      if (!isRateLimit || attempt === retries) throw err;
      await sleep(baseDelay * 2 ** attempt);
    }
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  }
  // DELETE responses sometimes have no body
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) return null;
  return res.json();
}

const list   = (entity)              => api('GET',    `/entities/${entity}`);
const create = (entity, body)        => api('POST',   `/entities/${entity}`, body);
const update = (entity, id, patch)   => api('PUT',    `/entities/${entity}/${id}`, patch);
const remove = (entity, id)          => api('DELETE', `/entities/${entity}/${id}`);

// ───────────────────────────────────────────────────────────────────
// Sync logic — mirrors src/pages/Seed.jsx step for step. Comments
// inside Seed.jsx explain why each filter / dedupe / cleanup runs.
// ───────────────────────────────────────────────────────────────────

async function main() {
  const log = (line) => console.log(line);
  log('→ Kategoriler getiriliyor…');
  const categories = await withRetry(() => list('Category'));
  const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const required = ['futbol', 'f1', 'tv'];
  const missing = required.filter((s) => !bySlug[s]);
  if (missing.length) {
    throw new Error(`Kategoriler eksik (${missing.join(', ')}). Base44 Data → Category tablosuna ekle.`);
  }
  log(`  ${categories.length} kategori. ✓`);

  log('→ Veri kaynakları sorgulanıyor…');
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [football, basketball, f1, motogp, wsbk, tournaments, tv] = await Promise.allSettled([
    fetchUpcomingFootballMatches(),
    fetchUpcomingBasketball(),
    fetchUpcomingF1Sessions(),
    Promise.resolve(buildMotoGpEvents()),
    Promise.resolve(buildWsbkEvents()),
    Promise.resolve(buildStaticTournamentEvents()),
    Promise.resolve(buildTvEvents({ today, tomorrow })),
  ]);

  const collected = [];
  const futureOnly = (arr) => {
    const now = Date.now();
    return arr.filter((e) => new Date(e.start_time).getTime() > now);
  };
  const fold = (label, result, filter = (x) => x) => {
    if (result.status === 'fulfilled') {
      const rows = filter(result.value);
      log(`  ${label} ${rows.length}`);
      collected.push(...rows);
    } else {
      log(`  ! ${label}: ${result.reason?.message || result.reason}`);
    }
  };
  fold('⚽ futbol',     football);
  fold('🏀 basketbol',  basketball);
  fold('🏎 F1',         f1);
  fold('🏍 MotoGP/2/3', motogp,    futureOnly);
  fold('🏍 WSBK',       wsbk,      futureOnly);
  fold('🎾 turnuva',    tournaments, futureOnly);
  fold('📺 TV',         tv);

  if (collected.length === 0) {
    throw new Error('Hiçbir kaynaktan veri çekilemedi.');
  }

  log('→ Eski / üzerine yazılacak Event temizleniyor…');
  const all = await withRetry(() => list('Event'));
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const upcomingWindow = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const incomingRefs = new Set(collected.map((e) => e._source_id));
  const toDelete = all.filter((e) => {
    const t = new Date(e.start_time).getTime();
    if (!Number.isFinite(t)) return false;
    const isStale = t < cutoff;
    const isOverwriting = e.external_ref && incomingRefs.has(e.external_ref);
    const isLegacyDemo = !e.external_ref && t >= cutoff && t <= upcomingWindow;
    return isStale || isOverwriting || isLegacyDemo;
  });
  let delIdx = 0;
  for (const ev of toDelete) {
    try {
      await withRetry(() => remove('Event', ev.id));
      delIdx += 1;
      await sleep(60);
      if (delIdx % 25 === 0) await sleep(800);
    } catch (err) {
      log(`  ! silinemedi: ${ev.title || ev.id} (${err?.message || err})`);
    }
  }
  log(`  ${toDelete.length} kayıt silindi. ✓`);

  log('→ Lig ve takım kayıtları hazırlanıyor…');
  const allComps = await withRetry(() => list('Competition'));
  const allEnts  = await withRetry(() => list('TrackedEntity'));

  // Cleanup orphan rows — same logic as Seed.jsx
  const orphanComps = allComps.filter((c) => !c.external_ref);
  const orphanEnts  = allEnts.filter((e) => !e.external_ref);
  let cleanedC = 0, cleanedE = 0;
  for (const c of orphanComps) {
    try { await withRetry(() => remove('Competition', c.id)); cleanedC += 1; await sleep(60); } catch { /* ignore */ }
  }
  for (const e of orphanEnts) {
    try { await withRetry(() => remove('TrackedEntity', e.id)); cleanedE += 1; await sleep(60); } catch { /* ignore */ }
  }
  if (cleanedC || cleanedE) log(`  eski kayıtlar temizlendi: ${cleanedC} lig, ${cleanedE} takım. ✓`);

  const compByRef = new Map();
  for (const c of allComps) if (c.external_ref) compByRef.set(c.external_ref, c);

  const entByRef = new Map();
  for (const e of allEnts)  if (e.external_ref) entByRef.set(e.external_ref, e);

  const wantComps = new Map();
  const wantEnts  = new Map();

  for (const [ref, name, slug] of STATIC_COMPETITIONS) {
    wantComps.set(ref, { name, category_slug: slug });
  }

  for (const seed of collected) {
    if (seed._competition_ref && !wantComps.has(seed._competition_ref)) {
      wantComps.set(seed._competition_ref, {
        name: seed._competition_name || seed.competition_name,
        category_slug: seed._category_slug,
      });
    }
    for (const side of ['home', 'away']) {
      const ref  = seed[`_${side}_entity_ref`];
      const name = seed[`_${side}_entity_name`];
      if (ref && name && !wantEnts.has(ref)) {
        wantEnts.set(ref, {
          name,
          category_slug: seed._category_slug,
          type: 'team',
          competition_ref: seed._competition_ref || '',
        });
      }
    }
  }

  for (const seed of buildStaticTeamSeeds()) {
    if (!wantEnts.has(seed._entity_ref)) {
      wantEnts.set(seed._entity_ref, {
        name: seed._entity_name,
        category_slug: seed._category_slug,
        type: seed._entity_type || 'team',
        competition_ref: seed._competition_ref,
      });
    }
  }

  let compCreated = 0, compUpdated = 0;
  for (const [ref, spec] of wantComps) {
    const cat = bySlug[spec.category_slug];
    if (!cat) continue;
    const existing = compByRef.get(ref);
    try {
      if (!existing) {
        const created = await withRetry(() => create('Competition', {
          name: spec.name, category_id: cat.id, external_ref: ref,
        }));
        compByRef.set(ref, created);
        compCreated += 1;
      } else if (existing.name !== spec.name) {
        await withRetry(() => update('Competition', existing.id, { name: spec.name }));
        compUpdated += 1;
      } else {
        continue;
      }
      await sleep(80);
    } catch (err) {
      log(`  ! Competition: ${spec.name} (${err?.message || err})`);
    }
  }
  log(`  ${compCreated} yeni + ${compUpdated} güncellendi + ${compByRef.size - compCreated} mevcut lig. ✓`);

  let entCreated = 0, entUpdated = 0, entIdx = 0;
  for (const [ref, spec] of wantEnts) {
    const cat = bySlug[spec.category_slug];
    if (!cat) continue;
    const existing = entByRef.get(ref);
    try {
      if (!existing) {
        const created = await withRetry(() => create('TrackedEntity', {
          name: spec.name,
          category_id: cat.id,
          type: spec.type,
          external_ref: ref,
          competition_ref: spec.competition_ref,
        }));
        entByRef.set(ref, created);
        entCreated += 1;
      } else {
        const patch = {};
        if (spec.competition_ref && existing.competition_ref !== spec.competition_ref) {
          patch.competition_ref = spec.competition_ref;
        }
        if (spec.name && existing.name !== spec.name) {
          patch.name = spec.name;
        }
        if (Object.keys(patch).length === 0) continue;
        await withRetry(() => update('TrackedEntity', existing.id, patch));
        entUpdated += 1;
      }
      entIdx += 1;
      await sleep(80);
      if (entIdx % 20 === 0) await sleep(800);
    } catch (err) {
      log(`  ! Entity: ${spec.name} (${err?.message || err})`);
    }
  }
  log(`  ${entCreated} yeni + ${entUpdated} güncellendi + ${entByRef.size - entCreated} mevcut takım. ✓`);

  log(`→ ${collected.length} Event yazılıyor…`);
  let okCount = 0, evIdx = 0;
  for (const seed of collected) {
    const {
      _category_slug, _source_id,
      _competition_ref, _competition_name,
      _home_entity_ref, _home_entity_name,
      _away_entity_ref, _away_entity_name,
      ...rest
    } = seed;
    const cat = bySlug[_category_slug];
    if (!cat) {
      log(`  ! kategori yok (${_category_slug}): ${seed.title}`);
      continue;
    }
    const payload = {
      ...rest,
      category_id: cat.id,
      external_ref: _source_id,
    };
    if (_competition_ref) {
      payload.competition_ref = _competition_ref;
      const c = compByRef.get(_competition_ref);
      if (c?.id) payload.competition_id = c.id;
    }
    if (_home_entity_ref) payload.home_entity_ref = _home_entity_ref;
    if (_away_entity_ref) payload.away_entity_ref = _away_entity_ref;

    try {
      await withRetry(() => create('Event', payload));
      okCount += 1;
      evIdx += 1;
      await sleep(80);
      if (evIdx % 20 === 0) await sleep(800);
    } catch (err) {
      log(`  ! yazılamadı: ${seed.title} (${err?.message || err})`);
    }
  }
  log(`  ${okCount}/${collected.length} Event yazıldı. ✓`);
  log('✓ Bitti.');
}

main().catch((err) => {
  console.error('❌ Sync failed:', err?.stack || err);
  process.exit(1);
});
