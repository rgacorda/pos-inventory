'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.workbox !== undefined
    ) {
      const wb = window.workbox;

      // Add event listeners
      wb.addEventListener('installed', (event: any) => {
        console.log('Service Worker installed:', event);
      });

      wb.addEventListener('controlling', (event: any) => {
        console.log('Service Worker controlling:', event);
        window.location.reload();
      });

      wb.addEventListener('activated', (event: any) => {
        console.log('Service Worker activated:', event);
      });

      // Register service worker
      wb.register();
    } else if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      // Fallback manual registration
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('✅ Service Worker registered successfully:', registration);
            
            // Check for updates periodically
            setInterval(() => {
              registration.update();
            }, 60000); // Check every minute
          })
          .catch((error) => {
            console.error('❌ Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    workbox: any;
  }
}
