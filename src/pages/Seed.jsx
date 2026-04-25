import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  fetchUpcomingFootballMatches,
  fetchUpcomingF1Sessions,
  buildTvEvents,
  buildStaticTeamSeeds,
} from '@/lib/dataSources';

/**
 * Seed runner. Call /seed manually each morning until we wire either a
 * Base44 Automation or a Banko Kupon → Base44 cron.
 *
 * Pulls real fixtures from:
 *   - football-predictor backend (Big-5 + Eredivisie + Primeira Liga +
 *     Championship — same data api-football Pro feeds nightly)
 *   - Jolpica F1 API (next race weekend, all sessions)
 *   - hand-curated TV events list (no usable Turkish EPG API)
 *
 * Dedupes across runs via Event.external_ref so re-running doesn't bloat
 * the table. Old Events (>2 days past) are pruned.
 */
// Base44's API rate-limits bursts of writes. Without throttling, a 60+
// event seed run gets ~30 written then stalls with "Rate limit exceeded"
// for the rest. Sleep briefly between calls + retry once on 429.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, { retries = 3, baseDelay = 1500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message || err);
      const isRateLimit =
        msg.toLowerCase().includes('rate limit') ||
        msg.includes('429') ||
        err?.status === 429;
      if (!isRateLimit || attempt === retries) throw err;
      // Exponential backoff: 1.5s, 3s, 6s
      await sleep(baseDelay * 2 ** attempt);
    }
  }
}

