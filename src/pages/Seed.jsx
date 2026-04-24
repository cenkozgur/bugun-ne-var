import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Dev-only seed runner.
 * Visiting /seed lets you wipe stale Event rows and re-create a realistic
 * slate of 5 events (3 today, 2 tomorrow) so the app doesn't look empty.
 *
 * Not linked from the UI. Bookmark /seed and re-run whenever seed data
 * is out of date. Future: replace this with a Base44 Automation pointing
 * at api-football once Base44 exposes backend functions on this plan.
 */
export default function Seed() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);

  const append = (line) => setLog((prev) => [...prev, line]);

  function atHour(date, hour, minute = 0) {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  const run = async ({ wipeFirst = true } = {}) => {
    setStatus('running');
    setLog([]);
    setError(null);

    try {
      append('→ Kategoriler getiriliyor…');
      const categories = await base44.entities.Category.list();
      const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

      const needed = ['futbol', 'f1', 'tv'];
      const missing = needed.filter((s) => !bySlug[s]);
      if (missing.length) {
        throw new Error(
          `Kategoriler eksik: ${missing.join(', ')}. Önce Data sekmesinde Category tablosuna ekle.`
        );
      }
      append(`  ${categories.length} kategori var. ✓`);

      if (wipeFirst) {
        append('→ Eski Event kayıtları temizleniyor…');
        const all = await base44.entities.Event.list();
        const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 gün öncesi
        const toDelete = all.filter((e) => {
          const t = new Date(e.start_time).getTime();
          return Number.isFinite(t) && t < cutoff;
        });
        // Also remove future events we're about to re-seed (avoid duplicates).
        // Heuristic: drop anything with start_time in the next 48h so our seeds are fresh.
        const upperCutoff = Date.now() + 48 * 60 * 60 * 1000;
        const toDeleteFuture = all.filter((e) => {
          const t = new Date(e.start_time).getTime();
          return Number.isFinite(t) && t >= cutoff && t <= upperCutoff;
        });
        const combined = [...toDelete, ...toDeleteFuture];
        for (const ev of combined) {
          try {
            await base44.entities.Event.delete(ev.id);
          } catch (err) {
            append(`  ! silinemedi: ${ev.title || ev.id} (${err?.message || err})`);
          }
        }
        append(`  ${combined.length} eski/önceden-seed-edilmiş Event silindi. ✓`);
      }

      const today = new Date();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const seeds = [
        {
          title: 'F1 Miami GP — Antrenman 2',
          competition_name: 'Formula 1 2026 — Miami GP',
          category_id: bySlug.f1.id,
          start_time: atHour(today, 18, 30),
          broadcaster: 'S Sport 2',
          venue: 'Miami International Autodrome',
          is_live: false,
        },
        {
          title: 'Fenerbahçe – Galatasaray',
          competition_name: 'Süper Lig — Hafta 34',
          category_id: bySlug.futbol.id,
          start_time: atHour(today, 20, 45),
          broadcaster: 'beIN Sports 1',
          venue: 'Ülker Stadyumu',
          is_live: false,
        },
        {
          title: 'Survivor All Star — Final',
          competition_name: 'Survivor All Star 2026',
          category_id: bySlug.tv.id,
          start_time: atHour(today, 22, 0),
          broadcaster: 'TV8',
          is_live: false,
        },
        {
          title: 'Miami Grand Prix — Yarış',
          competition_name: 'Formula 1 2026 — Miami GP',
          category_id: bySlug.f1.id,
          start_time: atHour(tomorrow, 22, 0),
          broadcaster: 'S Sport',
          venue: 'Miami International Autodrome',
          is_live: false,
        },
        {
          title: 'Trabzonspor – Beşiktaş',
          competition_name: 'Süper Lig — Hafta 34',
          category_id: bySlug.futbol.id,
          start_time: atHour(tomorrow, 19, 0),
          broadcaster: 'beIN Sports 1',
          venue: 'Papara Park',
          is_live: false,
        },
      ];

      append(`→ ${seeds.length} yeni Event oluşturuluyor…`);
      for (const seed of seeds) {
        try {
          await base44.entities.Event.create(seed);
          append(`  + ${seed.title}`);
        } catch (err) {
          append(`  ! oluşturulamadı: ${seed.title} (${err?.message || err})`);
        }
      }

      append('✓ Tamamlandı. Ana sayfaya dönebilirsin.');
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
          Sample event verisini günceller. Eski Event'leri siler, bugün ve yarın için 5 demo maç/etkinlik ekler.
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => run({ wipeFirst: true })}
            disabled={status === 'running'}
            className="flex-1 py-3 rounded-xl bg-foreground text-background text-body font-semibold flex items-center justify-center gap-2 press-scale disabled:opacity-60"
          >
            {status === 'running' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {status === 'running' ? 'çalışıyor…' : 'sil & yeniden seed et'}
          </button>
        </div>

        <button
          onClick={() => run({ wipeFirst: false })}
          disabled={status === 'running'}
          className="w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-caption font-medium press-scale disabled:opacity-60"
        >
          silmeden ekle
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
          <div className="bg-secondary/50 rounded-lg p-3 font-mono text-micro text-foreground space-y-1 max-h-80 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        <p className="text-micro text-muted-foreground pt-4">
          Not: bu sayfa UI'dan link'li değil. Sadece <code>/seed</code> URL'iyle açılır.
          Yarın yine aç, yeni event'ler gelsin.
        </p>
      </div>
    </div>
  );
}
