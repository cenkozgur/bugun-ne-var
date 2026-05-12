import React, { useState, useEffect } from 'react';

/**
 * Tick mark display for "how long until this event starts".
 *
 * Inline variant scales the unit so far-out events read as days, near-term
 * read as hours, and last-hour reads minute-precise. The hero variant
 * (event detail) keeps HH:MM:SS like a launch clock — but if the event is
 * more than ~36h away, also shows day count above so the user has context.
 */
export default function CountdownTimer({ targetTime, variant = 'inline' }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    const calc = () => {
      const now = new Date().getTime();
      const target = new Date(targetTime).getTime();
      const diff = target - now;
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor(diff / (1000 * 60 * 60)) % 24,
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        // Total hours regardless of day/hour split — useful for hero variant.
        totalHours: Math.floor(diff / (1000 * 60 * 60)),
        total: diff,
      };
    };

    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  if (!remaining) return null;
  if (remaining.total <= 0) return null;

  const isUrgent = remaining.total < 60 * 60 * 1000; // < 1h
  const pad = (n) => String(n).padStart(2, '0');

  if (variant === 'hero') {
    // Multi-day events get a leading GÜN cell so the saat hücresi reads as
    // "remaining hours within today" instead of misleading total hours
    // (e.g. 1 gün 3 saat away should show 01:03:11:00, not 03:11:00 which
    // looks like 3 hours total).
    const showDayCell = remaining.days >= 1;
    return (
      <div className="flex items-center justify-center gap-1.5 sm:gap-3 max-w-full">
        {showDayCell && (
          <>
            <Cell label="gün" value={pad(remaining.days)} />
            <Sep />
          </>
        )}
        <Cell label="saat" value={pad(remaining.hours)} />
        <Sep />
        <Cell label="dakika" value={pad(remaining.minutes)} />
        <Sep />
        <Cell label="saniye" value={pad(remaining.seconds)} />
      </div>
    );
  }

  // inline (event card)
  let label;
  if (remaining.days >= 1) {
    label = remaining.hours > 0
      ? `${remaining.days} gün ${remaining.hours} sa`
      : `${remaining.days} gün`;
  } else if (remaining.totalHours >= 1) {
    label = `${remaining.totalHours} sa ${remaining.minutes} dk`;
  } else {
    label = `${remaining.minutes} dk`;
  }

  return (
    <span className={`tabular-nums text-caption ${isUrgent ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
      ⏱ {label}
    </span>
  );
}

function Cell({ label, value }) {
  return (
    <div className="text-center min-w-0 shrink">
      <div className="text-[clamp(2.25rem,9vw,3.5rem)] leading-none tabular-nums font-bold text-foreground">{value}</div>
      <div className="text-micro text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function Sep() {
  return <div className="text-[clamp(2.25rem,9vw,3.5rem)] leading-none font-bold text-muted-foreground/40">:</div>;
}
