import React, { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import BottomSheet from './BottomSheet';

/**
 * Per-competition team sheet, sits on top of CategorySheet.
 * Tapping back goes to the category sheet; tapping outside closes both.
 *
 * Props:
 *   open, onClose, onBack
 *   competition — { id, name }
 *   teams — array of TrackedEntity rows whose competition_ref matches
 *   selectedTeamIds — Set
 *   onChange(nextSet)
 */
export default function TeamSheet({
  open,
  onClose,
  onBack,
  competition,
  teams,
  selectedTeamIds,
  onChange,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.trim().toLowerCase();
    return teams.filter((t) => (t.name || '').toLowerCase().includes(q));
  }, [teams, search]);

  // "Tüm takımlar" checked when zero teams selected — by convention
  // an empty selection means "follow the entire competition".
  const allFollowed = selectedTeamIds.size === 0;

  const toggleAll = () => {
    onChange(new Set()); // empty = follow whole comp
  };

  const toggleTeam = (id) => {
    const next = new Set(selectedTeamIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onBack={onBack}
      title={competition?.name || ''}
      subtitle={teams.length === 0 ? 'kayıtlı takım yok' : `${teams.length} takım`}
      footer={
        <button
          onClick={onBack || onClose}
          className="w-full py-3 rounded-xl bg-foreground text-background text-body font-semibold press-scale"
        >
          {selectedTeamIds.size > 0
            ? `${selectedTeamIds.size} takım seçili — kapat`
            : 'tüm lig takip ediliyor — kapat'}
        </button>
      }
    >
      {teams.length > 6 ? (
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="takım ara…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-foreground text-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      ) : null}

      {teams.length > 0 ? (
        <button
          onClick={toggleAll}
          className={`w-full px-4 py-3 rounded-xl border-2 flex items-center justify-between mb-3 press-scale transition-colors ${
            allFollowed
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-dashed border-border bg-transparent text-muted-foreground'
          }`}
        >
          <span className="text-body font-semibold">
            {allFollowed ? '✓ Tüm Lig Takip Ediliyor' : 'Tüm Ligi Takip Et'}
          </span>
          <span className="text-caption opacity-70">
            {teams.length} takım
          </span>
        </button>
      ) : null}

      <div className="space-y-2">
        {filtered.map((t) => {
          const checked = selectedTeamIds.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggleTeam(t.id)}
              className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 text-left press-scale transition-colors ${
                checked ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
              }`}
            >
              <span className="flex-1 text-body font-medium">{t.name}</span>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                checked ? 'bg-background/20 text-background' : 'border border-border'
              }`}>
                {checked ? <Check className="w-3 h-3" /> : null}
              </span>
            </button>
          );
        })}

        {filtered.length === 0 ? (
          <p className="text-body text-muted-foreground text-center py-8">
            {search ? 'eşleşen takım yok' : 'kayıtlı takım yok'}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
