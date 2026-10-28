import React, { useState } from 'react';

export default function DownloadApkButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        title="Download Sportivo Native Android APK"
        className="inline-flex items-center gap-1.5 rounded-full border border-[#c9f36b]/60 bg-[#c9f36b]/20 px-3 py-1.5 text-xs font-black text-[#c9f36b] hover:bg-[#c9f36b] hover:text-[#080a0b] transition-all shadow-md active:scale-95 shrink-0"
      >
        <span>📲</span>
        <span>Download APK</span>
      </button>

      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[99998] bg-black/85 backdrop-blur-md transition-opacity"
            onClick={() => setShowModal(false)}
            aria-hidden="true"
          />

          {/* Modal Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Download Sportivo Android APK"
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[99999] max-w-md mx-auto rounded-3xl border-2 border-white/20 bg-[#0c1413] p-6 shadow-2xl text-slate-100 ring-1 ring-[#c9f36b]/30"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c9f36b]/15 border border-[#c9f36b]/40 text-2xl">
                  📱
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Sportivo Android App</h3>
                  <p className="text-[11px] font-bold text-[#c9f36b]">Real Native APK · v1.0.0</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition"
              >
                ✕
              </button>
            </div>

            {/* Features List */}
            <div className="my-5 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 text-slate-300">
                <span className="text-[#c9f36b] font-bold">✓</span>
                <span><strong>Real Native Android App:</strong> Built with React Native &amp; ExoPlayer (not a web wrapper).</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-300">
                <span className="text-[#c9f36b] font-bold">✓</span>
                <span><strong>5-Minute Kickoff Alerts:</strong> Native Android push notifications &amp; tactile haptic feedback.</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-300">
                <span className="text-[#c9f36b] font-bold">✓</span>
                <span><strong>Official NPL 2026 &amp; Football:</strong> Ball-by-ball score tracking in Nepal Standard Time (NST).</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-300">
                <span className="text-[#c9f36b] font-bold">✓</span>
                <span><strong>Package ID:</strong> <code className="text-[#c9f36b] bg-black/40 px-1 py-0.5 rounded">np.com.dipeshsapkota7.sportivo</code></span>
              </div>
            </div>

            {/* Download Actions */}
            <div className="space-y-3 pt-2">
              <a
                href="https://github.com/Dszae/sportivo/releases/download/v1.0.0-apk/app-debug.apk"
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#c9f36b] px-4 py-3 text-sm font-black text-[#080a0b] hover:bg-[#b5e05c] transition-all shadow-lg shadow-[#c9f36b]/20 active:scale-98"
                download="Sportivo-v1.0.0.apk"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Direct Download Native APK (v1.0.0)</span>
              </a>

              <div className="rounded-xl border border-white/10 bg-[#121c1a] p-3 text-center space-y-1.5">
                <p className="text-[11px] text-slate-300">
                  <strong>Installation Guide:</strong> Once downloaded, tap the file in your notification bar and choose <em>Allow installation from this source</em> to launch Sportivo.
                </p>
                <div className="flex items-center justify-center gap-4 pt-1">
                  <a
                    href="https://github.com/Dszae/sportivo/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-slate-400 hover:text-white underline"
                  >
                    All Releases
                  </a>
                  <span className="text-slate-600">·</span>
                  <a
                    href="/privacy/"
                    className="text-[11px] text-[#c9f36b] hover:underline"
                  >
                    Play Store Privacy Policy &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
