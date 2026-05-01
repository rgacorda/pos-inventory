'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function PWAInstaller() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Listen for service worker updates
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            toast.info('Update available!', {
              description: 'A new version is available. Refresh to update.',
              duration: 10000,
              action: {
                label: 'Refresh',
                onClick: () => window.location.reload(),
              },
            });
          }
        });
      });
    });

    // Listen for when the service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker updated');
    });

    // Check for updates periodically (every hour)
    const checkForUpdates = () => {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
      });
    };

    const updateInterval = setInterval(checkForUpdates, 60 * 60 * 1000); // 1 hour

    return () => {
      clearInterval(updateInterval);
    };
  }, []);

  return null;
}
