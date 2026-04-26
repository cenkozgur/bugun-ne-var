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
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl border-t border-border max-h-[88vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Drag handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-2 pb-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center press-scale"
              aria-label="Geri"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
          ) : null}
          <div className="flex-1 min-w-0">
            <h2 className="text-title font-semibold text-foreground truncate">{title}</h2>
            {subtitle ? (
              <p className="text-caption text-muted-foreground truncate">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center press-scale"
            aria-label="Kapat"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {children}
        </div>

        {/* Footer — fixed at bottom of sheet */}
        {footer ? (
          <div className="px-4 pt-3 pb-6 border-t border-border bg-background">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
