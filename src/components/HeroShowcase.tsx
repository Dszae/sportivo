import React, { useState, useEffect, useRef } from 'react';

interface Slide {
  id: string;
  sport: 'football' | 'cricket';
  tag: string;
  badgeColor: string;
  title: string;
  highlight: string;
  description: string;
  imageUrl: string;
  accentGradient: string;
  actionText: string;
  actionHref: string;
}

const HERO_SLIDES: Slide[] = [
  {
    id: 'football-ucl',
    sport: 'football',
    tag: 'PREMIER LEAGUE & CHAMPIONS LEAGUE',
    badgeColor: 'text-[#c9f36b] bg-[#c9f36b]/10 border-[#c9f36b]/30',
    title: 'European Nights & Premier League',
    highlight: 'Showdowns.',
    description: 'Track high-stakes football fixtures in Nepal Standard Time (NST) with multi-server HD streaming, team crests, and live kickoff synchronization.',
    imageUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1600&auto=format&fit=crop',
    accentGradient: 'from-emerald-950/90 via-[#0a1412]/80 to-[#080d0c]',
    actionText: 'Watch Football Live',
    actionHref: '/football/',
  },
  {
    id: 'cricket-nepal',
    sport: 'cricket',
    tag: 'ICC CWC LEAGUE 2 & NPL 2026',
    badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    title: 'Nepal National Cricket & NPL',
    highlight: 'T20 Battles.',
    description: 'Follow Nepal vs UAE, Janakpur Bolts vs Pokhara Avengers, and international bilateral series with ball-by-ball updates and verified feeds.',
    imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop',
    accentGradient: 'from-amber-950/80 via-[#14120a]/80 to-[#080d0c]',
    actionText: 'Watch Cricket Live',
    actionHref: '/cricket/',
  },
  {
    id: 'football-derby',
    sport: 'football',
    tag: 'LA LIGA, BUNDESLIGA & SERIE A',
    badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
    title: 'World Derbies & Top Table',
    highlight: 'Clashes.',
    description: 'El Clásico, Der Klassiker, and Serie A showdowns with real-time scoreboards, live status trackers, and head-to-head team badges.',
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1600&auto=format&fit=crop',
    accentGradient: 'from-rose-950/80 via-[#140a0e]/80 to-[#080d0c]',
    actionText: 'Explore League Fixtures',
    actionHref: '/football/',
  },
  {
    id: 'cricket-world',
    sport: 'cricket',
    tag: 'INTERNATIONAL TEST & T20I SERIES',
    badgeColor: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
    title: 'India vs NZ, Ashes & Global',
    highlight: 'Series.',
    description: 'Comprehensive cricket schedules across Today, Tomorrow, and This Week. Kickoffs calculated accurately for fans in Nepal.',
    imageUrl: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1600&auto=format&fit=crop',
    accentGradient: 'from-cyan-950/80 via-[#0a1214]/80 to-[#080d0c]',
    actionText: 'Explore Cricket Schedule',
    actionHref: '/cricket/',
  },
];

