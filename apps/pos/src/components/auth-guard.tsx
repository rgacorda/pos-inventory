'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const token = apiClient.getAccessToken();
    
    // If not on login page and no token, redirect to login
    if (!token && pathname !== '/login') {
      router.push('/login');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
