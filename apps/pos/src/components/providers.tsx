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
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = () => {
      if (typeof window === 'undefined') return;
      
      const token = apiClient.getAccessToken();
      
      // If logged in, start auto-sync
      if (token) {
        syncService.startAutoSync(60000); // Sync every 60 seconds
      }
    };

    checkAuth();

    return () => {
      syncService.stopAutoSync();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