export default function HeroShowcase() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused]);

  const slide = HERO_SLIDES[current];

  return (
    <section
      aria-label="Featured Sports Showcase"
      className="relative mx-auto mb-12 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[#080c0b] shadow-2xl transition-all"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Slides with Crossfade */}
      <div className="relative min-h-[460px] w-full sm:min-h-[500px] lg:min-h-[540px]">
        {HERO_SLIDES.map((s, idx) => (
          <div
            key={s.id}
            aria-hidden={idx !== current}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === current ? 'opacity-100 z-0' : 'opacity-0 -z-10 pointer-events-none'
            }`}
          >
            {/* Background Image */}
            <img
              src={s.imageUrl}
              alt=""
              width="1600"
              height="800"
              loading={idx === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover object-center filter brightness-[0.7] contrast-[1.1]"
            />

            {/* Dark Cinematic Vignette Gradients */}
            <div className={`absolute inset-0 bg-gradient-to-r ${s.accentGradient} opacity-95`}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#080c0b] via-[#080c0b]/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#080c0b]/80 via-transparent to-[#080c0b]"></div>
          </div>
        ))}

        {/* AUTHENTIC HALFTONE TEXTURE OVERLAY */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2] opacity-40 mix-blend-overlay"
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(255, 255, 255, 0.45) 1.5px, transparent 1.5px), radial-gradient(circle at center, rgba(201, 243, 107, 0.3) 1px, transparent 1px)`,
            backgroundSize: '14px 14px, 7px 7px',
            backgroundPosition: '0 0, 3.5px 3.5px',
            maskImage: 'linear-gradient(to left, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, transparent 85%)',
          }}
        ></div>

        {/* Diagonal Halftone Texture Graphic Elements (Retro Sports Poster Mesh) */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-0 z-[3] h-full w-1/2 opacity-25 mix-blend-screen"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="halftone-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="8" cy="8" r="3" fill="#c9f36b" />
              <circle cx="0" cy="0" r="1.5" fill="#e5b94f" />
              <circle cx="16" cy="16" r="1.5" fill="#ffffff" />
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#halftone-dots)" />
        </svg>

        {/* Content Layer */}
        <div className="relative z-10 flex min-h-[460px] sm:min-h-[500px] lg:min-h-[540px] flex-col justify-between p-6 sm:p-10 lg:p-14">
          {/* Top Meta Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${slide.badgeColor}`}>
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-current"></span>
                {slide.tag}
              </span>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-bold text-slate-300 backdrop-blur-sm">
                Nepal Standard Time (NST)
              </span>
            </div>

            {/* Sport Indicator Switcher Pills */}
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setCurrent(0)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  slide.sport === 'football'
                    ? 'bg-[#c9f36b] text-[#080c0b] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⚽</span>
                <span>Football</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrent(1)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  slide.sport === 'cricket'
                    ? 'bg-amber-400 text-[#080c0b] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🏏</span>
                <span>Cricket</span>
              </button>
            </div>
          </div>

          {/* Center Showcase Headline & CTA */}
          <div className="max-w-2xl py-6">
            <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              {slide.title} <span className="text-[#c9f36b]">{slide.highlight}</span>
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {slide.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={slide.actionHref}
                className="inline-flex items-center gap-2 rounded-full bg-[#c9f36b] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#080c0b] shadow-lg shadow-[#c9f36b]/20 transition-all hover:bg-[#b5e056] hover:scale-105 active:scale-95"
              >
                <span>⚡</span>
                <span>{slide.actionText}</span>
                <span aria-hidden="true">&rarr;</span>
              </a>

              <a
                href="#live-matches"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('[id*="schedule-title"]')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
              >
                <span>View Live Fixtures</span>
              </a>

              <a
                href="/dashboard/"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-bold text-amber-300 backdrop-blur-sm transition-all hover:bg-white/5"
              >
                <span>★</span>
                <span>My Watchlist</span>
              </a>
            </div>
          </div>

          {/* Bottom Bar: Carousel Pagination Dots & Nav Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
            {/* Pagination Dots */}
            <div className="flex items-center gap-2" role="tablist" aria-label="Hero slides">
              {HERO_SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === current}
                  aria-label={`Slide ${idx + 1}: ${s.title}`}
                  onClick={() => setCurrent(idx)}
                  className={`group relative flex h-2.5 items-center transition-all ${
                    idx === current ? 'w-8' : 'w-2.5'
                  }`}
                >
                  <span
                    className={`h-2.5 w-full rounded-full transition-all duration-300 ${
                      idx === current
                        ? 'bg-[#c9f36b] shadow-sm shadow-[#c9f36b]/50'
                        : 'bg-white/30 group-hover:bg-white/60'
                    }`}
                  ></span>
                </button>
              ))}
            </div>

            {/* Prev / Next Chevrons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrent((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                aria-label="Previous slide"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm text-slate-300 backdrop-blur-sm transition-all hover:border-[#c9f36b] hover:text-[#c9f36b]"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setCurrent((prev) => (prev + 1) % HERO_SLIDES.length)}
                aria-label="Next slide"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm text-slate-300 backdrop-blur-sm transition-all hover:border-[#c9f36b] hover:text-[#c9f36b]"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

