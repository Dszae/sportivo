import React, { useEffect, useState } from 'react';

export type HeroMatch = {
  href: string;
  title: string;
  category: string;
  time: string;
  live: boolean;
};

interface Props {
  matches?: HeroMatch[];
}

// Floodlit ground at night. One still, no slideshow.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000&auto=format&fit=crop';

function nstNow() {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return '';
  }
}

function StadiumClock() {
  const [now, setNow] = useState('');
  useEffect(() => {
    setNow(nstNow());
    const id = setInterval(() => setNow(nstNow()), 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="clock text-sm text-fg-2" aria-label="Current time in Nepal">
      {now ? `${now} NST` : 'NST'}
    </span>
  );
}

export default function HeroShowcase({ matches = [] }: Props) {
  const rows = matches.slice(0, 5);

  return (
    <section aria-label="Sportivo" className="relative bg-ink-900">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <img
          src={HERO_IMAGE}
          alt=""
          width="2000"
          height="1333"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover object-[65%_center]"
          style={{ filter: 'brightness(0.75) saturate(0.9)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900 from-15% via-ink-900/55 via-50% to-ink-900/0" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink-900 via-ink-900/70 to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pb-8 pt-20 sm:px-6 lg:min-h-[640px] lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pt-28">
        <div className="animate-fade-in lg:col-span-7 lg:pr-8">
          <p className="eyebrow">Live sports desk, Nepal</p>
          <h1 className="mt-4 max-w-2xl text-[40px] font-semibold leading-[1.04] tracking-[-0.02em] text-fg sm:text-[56px] lg:text-[64px] lg:tracking-[-0.03em]">
            Every kickoff, in Nepal time
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-7 text-fg-2">
            Football, cricket and basketball fixtures with live scores and streams, converted to Nepal Standard Time so you never do the maths.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/npl/" className="btn btn-primary btn-lg">
              Watch NPL 2026
            </a>
            <a href="#football" className="btn btn-secondary btn-lg">
              Today's fixtures
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 lg:self-end lg:translate-y-16">
          <div className="panel overflow-hidden bg-ink-800/95 shadow-float backdrop-blur-sm">
            <div className="flex h-12 items-center justify-between border-b border-line px-4">
              <span className="text-sm font-medium text-fg">Up next</span>
              <StadiumClock />
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-fg-2">No fixtures scheduled yet</p>
            ) : (
              <ul>
                {rows.map((m) => (
                  <li key={m.href}>
                    <a href={m.href} className="row h-12 py-0">
                      <span className="clock w-[120px] shrink-0 text-[13px] text-fg-2">
                        {m.live ? <span className="live-tag"><span className="live-dot" />Live</span> : m.time}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-fg">{m.title}</span>
                      <span className="meta w-20 shrink-0 text-right capitalize">{m.category}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
