import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { getCategoryColorClass } from '@/lib/categoryUtils';
import BottomTabBar from '@/components/common/BottomTabBar';

export default function Kesfet() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

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
        <h1 className="text-display font-bold text-foreground">keşfet</h1>
        <p className="text-body text-muted-foreground mt-1">
          yeni kategoriler ve etkinlikler
        </p>
      </div>

      <div className="px-5">
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => {
            const colorClass = getCategoryColorClass(cat);
            return (
              <div
                key={cat.id}
                className="p-4 rounded-xl border border-border bg-card press-scale"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 bg-${colorClass}/15`}>
                  {cat.emoji}
                </div>
                <h3 className="text-body font-semibold text-foreground">{cat.name}</h3>
                <p className="text-caption text-muted-foreground mt-0.5 line-clamp-1">
                  {cat.subtitle}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}