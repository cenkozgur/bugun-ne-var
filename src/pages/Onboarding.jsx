import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StepDots from '@/components/onboarding/StepDots';
import CategoryTile from '@/components/onboarding/CategoryTile';
import { ArrowRight, ArrowLeft, Loader2, Check, Search } from 'lucide-react';

/**
 * 3-step onboarding:
 *
 *   1. Pick categories you follow (Futbol, F1, TV…) — required.
 *   2. (Optional) For each picked category that has competitions in the
 *      DB, narrow to specific leagues. Default: all leagues.
 *   3. (Optional) For each picked competition, narrow to specific teams.
 *      Teams are filtered to ONLY the leagues picked in step 2 (via
 *      TrackedEntity.competition_ref) and grouped under league headers.
 *      Default: all teams.
 *
 * Subscriptions are written at the most specific selected level — if the
 * user picks teams in step 3, we write only entity subs (no broader
 * category sub for that category). The subscription filter on Home
 * matches an event if ANY of category, competition, or entity is followed,
 * so a single team sub is enough to surface that team's matches.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set());
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState(new Set());
  const [selectedEntityIds, setSelectedEntityIds] = useState(new Set());

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: competitions = [], isLoading: compsLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => base44.entities.Competition.list(),
    enabled: step >= 2,
  });

  const { data: entities = [], isLoading: entsLoading } = useQuery({
    queryKey: ['entities'],
    queryFn: () => base44.entities.TrackedEntity.list(),
    enabled: step >= 3,
  });

  // Reset search whenever the step changes — stale query strings
  // shouldn't leak across steps.
  React.useEffect(() => {
    setSearch('');
  }, [step]);

  // Step 2: only competitions whose category was picked.
  const visibleCompetitions = useMemo(() => {
    const list = competitions.filter((c) => selectedCategoryIds.has(c.category_id));
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [competitions, selectedCategoryIds, search]);

  // Map competition_ref → competition for fast grouping in step 3.
  const compByRef = useMemo(() => {
    const m = new Map();
    competitions.forEach((c) => {
      if (c.external_ref) m.set(c.external_ref, c);
    });
    return m;
  }, [competitions]);

  // Step 3: teams gated by competition selection.
  // - If user picked specific leagues in step 2 → only teams with
  //   competition_ref in that set.
  // - If user skipped step 2 → teams from ALL competitions in the
  //   selected categories.
  // Then narrowed by search.
  const visibleEntities = useMemo(() => {
    const teams = entities.filter((e) => e.type === 'team');

    let pool;
    if (selectedCompetitionIds.size > 0) {
      const allowedCompRefs = new Set();
      for (const id of selectedCompetitionIds) {
        const comp = competitions.find((c) => c.id === id);
        if (comp?.external_ref) allowedCompRefs.add(comp.external_ref);
      }
      pool = teams.filter((t) => t.competition_ref && allowedCompRefs.has(t.competition_ref));
    } else {
      // No specific league picked — show every team in the user's
      // selected categories (legacy fallback for users who skipped
      // step 2 entirely).
      pool = teams.filter((t) => selectedCategoryIds.has(t.category_id));
    }

    if (!search.trim()) return pool;
    const q = search.trim().toLowerCase();
    return pool.filter((e) => (e.name || '').toLowerCase().includes(q));
  }, [entities, competitions, selectedCompetitionIds, selectedCategoryIds, search]);

  // Group step-3 entities by their parent competition for visual clarity
  // (under each league header: that league's teams).
  const groupedEntities = useMemo(() => {
    const groups = new Map(); // compRef → [team, ...]
    const orphan = [];
    for (const t of visibleEntities) {
      if (t.competition_ref && compByRef.has(t.competition_ref)) {
        const arr = groups.get(t.competition_ref) || [];
        arr.push(t);
        groups.set(t.competition_ref, arr);
      } else {
        orphan.push(t);
      }
    }
    // Stable order: by competition name
    const sortedGroups = Array.from(groups.entries())
      .map(([ref, teams]) => ({
        comp: compByRef.get(ref),
        teams: teams.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
      }))
      .sort((a, b) => (a.comp?.name || '').localeCompare(b.comp?.name || '', 'tr'));
    if (orphan.length) {
      sortedGroups.push({
        comp: { name: 'Diğer' },
        teams: orphan.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
      });
    }
    return sortedGroups;
  }, [visibleEntities, compByRef]);

  const toggle = (set, setter) => (id) => {
    setter(() => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleCategory = toggle(selectedCategoryIds, setSelectedCategoryIds);
  const toggleCompetition = toggle(selectedCompetitionIds, setSelectedCompetitionIds);
  const toggleEntity = toggle(selectedEntityIds, setSelectedEntityIds);

  const finalize = async () => {
    setBusy(true);
    try {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const existing = await base44.entities.UserSubscription.list();
      for (const s of existing) {
        try {
          await base44.entities.UserSubscription.delete(s.id);
          await sleep(60);
        } catch { /* ignore */ }
      }

      const subs = [];
      for (const catId of selectedCategoryIds) {
        const entitiesInCat = visibleEntities
          .filter((e) => e.category_id === catId && selectedEntityIds.has(e.id));
        if (entitiesInCat.length > 0) {
          for (const e of entitiesInCat) {
            subs.push({ target_type: 'entity', target_id: e.id, preset: 'all' });
          }
          continue;
        }
        const compsInCat = competitions
          .filter((c) => c.category_id === catId && selectedCompetitionIds.has(c.id));
        if (compsInCat.length > 0) {
          for (const c of compsInCat) {
            subs.push({ target_type: 'competition', target_id: c.id, preset: 'all' });
          }
          continue;
        }
        subs.push({ target_type: 'category', target_id: catId, preset: 'all' });
      }

      for (const s of subs) {
        try {
          await base44.entities.UserSubscription.create(s);
          await sleep(80);
        } catch { /* ignore — single failure shouldn't block onboarding */ }
      }
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  if (catsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canAdvance =
    (step === 1 && selectedCategoryIds.size > 0) || step === 2 || step === 3;

  // Auto-skip step 2 / 3 if the data set is empty for the current selection.
  const step2Empty = step === 2 && !compsLoading && visibleCompetitions.length === 0 && !search;
  if (step2Empty) setTimeout(() => setStep(3), 0);
  const step3Empty = step === 3 && !entsLoading && visibleEntities.length === 0 && !search;
  if (step3Empty) setTimeout(() => finalize(), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 pt-14 pb-4">
        <StepDots total={3} current={step} />

        {step === 1 && (
          <>
            <h1 className="text-display font-bold text-foreground mt-8 leading-tight">
              neleri takip{'\n'}ediyorsun?
            </h1>
            <p className="text-body text-muted-foreground mt-3">
              sonra istediğin kadar daralt — lig, takım.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-display font-bold text-foreground mt-8 leading-tight">
              hangi ligler?
            </h1>
            <p className="text-body text-muted-foreground mt-3">
              boş bırakırsan hepsini takip ederim.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-display font-bold text-foreground mt-8 leading-tight">
              belirli takımlar mı?
            </h1>
            <p className="text-body text-muted-foreground mt-3">
              boş bırakırsan ligin tüm maçları gelir.
            </p>
          </>
        )}

        {step >= 2 && (
          <div className="relative mt-6">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={step === 2 ? 'lig ara…' : 'takım ara…'}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-foreground text-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-28 overflow-y-auto">
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <CategoryTile
                key={cat.id}
                category={cat}
                selected={selectedCategoryIds.has(cat.id)}
                onToggle={() => toggleCategory(cat.id)}
              />
            ))}
          </div>
        )}

        {step === 2 && (compsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleCompetitions.length === 0 ? (
          <p className="text-body text-muted-foreground text-center py-12">
            {search ? 'eşleşen lig yok' : 'kayıtlı lig yok'}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleCompetitions.map((comp) => {
              const cat = categories.find((c) => c.id === comp.category_id);
              const active = selectedCompetitionIds.has(comp.id);
              return (
                <SelectableRow
                  key={comp.id}
                  prefix={cat?.emoji}
                  label={comp.name}
                  active={active}
                  onClick={() => toggleCompetition(comp.id)}
                />
              );
            })}
          </div>
        ))}

        {step === 3 && (entsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleEntities.length === 0 ? (
          <p className="text-body text-muted-foreground text-center py-12">
            {search ? 'eşleşen takım yok' : 'kayıtlı takım yok'}
          </p>
        ) : (
          <div className="space-y-6">
            {groupedEntities.map((group) => (
              <div key={group.comp?.external_ref || group.comp?.name}>
                <h3 className="text-micro uppercase text-muted-foreground tracking-wider mb-2">
                  {group.comp?.name}
                </h3>
                <div className="space-y-2">
                  {group.teams.map((ent) => {
                    const active = selectedEntityIds.has(ent.id);
                    return (
                      <SelectableRow
                        key={ent.id}
                        label={ent.name}
                        active={active}
                        onClick={() => toggleEntity(ent.id)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-5 py-4 rounded-full bg-secondary text-secondary-foreground press-scale"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={() => canAdvance && setStep(step + 1)}
            disabled={!canAdvance}
            className={`flex-1 py-4 rounded-full text-body font-semibold flex items-center justify-center gap-2 transition-all press-scale ${
              canAdvance ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}
          >
            {step === 1 ? 'devam et' : 'devam'}
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={finalize}
            disabled={busy}
            className="flex-1 py-4 rounded-full bg-foreground text-background text-body font-semibold flex items-center justify-center gap-2 press-scale disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            bitir
          </button>
        )}
      </div>
    </div>
  );
}

function SelectableRow({ prefix, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left press-scale transition-colors ${
        active
          ? 'bg-foreground text-background'
          : 'bg-secondary text-foreground'
      }`}
    >
      {prefix && <span className="text-lg">{prefix}</span>}
      <span className="flex-1 text-body font-medium">{label}</span>
      {active && <Check className="w-4 h-4" />}
    </button>
  );
}
