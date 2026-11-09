import React, { useState, useEffect } from 'react';

export default function MobileAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('sportivo_app_banner_dismissed');
      // If not dismissed or dismissed more than 24h ago
      if (!dismissed || Date.now() - parseInt(dismissed, 10) > 24 * 3600 * 1000) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('sportivo_app_banner_dismissed', Date.now().toString());
    } catch {}
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Download Sportivo Android App"
      className="sticky top-14 z-40 sm:hidden border-b border-lime/20 bg-ink-950/95 px-3 py-2.5 backdrop-blur-md shadow-card transition-all"
    >
      <div className="flex items-center justify-between gap-2.5">
        {/* App Icon & Title */}
        <a href="/download/" className="flex flex-1 items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-lime/30 bg-ink-900 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_8px_rgba(201,243,107,0.8)]"></span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-fg leading-none">Sportivo App</span>
              <span className="rounded bg-lime/15 px-1 py-0.2 text-[10px] font-semibold text-lime leading-tight">FREE</span>
            </div>
            <p className="truncate text-[11px] text-fg-2 mt-0.5">
              Watch NPL 2026 Live in Zero Delay
            </p>
          </div>
        </a>

        {/* Download CTA */}
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href="/download/sportivo.apk"
            download="sportivo.apk"
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-ink-950 shadow-sm active:scale-95 transition-transform"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5M12 15V3" />
            </svg>
            <span>Get APK</span>
          </a>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss app banner"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-3 hover:text-fg active:bg-ink-800 transition-colors"
          >
            <span className="text-sm font-bold">✕</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
