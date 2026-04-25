import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StepDots from '@/components/onboarding/StepDots';
import CategoryTile from '@/components/onboarding/CategoryTile';
import { ArrowRight, ArrowLeft, Loader2, Check } from 'lucide-react';

/**
 * 3-step onboarding:
 *
 *   1. Pick categories you follow (Futbol, F1, TV…) — required.
 *   2. (Optional) For each picked category that has competitions in the
 *      DB, narrow to specific leagues. Default: all leagues.
 *   3. (Optional) For each picked competition, narrow to specific teams.
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

  // Step 1
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set());
  // Step 2 — set of competition ids (per category, but flat is fine for storage)
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState(new Set());
  // Step 3 — set of TrackedEntity ids
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

  // Competitions visible in step 2 — only those whose category is selected.
  const visibleCompetitions = useMemo(() => {
    return competitions.filter((c) => selectedCategoryIds.has(c.category_id));
  }, [competitions, selectedCategoryIds]);

  const visibleEntities = useMemo(() => {
    // Teams are tagged by category, not competition (we don't store that
    // edge yet). So show all team-type entities whose category is in the
    // selected category set. Then group by competition externally if we
    // want.
    return entities.filter(
      (e) => e.type === 'team' && selectedCategoryIds.has(e.category_id)
    );
  }, [entities, selectedCategoryIds]);

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
      // Sequential delete + create so Base44's per-second cap doesn't
      // start dropping requests halfway through (observed during /seed).
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const existing = await base44.entities.UserSubscription.list();
      for (const s of existing) {
        try {
          await base44.entities.UserSubscription.delete(s.id);
          await sleep(60);
        } catch { /* ignore */ }
      }

      const subs = [];
      // For each selected category, write the most specific level the
      // user expressed:
      //   - any entity selected for this category → entity subs only
      //   - any competition selected for this category → competition subs only
      //   - else → blanket category sub
      for (const catId of selectedCategoryIds) {
        const entitiesInCat = visibleEntities
          .filter((e) => e.category_id === catId && selectedEntityIds.has(e.id));
        if (entitiesInCat.length > 0) {
          for (const e of entitiesInCat) {
            subs.push({ target_type: 'entity', target_id: e.id, preset: 'all' });
          }
          continue;
        }
        const compsInCat = visibleCompetitions
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
        } catch { /* ignore — individual sub failure shouldn't block onboarding completion */ }
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

  // Decide CTA state
  const canAdvance =
    (step === 1 && selectedCategoryIds.size > 0) ||
    step === 2 ||
    step === 3;

  // Skip step 2 entirely if no competitions exist for any selected category.
  const step2Empty = step === 2 && !compsLoading && visibleCompetitions.length === 0;
  if (step2Empty) {
    // Auto-advance — there's nothing to narrow.
    setTimeout(() => setStep(3), 0);
  }
  const step3Empty = step === 3 && !entsLoading && visibleEntities.length === 0;
  if (step3Empty) {
    setTimeout(() => finalize(), 0);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 pt-14 pb-6">
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
        ) : (
          <div className="space-y-2">
            {visibleEntities.map((ent) => {
              const cat = categories.find((c) => c.id === ent.category_id);
              const active = selectedEntityIds.has(ent.id);
              return (
                <SelectableRow
                  key={ent.id}
                  prefix={cat?.emoji}
                  label={ent.name}
                  active={active}
                  onClick={() => toggleEntity(ent.id)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom action bar */}
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
