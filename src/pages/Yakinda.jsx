import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { parseISO, isAfter, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import EventCard from '@/components/home/EventCard';
import CategoryChips from '@/components/home/CategoryChips';
import BottomTabBar from '@/components/common/BottomTabBar';
import FilterModal, { EMPTY_FILTER, isFilterActive, applyFilter } from '@/components/common/FilterModal';

export default function Yakinda() {
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filter, setFilter] = useState(EMPTY_FILTER);

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

  const isLoading = eventsLoading || subsLoading;

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

  const subBuckets = useMemo(() => {
    const cats = new Set();
    const compRefs = new Set();
    const entRefs = new Set();
    const compCats = new Set();
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

  const subscribedCategoryIds = useMemo(
    () => new Set([...subBuckets.cats, ...subBuckets.compCats]),
    [subBuckets]
  );

  const subscribedCategories = useMemo(
    () => categories.filter((c) => subscribedCategoryIds.has(c.id)),
    [categories, subscribedCategoryIds]
  );

  // Subscription gate (OR across category/competition/entity), then
  // category narrowing, then filter modal, then "in the future and not
  // currently live" + sort.
  const subscribed = useMemo(() => {
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
    if (!activeCategoryId) return subscribed;
    return subscribed.filter((e) => e.category_id === activeCategoryId);
  }, [subscribed, activeCategoryId]);

  const competitionList = useMemo(() => {
    const seen = new Set();
    for (const e of categoryNarrowed) {
      if (e.competition_name) seen.add(e.competition_name);
    }
    return Array.from(seen).sort();
  }, [categoryNarrowed]);

  const filteredAll = useMemo(() => applyFilter(categoryNarrowed, filter), [categoryNarrowed, filter]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return filteredAll
      .filter((e) => isAfter(parseISO(e.start_time), now) && !e.is_live)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [filteredAll]);

  // Group by date so "yarın", "Cumartesi 3 Mayıs" etc. all stack visually.
  const grouped = useMemo(() => {
    const groups = {};
    upcoming.forEach((e) => {
      const key = format(parseISO(e.start_time), 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).map(([date, items]) => ({
      date,
      label: format(parseISO(date), 'd MMMM EEEE', { locale: tr }),
      events: items,
    }));
  }, [upcoming]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-14 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-display font-bold text-foreground">yakında</h1>
          <p className="text-body text-muted-foreground mt-1">
            önümüzdeki etkinlikler
          </p>
        </div>
        <button
          onClick={() => setFilterModalOpen(true)}
          className={`relative mt-1 p-2 rounded-xl press-scale ${
            isFilterActive(filter)
              ? 'bg-primary/15 text-primary'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          {isFilterActive(filter) && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* Category chips */}
      <div className="px-5 mb-5">
        <CategoryChips
          categories={subscribedCategories}
          activeId={activeCategoryId}
          onSelect={setActiveCategoryId}
        />
      </div>

      <div className="px-5 space-y-6">
        {grouped.map((group) => (
          <section key={group.date}>
            <h2 className="text-micro uppercase text-muted-foreground tracking-wider mb-3">
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  category={categoryMap[event.category_id]}
                />
              ))}
            </div>
          </section>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-16">
            <p className="text-body text-muted-foreground">
              {subscribedCategoryIds.size === 0
                ? 'henüz hiçbir kategori takip etmiyorsun'
                : 'bu kriterlerde yaklaşan etkinlik yok'}
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