export default function Seed() {
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);

  const append = (line) => setLog((prev) => [...prev, line]);

  const run = async () => {
    setStatus('running');
    setLog([]);
    setError(null);

    try {
      append('→ Kategoriler getiriliyor…');
      const categories = await base44.entities.Category.list();
      const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
      const required = ['futbol', 'f1', 'tv'];
      const missing = required.filter((s) => !bySlug[s]);
      if (missing.length) {
        throw new Error(
          `Kategoriler eksik (${missing.join(', ')}). Base44 Data → Category tablosuna ekle.`
        );
      }
      append(`  ${categories.length} kategori. ✓`);

      append('→ Veri kaynakları sorgulanıyor…');
      const today = new Date();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const [football, f1, tv] = await Promise.allSettled([
        fetchUpcomingFootballMatches({ daysAhead: 2 }),
        fetchUpcomingF1Sessions({ daysAhead: 7 }),
        Promise.resolve(buildTvEvents({ today, tomorrow })),
      ]);

      const collected = [];
      if (football.status === 'fulfilled') {
        append(`  ⚽ ${football.value.length} futbol`);
        collected.push(...football.value);
      } else {
        append(`  ! futbol kaynağı: ${football.reason?.message || football.reason}`);
      }
      if (f1.status === 'fulfilled') {
        append(`  🏎 ${f1.value.length} F1 oturumu`);
        collected.push(...f1.value);
      } else {
        append(`  ! F1 kaynağı: ${f1.reason?.message || f1.reason}`);
      }
      if (tv.status === 'fulfilled') {
        append(`  📺 ${tv.value.length} TV etkinliği`);
        collected.push(...tv.value);
      }

      if (collected.length === 0) {
        throw new Error('Hiçbir kaynaktan veri çekilemedi.');
      }

      append('→ Eski / üzerine yazılacak Event temizleniyor…');
      const all = await base44.entities.Event.list();
      const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const upcomingWindow = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const incomingRefs = new Set(collected.map((e) => e._source_id));
      const toDelete = all.filter((e) => {
        const t = new Date(e.start_time).getTime();
        if (!Number.isFinite(t)) return false;
        const isStale = t < cutoff;
        const isOverwriting = e.external_ref && incomingRefs.has(e.external_ref);
        // Legacy demo rows had no external_ref. Within the upcoming window,
        // wipe them so the new real-data rows take their place — otherwise
        // the user sees both the demo Fenerbahçe-Galatasaray and a real one.
        const isLegacyDemo =
          !e.external_ref && t >= cutoff && t <= upcomingWindow;
        return isStale || isOverwriting || isLegacyDemo;
      });
      let delIdx = 0;
      for (const ev of toDelete) {
        try {
          await withRetry(() => base44.entities.Event.delete(ev.id));
          delIdx += 1;
          await sleep(60);
          if (delIdx % 25 === 0) await sleep(800);
        } catch (err) {
          append(`  ! silinemedi: ${ev.title || ev.id} (${err?.message || err})`);
        }
      }
      append(`  ${toDelete.length} kayıt silindi. ✓`);

      // Build the unique set of competitions + entities seen across all
      // collected events, then upsert them. We dedupe by external_ref so
      // re-runs don't create duplicates. Once persisted, we map ref→id so
      // the Event rows we write can store actual ids (kept for future
      // queries) while still carrying *_ref strings for fast filtering.
      append('→ Lig ve takım kayıtları hazırlanıyor…');

      // Cleanup: legacy duplicates from earlier seed runs that predate
      // external_ref. Anything in Competition / TrackedEntity without
      // external_ref is residue — wipe so the dropdown isn't full of
      // copies. We can only do this safely because every "real" row from
      // the new seed code has external_ref by construction.
      const allComps = await base44.entities.Competition.list();
      const allEnts = await base44.entities.TrackedEntity.list();

      const orphanComps = allComps.filter((c) => !c.external_ref);
      const orphanEnts = allEnts.filter((e) => !e.external_ref);
      let cleanedC = 0, cleanedE = 0;
      for (const c of orphanComps) {
        try {
          await withRetry(() => base44.entities.Competition.delete(c.id));
          cleanedC += 1;
          await sleep(60);
        } catch { /* ignore */ }
      }
      for (const e of orphanEnts) {
        try {
          await withRetry(() => base44.entities.TrackedEntity.delete(e.id));
          cleanedE += 1;
          await sleep(60);
        } catch { /* ignore */ }
      }
      if (cleanedC || cleanedE) {
        append(`  eski kayıtlar temizlendi: ${cleanedC} lig, ${cleanedE} takım. ✓`);
      }

      const compByRef = new Map();
      for (const c of allComps) {
        if (c.external_ref) compByRef.set(c.external_ref, c);
      }

      const entByRef = new Map();
      for (const e of allEnts) {
        if (e.external_ref) entByRef.set(e.external_ref, e);
      }

      const wantComps = new Map(); // ref → { name, category_slug }
      const wantEnts = new Map();  // ref → { name, category_slug, type, competition_ref }
      for (const seed of collected) {
        if (seed._competition_ref && !wantComps.has(seed._competition_ref)) {
          wantComps.set(seed._competition_ref, {
            name: seed._competition_name || seed.competition_name,
            category_slug: seed._category_slug,
          });
        }
        for (const side of ['home', 'away']) {
          const ref = seed[`_${side}_entity_ref`];
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

      // Layer in static team rosters (e.g. all 18 Süper Lig clubs even
      // when only 8 are scheduled this week). Doesn't override fixture-
      // sourced entries because the for-loop above already filled them.
      for (const seed of buildStaticTeamSeeds()) {
        if (!wantEnts.has(seed._entity_ref)) {
          wantEnts.set(seed._entity_ref, {
            name: seed._entity_name,
            category_slug: seed._category_slug,
            type: 'team',
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
            const created = await withRetry(() =>
              base44.entities.Competition.create({
                name: spec.name,
                category_id: cat.id,
                external_ref: ref,
              })
            );
            compByRef.set(ref, created);
            compCreated += 1;
          } else if (existing.name !== spec.name) {
            // The label format may have evolved (e.g. flag emoji prefix
            // added). Patch the existing row so the dropdown picks up
            // the new label without forcing the user to re-onboard.
            await withRetry(() =>
              base44.entities.Competition.update(existing.id, { name: spec.name })
            );
            compUpdated += 1;
          } else {
            continue;
          }
          await sleep(80);
        } catch (err) {
          append(`  ! Competition: ${spec.name} (${err?.message || err})`);
        }
      }
      append(`  ${compCreated} yeni + ${compUpdated} güncellendi + ${compByRef.size - compCreated} mevcut lig. ✓`);

      let entCreated = 0;
      let entUpdated = 0;
      let entIdx = 0;
      for (const [ref, spec] of wantEnts) {
        const cat = bySlug[spec.category_slug];
        if (!cat) continue;
        const existing = entByRef.get(ref);
        try {
          if (!existing) {
            const created = await withRetry(() =>
              base44.entities.TrackedEntity.create({
                name: spec.name,
                category_id: cat.id,
                type: spec.type,
                external_ref: ref,
                competition_ref: spec.competition_ref,
              })
            );
            entByRef.set(ref, created);
            entCreated += 1;
          } else {
            // Build a patch only for the fields that diverge. Covers
            // both the competition_ref backfill and the ASCII→Turkish
            // display rename (Besiktas → Beşiktaş).
            const patch = {};
            if (spec.competition_ref && existing.competition_ref !== spec.competition_ref) {
              patch.competition_ref = spec.competition_ref;
            }
            if (spec.name && existing.name !== spec.name) {
              patch.name = spec.name;
            }
            if (Object.keys(patch).length === 0) continue;
            await withRetry(() =>
              base44.entities.TrackedEntity.update(existing.id, patch)
            );
            entUpdated += 1;
          }
          entIdx += 1;
          await sleep(80);
          if (entIdx % 20 === 0) await sleep(800);
        } catch (err) {
          append(`  ! Entity: ${spec.name} (${err?.message || err})`);
        }
      }
      append(
        `  ${entCreated} yeni + ${entUpdated} güncellendi + ${entByRef.size - entCreated} mevcut takım. ✓`
      );

      append(`→ ${collected.length} Event yazılıyor…`);
      let okCount = 0;
      let evIdx = 0;
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
          append(`  ! kategori yok (${_category_slug}): ${seed.title}`);
          continue;
        }
        const payload = {
          ...rest,
          category_id: cat.id,
          external_ref: _source_id,
        };
        // Resolve ids (best-effort) + always write the *_ref strings so
        // the subscription filter can match purely on refs without a
        // round-trip through ids.
        if (_competition_ref) {
          payload.competition_ref = _competition_ref;
          const c = compByRef.get(_competition_ref);
          if (c?.id) payload.competition_id = c.id;
        }
        if (_home_entity_ref) payload.home_entity_ref = _home_entity_ref;
        if (_away_entity_ref) payload.away_entity_ref = _away_entity_ref;

        try {
          await withRetry(() => base44.entities.Event.create(payload));
          okCount += 1;
          evIdx += 1;
          await sleep(80);
          if (evIdx % 20 === 0) await sleep(800);
        } catch (err) {
          append(`  ! yazılamadı: ${seed.title} (${err?.message || err})`);
        }
      }
      append(`  ${okCount}/${collected.length} Event yazıldı. ✓`);
      append('✓ Bitti.');
      setStatus('done');
    } catch (err) {
      console.error(err);
      setError(err?.message || String(err));
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4 mt-8">
        <h1 className="text-title-lg font-bold text-foreground">Veri Senkronu — v2 🚦</h1>
        <p className="text-body text-muted-foreground">
          Gerçek veriyi çeker: futbol fikstürlerini football-predictor backend'inden,
          F1 oturumlarını Jolpica API'sinden, TV etkinliklerini elle hazırlanmış listeden.
          Tekrar çalıştırırsan duplicate olmaz (external_ref ile dedup).
        </p>

        <button
          onClick={run}
          disabled={status === 'running'}
          className="w-full py-3 rounded-xl bg-foreground text-background text-body font-semibold flex items-center justify-center gap-2 press-scale disabled:opacity-60"
        >
          {status === 'running' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {status === 'running' ? 'çalışıyor…' : 'gerçek veriyi çek'}
        </button>

        {status === 'done' && (
          <div className="flex items-center gap-2 text-primary text-caption">
            <CheckCircle2 className="w-4 h-4" />
            bitti
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2 text-destructive text-caption bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {log.length > 0 && (
          <div className="bg-secondary/50 rounded-lg p-3 font-mono text-micro text-foreground space-y-1 max-h-96 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        <p className="text-micro text-muted-foreground pt-4">
          Bu sayfa UI'dan link'li değil — sadece <code>/seed</code> URL'iyle açılır.
          Hedef: Banko Kupon backend'ine cron koyup bunu otomatik tetiklemek.
        </p>
      </div>
    </div>
  );
}
