'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';
import { syncService, apiClient } from '@/lib/api-client';
import { useRouter, usePathname } from 'next/navigation';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
            retry: (failureCount, error: any) => {
              // Don't retry if offline
              if (!navigator.onLine) return false;
              // Don't retry on 4xx errors
              if (error?.response?.status >= 400 && error?.response?.status < 500) {
                return false;
              }
              // Retry up to 2 times for other errors
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
            refetchOnReconnect: true, // Refetch when connection is restored
          },
        },
      })
  );

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = () => {
      if (typeof window === 'undefined') return;
      
      const token = apiClient.getAccessToken();
      
      // If logged in and online, start auto-sync
      if (token && navigator.onLine) {
        syncService.startAutoSync(60000); // Sync every 60 seconds
      }
    };

    checkAuth();

    // Handle online/offline events
    const handleOnline = () => {
      console.log('Connection restored, starting sync...');
      const token = apiClient.getAccessToken();
      if (token) {
        syncService.startAutoSync(60000);
      }
    };

    const handleOffline = () => {
      console.log('Connection lost, stopping sync...');
      syncService.stopAutoSync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      syncService.stopAutoSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
