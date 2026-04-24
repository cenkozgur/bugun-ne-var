import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { getGreeting } from '@/lib/useTheme';
import FilterChips from '@/components/home/FilterChips';
import EventCard from '@/components/home/EventCard';
import BottomTabBar from '@/components/common/BottomTabBar';
import { rehydrateReminders } from '@/lib/reminders';

export default function Home() {
  const [filter, setFilter] = useState('today');
  const greeting = getGreeting();

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => (map[c.id] = c));
    return map;
  }, [categories]);

  // Re-arm in-tab notification timers after a page reload.
  useEffect(() => {
    if (!events.length) return;
    const byId = Object.fromEntries(events.map((e) => [e.id, e]));
    rehydrateReminders(byId);
  }, [events]);

  const filtered = useMemo(() => {
    return events
      .filter((e) => {
        const d = parseISO(e.start_time);
        if (filter === 'today') return isToday(d) || e.is_live;
        if (filter === 'tomorrow') return isTomorrow(d);
        if (filter === 'week') return isThisWeek(d, { weekStartsOn: 1 });
        return true;
      })
      .sort((a, b) => {
        if (a.is_live && !b.is_live) return -1;
        if (!a.is_live && b.is_live) return 1;
        return new Date(a.start_time) - new Date(b.start_time);
      });
  }, [events, filter]);

  const liveEvents = filtered.filter((e) => e.is_live);
  const upcomingToday = filtered.filter((e) => !e.is_live && isToday(parseISO(e.start_time)));
  const tomorrowEvents = events
    .filter((e) => isTomorrow(parseISO(e.start_time)))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 2);

  const todayCount = events.filter(
    (e) => isToday(parseISO(e.start_time)) || e.is_live
  ).length;

  if (eventsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-display font-bold text-foreground">
              {greeting.text} {greeting.emoji}
            </h1>
            <p className="text-body text-muted-foreground mt-1">
              bugün {todayCount} etkinlik var
            </p>
          </div>
          <Link
            to="/ayarlar"
            className="mt-1 p-2 rounded-xl bg-secondary text-muted-foreground press-scale"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 mb-5">
        <FilterChips active={filter} onSelect={setFilter} />
      </div>

      {/* Content */}
      <div className="px-5 space-y-6">
        {/* CANLI section */}
        {filter === 'today' && liveEvents.length > 0 && (
          <section>
            <h2 className="text-micro uppercase text-red-500 tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse" />
              canlı
            </h2>
            <div className="space-y-3">
              {liveEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  category={categoryMap[event.category_id]}
                />
              ))}
            </div>
          </section>
        )}

        {/* BUGÜN section */}
        {filter === 'today' && upcomingToday.length > 0 && (
          <section>
            <h2 className="text-micro uppercase text-muted-foreground tracking-wider mb-3">
              bugün
            </h2>
            <div className="space-y-3">
              {upcomingToday.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  category={categoryMap[event.category_id]}
                />
              ))}
            </div>
          </section>
        )}

        {/* YARIN preview (only on today filter) */}
        {filter === 'today' && tomorrowEvents.length > 0 && (
          <section>
            <h2 className="text-micro uppercase text-muted-foreground tracking-wider mb-3">
              yarın
            </h2>
            <div className="space-y-3">
              {tomorrowEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  category={categoryMap[event.category_id]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Other filters */}
        {filter !== 'today' && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                category={categoryMap[event.category_id]}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 && filter !== 'today' && (
          <div className="text-center py-16">
            <p className="text-body text-muted-foreground">
              bu zaman aralığında etkinlik yok
            </p>
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}