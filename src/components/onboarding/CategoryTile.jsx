import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { getCategoryColorClass } from '@/lib/categoryUtils';

export default function CategoryTile({ category, selected, onToggle }) {
  const colorClass = getCategoryColorClass(category);

  return (
    <button
      onClick={onToggle}
      className={`relative w-full p-4 rounded-xl border text-left transition-all press-scale ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card'
      }`}
    >
      {/* Check indicator */}
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="w-5 h-5 text-primary fill-primary/20" />
        </div>
      )}

      {/* Emoji badge */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 bg-${colorClass}/15`}
      >
        {category.emoji}
      </div>

      {/* Text */}
      <h3 className="text-body font-semibold text-foreground">{category.name}</h3>
      {category.subtitle && (
        <p className="text-caption text-muted-foreground mt-0.5 line-clamp-1">
          {category.subtitle}
        </p>
      )}
    </button>
  );
}