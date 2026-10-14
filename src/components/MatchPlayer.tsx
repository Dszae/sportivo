import { useEffect, useState } from 'react';
import type { Match } from '../lib/sportivo';
import { publicUrl } from '../lib/sportivo';

type Stream = { embedUrl?: string; url?: string; language?: string; hd?: boolean } | string;
type Props = { match: Match };

function streamUrl(stream: Stream) { return typeof stream === 'string' ? stream : stream.embedUrl || stream.url || ''; }

export default function MatchPlayer({ match }: Props) {
  const source = match.sources?.[0];
  const [streams, setStreams] = useState<Stream[]>([]);
  const [active, setActive] = useState<Stream | null>(null);
  const [error, setError] = useState(source?.source && source.id ? '' : 'No stream sources available for this match.');

  useEffect(() => {
    if (!source?.source || !source.id) return;
    fetch(`/api/stream/${encodeURIComponent(source.source)}/${encodeURIComponent(source.id)}`)
      .then((response) => { if (!response.ok) throw new Error('Stream unavailable'); return response.json(); })
      .then((payload) => {
        const parsed = typeof payload?.contents === 'string' ? JSON.parse(payload.contents) : payload;
        const available = (Array.isArray(parsed) ? parsed : [parsed]).filter((item): item is Stream => Boolean(publicUrl(streamUrl(item))));
        setStreams(available); setActive(available[0] || null);
      })
      .catch(() => setError('Stream is currently offline or failed to parse.'));
  }, [source?.id, source?.source]);

  const url = active ? publicUrl(streamUrl(active)) : null;
  return <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#12161f] shadow-2xl shadow-black/80"><div className="flex items-center justify-between border-b border-slate-800 bg-[#0b0e14] p-4"><h2 className="font-bold text-slate-100">{match.title || match.name || 'Fixture stream'}</h2><a href="../" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white">Back to fixtures</a></div><div className="relative flex aspect-video items-center justify-center bg-black">{error ? <p className="px-4 text-center text-sm text-red-400">{error}</p> : !url ? <p className="animate-pulse font-mono text-sm text-slate-400">Connecting to stream...</p> : url.includes('.m3u8') ? <video controls autoPlay className="h-full w-full" src={url}></video> : <iframe src={url} className="h-full w-full border-0" allowFullScreen allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerPolicy="no-referrer" title="Live stream"></iframe>}</div>{streams.length > 0 && <div className="flex gap-2 overflow-x-auto border-t border-slate-800 bg-[#0b0e14] p-3"><span className="mr-2 text-xs font-bold text-slate-500">Servers:</span>{streams.map((stream, index) => <button key={index} onClick={() => setActive(stream)} className={`rounded-md px-3 py-1.5 text-xs font-bold ${active === stream ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{typeof stream === 'string' ? `Server ${index + 1}` : `${stream.language || `Server ${index + 1}`} ${stream.hd ? 'HD' : ''}`}</button>)}</div>}</div>;
}