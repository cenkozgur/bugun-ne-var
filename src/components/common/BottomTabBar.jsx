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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors press-scale ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}