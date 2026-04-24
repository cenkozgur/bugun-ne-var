import React from 'react';

export default function LiveBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse" />
      <span className="text-micro text-red-500 uppercase">canli</span>
    </div>
  );
}