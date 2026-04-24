import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sun, Sunrise, Moon, RotateCcw } from 'lucide-react';
import { useTheme } from '@/lib/useTheme';
import BottomTabBar from '@/components/common/BottomTabBar';

const themeOptions = [
  { key: null, label: 'otomatik', subtitle: 'saate göre değişir', icon: RotateCcw },
  { key: 'morning', label: 'sabah', subtitle: 'sıcak sarı-krem', icon: Sunrise },
  { key: 'day', label: 'gündüz', subtitle: 'krem-kahve tonları', icon: Sun },
  { key: 'evening', label: 'akşam', subtitle: 'koyu altın tonları', icon: Moon },
];

export default function Settings() {
  const navigate = useNavigate();
  const { activeTheme, themeOverride, setOverride } = useTheme();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center press-scale"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-title font-semibold text-foreground">ayarlar</h1>
      </div>

      {/* Theme section */}
      <div className="px-5">
        <h2 className="text-micro uppercase text-muted-foreground tracking-wider mb-3">
          tema
        </h2>
        <div className="space-y-2">
          {themeOptions.map((opt) => {
            const isActive = themeOverride === opt.key;
            const Icon = opt.icon;
            return (
              <button
                key={opt.key || 'auto'}
                onClick={() => setOverride(opt.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all press-scale ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-body font-medium text-foreground">{opt.label}</p>
                  <p className="text-caption text-muted-foreground">{opt.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}