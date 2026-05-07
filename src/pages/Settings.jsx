import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sun, Sunrise, Moon, RotateCcw, LogOut, User } from 'lucide-react';
import { useTheme } from '@/lib/useTheme';
import { useAuth } from '@/lib/AuthContext';
import BottomTabBar from '@/components/common/BottomTabBar';

const themeOptions = [
  { key: null, label: 'otomatik', subtitle: 'saate göre değişir', icon: RotateCcw },
  { key: 'morning', label: 'sabah', subtitle: 'sıcak sarı-krem', icon: Sunrise },
  { key: 'day', label: 'gündüz', subtitle: 'krem-kahve tonları', icon: Sun },
  { key: 'evening', label: 'akşam', subtitle: 'koyu altın tonları', icon: Moon },
];

export default function Settings() {
  const navigate = useNavigate();
  const { themeOverride, setOverride } = useTheme();
  const { user, logout } = useAuth();

  // Friendly display: user.full_name → user.email → fallback. Base44's
  // /me payload exposes both, so we show name when present and email
  // as a secondary line for verification.
  const displayName = user?.full_name || user?.name || user?.email || 'kullanıcı';
  const showEmail = user?.email && displayName !== user.email;

  const handleLogout = () => {
    // Don't pop a confirm() — too jarring, and the user can sign back
    // in immediately if it was a mistap. Logout itself redirects via
    // base44.auth.logout(window.location.href) under the hood, so we
    // don't need to navigate manually.
    logout(true);
  };

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

      {/* Account section */}
      {user ? (
        <div className="px-5 mb-8">
          <h2 className="text-micro uppercase text-muted-foreground tracking-wider mb-3">
            hesap
          </h2>
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-xl bg-secondary text-muted-foreground flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-medium text-foreground truncate">{displayName}</p>
              {showEmail ? (
                <p className="text-caption text-muted-foreground truncate">{user.email}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Logout — destructive style (red text on neutral surface) so it
          doesn't shout. We only render when the user is actually
          authenticated; pre-auth there's nothing to log out of. */}
      {user ? (
        <div className="px-5 mt-8">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-border bg-card text-destructive press-scale"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-body font-medium">çıkış yap</span>
          </button>
        </div>
      ) : null}

      <BottomTabBar />
    </div>
  );
}