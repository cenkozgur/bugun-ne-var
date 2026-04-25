import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

const filters = [
  { key: 'today', label: 'bugün' },
  { key: 'tomorrow', label: 'yarın' },
  { key: 'week', label: 'bu hafta' },
  { key: 'all', label: 'tümü' },
];

export default function FilterChips({ active, onSelect, onOpenFilters, filtersActive }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onSelect(f.key)}
          className={`px-4 py-2 rounded-full text-caption font-medium whitespace-nowrap transition-colors press-scale ${
            active === f.key
              ? 'bg-primary/15 text-primary'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          {f.label}
        </button>
      ))}
      <button
        onClick={onOpenFilters}
        className={`relative px-3 py-2 rounded-full press-scale ${
          filtersActive
            ? 'bg-primary/15 text-primary'
            : 'bg-secondary text-muted-foreground'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {filtersActive && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
        )}
      </button>
    </div>
  );
}
