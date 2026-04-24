import React from 'react';
import { getCategoryColorClass } from '@/lib/categoryUtils';

export default function CategoryBadge({ category, size = 'md' }) {
  const colorClass = getCategoryColorClass(category);
  const sizes = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-lg',
    lg: 'w-10 h-10 text-xl',
  };

  return (
    <div
      className={`${sizes[size]} rounded-lg flex items-center justify-center bg-${colorClass}/15`}
    >
      <span>{category?.emoji}</span>
    </div>
  );
}