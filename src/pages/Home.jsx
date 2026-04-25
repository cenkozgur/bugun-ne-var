import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings, Loader2, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isToday, isTomorrow, isThisWeek, isAfter, parseISO } from 'date-fns';
import { getGreeting } from '@/lib/useTheme';
import FilterChips from '@/components/home/FilterChips';
import CategoryChips from '@/components/home/CategoryChips';
import EventCard from '@/components/home/EventCard';
import BottomTabBar from '@/components/common/BottomTabBar';
import FilterModal, { EMPTY_FILTER, isFilterActive, applyFilter } from '@/components/common/FilterModal';
import { rehydrateReminders } from '@/lib/reminders';

export default function Home() {
  const [timeFilter, setTimeFilter] = useState('today');
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filter, setFilter] = useState(EMPTY_FILTER);
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

  const { data: comps = [] } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => base44.entities.Competition.list(),
  });
  const { data: ents = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => base44.entities.TrackedEntity.list(),
  });

  // Index by id so we can resolve target_id → external_ref for matching.
  const compById = useMemo(() => {
    const m = new Map();
    comps.forEach((c) => m.set(c.id, c));
    return m;
  }, [comps]);
  const entById = useMemo(() => {
    const m = new Map();
    ents.forEach((e) => m.set(e.id, e));
    return m;
  }, [ents]);

  // Subscription buckets — separated so the filter can match an event if
  // ANY of category/competition/entity is followed.
  const subBuckets = useMemo(() => {
    const cats = new Set();
    const compRefs = new Set();
    const entRefs = new Set();
    const compCats = new Set(); // categories implicitly followed via competitions/entities
    for (const sub of subscriptions) {
      if (!sub.target_id) continue;
      if (sub.target_type === 'category') {
        cats.add(sub.target_id);
      } else if (sub.target_type === 'competition') {
        const c = compById.get(sub.target_id);
        if (c?.external_ref) compRefs.add(c.external_ref);
        if (c?.category_id) compCats.add(c.category_id);
      } else if (sub.target_type === 'entity') {
        const e = entById.get(sub.target_id);
        if (e?.external_ref) entRefs.add(e.external_ref);
        if (e?.category_id) compCats.add(e.category_id);
      }
    }
    return { cats, compRefs, entRefs, compCats };
  }, [subscriptions, compById, entById]);

  const subscribedCategoryIds = useMemo(() => {
    const set = new Set([...subBuckets.cats, ...subBuckets.compCats]);
    return set;
  }, [subBuckets]);

  // The actual category objects the user follows — feed for the chip row.
  const subscribedCategories = useMemo(
    () => categories.filter((c) => subscribedCategoryIds.has(c.id)),
    [categories, subscribedCategoryIds]
  );

  useEffect(() => {
    if (!events.length) return;
    const byId = Object.fromEntries(events.map((e) => [e.id, e]));
    rehydrateReminders(byId);
  }, [events]);

  // Layer 1: subscription gate. An event passes if ANY of:
  //   - its category is followed (blanket sub for that category), OR
  //   - its competition_ref is followed, OR
  //   - either team's entity_ref is followed.
  // Layer 2: optionally narrow to a single category chip.
  // Layer 3: search/competition/prime-time filter modal.
  const subscribedEvents = useMemo(() => {
    if (
      subBuckets.cats.size === 0 &&
      subBuckets.compRefs.size === 0 &&
      subBuckets.entRefs.size === 0
    ) {
      return [];
    }
    return events.filter((e) => {
      if (subBuckets.cats.has(e.category_id)) return true;
      if (e.competition_ref && subBuckets.compRefs.has(e.competition_ref)) return true;
      if (e.home_entity_ref && subBuckets.entRefs.has(e.home_entity_ref)) return true;
      if (e.away_entity_ref && subBuckets.entRefs.has(e.away_entity_ref)) return true;
      return false;
    });
  }, [events, subBuckets]);

  const categoryNarrowed = useMemo(() => {
    if (!activeCategoryId) return subscribedEvents;
    return subscribedEvents.filter((e) => e.category_id === activeCategoryId);
  }, [subscribedEvents, activeCategoryId]);

  const filteredAll = useMemo(() => applyFilter(categoryNarrowed, filter), [categoryNarrowed, filter]);

  // Competition list shown in the filter modal — derived from what's
  // actually visible after category narrowing, so the user doesn't see
  // "Premier League" in the dropdown when they're filtered to F1.
  const competitionList = useMemo(() => {
    const seen = new Set();
    for (const e of categoryNarrowed) {
      if (e.competition_name) seen.add(e.competition_name);
    }
    return Array.from(seen).sort();
  }, [categoryNarrowed]);

  const filtered = useMemo(() => {
    return filteredAll
      .filter((e) => {
        const d = parseISO(e.start_time);
        if (timeFilter === 'today') return isToday(d) || e.is_live;
        if (timeFilter === 'tomorrow') return isTomorrow(d);
        if (timeFilter === 'week') return isThisWeek(d, { weekStartsOn: 1 });
        if (timeFilter === 'all') return isAfter(d, new Date()) || e.is_live;
        return true;
      })
      .sort((a, b) => {
        if (a.is_live && !b.is_live) return -1;
        if (!a.is_live && b.is_live) return 1;
        return new Date(a.start_time) - new Date(b.start_time);
      });
  }, [filteredAll, timeFilter]);

  const liveEvents = filtered.filter((e) => e.is_live);
  const upcomingToday = filtered.filter((e) => !e.is_live && isToday(parseISO(e.start_time)));
  const tomorrowEvents = filteredAll
    .filter((e) => isTomorrow(parseISO(e.start_time)))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 3);

  const todayCount = filteredAll.filter(
    (e) => isToday(parseISO(e.start_time)) || e.is_live
  ).length;

  if (eventsLoading || subsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No subscriptions: route the user to onboarding.
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
                : tomorrowEvents.length > 0
                ? `bugün sakin, yarın ${tomorrowEvents.length} etkinlik var`
                : 'şu an takip ettiğin bir etkinlik yok'}
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

      {/* Time filter chips + filter button */}
      <div className="px-5 mb-3">
        <FilterChips
          active={timeFilter}
          onSelect={setTimeFilter}
          onOpenFilters={() => setFilterModalOpen(true)}
          filtersActive={isFilterActive(filter)}
        />
      </div>

      {/* Category chips (only if user follows >1 category) */}
      <div className="px-5 mb-5">
        <CategoryChips
          categories={subscribedCategories}
          activeId={activeCategoryId}
          onSelect={setActiveCategoryId}
        />
      </div>

      {/* Content */}
      <div className="px-5 space-y-6">
        {/* CANLI section (today only) */}
        {timeFilter === 'today' && liveEvents.length > 0 && (
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

        {/* BUGÜN section — only when today actually has something */}
        {timeFilter === 'today' && upcomingToday.length > 0 && (
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

        {/* YARIN section — header label adapts depending on whether
            today already has cards (then it's a preview) or today is
            empty (then yarın IS the main list). The header subline
            already says "bugün sakin, yarın N etkinlik var" so we don't
            add a second hint here. */}
        {timeFilter === 'today' && tomorrowEvents.length > 0 && (
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

        {/* Other time filters: flat list */}
        {timeFilter !== 'today' && filtered.length > 0 && (
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

        {/* Hard empty state — today AND tomorrow are both empty. */}
        {timeFilter === 'today' &&
          liveEvents.length === 0 &&
          upcomingToday.length === 0 &&
          tomorrowEvents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-body text-muted-foreground">
                bugün ve yarın takip ettiğin bir etkinlik yok
              </p>
            </div>
          )}

        {timeFilter !== 'today' && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-body text-muted-foreground">
              bu kriterlerde etkinlik yok
            </p>
          </div>
        )}
      </div>

      <FilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        competitions={competitionList}
        value={filter}
        onChange={setFilter}
      />

      <BottomTabBar />
    </div>
  );
}
