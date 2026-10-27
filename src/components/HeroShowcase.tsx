import React, { useState, useEffect } from 'react';

// Sports backgrounds that cycle continuously 24/7 (routed via local first-party proxy)
const RAW_BG_IMAGES = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1600&auto=format&fit=crop', // Football pitch
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop', // Cricket stadium
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1600&auto=format&fit=crop', // Basketball court
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1600&auto=format&fit=crop', // Football stadium lights
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1600&auto=format&fit=crop', // Cricket bowler
  'https://images.unsplash.com/photo-1611791484670-ce19b801d192?q=80&w=1600&auto=format&fit=crop', // Tennis action
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop', // Night arena
];

const BG_IMAGES = RAW_BG_IMAGES.map((url) => `/api/thumbnail?url=${encodeURIComponent(url)}`);

// Generic Sportivo slogans — sport-neutral, rotating
const SLOGANS = [
  { headline: 'Every Match.', sub: 'Every Sport.', description: 'Live kickoffs, real-time scores, and multi-server HD streams — all in Nepal Standard Time.' },
  { headline: 'Live. Now.', sub: 'From Anywhere.', description: 'Track football, cricket, and basketball from top leagues worldwide, synced to NST.' },
  { headline: 'Your Sports.', sub: 'Your Schedule.', description: 'Personalise your watchlist, get live match alerts, and never miss a kickoff again.' },
  { headline: 'Stream.', sub: 'Without Limits.', description: 'Multi-provider HD streams with team crests, live scoreboards, and zero friction.' },
];

export default function HeroShowcase() {
  const [bgIndex, setBgIndex] = useState(0);
  const [sloganIndex, setSloganIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  // Cycle backgrounds every 5 seconds continuously — sport-neutral auto-rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setFadeOut(true);
      setTimeout(() => {
        setBgIndex((prev) => (prev + 1) % BG_IMAGES.length);
        setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
        setFadeOut(false);
      }, 700);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const slogan = SLOGANS[sloganIndex];

  return (
    <section
      aria-label="Sportivo — Live Sports Streaming"
      className="relative w-full overflow-hidden bg-[#080a0b]"
    >
      {/* Full-bleed Edge-to-Edge Background with Ken Burns Zoom & Subtle Opacity */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden" aria-hidden="true">
        {BG_IMAGES.map((url, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              idx === bgIndex ? 'opacity-100 z-0' : 'opacity-0 -z-10'
            }`}
          >
            <img
              src={url}
              alt=""
              width="1920"
              height="1080"
              loading={idx === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={`h-full w-full object-cover object-center ${idx === bgIndex ? 'img-zoom-in' : ''}`}
              style={{ filter: 'brightness(0.7) contrast(1.1)', opacity: 0.65 }}
            />
          </div>
        ))}

        {/* Ambient Top Vignette */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#080a0b]/80 via-[#080a0b]/30 to-transparent"></div>

        {/* Horizontal Vignette for Left-side Headline Contrast */}
        <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 bg-gradient-to-r from-[#080a0b]/85 via-[#080a0b]/40 to-transparent"></div>

        {/* Seamless Bottom Gradient Blend into Pure Site Black */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080a0b] via-[#080a0b]/75 to-transparent"></div>
      </div>

      {/* Content Container (Constrained & Aligned with Grid) */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-16 sm:pt-8 sm:pb-20 lg:pt-10 lg:pb-24">
        {/* Top Meta Bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <a
            href="/about-dipesh-sapkota/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-md hover:border-[#c9f36b]/40 hover:text-[#c9f36b] transition-all shadow-sm"
            title="Learn more about the creator of Sportivo"
          >
            <img
              src="/dipesh-sapkota-profile.webp"
              alt=""
              className="h-4 w-4 rounded-full object-cover border border-[#c9f36b]"
              width="16"
              height="16"
              loading="eager"
            />
            <span>Sportivo by Dipesh Sapkota</span>
          </a>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-1.5 text-xs font-bold text-[#e5b94f] backdrop-blur-md">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></span>
            <span>Live Fixture Desk · Nepal Standard Time (UTC+5:45)</span>
          </div>
        </div>

        {/* Center Headline & Rotating Slogan */}
        <div className="max-w-3xl py-4 sm:py-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9f36b]/30 bg-[#c9f36b]/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-[#c9f36b] mb-4">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#c9f36b]" aria-hidden="true" />
            Live Sports Hub · Nepal
          </div>

          <h2
            key={`slogan-${sloganIndex}`}
            className="text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl"
            style={{ animation: 'fadeUp 0.7s ease both' }}
          >
            {slogan.headline}{' '}
            <span className="text-[#c9f36b]">{slogan.sub}</span>
          </h2>

          <p
            key={`desc-${sloganIndex}`}
            className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg"
            style={{ animation: 'fadeUp 0.9s ease both' }}
          >
            {slogan.description}
          </p>

          {/* Quick Action Navigation */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/football/"
              className="inline-flex items-center gap-2 rounded-full bg-[#c9f36b] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#080c0b] shadow-lg shadow-[#c9f36b]/20 transition-all hover:bg-[#b5e056] hover:scale-105 active:scale-95"
            >
              <span>⚽</span>
              <span>Football Live</span>
            </a>
            <a
              href="/cricket/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:border-[#c9f36b]/40 hover:bg-white/15 hover:text-[#c9f36b]"
            >
              <span>🏏</span>
              <span>Cricket Live</span>
            </a>
            <a
              href="/basketball/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:border-[#c9f36b]/40 hover:bg-white/15 hover:text-[#c9f36b]"
            >
              <span>🏀</span>
              <span>Basketball</span>
            </a>
            <a
              href="/dashboard/"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs font-bold text-amber-300 backdrop-blur-md transition-all hover:bg-amber-400/20"
            >
              <span>★</span>
              <span>My Watchlist</span>
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
              onClick={() => { setBgIndex(idx); setSloganIndex(idx % SLOGANS.length); }}
              className={`block rounded-full transition-all duration-500 focus:outline-none ${
                idx === bgIndex ? 'h-1.5 w-8 bg-[#c9f36b]' : 'h-1.5 w-2 bg-white/20 hover:bg-white/50'
              }`}
              aria-current={idx === bgIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes zoomIn {
          from { transform: scale(1); }
          to { transform: scale(1.14); }
        }
        .img-zoom-in {
          animation: zoomIn 6s ease-out forwards;
        }
      `}</style>
    </section>
  );
}

