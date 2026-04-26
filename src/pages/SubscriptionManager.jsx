import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { getCategoryColorClass } from '@/lib/categoryUtils';
import BottomTabBar from '@/components/common/BottomTabBar';
import CategorySheet from '@/components/subscription/CategorySheet';
import TeamSheet from '@/components/subscription/TeamSheet';

/**
 * Single source of truth for subscription editing — used by:
 *   - first-run onboarding (mode='onboarding'), CTA = "Devam et"
 *   - Keşfet tab (mode='manage'), CTA = "Kaydet" (only enabled when dirty)
 *
 * Layout:
 *   - Header (greeting / explainer)
 *   - 8 category tiles in a 2-col grid. Each shows a live subtitle:
 *     "henüz seçim yok" / "tümü" / "X lig" / "X lig, Y takım" depending
 *     on what's checked underneath.
 *   - Tap a category → CategorySheet (bottom sheet) opens with leagues
 *     in that category. User can "tümünü seç" or pick individually.
 *   - Each checked league has a "sadece belirli takımlar →" link →
 *     TeamSheet opens on top.
 *   - Sticky CTA at bottom.
 *
 * State model: a single `selection` object
 *   {
 *     compIdsByCat: { [catId]: Set<compId> },
 *     entityIdsByComp: { [compId]: Set<entId> },  // empty = follow whole comp
 *     wholeCategory: Set<catId>  // true = the user wants every league/team in this cat
 *   }
 *
 * On save we translate this into UserSubscription rows at the most
 * specific level the user expressed. Diff against existing subs so we
 * only DELETE rows that vanished and CREATE rows that appeared — no
 * blanket wipe.
 */
