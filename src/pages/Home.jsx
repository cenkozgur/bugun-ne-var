import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings, Loader2, Compass } from 'lucide-react';
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

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.UserSubscription.list(),
  });

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => (map[c.id] = c));
    return map;
  }, [categories]);

  // Build the set of category ids the user is subscribed to. For now we
  // only honour category-level subs; competition/entity-level filtering
  // comes later when those entities have data.
  const subscribedCategoryIds = useMemo(() => {
    const set = new Set();
    for (const sub of subscriptions) {
      if (sub.target_type === 'category' && sub.target_id) {
        set.add(sub.target_id);
      }
    }
    return set;
  }, [subscriptions]);

  // Re-arm in-tab notification timers after a page reload.
  useEffect(() => {
    if (!events.length) return;
    const byId = Object.fromEntries(events.map((e) => [e.id, e]));
    rehydrateReminders(byId);
  }, [events]);

  // Filter events to only those whose category the user follows. If they
  // have zero subs we fall through to the empty-state below — showing
  // every Event regardless would defeat the whole point of the app.
  const subscribedEvents = useMemo(() => {
    if (subscribedCategoryIds.size === 0) return [];
    return events.filter((e) => subscribedCategoryIds.has(e.category_id));
  }, [events, subscribedCategoryIds]);

  const filtered = useMemo(() => {
    return subscribedEvents
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
  }, [subscribedEvents, filter]);

  const liveEvents = filtered.filter((e) => e.is_live);
  const upcomingToday = filtered.filter((e) => !e.is_live && isToday(parseISO(e.start_time)));
  const tomorrowEvents = subscribedEvents
    .filter((e) => isTomorrow(parseISO(e.start_time)))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 3);

  const todayCount = subscribedEvents.filter(
    (e) => isToday(parseISO(e.start_time)) || e.is_live
  ).length;

  if (eventsLoading || subsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No subscriptions yet — push the user to pick something. We render
  // greeting + tab bar so the layout doesn't feel broken, but the body
  // is a single CTA.
  if (subscribedCategoryIds.size === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-5 pt-14 pb-4 flex items-start justify-between">
          <div>
            <h1 className="text-display font-bold text-foreground">
              {greeting.text} {greeting.emoji}
            </h1>
            <p className="text-body text-muted-foreground mt-1">
              henüz hiçbir şey takip etmiyorsun
            </p>
          </div>
          <Link
            to="/ayarlar"
            className="mt-1 p-2 rounded-xl bg-secondary text-muted-foreground press-scale"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>

        <div className="px-5 pt-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6">
            <Compass className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-title font-semibold text-foreground mb-2">
            ne takip etmek istersin?
          </h2>
          <p className="text-body text-muted-foreground mb-8 max-w-xs">
            kategorileri seç, sadece ilgilendiklerini gör.
          </p>
          <Link
            to="/onboarding"
            className="px-6 py-3 rounded-full bg-foreground text-background text-body font-semibold press-scale"
          >
            kategorileri seç →
          </Link>
        </div>

        <BottomTabBar />
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
              {todayCount > 0
                ? `bugün ${todayCount} etkinlik var`
                : 'bugün takip ettiğin bir şey yok'}
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

        {/* Other filters (yarın / hafta) */}
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

        {/* Empty state for today filter */}
        {filter === 'today' && liveEvents.length === 0 && upcomingToday.length === 0 && (
          <div className="text-center py-12">
            <p className="text-body text-muted-foreground">
              bugün takip ettiğin bir etkinlik yok
              {tomorrowEvents.length > 0 ? ' — yarına bak ↓' : ''}
            </p>
          </div>
        )}

        {filter !== 'today' && filtered.length === 0 && (
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
