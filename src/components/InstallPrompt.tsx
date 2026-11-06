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
        title="Download the Android app (60 MB)"
        className="btn btn-secondary btn-sm"
      >
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5M12 15V3" />
        </svg>
        <span>{downloading ? 'Downloading' : 'App'}</span>
      </a>

      {downloading && (
        <div className="panel animate-fade-in absolute right-0 top-full z-50 mt-2 whitespace-nowrap px-3 py-2 text-xs text-fg-2 shadow-float">
          Downloading Sportivo for Android, 60 MB
        </div>
      )}
    </div>
  );
}
