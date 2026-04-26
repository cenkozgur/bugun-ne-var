import React, { useMemo, useState } from 'react';
import { Search, Check, Users } from 'lucide-react';
import BottomSheet from './BottomSheet';

/**
 * Per-category bottom sheet — shows competitions inside the category and
 * lets the user check the ones they want. Each row has a "sadece belirli
 * takımlar →" link that opens the team sheet on top.
 *
 * Props:
 *   open, onClose
 *   category — { id, name, emoji, slug }
 *   competitions — array of Competition rows in this category
 *   selection — { compIds: Set, entityIdsByComp: { [compId]: Set } }
 *   onChange(nextSelection)
 *   onOpenTeams(competition) — caller pushes a TeamSheet on top
 */
export default function CategorySheet({
  open,
  onClose,
  category,
  competitions,
  selection,
  onChange,
  onOpenTeams,
  totalSubscribed,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return competitions;
    const q = search.trim().toLowerCase();
    return competitions.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [competitions, search]);

  const allChecked = competitions.length > 0
    && competitions.every((c) => selection.compIds.has(c.id));

  const toggleAll = () => {
    const next = { ...selection, compIds: new Set(selection.compIds) };
    if (allChecked) {
      // Uncheck every competition AND drop any team-level narrowing.
      next.compIds = new Set();
      next.entityIdsByComp = {};
    } else {
      next.compIds = new Set(competitions.map((c) => c.id));
    }
    onChange(next);
  };

  const toggleComp = (compId) => {
    const next = { ...selection, compIds: new Set(selection.compIds) };
    const teamMap = { ...(selection.entityIdsByComp || {}) };
    if (next.compIds.has(compId)) {
      next.compIds.delete(compId);
      delete teamMap[compId];
    } else {
      next.compIds.add(compId);
    }
    next.entityIdsByComp = teamMap;
    onChange(next);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`${category?.emoji || ''} ${category?.name || ''}`.trim()}
      subtitle={competitions.length === 0 ? 'henüz lig kaydı yok' : `${competitions.length} lig`}
      footer={
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-foreground text-background text-body font-semibold press-scale"
        >
          {totalSubscribed > 0 ? `${totalSubscribed} lig seçili — kapat` : 'kapat'}
        </button>
      }
    >
      {/* Search */}
      {competitions.length > 4 ? (
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="lig ara…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-foreground text-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      ) : null}

      {/* Select all — distinct visual from per-row rows so it doesn't
          read as just another league. Outline style with bold "Tümünü Seç"
          label, accent fill when active. */}
      {competitions.length > 0 ? (
        <button
          onClick={toggleAll}
          className={`w-full px-4 py-3 rounded-xl border-2 flex items-center justify-between mb-3 press-scale transition-colors ${
            allChecked
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-dashed border-border bg-transparent text-muted-foreground'
          }`}
        >
          <span className="text-body font-semibold">
            {allChecked ? '✓ Tümü Seçili' : 'Tümünü Seç'}
          </span>
          <span className="text-caption opacity-70">
            {competitions.length} lig
          </span>
        </button>
      ) : null}

      {/* List */}
      <div className="space-y-2">
        {filtered.map((comp) => {
          const checked = selection.compIds.has(comp.id);
          const narrowedTeams = selection.entityIdsByComp?.[comp.id];
          const narrowedCount = narrowedTeams?.size || 0;
          return (
            <div
              key={comp.id}
              className={`rounded-xl ${checked ? 'bg-foreground text-background' : 'bg-secondary text-foreground'}`}
            >
              <button
                onClick={() => toggleComp(comp.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left press-scale"
              >
                <span className="flex-1 text-body font-medium">{comp.name}</span>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  checked ? 'bg-background/20 text-background' : 'border border-border'
                }`}>
                  {checked ? <Check className="w-3 h-3" /> : null}
                </span>
              </button>

              {/* Narrow-to-teams link, only when this competition is checked */}
              {checked && onOpenTeams ? (
                <button
                  onClick={() => onOpenTeams(comp)}
                  className={`w-full px-4 pb-3 -mt-1 flex items-center gap-2 text-caption press-scale ${
                    'text-background/80 hover:text-background'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  {narrowedCount > 0
                    ? `${narrowedCount} takım seçili — değiştir →`
                    : 'sadece belirli takımlar seç →'}
                </button>
              ) : null}
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <p className="text-body text-muted-foreground text-center py-8">
            {search ? 'eşleşen lig yok' : 'kayıtlı lig yok'}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
