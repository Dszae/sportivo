import { useMemo, useState } from 'react';
import type { Category, Match } from '../lib/sportivo';
import { publicUrl, slugify, statusOf, timeOf, titleOf } from '../lib/sportivo';

type Props = { category: Category; matches: Match[] };

function teamParts(title: string) {
  const parts = title.split(/\s+vs\.?\s+|\s+-\s+/i);
  return { first: parts[0]?.trim() || title, second: parts[1]?.trim() || '' };
}

export default function MatchExplorer({ category, matches }: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const list = value
      ? matches.filter((match) => `${titleOf(match)} ${match.category || category}`.toLowerCase().includes(value))
      : matches;

    return [...list].sort((a, b) => {
      const statusA = statusOf(a);
      const statusB = statusOf(b);

      // 1. Live matches always come first
      if (statusA === 'Live' && statusB !== 'Live') return -1;
      if (statusB === 'Live' && statusA !== 'Live') return 1;

      // 2. Upcoming matches come before Final matches
      if (statusA === 'Upcoming' && statusB === 'Final') return -1;
      if (statusB === 'Upcoming' && statusA === 'Final') return 1;

      const timeA = typeof a.date === 'number' ? a.date : new Date(a.date || a.startTime || a.start_at || a.timestamp || 0).getTime() || 0;
      const timeB = typeof b.date === 'number' ? b.date : new Date(b.date || b.startTime || b.start_at || b.timestamp || 0).getTime() || 0;

      // Chronological order for upcoming fixtures
      return timeA - timeB;
    });
  }, [category, matches, query]);

  return (
    <section aria-labelledby="schedule-title">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#e5b94f]">Real-time schedule</span>
          <h2 id="schedule-title" className="text-2xl font-black text-white">{category[0].toUpperCase() + category.slice(1)} fixtures</h2>
          <p className="mt-1 text-xs text-slate-500">{matches.length} fixtures supplied by the upstream provider.</p>
        </div>
        <label className="w-full md:w-72">
          <span className="sr-only">Search matches or teams</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search matches or teams..." className="w-full rounded-lg border border-white/10 bg-[#111a19] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#c9f36b] focus:outline-none" />
        </label>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#12161f] py-16 text-center"><p className="font-medium text-slate-300">No fixtures found for this sport.</p><p className="mt-2 text-sm text-slate-500">Try another search or check back when the schedule updates.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((match, index) => {
            const title = titleOf(match);
            const status = statusOf(match);
            const isLive = status === 'Live';
            const { first, second } = teamParts(title);
            const poster = publicUrl(match.poster || match.image || match.thumbnail || undefined);
            return (
              <a key={`${slugify(title)}-${index}`} href={`/${category}/match/${encodeURIComponent(slugify(title))}/`} className={`group overflow-hidden rounded-2xl border bg-[#111a19] shadow-xl shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-[#e5b94f]/50 focus:outline-none focus:ring-2 focus:ring-[#c9f36b] ${isLive ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-white/10'}`}>
                <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#182b2a] via-[#18212b] to-[#111a19]">
                  <span className={`absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold text-white shadow-md ${isLive ? 'bg-red-600 font-black tracking-wider' : 'bg-black/80'}`}>
                    {isLive && <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-white"></span>}
                    {isLive ? 'LIVE' : status === 'Final' ? 'Final' : timeOf(match)}
                  </span>
                  {poster ? <img src={poster} alt={`${title} poster`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /> : <div className="px-4 text-center text-sm font-bold text-slate-300"><span>{first}</span>{second && <><span className="mx-2 text-[#c9f36b]">vs</span><span>{second}</span></>}</div>}
                </div>
                <div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-slate-100 group-hover:text-[#e5b94f]">{title}</h3><p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500"><span>{match.category || category}</span><span>•</span><span className={isLive ? 'text-red-400 font-black' : ''}>{isLive ? 'Broadcasting Now' : status === 'Final' ? 'Final' : timeOf(match)}</span></p></div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}