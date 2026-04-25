import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  fetchUpcomingFootballMatches,
  fetchUpcomingF1Sessions,
  buildTvEvents,
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
      for (const ev of toDelete) {
        try {
          await base44.entities.Event.delete(ev.id);
        } catch (err) {
          append(`  ! silinemedi: ${ev.title || ev.id} (${err?.message || err})`);
        }
      }
      append(`  ${toDelete.length} kayıt silindi. ✓`);

      append(`→ ${collected.length} Event yazılıyor…`);
      let okCount = 0;
      for (const seed of collected) {
        const { _category_slug, _source_id, ...rest } = seed;
        const cat = bySlug[_category_slug];
        if (!cat) {
          append(`  ! kategori yok (${_category_slug}): ${seed.title}`);
          continue;
        }
        try {
          await base44.entities.Event.create({
            ...rest,
            category_id: cat.id,
            external_ref: _source_id,
          });
          okCount += 1;
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
        <h1 className="text-title-lg font-bold text-foreground">Seed Runner</h1>
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
