import React, { useState, useEffect } from 'react';

export default function CountdownTimer({ targetTime, variant = 'inline' }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    const calc = () => {
      const now = new Date().getTime();
      const target = new Date(targetTime).getTime();
      const diff = target - now;
      if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 };
      return {
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        total: diff,
      };
    };

    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  if (!remaining) return null;

  const isUrgent = remaining.total > 0 && remaining.total < 3600000;
  const pad = (n) => String(n).padStart(2, '0');

  if (variant === 'hero') {
    return (
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-display-xl tabular-nums font-bold text-foreground">{pad(remaining.hours)}</div>
          <div className="text-micro text-muted-foreground uppercase tracking-wider mt-1">saat</div>
        </div>
        <div className="text-display-xl font-bold text-muted-foreground/40">:</div>
        <div className="text-center">
          <div className="text-display-xl tabular-nums font-bold text-foreground">{pad(remaining.minutes)}</div>
          <div className="text-micro text-muted-foreground uppercase tracking-wider mt-1">dakika</div>
        </div>
        <div className="text-display-xl font-bold text-muted-foreground/40">:</div>
        <div className="text-center">
          <div className="text-display-xl tabular-nums font-bold text-foreground">{pad(remaining.seconds)}</div>
          <div className="text-micro text-muted-foreground uppercase tracking-wider mt-1">saniye</div>
        </div>
      </div>
    );
  }

  if (remaining.total <= 0) return null;

  return (
    <span className={`tabular-nums text-caption ${isUrgent ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
      ⏱ {remaining.hours > 0 ? `${remaining.hours} sa ` : ''}{remaining.minutes} dk
    </span>
  );
}