import React, { useState, useEffect } from 'react';

// Sports backgrounds that cycle continuously 24/7
const BG_IMAGES = [
  // Football
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1600&auto=format&fit=crop',
  // Cricket
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop',
  // Basketball
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1600&auto=format&fit=crop',
  // Football stadium aerial
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1600&auto=format&fit=crop',
  // Cricket bowl
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1600&auto=format&fit=crop',
  // Tennis
  'https://images.unsplash.com/photo-1611791484670-ce19b801d192?q=80&w=1600&auto=format&fit=crop',
  // Stadium lights
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop',
];

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
      className="relative mx-auto mb-12 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[#080c0b] shadow-2xl"
    >
      <div className="relative min-h-[440px] w-full sm:min-h-[480px] lg:min-h-[520px]">
        {/* All backgrounds pre-rendered; active one is visible with zoom-in animation */}
        {BG_IMAGES.map((url, idx) => (
          <div
            key={idx}
            aria-hidden="true"
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === bgIndex ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}
          >
            <img
              src={url}
              alt=""
              width="1600"
              height="800"
              loading={idx === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={`h-full w-full object-cover object-center ${idx === bgIndex ? 'img-zoom-in' : ''}`}
              style={{ filter: 'brightness(0.45) contrast(1.05)', opacity: 0.85 }}
            />
          </div>
        ))}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080c0b]/92 via-[#080c0b]/50 to-transparent" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080c0b]/95 via-transparent to-transparent" aria-hidden="true" />

        {/* Content Layer */}
        <div className="relative z-10 flex min-h-[440px] sm:min-h-[480px] lg:min-h-[520px] flex-col justify-between p-6 sm:p-10 lg:p-14">

          {/* Top Badge */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#c9f36b]/30 bg-[#c9f36b]/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-[#c9f36b]">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#c9f36b]" aria-hidden="true" />
              Sportivo
            </span>
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-bold text-slate-300 backdrop-blur-sm">
              Nepal Standard Time (NST · UTC+5:45)
            </span>
          </div>

          {/* Centre Headline */}
          <div className="max-w-2xl py-6">
            <h2
              key={`slogan-${sloganIndex}`}
              className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
              style={{ animation: 'fadeUp 0.7s ease both' }}
            >
              {slogan.headline}{' '}
              <span className="text-[#c9f36b]">{slogan.sub}</span>
            </h2>

            <p
              key={`desc-${sloganIndex}`}
              className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base"
              style={{ animation: 'fadeUp 0.9s ease both' }}
            >
              {slogan.description}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="/football/"
                className="inline-flex items-center gap-2 rounded-full bg-[#c9f36b] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#080c0b] shadow-lg shadow-[#c9f36b]/20 transition-all hover:bg-[#b5e056] hover:scale-105 active:scale-95"
              >
                <span>⚽</span>
                <span>Football</span>
              </a>
              <a
                href="/cricket/"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
              >
                <span>🏏</span>
                <span>Cricket</span>
              </a>
              <a
                href="/basketball/"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
              >
                <span>🏀</span>
                <span>Basketball</span>
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

          {/* Bottom progress dots */}
          <div className="flex items-center gap-1.5 pt-4 border-t border-white/10">
            {BG_IMAGES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Background image ${idx + 1}`}
                onClick={() => { setBgIndex(idx); setSloganIndex(idx % SLOGANS.length); }}
                className={`block rounded-full transition-all duration-500 focus:outline-none ${idx === bgIndex ? 'h-2 w-7 bg-[#c9f36b]' : 'h-2 w-2 bg-white/20 hover:bg-white/50'}`}
                aria-current={idx === bgIndex ? 'true' : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes zoomIn {
          from { transform: scale(1); }
          to { transform: scale(1.12); }
        }
        .img-zoom-in {
          animation: zoomIn 6s ease-out forwards;
        }
      `}</style>
    </section>
  );
}

