import React, { useState, useEffect } from 'react';

interface Props {
  activeCategory?: string;
}

export default function HamburgerMenu({ activeCategory }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const sports = [
    {
      name: 'Football Desk',
      category: 'football',
      href: '/football/',
      icon: (
        <svg className="w-5 h-5 text-[#c9f36b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      ),
      tag: 'Premier League, UCL, La Liga',
      badge: 'Live Feeds',
      badgeColor: 'border-[#c9f36b]/40 text-[#c9f36b] bg-[#c9f36b]/10',
    },
    {
      name: 'NPL 2026',
      category: 'npl',
      href: '/npl/',
      icon: (
        <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
          <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      ),
      tag: 'Official Nepal Premier League',
      badge: '32 Fixtures',
      badgeColor: 'border-red-500/40 text-red-400 bg-red-500/15 animate-pulse',
    },
    {
      name: 'Cricket Desk',
      category: 'cricket',
      href: '/cricket/',
      icon: (
        <svg className="w-5 h-5 text-[#c9f36b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 4.24 4.24" />
          <path d="m14.83 9.17 4.24-4.24" />
          <path d="m14.83 14.83 4.24 4.24" />
          <path d="m9.17 14.83-4.24 4.24" />
        </svg>
      ),
      tag: 'ICC, IPL, Bilateral Series',
      badge: 'NST Scores',
      badgeColor: 'border-[#c9f36b]/40 text-[#c9f36b] bg-[#c9f36b]/10',
    },
    {
      name: 'Basketball Desk',
      category: 'basketball',
      href: '/basketball/',
      icon: (
        <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2.1 10.5A10 10 0 0 1 10.5 2.1" />
          <path d="M21.9 13.5a10 10 0 0 1-8.4 8.4" />
          <path d="M2 12h20" />
          <path d="M12 2v20" />
        </svg>
      ),
      tag: 'NBA & EuroLeague Fixtures',
      badge: 'Live Quarters',
      badgeColor: 'border-amber-400/40 text-amber-300 bg-amber-400/10',
    },
  ];

  const tools = [
    {
      name: 'FotMob Matchday Hub',
      category: 'hub',
      href: '/hub/',
      icon: (
        <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
      tag: 'FotMob live matches, standings & TV',
    },
    {
      name: 'My Personal Watchlist',
      category: 'dashboard',
      href: '/dashboard/',
      icon: (
        <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
      tag: 'Follow clubs & track personal schedule',
    },
    {
      name: 'About Dipesh Sapkota',
      category: 'creator',
      href: '/about-dipesh-sapkota/',
      icon: (
        <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      tag: 'Software Developer & Creator of Sportivo',
    },
    {
      name: 'Official Privacy Policy',
      category: 'privacy',
      href: '/privacy/',
      icon: (
        <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      tag: 'Device permissions & store compliance',
    },
    {
      name: 'Developer Fixture API',
      category: 'api-docs',
      href: '/api-docs/',
      icon: (
        <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      tag: 'Open REST endpoints for developers',
    },
  ];

  return (
    <>
      {/* Sleek Mobile Hamburger Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Navigation Menu"
        className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#141f1d] px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-[#c9f36b]/60 hover:bg-[#1a2927] hover:text-white transition-all shadow-sm active:scale-95"
      >
        <span className="flex flex-col gap-1 w-4">
          <span className="h-0.5 w-4 bg-[#c9f36b] rounded-full"></span>
          <span className="h-0.5 w-3 bg-white rounded-full"></span>
          <span className="h-0.5 w-4 bg-[#c9f36b] rounded-full"></span>
        </span>
      </button>

      {/* Slide-over Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-[99999] w-full max-w-[320px] sm:max-w-[360px] bg-[#0c1413] border-l border-white/15 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Sportivo Navigation Drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#111c1a]">
          <a href="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c9f36b] opacity-80"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#c9f36b]"></span>
            </span>
            <span className="text-lg font-black text-white tracking-tight">
              Sportivo<span className="text-[#c9f36b]">.</span>
            </span>
            <span className="rounded bg-black/60 border border-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#e5b94f]">
              Nepal
            </span>
          </a>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close Navigation Menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Sports Arenas Section */}
          <div>
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#c9f36b] mb-3">
              Sports Arenas
            </span>
            <div className="space-y-2">
              {sports.map((item) => {
                const isActive = activeCategory === item.category;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'border-[#c9f36b] bg-[#c9f36b]/15 text-white shadow-md'
                        : 'border-white/10 bg-[#121d1b] text-slate-200 hover:border-[#c9f36b]/40 hover:bg-[#162421]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="shrink-0">{item.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.tag}</div>
                      </div>
                    </div>
                    {item.badge && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black border uppercase tracking-wider shrink-0 ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Tools & Information */}
          <div>
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#e5b94f] mb-3">
              Tools &amp; Information
            </span>
            <div className="space-y-2">
              {tools.map((item) => {
                const isActive = activeCategory === item.category;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'border-[#c9f36b] bg-[#c9f36b]/15 text-white'
                        : 'border-white/10 bg-[#121d1b] text-slate-200 hover:border-[#c9f36b]/40 hover:bg-[#162421]'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white">{item.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.tag}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-white/10 p-5 bg-[#0e1615] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Timezone:</span>
            <span className="font-bold text-[#c9f36b]">NST (UTC+5:45)</span>
          </div>
          <div className="text-[10px] text-slate-500 text-center pt-2">
            Created &amp; Published by <span className="text-white font-semibold">Dipesh Sapkota</span>
          </div>
        </div>
      </div>
    </>
  );
}
