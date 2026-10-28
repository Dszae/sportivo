import React, { useState, useEffect } from 'react';

// Sports backgrounds that cycle continuously 24/7 (high-quality sports photography on CDN)
const BG_IMAGES = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1600&auto=format&fit=crop', // Football pitch
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop', // Cricket stadium
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1600&auto=format&fit=crop', // Basketball court
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1600&auto=format&fit=crop', // Football stadium floodlights
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1600&auto=format&fit=crop', // Cricket bowler delivery
  'https://images.unsplash.com/photo-1611791484670-ce19b801d192?q=80&w=1600&auto=format&fit=crop', // Tennis action
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop', // Night sports arena
];

// Generic Sportivo slogans — sport-neutral, rotating smoothly without layout jumps
const SLOGANS = [
  {
    headline: 'Every Match.',
    sub: 'Every Sport.',
    description: 'Live kickoffs, real-time scores, and multi-server HD streams — all in Nepal Standard Time.',
  },
  {
    headline: 'Live. Now.',
    sub: 'From Anywhere.',
    description: 'Track football, cricket, and basketball from top leagues worldwide, synced to NST.',
  },
  {
    headline: 'Your Sports.',
    sub: 'Your Schedule.',
    description: 'Personalise your watchlist, get live match alerts, and never miss a kickoff again.',
  },
  {
    headline: 'Stream.',
    sub: 'Without Limits.',
    description: 'Multi-provider HD streams with team crests, live scoreboards, and zero friction.',
  },
];

