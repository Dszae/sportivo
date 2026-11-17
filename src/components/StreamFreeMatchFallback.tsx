import { useEffect, useState } from 'react';
import MatchPlayer from './MatchPlayer';
import { findStreamFreeMatch } from '../lib/streamfreeClient';
import { detectFootballLeague, statusOf, timeOf, titleOf, type Match } from '../lib/sportivo';

type Props = { category: string; slug: string };

/**
 * Shown when our server can't find a fixture. The match may still exist on StreamFree, whose list
 * only the browser can reach (it blocks our Cloudflare server), so look it up here before giving up.
 */
export default function StreamFreeMatchFallback({ category, slug }: Props) {
  const [match, setMatch] = useState<Match | null>(null);
  const [state, setState] = useState<'loading' | 'found' | 'missing'>('loading');
  const categoryLabel = category[0].toUpperCase() + category.slice(1);

  useEffect(() => {
    let cancelled = false;
    findStreamFreeMatch(category, slug).then((found) => {
      if (cancelled) return;
      if (found) {
        setMatch(found);
        setState('found');
        document.title = `${titleOf(found)} - ${categoryLabel} Live Stream & Score | Nepal Time | Sportivo`;
      } else {
        setState('missing');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [category, slug, categoryLabel]);

  if (state === 'loading') {
    return (
      <div className="card p-8" aria-busy="true">
        <p className="text-sm text-fg-2">Looking for this match…</p>
      </div>
    );
  }

  if (state === 'missing' || !match) {
    return (
      <div className="card p-8">
        <h1 className="text-3xl font-medium text-fg">Fixture not found</h1>
        <p className="mt-3 text-sm text-fg-2">This match is not in the current schedule.</p>
        <a href={`/${category}/`} className="btn btn-secondary mt-6 capitalize">
          {category} fixtures
        </a>
      </div>
    );
  }

  const status = statusOf(match);
  return (
    <>
      <div className="mb-4 sm:mb-8 flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-xs sm:text-sm">
            {match.category === 'football' ? detectFootballLeague(match) : match.league || categoryLabel}
          </p>
          <h1 className="mt-1.5 sm:mt-3 text-xl sm:text-4xl lg:text-5xl font-medium tracking-[-0.02em] text-fg">
            {titleOf(match)}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4 text-xs sm:text-sm">
          {status === 'Live' ? (
            <span className="live-tag text-xs sm:text-sm">
              <span className="live-dot"></span>Live
            </span>
          ) : (
            <span className="text-fg-2">{status}</span>
          )}
          <span className="clock text-fg">{timeOf(match)} NST</span>
        </div>
      </div>
      <MatchPlayer match={match} />
    </>
  );
}
