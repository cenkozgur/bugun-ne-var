import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, Clock, Compass, Settings } from 'lucide-react';

const tabs = [
  { path: '/', label: 'bugün', icon: CalendarDays },
  { path: '/yakinda', label: 'yakında', icon: Clock },
  { path: '/kesfet', label: 'keşfet', icon: Compass },
  { path: '/ayarlar', label: 'ayarlar', icon: Settings },
];

export default function BottomTabBar() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 tab-glass bg-card/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around px-2 h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center gap-1 px-4 py-1.5 press-scale"
            >
              <div className="relative">
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground/60'
                  }`}
                  strokeWidth={1.75}
                />
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-opacity ${
                  isActive ? 'text-primary opacity-100' : 'opacity-0 h-0 overflow-hidden'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}