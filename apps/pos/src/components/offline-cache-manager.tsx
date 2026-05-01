'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Component that manages offline caching of pages
 * Prefetches and caches critical pages when online
 */
export function OfflineCacheManager() {
  const pathname = usePathname();
  const [hasShownInitialToast, setHasShownInitialToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.onLine) return;

    const cachePages = async () => {
      try {
        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;
        
        if (!registration || !registration.active) {
          console.log('Service worker not ready yet');
          return;
        }

        // Critical pages to cache for offline access
        const criticalPages = [
          '/',
          '/login',
          '/products',
          '/transactions',
          '/select-terminal',
          '/offline',
        ];

        // Open the pages cache
        const cache = await caches.open('pages-cache');
        
        // Check which pages are already cached
        const cachedRequests = await cache.keys();
        const cachedUrls = cachedRequests.map(req => new URL(req.url).pathname);

        let newPagesCached = 0;

        // Cache pages that aren't cached yet
        for (const page of criticalPages) {
          if (!cachedUrls.includes(page)) {
            try {
              // Fetch and cache the page
              const response = await fetch(page, {
                credentials: 'same-origin',
                headers: {
                  'Accept': 'text/html',
                },
              });
              
              if (response.ok) {
                await cache.put(page, response.clone());
                console.log(`Cached page: ${page}`);
                newPagesCached++;
              }
            } catch (error) {
              console.warn(`Failed to cache page: ${page}`, error);
            }
          }
        }

        // Show toast only once if new pages were cached
        if (newPagesCached > 0 && !hasShownInitialToast) {
          toast.success('Offline mode ready', {
            description: `${newPagesCached} page${newPagesCached > 1 ? 's' : ''} cached for offline use`,
            duration: 3000,
          });
          setHasShownInitialToast(true);
        }

        console.log('Offline cache manager: Critical pages cached');
      } catch (error) {
        console.error('Error caching pages:', error);
      }
    };

    // Cache pages after a short delay (don't block initial render)
    const timeoutId = setTimeout(cachePages, 1000);

    // Also cache when online status changes
    const handleOnline = () => {
      setTimeout(cachePages, 500);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
    };
  }, [hasShownInitialToast]);

  // Also cache the current page whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.onLine) return;

    const cacheCurrentPage = async () => {
      try {
        const cache = await caches.open('pages-cache');
        const response = await fetch(pathname, {
          credentials: 'same-origin',
          headers: {
            'Accept': 'text/html',
          },
        });
        
        if (response.ok) {
          await cache.put(pathname, response.clone());
          console.log(`Cached current page: ${pathname}`);
        }
      } catch (error) {
        console.warn(`Failed to cache current page: ${pathname}`, error);
      }
    };

    // Cache current page after navigation
    const timeoutId = setTimeout(cacheCurrentPage, 500);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}
