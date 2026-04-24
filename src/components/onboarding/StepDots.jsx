import React from 'react';

export default function StepDots({ total, current }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i === current
              ? 'w-6 h-2 bg-primary'
              : 'w-2 h-2 bg-border'
          }`}
        />
      ))}
    </div>
  );
}