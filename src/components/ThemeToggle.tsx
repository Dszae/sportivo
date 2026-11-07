import React, { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read active theme from documentElement (already set by zero-FOUT head script)
    const currentTheme = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    setTheme(currentTheme);

    const onThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail?.theme) {
        setTheme(customEvent.detail.theme);
      }
    };

    window.addEventListener('sportivo:theme-changed', onThemeChange);
    return () => window.removeEventListener('sportivo:theme-changed', onThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    const root = document.documentElement;
    if (nextTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }

    try {
      localStorage.setItem('sportivo_theme', nextTheme);
    } catch {}

    // Update meta theme-color for mobile chrome / status bars
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', nextTheme === 'light' ? '#f8faf8' : '#101312');
    }

    window.dispatchEvent(new CustomEvent('sportivo:theme-changed', { detail: { theme: nextTheme } }));
  };

  const isLight = mounted && theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      title={isLight ? 'Switch to Dark Mode (Deep Obsidian)' : 'Switch to Light Mode (Pitch Emerald)'}
      className={`group relative inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-ink-800/80 px-2.5 py-1 text-xs font-medium text-fg-2 backdrop-blur-md transition-all duration-200 hover:border-line-strong hover:bg-ink-700/80 hover:text-fg active:scale-95 shadow-sm ${className}`}
    >
      <div className="relative flex h-4 w-4 items-center justify-center overflow-hidden">
        {/* Sun Icon */}
        <svg
          className={`h-4 w-4 text-amber-500 transition-all duration-300 transform ${
            isLight ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0 absolute'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>

        {/* Moon Icon */}
        <svg
          className={`h-4 w-4 text-lime transition-all duration-300 transform ${
            !isLight ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0 absolute'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" fillOpacity="0.15" />
          <path d="M19 3v4M21 5h-4" strokeWidth="1.5" />
        </svg>
      </div>

      <span className="hidden sm:inline font-semibold tracking-tight text-[11px] uppercase">
        {isLight ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
