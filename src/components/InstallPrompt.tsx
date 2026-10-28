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
                href="https://github.com/Dszae/sportivo/actions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#c9f36b] px-4 py-3 text-sm font-black text-[#080a0b] hover:bg-[#b5e05c] transition-all shadow-lg shadow-[#c9f36b]/20 active:scale-98"
              >
                <span>📦</span>
                <span>Download APK from GitHub Actions</span>
                <span>&rarr;</span>
              </a>

              <div className="rounded-xl border border-white/10 bg-[#121c1a] p-3 text-center">
                <p className="text-[11px] text-slate-300">
                  <strong>Play Store Submission:</strong> Android App Bundle (<code className="text-white">.aab</code>) is generated and compliant with Google Play Console.
                </p>
                <a
                  href="/privacy/"
                  className="mt-1.5 inline-block text-[11px] text-[#c9f36b] hover:underline"
                >
                  View Store Privacy Policy &rarr;
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
