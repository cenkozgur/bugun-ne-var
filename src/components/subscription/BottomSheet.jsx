import React, { useEffect } from 'react';
import { X, ChevronLeft } from 'lucide-react';

/**
 * Generic bottom-sheet shell used by category and team selectors.
 *
 *   - Slides up from the bottom on open.
 *   - Background is a dimmed scrim; tap-out closes.
 *   - Optional onBack renders a chevron on the left of the header
 *     (used when a team sheet sits on top of a category sheet).
 *   - Locks page scroll while open so the underlying SubscriptionManager
 *     can't accidentally scroll under the user's thumb.
 */
export default function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  onBack,
  footer,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Allow Escape on web for power users.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 sheet-backdrop"
      />
      <div className="relative w-full max-w-md bg-card rounded-t-[28px] max-h-[88vh] flex flex-col animate-in slide-in-from-bottom duration-250">
        {/* Drag handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-2 pb-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center press-scale"
              aria-label="Geri"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" strokeWidth={1.75} />
            </button>
          ) : null}
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-semibold text-foreground truncate leading-tight">{title}</h2>
            {subtitle ? (
              <p className="text-[13px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center press-scale"
            aria-label="Kapat"
          >
            <X className="w-4 h-4 text-foreground" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {children}
        </div>

        {/* Footer — fixed at bottom of sheet */}
        {footer ? (
          <div className="px-5 pt-3 pb-6 bg-card">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}