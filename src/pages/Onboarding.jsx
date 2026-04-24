import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StepDots from '@/components/onboarding/StepDots';
import CategoryTile from '@/components/onboarding/CategoryTile';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function Onboarding() {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const toggleCategory = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = async () => {
    const subscriptions = Array.from(selectedIds).map((id) => ({
      target_type: 'category',
      target_id: id,
      preset: 'all',
    }));
    await Promise.all(
      subscriptions.map((s) => base44.entities.UserSubscription.create(s))
    );
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top area */}
      <div className="px-6 pt-14 pb-6">
        <StepDots total={4} current={1} />

        <h1 className="text-display font-bold text-foreground mt-8 leading-tight">
          neleri takip{'\n'}ediyorsun?
        </h1>
        <p className="text-body text-muted-foreground mt-3">
          sonra istediğin kadar daralt — takım, oyuncu, turnuva.
        </p>
      </div>

      {/* Category grid */}
      <div className="flex-1 px-6 pb-28 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <CategoryTile
              key={cat.id}
              category={cat}
              selected={selectedIds.has(cat.id)}
              onToggle={() => toggleCategory(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={handleContinue}
          disabled={selectedIds.size === 0}
          className={`w-full py-4 rounded-full text-body font-semibold flex items-center justify-center gap-2 transition-all press-scale ${
            selectedIds.size > 0
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          devam et
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}