export default function SubscriptionManager({ mode = 'onboarding' }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [savingState, setSavingState] = useState('idle'); // idle | saving | saved
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeCompetitionForTeams, setActiveCompetitionForTeams] = useState(null);
  // Mutex: only one persist() at a time. Without this, rapid toggles
  // produce overlapping persist runs that race each other on Base44 — a
  // late-finishing earlier run can re-delete a sub the newer run just
  // created. Observed 2026-04-26: home would flash matches then lose
  // them as the older persist completed.
  const persistInFlightRef = useRef(null);
  // Marker so the in-flight persist knows it should re-run with fresh
  // state once it finishes (instead of dropping the latest change).
  const persistDirtyRef = useRef(false);
  // Hold the latest selection in a ref so persist() always reads the
  // newest state, even if a stale React closure scheduled it.
  const selectionRef = useRef(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });
  const { data: competitions = [], isLoading: compsLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => base44.entities.Competition.list(),
  });
  const { data: entities = [], isLoading: entsLoading } = useQuery({
    queryKey: ['entities'],
    queryFn: () => base44.entities.TrackedEntity.list(),
  });
  const { data: existingSubs = [], isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.UserSubscription.list(),
  });

  const compsByCat = useMemo(() => {
    const m = {};
    for (const c of competitions) {
      if (!c.category_id) continue;
      (m[c.category_id] ||= []).push(c);
    }
    // Stable display order: Turkish-locale by name
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
    }
    return m;
  }, [competitions]);

  const teamsByComp = useMemo(() => {
    const m = {};
    for (const e of entities) {
      if (e.type !== 'team' && e.type !== 'player') continue;
      const ref = e.competition_ref;
      if (!ref) continue;
      (m[ref] ||= []).push(e);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
    }
    return m;
  }, [entities]);

  // Hydrate `selection` from existing subscriptions on first load.
  // orphanSubs holds entity subs whose entity has no resolvable parent
  // competition (entity row missing or has no competition_ref). We
  // preserve them as-is across save so legacy data isn't quietly wiped.
  const [selection, setSelection] = useState({
    wholeCategory: new Set(),
    compIdsByCat: {},
    entityIdsByComp: {},
    orphanSubs: new Set(), // raw "type:id" keys we couldn't bucket but must keep
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (subsLoading || compsLoading || entsLoading || catsLoading) return;

    const wholeCategory = new Set();
    const compIdsByCat = {};
    const entityIdsByComp = {};
    const orphanSubs = new Set();

    const compById = Object.fromEntries(competitions.map((c) => [c.id, c]));
    const entById = Object.fromEntries(entities.map((e) => [e.id, e]));

    for (const sub of existingSubs) {
      if (!sub.target_id) continue;
      const key = `${sub.target_type}:${sub.target_id}`;
      if (sub.target_type === 'category') {
        wholeCategory.add(sub.target_id);
      } else if (sub.target_type === 'competition') {
        const c = compById[sub.target_id];
        if (c) {
          (compIdsByCat[c.category_id] ||= new Set()).add(c.id);
        } else {
          // Competition row no longer exists in our cache (deleted or
          // not yet loaded). Keep the sub as orphan so it isn't wiped.
          orphanSubs.add(key);
        }
      } else if (sub.target_type === 'entity') {
        const e = entById[sub.target_id];
        if (!e) {
          orphanSubs.add(key);
          continue;
        }
        if (e.competition_ref) {
          const comp = competitions.find((c) => c.external_ref === e.competition_ref);
          if (comp) {
            (compIdsByCat[comp.category_id] ||= new Set()).add(comp.id);
            (entityIdsByComp[comp.id] ||= new Set()).add(e.id);
          } else {
            // Entity has competition_ref but no Competition row matches.
            // Preserve as orphan so legacy data survives.
            orphanSubs.add(key);
          }
        } else {
          // Entity exists but has no competition_ref (predates schema).
          // Preserve as orphan rather than silently dropping the sub.
          orphanSubs.add(key);
        }
      } else {
        // Unknown target_type — preserve.
        orphanSubs.add(key);
      }
    }

    setSelection({ wholeCategory, compIdsByCat, entityIdsByComp, orphanSubs });
    setHydrated(true);
  }, [hydrated, subsLoading, compsLoading, entsLoading, catsLoading, existingSubs, competitions, entities]);

  // --- helpers used by the category tile subtitle ---
  function summary(catId) {
    if (selection.wholeCategory.has(catId)) return 'tümü';
    const compIds = selection.compIdsByCat[catId];
    if (!compIds || compIds.size === 0) return 'henüz seçim yok';
    let teamCount = 0;
    let narrowedComps = 0;
    for (const cid of compIds) {
      const t = selection.entityIdsByComp[cid];
      if (t && t.size > 0) {
        teamCount += t.size;
        narrowedComps += 1;
      }
    }
    if (narrowedComps === 0) {
      return `${compIds.size} lig`;
    }
    return `${compIds.size} lig, ${teamCount} takım`;
  }

  function isCategoryActive(catId) {
    if (selection.wholeCategory.has(catId)) return true;
    const cs = selection.compIdsByCat[catId];
    return Boolean(cs && cs.size > 0);
  }

  // Build the desired UserSubscription rows from the in-memory selection.
  function buildDesired(sel) {
    const desired = new Set();
    for (const catId of sel.wholeCategory) {
      desired.add(`category:${catId}`);
    }
    for (const [catId, compIds] of Object.entries(sel.compIdsByCat)) {
      if (sel.wholeCategory.has(catId)) continue;
      for (const compId of compIds) {
        const teamIds = sel.entityIdsByComp[compId];
        if (teamIds && teamIds.size > 0) {
          for (const tid of teamIds) desired.add(`entity:${tid}`);
        } else {
          desired.add(`competition:${compId}`);
        }
      }
    }
    // Carry orphan subs verbatim so save doesn't silently delete subs
    // we couldn't categorize at hydration time.
    if (sel.orphanSubs) {
      for (const k of sel.orphanSubs) desired.add(k);
    }
    return desired;
  }

  // Keep selectionRef synced so a long-running persist() always sees
  // the latest state when it re-loops.
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  // Internal: do one diff+apply pass against the current selectionRef.
  async function _doOnePersistPass() {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const desired = buildDesired(selectionRef.current);

    let current;
    try {
      current = await base44.entities.UserSubscription.list();
    } catch {
      current = existingSubs;
    }
    const existing = new Map();
    for (const s of current) existing.set(`${s.target_type}:${s.target_id}`, s);

    const toCreate = [];
    const toDelete = [];
    for (const key of desired) {
      if (!existing.has(key)) {
        const [type, id] = key.split(':');
        toCreate.push({ target_type: type, target_id: id, preset: 'all' });
      }
    }
    for (const [key, sub] of existing) {
      if (!desired.has(key)) toDelete.push(sub);
    }
    if (toCreate.length === 0 && toDelete.length === 0) return { created: 0, deleted: 0 };

    for (const s of toDelete) {
      try {
        await base44.entities.UserSubscription.delete(s.id);
        await sleep(60);
      } catch { /* ignore */ }
    }
    for (const sub of toCreate) {
      try {
        await base44.entities.UserSubscription.create(sub);
        await sleep(80);
      } catch { /* ignore */ }
    }
    qc.invalidateQueries({ queryKey: ['subscriptions'] });
    return { created: toCreate.length, deleted: toDelete.length };
  }

  // Public persist() — serialised. If a persist is in flight, mark
  // dirty and wait; the in-flight pass will re-run for us. This
  // collapses bursts of changes into at most two passes (one in
  // flight, one queued).
  async function persist() {
    if (persistInFlightRef.current) {
      persistDirtyRef.current = true;
      return persistInFlightRef.current;
    }
    persistInFlightRef.current = (async () => {
      let totalCreated = 0;
      let totalDeleted = 0;
      do {
        persistDirtyRef.current = false;
        try {
          const r = await _doOnePersistPass();
          totalCreated += r.created;
          totalDeleted += r.deleted;
        } catch { /* swallow; next change will retry */ }
      } while (persistDirtyRef.current);
      persistInFlightRef.current = null;
      return { created: totalCreated, deleted: totalDeleted };
    })();
    return persistInFlightRef.current;
  }

  // Onboarding mode: save + navigate to home (one-shot).
  async function finishOnboarding() {
    setBusy(true);
    try {
      await persist();
      navigate('/');
    } finally {
      setBusy(false);
    }
  }

  // Mark dirty when selection changes (after hydration). Manual save
  // primitive — no debounce, no auto-save (auto-save wiped subs).
  // To remove ambiguity ("did my toggle take?") we ALSO show the
  // Kaydet button whenever the user has at least one item selected,
  // even if it matches the hydrated baseline. Worst case the button
  // does a no-op save and shows "değişiklik yok" toast — better than
  // a silent UI where the user can't tell.
  const [isDirty, setIsDirty] = useState(false);
  const initialSelectionRef = useRef(null);
  useEffect(() => {
    if (!hydrated) return;
    if (initialSelectionRef.current === null) {
      initialSelectionRef.current = selection;
      return;
    }
    setIsDirty(true);
  }, [selection, hydrated]);

  async function manualSave() {
    setBusy(true);
    setSavingState('saving');
    try {
      const result = await persist();
      setSavingState('saved');
      setIsDirty(false);
      // Refresh the baseline so subsequent edits start fresh.
      initialSelectionRef.current = selection;
      if (result.created || result.deleted) {
        toast({
          title: 'kaydedildi',
          description: `+${result.created} eklendi, ${result.deleted} kaldırıldı`,
        });
      } else {
        toast({ title: 'değişiklik yok' });
      }
      setTimeout(() => setSavingState('idle'), 1800);
    } catch (err) {
      setSavingState('idle');
      toast({
        title: 'kaydedilemedi',
        description: String(err?.message || err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  if (catsLoading || compsLoading || entsLoading || subsLoading || !hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCompetitions = activeCategory
    ? (compsByCat[activeCategory.id] || [])
    : [];

  // For the team sheet, look up teams by competition.external_ref since
  // that's how dataSources stamps them.
  const activeTeams = activeCompetitionForTeams
    ? (teamsByComp[activeCompetitionForTeams.external_ref] || [])
    : [];

  // Selection inside the open category sheet. If the user has a
  // category-level subscription ('wholeCategory'), present that as
  // every league checked so the sheet's "tümünü seç" toggle reads as
  // active and matches the tile's "tümü" subtitle.
  let catSelection = { compIds: new Set(), entityIdsByComp: {} };
  if (activeCategory) {
    if (selection.wholeCategory.has(activeCategory.id)) {
      catSelection = {
        compIds: new Set(activeCompetitions.map((c) => c.id)),
        entityIdsByComp: selection.entityIdsByComp,
      };
    } else {
      catSelection = {
        compIds: selection.compIdsByCat[activeCategory.id] || new Set(),
        entityIdsByComp: selection.entityIdsByComp,
      };
    }
  }

  function updateCategorySelection(next) {
    setSelection((prev) => {
      const wholeCategory = new Set(prev.wholeCategory);
      // Touching a competition individually means the user wants the
      // per-league granularity, not the blanket-category sub. Drop the
      // wholeCategory entry if present.
      wholeCategory.delete(activeCategory.id);
      const compIdsByCat = { ...prev.compIdsByCat };
      compIdsByCat[activeCategory.id] = next.compIds;
      return {
        ...prev,
        wholeCategory,
        compIdsByCat,
        entityIdsByComp: next.entityIdsByComp,
      };
    });
  }

  function updateTeamSelection(nextSet) {
    setSelection((prev) => {
      const entityIdsByComp = { ...prev.entityIdsByComp };
      if (nextSet.size === 0) {
        delete entityIdsByComp[activeCompetitionForTeams.id];
      } else {
        entityIdsByComp[activeCompetitionForTeams.id] = nextSet;
      }
      return { ...prev, entityIdsByComp };
    });
  }

  const isOnboarding = mode === 'onboarding';
  const hasAny =
    selection.wholeCategory.size > 0 ||
    Object.values(selection.compIdsByCat).some((s) => s.size > 0);

  // Bottom padding: in manage mode we sit above the BottomTabBar
  // (h-16 = 64px) PLUS the sticky save button (~80px). Onboarding has
  // no tab bar, so just the save button worth of clearance.
  const bottomPadClass = isOnboarding ? 'pb-32' : 'pb-44';

  return (
    <div className={`min-h-screen bg-background ${bottomPadClass}`}>
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-display font-bold text-foreground leading-tight">
          {isOnboarding ? 'neleri takip ediyorsun?' : 'takip ettiklerin'}
        </h1>
        <p className="text-body text-muted-foreground mt-2">
          {isOnboarding
            ? 'kategoriye dokun → ligleri seç → istersen takım daralt.'
            : 'kategoriye dokunup düzenle. değişiklik yaparsan kaydet.'}
        </p>
      </div>

      <div className="px-5 grid grid-cols-2 gap-3">
        {categories
          // Hide categories that have nothing to subscribe to (no
          // competitions in the DB). 'turnuva' is the prime example —
          // it was a placeholder we never populated. Keeping it in the
          // grid would just confuse users with an empty sheet.
          .filter((cat) => (compsByCat[cat.id] || []).length > 0)
          .map((cat) => (
            <CategoryTile
              key={cat.id}
              category={cat}
              active={isCategoryActive(cat.id)}
              subtitle={summary(cat.id)}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
      </div>

      {/* Sticky save CTA. Manage mode sits ABOVE the BottomTabBar
          (which is fixed bottom: 0 + safe-area). Onboarding sits at
          the actual bottom because there's no tab bar.
          - z-40 keeps the CTA below the bottom-sheet scrim (z-50) so
            opening a sheet visually covers it instead of layering on.
          - bottom: env() respects iPhone home-indicator. Manage mode
            offsets by tab-bar height (64px) on top of that. */}
      <div
        className="fixed left-0 right-0 z-40 px-5 pt-3 pb-3 bg-gradient-to-t from-background via-background to-transparent"
        style={{
          bottom: isOnboarding
            ? 'env(safe-area-inset-bottom, 0px)'
            : 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <button
          onClick={isOnboarding ? finishOnboarding : manualSave}
          disabled={busy || (isOnboarding && !hasAny)}
          className={`w-full py-4 rounded-full text-body font-semibold flex items-center justify-center gap-2 press-scale transition-all shadow-lg ${
            busy || (isOnboarding && !hasAny)
              ? 'bg-muted text-muted-foreground'
              : isDirty || isOnboarding
                ? 'bg-foreground text-background'
                : 'bg-foreground/70 text-background'
          }`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            isOnboarding ? null : <Save className="w-4 h-4" />
          )}
          {isOnboarding
            ? 'devam et'
            : isDirty
              ? 'kaydet'
              : 'kaydedildi ✓'}
        </button>
      </div>

      {/* Manage mode also shows a transient saved-pill at the top so
          the user gets feedback that the explicit save succeeded. */}
      {!isOnboarding && savingState === 'saved' ? (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-foreground text-background text-caption font-medium flex items-center gap-1.5 shadow-md">
          <Save className="w-3.5 h-3.5" />
          kaydedildi
        </div>
      ) : null}

      {/* Category sheet (level 2) */}
      <CategorySheet
        open={Boolean(activeCategory) && !activeCompetitionForTeams}
        onClose={() => setActiveCategory(null)}
        category={activeCategory}
        competitions={activeCompetitions}
        selection={catSelection}
        totalSubscribed={catSelection.compIds.size}
        onChange={updateCategorySelection}
        onOpenTeams={(comp) => setActiveCompetitionForTeams(comp)}
      />

      {/* Team sheet (level 3, sits on top) */}
      <TeamSheet
        open={Boolean(activeCompetitionForTeams)}
        onClose={() => {
          setActiveCompetitionForTeams(null);
          setActiveCategory(null);
        }}
        onBack={() => setActiveCompetitionForTeams(null)}
        competition={activeCompetitionForTeams}
        teams={activeTeams}
        selectedTeamIds={
          activeCompetitionForTeams
            ? (selection.entityIdsByComp[activeCompetitionForTeams.id] || new Set())
            : new Set()
        }
        onChange={updateTeamSelection}
      />

      {!isOnboarding ? <BottomTabBar /> : null}
    </div>
  );
}

function CategoryTile({ category, active, subtitle, onClick }) {
  const colorClass = getCategoryColorClass(category);
  return (
    <button
      onClick={onClick}
      className={`relative w-full p-4 rounded-xl border text-left transition-all press-scale ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}
    >
      {active ? (
        <div className="absolute top-3 right-3">
          <Check className="w-5 h-5 text-primary" />
        </div>
      ) : null}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 bg-${colorClass}/15`}
      >
        {category.emoji}
      </div>
      <h3 className="text-body font-semibold text-foreground">{category.name}</h3>
      <p className="text-caption text-muted-foreground mt-0.5 line-clamp-1">
        {subtitle}
      </p>
    </button>
  );
}
