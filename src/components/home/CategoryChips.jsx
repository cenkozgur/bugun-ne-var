import React from 'react';

/**
 * Horizontal pill row for narrowing the visible event list to a single
 * category (or "tümü"). Only renders chips for categories the user is
 * actually subscribed to — there's no point letting them filter to
 * NBA if they don't follow it.
 */
export default function CategoryChips({ categories, activeId, onSelect }) {
  if (!categories || categories.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-5 px-5">
      <Chip
        active={activeId === null}
        onClick={() => onSelect(null)}
      >
        tümü
      </Chip>
      {categories.map((c) => (
        <Chip
          key={c.id}
          active={activeId === c.id}
          onClick={() => onSelect(c.id)}
        >
          {c.emoji ? <span className="mr-1">{c.emoji}</span> : null}
          {c.name?.toLowerCase()}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-all press-scale ${
        active
          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
          : 'bg-secondary/60 text-muted-foreground font-medium'
      }`}
    >
      {children}
    </button>
  );
}