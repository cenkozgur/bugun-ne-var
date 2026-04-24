import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

const filters = [
  { key: 'today', label: 'bugün' },
  { key: 'tomorrow', label: 'yarın' },
  { key: 'week', label: 'bu hafta' },
];

export default function FilterChips({ active, onSelect }) {
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
        className="px-3 py-2 rounded-full bg-secondary text-muted-foreground press-scale"
        onClick={() => {}}
      >
        <SlidersHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
}