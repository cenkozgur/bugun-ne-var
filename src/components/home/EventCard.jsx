import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Bell, BellOff, CalendarPlus, Tv } from 'lucide-react';
import CategoryBadge from '@/components/common/CategoryBadge';
import CountdownTimer from '@/components/common/CountdownTimer';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { downloadIcsForEvent } from '@/lib/ics';
import { createReminder, removeReminder, isEventReminded } from '@/lib/reminders';

export default function EventCard({ event, category }) {
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const eventTime = new Date(event.start_time);
  const timeStr = format(eventTime, 'HH:mm');

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
          <p className="text-caption text-muted-foreground mt-0.5">
            {event.is_live && event.live_status
              ? <span className="text-primary font-medium">{event.live_status}</span>
              : timeStr}
          </p>
        </div>
        <button
          className="p-1 text-muted-foreground"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
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

      {/* Divider + countdown only for upcoming */}
      {showCountdownRow && (
        <>
          <div className="border-t border-border my-3" />
          <div className="mb-3">
            <CountdownTimer targetTime={event.start_time} />
          </div>
        </>
      )}

      {/* Row 5: Action buttons */}
      <div className="flex gap-2 mt-3">
        {actionsForLive ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); /* link will still navigate */ }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-caption font-medium bg-primary/10 text-primary press-scale"
          >
            <Tv className="w-3.5 h-3.5" />
            şimdi yayında
          </button>
        ) : (
          <button
            onClick={handleReminder}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-caption font-medium transition-colors press-scale ${
              reminded
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary text-secondary-foreground'
            } disabled:opacity-60`}
          >
            {reminded ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            {reminded ? 'hatırlatıldı ✓' : 'hatırlat'}
          </button>
        )}
        <button
          onClick={handleAddToCalendar}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-caption font-medium bg-secondary text-secondary-foreground press-scale"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          takvime ekle
        </button>
      </div>
    </Link>
  );
}
