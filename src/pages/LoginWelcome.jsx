import React from 'react';
import { Bell, Calendar, Target, ArrowRight } from 'lucide-react';
import { getGreeting } from '@/lib/useTheme';

/**
 * Pre-login welcome screen.
 *
 * Base44's hosted login page is generic and can't be re-skinned per
 * app on our plan, so we own the moment *before* that redirect:
 * brand pitch, three feature chips, "Google ile devam et" CTA. When
 * the user taps the CTA we hand off to base44.auth.redirectToLogin
 * via the parent's navigateToLogin().
 *
 * Theme-aware: uses the same morning/day/evening tokens as Home, so
 * the welcome always matches the app the user is about to enter.
 */
export default function LoginWelcome({ onContinue }) {
  const greeting = getGreeting();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top brand row — small enough that the CTA stays above the fold
          on a 5.5" phone, big enough to register the brand. */}
      <div className="px-6 pt-16 pb-2">
        <p className="text-[15px] text-muted-foreground font-medium">
          {greeting.text} {greeting.emoji}
        </p>
        <h1 className="text-[40px] leading-[1.05] font-bold text-foreground tracking-tight mt-2">
          bugün<br />ne var?
        </h1>
        <p className="text-[16px] text-muted-foreground mt-3 leading-snug max-w-md">
          takip ettiğin sporlar, turnuvalar ve TV — tek bir günde, sadece senin
          seçtiklerin.
        </p>
      </div>

      {/* Feature chips — three, each one a single line. We deliberately
          use the same icon set as the rest of the app to keep brand
          fingerprints tight. */}
      <div className="px-6 mt-10 space-y-3">
        <FeatureRow
          icon={<Bell className="w-5 h-5" strokeWidth={1.75} />}
          title="hatırlatmalar"
          desc="maçtan 15 dk önce bildirim"
        />
        <FeatureRow
          icon={<Calendar className="w-5 h-5" strokeWidth={1.75} />}
          title="takvim senkronu"
          desc="tek tıkla telefon takvimine"
        />
        <FeatureRow
          icon={<Target className="w-5 h-5" strokeWidth={1.75} />}
          title="sadece senin seçtiklerin"
          desc="lig, takım, oyuncu — istediğin kadar daralt"
        />
      </div>

      {/* Spacer pushes the CTA to the bottom. We keep some bottom-safe
          padding for iPhone home indicators / Android nav bars. */}
      <div className="flex-1" />

      <div className="px-6 pb-12 space-y-3">
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-full text-body font-semibold flex items-center justify-center gap-2 bg-foreground text-background press-scale shadow-md transition-all"
        >
          giriş yap
          <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
        </button>
        <p className="text-center text-[13px] text-muted-foreground">
          Google veya e-posta ile
        </p>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border">
      <div className="mt-0.5 w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center text-foreground shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
