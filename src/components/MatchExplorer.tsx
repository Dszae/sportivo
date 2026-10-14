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
    if (!value) return matches;
    return matches.filter((match) => `${titleOf(match)} ${match.category || category}`.toLowerCase().includes(value));
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
            const { first, second } = teamParts(title);
            const poster = publicUrl(match.poster || match.image || match.thumbnail || undefined);
            return (
              <a key={`${slugify(title)}-${index}`} href={`/${category}/match/${encodeURIComponent(slugify(title))}/`} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111a19] shadow-xl shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-[#e5b94f]/50 focus:outline-none focus:ring-2 focus:ring-[#c9f36b]">
                <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#182b2a] via-[#18212b] to-[#111a19]">
                  <span className="absolute left-2 top-2 z-10 rounded bg-black/80 px-2 py-1 text-[10px] font-bold text-white">{status === 'Live' ? 'LIVE' : status === 'Final' ? 'Final' : timeOf(match)}</span>
                  {poster ? <img src={poster} alt={`${title} poster`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /> : <div className="px-4 text-center text-sm font-bold text-slate-300"><span>{first}</span>{second && <><span className="mx-2 text-[#c9f36b]">vs</span><span>{second}</span></>}</div>}
                </div>
                <div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-slate-100 group-hover:text-[#e5b94f]">{title}</h3><p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{match.category || category} {status !== 'Live' && `| ${status}`}</p></div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}