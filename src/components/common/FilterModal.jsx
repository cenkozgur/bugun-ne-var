import React, { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';

/**
 * Bottom-sheet style modal for free-text search and competition narrowing.
 *
 * Receives all available competition labels (extracted from the events
 * currently in scope) so the user only sees options that exist. Output
 * is a {query, competitions: Set<string>, primeTimeOnly: boolean} value
 * the parent applies in its own filter pipeline.
 */
export default function FilterModal({
  open,
  onClose,
  competitions,
  value,
  onChange,
}) {
  const [draft, setDraft] = useState(value);

  // Re-sync draft whenever the modal is (re)opened with a different
  // committed value — otherwise stale local state would shadow the
  // parent's reset.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  const toggleCompetition = (name) => {
    setDraft((prev) => {
      const next = new Set(prev.competitions);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...prev, competitions: next };
    });
  };

  const apply = () => {
    onChange(draft);
    onClose();
  };

  const reset = () => {
    const cleared = { query: '', competitions: new Set(), primeTimeOnly: false };
    setDraft(cleared);
    onChange(cleared);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/50 sheet-backdrop"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-card rounded-t-[28px] max-h-[80vh] overflow-y-auto">
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="text-[17px] font-semibold text-foreground">filtre</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center press-scale"
          >
            <X className="w-4 h-4 text-foreground" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-6">
          {/* Search */}
          <div>
            <label className="text-micro uppercase text-muted-foreground tracking-wider block mb-2">
              ara
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={draft.query}
                onChange={(e) => setDraft({ ...draft, query: e.target.value })}
                placeholder="takım, turnuva, yayıncı…"
                className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-secondary/60 text-foreground text-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Prime time */}
          <div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-body text-foreground">akşam saatleri</div>
                <div className="text-caption text-muted-foreground">19:00 – 23:30 arası</div>
              </div>
              <button
                onClick={() => setDraft({ ...draft, primeTimeOnly: !draft.primeTimeOnly })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  draft.primeTimeOnly ? 'bg-foreground' : 'bg-secondary'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                    draft.primeTimeOnly ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Competitions */}
          {competitions && competitions.length > 0 && (
            <div>
              <label className="text-micro uppercase text-muted-foreground tracking-wider block mb-2">
                turnuva / lig
              </label>
              <div className="flex flex-wrap gap-2">
                {competitions.map((name) => {
                  const active = draft.competitions.has(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleCompetition(name)}
                      className={`px-3 py-1.5 rounded-full text-caption font-medium press-scale transition-all ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary/60 text-muted-foreground'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {draft.competitions.size > 0 && (
                <button
                  onClick={() => setDraft({ ...draft, competitions: new Set() })}
                  className="text-caption text-muted-foreground mt-3 underline"
                >
                  ligleri sıfırla
                </button>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-full bg-secondary/60 text-secondary-foreground text-body font-medium press-scale"
            >
              sıfırla
            </button>
            <button
              onClick={apply}
              className="flex-1 py-3 rounded-full bg-primary text-primary-foreground text-body font-semibold press-scale shadow-md"
            >
              uygula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const EMPTY_FILTER = {
  query: '',
  competitions: new Set(),
  primeTimeOnly: false,
};

export function isFilterActive(f) {
  return Boolean(
    (f.query && f.query.trim()) ||
    (f.competitions && f.competitions.size > 0) ||
    f.primeTimeOnly
  );
}

export function applyFilter(events, f) {
  if (!f) return events;
  let out = events;
  if (f.query && f.query.trim()) {
    const q = f.query.trim().toLowerCase();
    out = out.filter((e) => {
      const hay = `${e.title || ''} ${e.competition_name || ''} ${e.broadcaster || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (f.competitions && f.competitions.size > 0) {
    out = out.filter((e) => f.competitions.has(e.competition_name));
  }
  if (f.primeTimeOnly) {
    out = out.filter((e) => {
      const d = new Date(e.start_time);
      const h = d.getHours();
      const m = d.getMinutes();
      const minutes = h * 60 + m;
      return minutes >= 19 * 60 && minutes <= 23 * 60 + 30;
    });
  }
  return out;
}