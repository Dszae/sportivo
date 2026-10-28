import React, { useState } from 'react';

export default function DownloadApkButton() {
  const [downloading, setDownloading] = useState(false);

  const handleClick = () => {
    setDownloading(true);
    setTimeout(() => setDownloading(false), 4000);
  };

  return (
    <div className="relative inline-flex items-center">
      <a
        href="/download/sportivo.apk"
        download="sportivo.apk"
        onClick={handleClick}
        title="Download Sportivo Native Android APK (60 MB)"
        className="inline-flex items-center gap-1.5 rounded-full border border-[#c9f36b]/60 bg-[#c9f36b]/20 px-3 py-1.5 text-xs font-black text-[#c9f36b] hover:bg-[#c9f36b] hover:text-[#080a0b] transition-all shadow-md active:scale-95 shrink-0"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>{downloading ? 'Downloading...' : 'APK'}</span>
      </a>

      {downloading && (
        <div className="absolute right-0 top-full mt-2 z-50 whitespace-nowrap rounded-xl bg-[#0e1715] border border-[#c9f36b]/40 px-3 py-1.5 text-[11px] font-bold text-[#c9f36b] shadow-xl">
          Downloading Sportivo APK (60 MB)...
        </div>
      )}
    </div>
  );
}
