import React, { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone app mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setCanInstall(false);
    } else {
      // Direct instruction for iOS Safari or browsers without beforeinstallprompt
      alert(
        '📲 To install Sportivo:\n\n' +
        '• Android (Chrome): Tap the three dots (⋮) in the top-right corner and select "Install app" or "Add to Home screen".\n\n' +
        '• iPhone (Safari): Tap the Share button at the bottom and select "Add to Home Screen".'
      );
    }
  };

  if (isInstalled) return null;

  return (
    <button
      type="button"
      onClick={handleInstallClick}
      title="Install Sportivo on your mobile phone"
      className="inline-flex items-center gap-1.5 rounded-full border border-[#c9f36b]/40 bg-[#c9f36b]/15 px-3 py-1 text-xs font-black text-[#c9f36b] hover:bg-[#c9f36b] hover:text-[#080c0b] transition-all shadow-sm active:scale-95 shrink-0"
    >
      <span>📲</span>
      <span>Install App</span>
    </button>
  );
}

