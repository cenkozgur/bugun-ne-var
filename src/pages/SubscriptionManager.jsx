import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check } from 'lucide-react';
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
  const [busy, setBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeCompetitionForTeams, setActiveCompetitionForTeams] = useState(null);

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
  const [selection, setSelection] = useState({
    wholeCategory: new Set(),
    compIdsByCat: {},
    entityIdsByComp: {},
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (subsLoading || compsLoading || entsLoading || catsLoading) return;

    const wholeCategory = new Set();
    const compIdsByCat = {};
    const entityIdsByComp = {};

    const compById = Object.fromEntries(competitions.map((c) => [c.id, c]));
    const entById = Object.fromEntries(entities.map((e) => [e.id, e]));

    for (const sub of existingSubs) {
      if (!sub.target_id) continue;
      if (sub.target_type === 'category') {
        wholeCategory.add(sub.target_id);
      } else if (sub.target_type === 'competition') {
        const c = compById[sub.target_id];
        if (!c) continue;
        (compIdsByCat[c.category_id] ||= new Set()).add(c.id);
      } else if (sub.target_type === 'entity') {
        const e = entById[sub.target_id];
        if (!e) continue;
        // Each entity sub implies its parent competition is followed,
        // and team-level narrowing is recorded for that comp.
        if (e.competition_ref) {
          // Resolve comp by external_ref to get the comp id
          const comp = competitions.find((c) => c.external_ref === e.competition_ref);
          if (comp) {
            (compIdsByCat[comp.category_id] ||= new Set()).add(comp.id);
            (entityIdsByComp[comp.id] ||= new Set()).add(e.id);
          }
        }
      }
    }

    setSelection({ wholeCategory, compIdsByCat, entityIdsByComp });
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

  // --- save: diff against existing subs, only write what changed ---
  async function save() {
    setBusy(true);
    try {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // Build the desired set of {target_type, target_id} keys.
      const desired = new Set();
      for (const catId of selection.wholeCategory) {
        desired.add(`category:${catId}`);
      }
      for (const [catId, compIds] of Object.entries(selection.compIdsByCat)) {
        if (selection.wholeCategory.has(catId)) continue; // category-level sub covers it
        for (const compId of compIds) {
          const teamIds = selection.entityIdsByComp[compId];
          if (teamIds && teamIds.size > 0) {
            for (const tid of teamIds) {
              desired.add(`entity:${tid}`);
            }
          } else {
            desired.add(`competition:${compId}`);
          }
        }
      }

      const existing = new Map(); // key → sub object
      for (const s of existingSubs) {
        existing.set(`${s.target_type}:${s.target_id}`, s);
      }

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

      // Sequential to dodge Base44 rate limit (proven on big-roster /seed).
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
      navigate('/');
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

  return (
    <div className="min-h-screen bg-background pb-32">
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
        {categories.map((cat) => (
          <CategoryTile
            key={cat.id}
            category={cat}
            active={isCategoryActive(cat.id)}
            subtitle={summary(cat.id)}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={save}
          disabled={busy || (isOnboarding && !hasAny)}
          className={`w-full py-4 rounded-full text-body font-semibold flex items-center justify-center gap-2 press-scale transition-all ${
            busy || (isOnboarding && !hasAny)
              ? 'bg-muted text-muted-foreground'
              : 'bg-foreground text-background'
          }`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isOnboarding ? 'devam et' : 'kaydet'}
        </button>
      </div>

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
