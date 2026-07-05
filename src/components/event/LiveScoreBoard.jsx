import React from 'react';
import LiveBadge from '@/components/common/LiveBadge';

// Splits "Fenerbahçe - Galatasaray" / "A vs B" into team names.
function splitTeams(title) {
  const parts = title.split(/\s+(?:-|–|—|vs\.?|x)\s+/i);
  if (parts.length === 2) return parts;
  return null;
}

export default function LiveScoreBoard({ event }) {
  const teams = splitTeams(event.title || '');
  const hasScore = event.home_score != null && event.away_score != null;

  return (
    <div className="w-full max-w-sm mx-auto rounded-[20px] bg-card card-elevated live-glow px-5 py-5 flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <LiveBadge />
        {event.live_status && (
          <span className="text-caption font-semibold text-red-500 tabular-nums">
            {event.live_status}
          </span>
        )}
      </div>

      {hasScore ? (
        teams ? (
          <div className="w-full flex items-center justify-between gap-3">
            <span className="flex-1 text-caption font-semibold text-foreground text-right leading-tight">
              {teams[0]}
            </span>
            <span className="text-display font-bold text-foreground tabular-nums whitespace-nowrap">
              {event.home_score} : {event.away_score}
            </span>
            <span className="flex-1 text-caption font-semibold text-foreground text-left leading-tight">
              {teams[1]}
            </span>
          </div>
        ) : (
          <span className="text-display font-bold text-foreground tabular-nums">
            {event.home_score} : {event.away_score}
          </span>
        )
      ) : (
        <p className="text-caption text-muted-foreground">skor bilgisi henüz yok</p>
      )}
    </div>
  );
}