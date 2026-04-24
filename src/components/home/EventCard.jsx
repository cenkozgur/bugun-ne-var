import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Bell, BellOff, CalendarPlus } from 'lucide-react';
import CategoryBadge from '@/components/common/CategoryBadge';
import CountdownTimer from '@/components/common/CountdownTimer';
import LiveBadge from '@/components/common/LiveBadge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function EventCard({ event, category }) {
  const [reminded, setReminded] = useState(false);
  const eventTime = new Date(event.start_time);
  const timeStr = format(eventTime, 'HH:mm');

  return (
    <Link
      to={`/event/${event.id}`}
      className="block bg-card border border-border rounded-lg p-4 press-scale transition-transform"
    >
      {/* Row 1: Badge + Meta + Overflow */}
      <div className="flex items-start gap-3">
        <CategoryBadge category={category} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-micro uppercase text-muted-foreground tracking-wider">
            {event.competition_name}
          </p>
          <p className="text-caption text-muted-foreground mt-0.5">{timeStr}</p>
        </div>
        <button
          className="p-1 text-muted-foreground"
          onClick={(e) => e.preventDefault()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Row 2: Title */}
      <h3 className="text-body font-semibold text-foreground mt-2.5 line-clamp-2">
        {event.title}
      </h3>

      {/* Row 3: Broadcaster */}
      {event.broadcaster && (
        <p className="text-caption text-muted-foreground mt-1.5">
          📺 {event.broadcaster}
        </p>
      )}

      {/* Divider */}
      <div className="border-t border-border my-3" />

      {/* Row 4: Countdown or Live */}
      <div className="mb-3">
        {event.is_live ? (
          <div className="flex items-center gap-2">
            <LiveBadge />
            {event.live_status && (
              <span className="text-caption text-muted-foreground">{event.live_status}</span>
            )}
          </div>
        ) : (
          <CountdownTimer targetTime={event.start_time} />
        )}
      </div>

      {/* Row 5: Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            setReminded(!reminded);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-caption font-medium transition-colors press-scale ${
            reminded
              ? 'bg-primary/10 text-primary'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {reminded ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          {reminded ? 'hatırlatıldı ✓' : 'hatırlat'}
        </button>
        <button
          onClick={(e) => e.preventDefault()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-caption font-medium bg-secondary text-secondary-foreground press-scale"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          takvime ekle
        </button>
      </div>
    </Link>
  );
}