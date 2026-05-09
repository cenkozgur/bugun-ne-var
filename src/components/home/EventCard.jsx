import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Bell, BellOff, CalendarPlus, Tv } from 'lucide-react';
import CategoryBadge from '@/components/common/CategoryBadge';
import CountdownTimer from '@/components/common/CountdownTimer';
import { format, isToday, isTomorrow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { downloadIcsForEvent } from '@/lib/ics';
import { createReminder, removeReminder, isEventReminded } from '@/lib/reminders';

export default function EventCard({ event, category }) {
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const eventTime = new Date(event.start_time);
  // For today's events just the time. Tomorrow gets a soft prefix. Anything
  // further out shows the date so the user isn't squinting at "150 saat" trying
  // to figure out which day it lands on.
  let timeStr;
  if (isToday(eventTime)) {
    timeStr = format(eventTime, 'HH:mm');
  } else if (isTomorrow(eventTime)) {
    timeStr = `yarın ${format(eventTime, 'HH:mm')}`;
  } else {
    timeStr = format(eventTime, 'd MMM EEE • HH:mm', { locale: tr });
  }

  useEffect(() => {
    setReminded(isEventReminded(event.id));
  }, [event.id]);

  const handleReminder = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (reminded) {
        await removeReminder(event);
        setReminded(false);
        toast({ title: 'hatırlatıcı kaldırıldı' });
      } else {
        const res = await createReminder(event, { minutesBefore: 15 });
        setReminded(true);
        if (res.permission === 'granted') {
          toast({ title: 'hatırlatacağım', description: '15 dakika önce bildirim gelecek.' });
        } else if (res.permission === 'denied') {
          toast({ title: 'kaydettim', description: 'bildirim izni kapalı — ayarlar/safari üzerinden açabilirsin.' });
        } else {
          toast({ title: 'kaydettim', description: 'bu tarayıcı bildirim desteklemiyor.' });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddToCalendar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      downloadIcsForEvent(event);
      toast({ title: 'takvime eklendi', description: 'dosyayı açınca takvimine düşer.' });
    } catch (err) {
      toast({ title: 'takvime eklenemedi', description: String(err?.message || err), variant: 'destructive' });
    }
  };

  // On live events we hide the standalone live pill (already shown as section header).
  const showCountdownRow = !event.is_live;
  // On live events we hide reminder button (makes no sense) and replace with a watch link if we have broadcaster.
  const actionsForLive = event.is_live;

  const colorClass = category ? `cat-${category.slug}` : 'cat-futbol';

  return (
    <Link
      to={`/event/${event.id}`}
      data-event-card
      data-event-id={event.id}
      data-event-live={event.is_live ? 'true' : 'false'}
      className={`relative block bg-card rounded-[20px] pl-5 pr-4 pt-4 pb-4 overflow-hidden press-scale transition-transform card-elevated ${
        event.is_live ? 'live-glow' : ''
      }`}
    >
      {/* Left vertical accent bar (category color) */}
      <span className={`accent-bar bg-${colorClass}`} />

      {/* Row 1: Meta + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-micro uppercase text-muted-foreground tracking-wider">
            {event.competition_name}
          </p>
        </div>
        <div className="text-right shrink-0">
          {event.is_live && event.live_status ? (
            <span className="text-[11px] font-semibold text-red-500 tabular-nums">{event.live_status}</span>
          ) : (
            <span className="text-caption text-muted-foreground tabular-nums font-medium">{timeStr}</span>
          )}
        </div>
      </div>

      {/* Row 2: Title */}
      <h3
        data-event-title
        className="text-body font-semibold text-foreground mt-2 line-clamp-2 leading-snug"
      >
        {event.title}
      </h3>

      {/* Row 3: Broadcaster */}
      {event.broadcaster && (
        <p className="text-[12px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Tv className="w-3 h-3 shrink-0" strokeWidth={1.75} />
          {event.broadcaster}
        </p>
      )}

      {/* Countdown for upcoming */}
      {showCountdownRow && (
        <div className="mt-3">
          <CountdownTimer targetTime={event.start_time} />
        </div>
      )}

      {/* Action buttons — ghost style */}
      <div className="flex gap-1 mt-3 -mx-1">
        {actionsForLive ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-[12px] font-semibold text-red-500 bg-red-500/8 press-scale"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
            şimdi yayında
          </button>
        ) : (
          <button
            onClick={handleReminder}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-[12px] font-medium transition-colors press-scale ${
              reminded
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground bg-secondary/60'
            } disabled:opacity-60`}
          >
            {reminded ? <BellOff className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Bell className="w-3.5 h-3.5" strokeWidth={1.75} />}
            {reminded ? 'hatırlatıldı ✓' : 'hatırlat'}
          </button>
        )}
        <button
          onClick={handleAddToCalendar}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-[12px] font-medium text-muted-foreground bg-secondary/60 press-scale"
        >
          <CalendarPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
          takvime ekle
        </button>
      </div>
    </Link>
  );
}