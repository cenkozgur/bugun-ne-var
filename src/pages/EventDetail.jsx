import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Share2, Bell, BellOff, CalendarPlus, Loader2 } from 'lucide-react';
import CountdownTimer from '@/components/common/CountdownTimer';
import LiveBadge from '@/components/common/LiveBadge';
import { getCategoryColorClass } from '@/lib/categoryUtils';

export default function EventDetail() {
  const navigate = useNavigate();
  const [reminded, setReminded] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const eventId = window.location.pathname.split('/event/')[1];

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const event = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);
  const category = useMemo(
    () => categories.find((c) => c.id === event?.category_id),
    [categories, event]
  );

  if (eventsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-body text-muted-foreground">etkinlik bulunamadı</p>
      </div>
    );
  }

  const colorClass = getCategoryColorClass(category);
  const categoryColor = category?.color || '#E8A33D';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${categoryColor}, transparent)` }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-14 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center press-scale"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>
        <button className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center press-scale">
          <Share2 className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-6 pb-8">
        {/* Category pill */}
        <div
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-caption font-medium bg-${colorClass}`}
        >
          <span>{category?.emoji}</span>
          <span>
            {category?.name} — {event.competition_name?.split('—')[1]?.trim() || event.competition_name}
          </span>
        </div>

        {/* Subtitle */}
        {!event.is_live && (
          <p className="text-caption text-muted-foreground mt-6 mb-2">
            etkinliğe
          </p>
        )}

        {/* Countdown or Live */}
        <div className="my-4">
          {event.is_live ? (
            <div className="flex flex-col items-center gap-3">
              <LiveBadge />
              {event.live_status && (
                <p className="text-title text-foreground font-semibold">{event.live_status}</p>
              )}
            </div>
          ) : (
            <CountdownTimer targetTime={event.start_time} variant="hero" />
          )}
        </div>

        {/* Event title */}
        <h1 className="text-title text-foreground font-semibold mt-4">
          {event.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-caption text-muted-foreground">
          {event.broadcaster && <span>📺 {event.broadcaster}</span>}
          {event.broadcaster && event.venue && <span>•</span>}
          {event.venue && <span>{event.venue}</span>}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="relative z-10 px-6 mt-auto space-y-3 pb-12">
        {/* Primary CTA */}
        <button
          onClick={() => setReminded(!reminded)}
          className={`w-full py-4 rounded-2xl text-body font-semibold flex items-center justify-center gap-2 transition-all press-scale ${
            reminded
              ? 'bg-primary/15 text-primary'
              : 'bg-foreground text-background'
          }`}
        >
          {reminded ? (
            <>
              <BellOff className="w-4 h-4" />
              hatırlatıldı ✓
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              beni hatırlat — 15 dk önce
            </>
          )}
        </button>

        {/* Secondary actions */}
        <div className="flex gap-3">
          <button className="flex-1 py-3.5 rounded-2xl bg-secondary text-secondary-foreground text-caption font-medium flex items-center justify-center gap-1.5 press-scale">
            <CalendarPlus className="w-4 h-4" />
            takvime ekle
          </button>
          <button className="flex-1 py-3.5 rounded-2xl bg-secondary text-secondary-foreground text-caption font-medium flex items-center justify-center gap-1.5 press-scale">
            <Share2 className="w-4 h-4" />
            paylaş
          </button>
        </div>
      </div>
    </div>
  );
}