export default function HeroShowcase() {
  const [bgIndex, setBgIndex] = useState(0);
  const [sloganIndex, setSloganIndex] = useState(0);

  // Preload all background images immediately to eliminate any network flash or flicker
  useEffect(() => {
    BG_IMAGES.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // Smooth, continuous 7s cycle — slow cinematic dissolve with zero flicker
  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % BG_IMAGES.length);
      setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      aria-label="Sportivo — Live Sports Streaming"
      className="relative w-full overflow-hidden bg-[#080a0b]"
    >
      {/* Full-bleed Edge-to-Edge Background with Cinema Crossfade & Slow Ken Burns */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden" aria-hidden="true">
        {BG_IMAGES.map((url, idx) => {
          const isActive = idx === bgIndex;
          return (
            <div
              key={idx}
              className={`absolute inset-0 w-full h-full transition-opacity duration-[2200ms] ease-in-out will-change-[opacity] ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={url}
                alt=""
                width="1920"
                height="1080"
                loading="eager"
                decoding="async"
                className={`h-full w-full object-cover object-center transition-transform duration-[8500ms] ease-out will-change-transform ${
                  isActive ? 'scale-110' : 'scale-100'
                }`}
                style={{
                  filter: 'brightness(0.6) contrast(1.1)',
                  opacity: 0.5,
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
              />
            </div>
          );
        })}

        {/* Ambient Top Vignette — z-20 sits on top of images */}
        <div className="absolute inset-x-0 top-0 h-32 z-20 pointer-events-none bg-gradient-to-b from-[#080a0b]/90 via-[#080a0b]/40 to-transparent" aria-hidden="true"></div>

        {/* Horizontal Vignette for Left-side Headline Contrast — z-20 */}
        <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 z-20 pointer-events-none bg-gradient-to-r from-[#080a0b]/90 via-[#080a0b]/50 to-transparent" aria-hidden="true"></div>

        {/* Seamless Bottom Gradient Blend into Pure Site Black — z-20 */}
        <div className="absolute inset-x-0 bottom-0 h-56 sm:h-64 lg:h-72 z-20 pointer-events-none bg-gradient-to-t from-[#080a0b] via-[#080a0b]/85 to-transparent" aria-hidden="true"></div>
      </div>

      {/* Content Container (Constrained & Aligned with Grid — z-30 above all gradients) */}
      <div className="relative z-30 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-14 sm:pt-8 sm:pb-16 lg:pt-10 lg:pb-20">
        {/* Top Meta Bar */}
        <div className="mb-4 sm:mb-8 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <a
            href="/about-dipesh-sapkota/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-slate-300 backdrop-blur-md hover:border-[#c9f36b]/40 hover:text-[#c9f36b] transition-all shadow-sm"
            title="Learn more about the creator of Sportivo"
          >
            <img
              src="/dipesh-sapkota-profile.webp"
              alt=""
              className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full object-cover border border-[#c9f36b]"
              width="16"
              height="16"
              loading="eager"
            />
            <span>Sportivo by Dipesh Sapkota</span>
          </a>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-bold text-[#e5b94f] backdrop-blur-md">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></span>
            <span>Live Desk · Nepal Time (NST)</span>
          </div>
        </div>

        {/* Center Headline & Rotating Slogan Stage — CSS Grid Stacking (Zero Layout Shift) */}
        <div className="max-w-3xl py-1 sm:py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9f36b]/30 bg-[#c9f36b]/10 px-3 py-0.5 sm:px-3.5 sm:py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#c9f36b] mb-3 sm:mb-4">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#c9f36b]" aria-hidden="true" />
            Live Sports Hub · Nepal
          </div>

          {/* Fixed-stage CSS Grid: All slogans occupy the exact same cell so the page below never shifts */}
          <div className="grid grid-cols-1 grid-rows-1 min-h-[140px] sm:min-h-[180px] lg:min-h-[210px]">
            {SLOGANS.map((item, idx) => {
              const isCurrent = idx === sloganIndex;
              return (
                <div
                  key={idx}
                  aria-hidden={!isCurrent}
                  className={`col-start-1 row-start-1 flex flex-col justify-start transition-all duration-1000 ease-in-out ${
                    isCurrent
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}
                >
                  {idx === 0 ? (
                    <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight text-white">
                      Sportivo — {item.headline}{' '}
                      <span className="text-[#c9f36b]">{item.sub}</span>
                    </h1>
                  ) : (
                    <div className="text-3xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight text-white">
                      {item.headline}{' '}
                      <span className="text-[#c9f36b]">{item.sub}</span>
                    </div>
                  )}

                  <p className="mt-2.5 sm:mt-4 max-w-2xl text-sm sm:text-lg leading-relaxed text-slate-300">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Quick Action Navigation (Touch-Friendly Responsive Buttons) */}
          <div className="mt-5 sm:mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
            <a
              href="/football/"
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#c9f36b] px-4 sm:px-6 py-2 sm:py-2.5 text-xs font-black uppercase tracking-wider text-[#080c0b] shadow-lg shadow-[#c9f36b]/20 transition-all hover:bg-[#b5e056] active:scale-95"
            >
              <span>⚽</span>
              <span>Football Live</span>
            </a>
            <a
              href="/npl/"
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-red-500/40 bg-red-600/20 px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-black uppercase tracking-wider text-red-300 shadow-md backdrop-blur-md transition-all hover:bg-red-600/30 active:scale-95"
            >
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>NPL 2026</span>
            </a>
            <a
              href="/cricket/"
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/10 bg-white/5 px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold text-slate-200 backdrop-blur-md transition-all hover:border-[#c9f36b]/40 hover:text-white active:scale-95"
            >
              <span>🏏</span>
              <span>Cricket Desk</span>
            </a>
            <a
              href="/dashboard/"
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-amber-300 backdrop-blur-md transition-all hover:bg-amber-400/20 active:scale-95"
            >
              <span>★</span>
              <span>Watchlist</span>
            </a>
          </div>
        </div>

        {/* Bottom Carousel Progress Indicators */}
        <div className="flex items-center gap-1.5 pt-6 border-t border-white/5">
          {BG_IMAGES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Background image ${idx + 1}`}
              onClick={() => {
                setBgIndex(idx);
                setSloganIndex(idx % SLOGANS.length);
              }}
              className={`block rounded-full transition-all duration-500 focus:outline-none ${
                idx === bgIndex ? 'h-1.5 w-8 bg-[#c9f36b]' : 'h-1.5 w-2 bg-white/20 hover:bg-white/50'
              }`}
              aria-current={idx === bgIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
