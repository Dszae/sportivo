import { useEffect, useState } from 'react';
import type { Match } from '../lib/sportivo';
import { publicUrl } from '../lib/sportivo';

type Stream = { embedUrl?: string; url?: string; language?: string; hd?: boolean } | string;
type Props = { match: Match };

function streamUrl(stream: Stream) { return typeof stream === 'string' ? stream : stream.embedUrl || stream.url || ''; }

export default function MatchPlayer({ match }: Props) {
  const sources = match.sources || [];
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const currentSource = sources[selectedSourceIndex];

  const [streams, setStreams] = useState<Stream[]>([]);
  const [active, setActive] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(Boolean(currentSource?.source && currentSource.id));
  const [error, setError] = useState(currentSource?.source && currentSource.id ? '' : 'No stream sources available for this match.');

  useEffect(() => {
    if (!currentSource?.source || !currentSource.id) return;

    let cancelled = false;

    fetch(`/api/stream/${encodeURIComponent(currentSource.source)}/${encodeURIComponent(currentSource.id)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Stream unavailable');
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const parsed = typeof payload?.contents === 'string' ? JSON.parse(payload.contents) : payload;
        const available = (Array.isArray(parsed) ? parsed : [parsed]).filter((item): item is Stream => Boolean(publicUrl(streamUrl(item))));
        if (available.length === 0) {
          setError('No active stream feeds available for this fixture yet. Live feeds typically go online 15 minutes before kickoff.');
        } else {
          setStreams(available);
          setActive(available[0] || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('This stream is currently offline. Live feeds typically go live 15 minutes before kickoff.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentSource?.id, currentSource?.source]);

  function handleSourceChange(idx: number) {
    setSelectedSourceIndex(idx);
    setLoading(true);
    setError('');
    setStreams([]);
    setActive(null);
  }

  const url = active ? publicUrl(streamUrl(active)) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#12161f] shadow-2xl shadow-black/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0b0e14] p-4">
        <div>
          <h2 className="font-bold text-slate-100">{match.title || match.name || 'Fixture stream'}</h2>
          {sources.length > 1 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider:</span>
              {sources.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSourceChange(idx)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                    selectedSourceIndex === idx ? 'bg-[#c9f36b] text-black' : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {s.source || `Provider ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <a href="../" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white transition">Back to fixtures</a>
      </div>

      <div className="relative flex aspect-video items-center justify-center bg-black">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9f36b] border-t-transparent"></span>
            <p className="font-mono text-xs text-slate-400">Connecting to stream provider...</p>
          </div>
        ) : error ? (
          <div className="max-w-md px-6 text-center">
            <p className="text-sm font-semibold text-amber-300">{error}</p>
            <p className="mt-2 text-xs text-slate-400">If the match is currently ongoing, try switching providers above or checking another server.</p>
          </div>
        ) : !url ? (
          <p className="font-mono text-sm text-slate-400">Waiting for stream signal...</p>
        ) : url.includes('.m3u8') ? (
          <video controls autoPlay className="h-full w-full" src={url}></video>
        ) : (
          <iframe
            src={url}
            className="h-full w-full border-0"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="no-referrer"
            title="Live stream"
          ></iframe>
        )}
      </div>

      {streams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-slate-800 bg-[#0b0e14] p-3">
          <span className="mr-2 text-xs font-bold text-slate-500">Servers:</span>
          {streams.map((stream, index) => (
            <button
              key={index}
              onClick={() => setActive(stream)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                active === stream ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {typeof stream === 'string' ? `Server ${index + 1}` : `${stream.language || `Server ${index + 1}`} ${stream.hd ? 'HD' : ''}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}