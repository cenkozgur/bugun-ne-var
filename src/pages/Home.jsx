import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings, Loader2, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isToday, parseISO } from 'date-fns';
import { applyTimeFilter, tomorrowPreview, todayCount as countToday } from '@/lib/filterEvents';
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

  const filtered = useMemo(
    () => applyTimeFilter(filteredAll, timeFilter),
    [filteredAll, timeFilter]
  );

  const liveEvents = filtered.filter((e) => e.is_live);
  const upcomingToday = filtered.filter((e) => !e.is_live && isToday(parseISO(e.start_time)));
  const tomorrowEvents = useMemo(() => tomorrowPreview(filteredAll, 3), [filteredAll]);
  const todayCount = useMemo(() => countToday(filteredAll), [filteredAll]);

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
            <h1 className="text-[32px] font-bold text-foreground leading-tight tracking-tight">
              {greeting.text} {greeting.emoji}
            </h1>
            <p className="text-[15px] text-muted-foreground mt-1 font-medium">
              henüz hiçbir şey takip etmiyorsun
            </p>
          </div>
          <Link
            to="/ayarlar"
            className="mt-1 p-2.5 rounded-2xl bg-secondary/60 text-muted-foreground press-scale"
          >
            <Settings className="w-5 h-5" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="px-5 pt-12 flex flex-col items-center text-center">
          <div className="text-5xl mb-5">🏟️</div>
          <h2 className="text-[20px] font-semibold text-foreground mb-2 tracking-tight">
            ne takip etmek istersin?
          </h2>
          <p className="text-[15px] text-muted-foreground mb-8 max-w-xs leading-relaxed">
            kategorileri seç, sadece ilgilendiklerini gör.
          </p>
          <Link
            to="/onboarding"
            className="px-6 py-3.5 rounded-full bg-primary text-primary-foreground text-body font-semibold press-scale shadow-md"
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
            <h1 className="text-[32px] font-bold text-foreground leading-tight tracking-tight">
              {greeting.text} {greeting.emoji}
            </h1>
            <p className="text-[15px] text-muted-foreground mt-1 font-medium">
              {todayCount > 0
                ? `bugün ${todayCount} etkinlik var`
                : tomorrowEvents.length > 0
                ? `bugün sakin, yarın ${tomorrowEvents.length} etkinlik var`
                : 'şu an takip ettiğin bir etkinlik yok'}
            </p>
          </div>
          <Link
            to="/ayarlar"
            className="mt-1 p-2.5 rounded-2xl bg-secondary/60 text-muted-foreground press-scale"
          >
            <Settings className="w-5 h-5" strokeWidth={1.75} />
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

        {/* Empty state. If the user follows specific things but those
            aren't on the schedule today, distinguish "scope is empty"
            (sakin gün) from "you follow things that aren't playing"
            (abonelik aktif ama bu hafta yok) so it doesn't read like
            the app is broken. */}
        {timeFilter === 'today' &&
          liveEvents.length === 0 &&
          upcomingToday.length === 0 && (
            <div className="text-center py-16 flex flex-col items-center">
              <div className="text-5xl mb-4">😴</div>
              <h3 className="text-[17px] font-semibold text-foreground mb-1">bugün sakin</h3>
              <p className="text-[14px] text-muted-foreground max-w-xs leading-relaxed">
                {subscribedEvents.length === 0
                  ? 'takip ettiklerin bu sıralar sahada yok'
                  : 'bugün takip ettiğin bir etkinlik yok'}
              </p>
            </div>
          )}

        {timeFilter !== 'today' && filtered.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-[17px] font-semibold text-foreground mb-1">
              {subscribedEvents.length === 0 ? 'sahada yok' : 'etkinlik bulunamadı'}
            </h3>
            <p className="text-[14px] text-muted-foreground max-w-xs leading-relaxed">
              {subscribedEvents.length === 0
                ? 'takip ettiklerin bu sıralar sahada yok'
                : 'bu kriterlerde etkinlik yok'}
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