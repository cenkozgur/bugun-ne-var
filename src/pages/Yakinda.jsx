import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { parseISO, isAfter, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import EventCard from '@/components/home/EventCard';
import BottomTabBar from '@/components/common/BottomTabBar';

export default function Yakinda() {
  const { data: events = [], isLoading } = useQuery({
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

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => isAfter(parseISO(e.start_time), now) && !e.is_live)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [events]);

  // Group by date
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
      <div className="px-5 pt-14 pb-6">
        <h1 className="text-display font-bold text-foreground">yakında</h1>
        <p className="text-body text-muted-foreground mt-1">
          önümüzdeki etkinlikler
        </p>
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
              yaklaşan etkinlik yok
            </p>
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}