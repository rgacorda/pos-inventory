'use client';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50",
      "bg-amber-500 text-black",
      "px-4 py-2",
      "flex items-center justify-center gap-2",
      "text-sm font-medium",
      "shadow-md"
    )}>
      <WifiOff className="h-4 w-4" />
      <span>You are currently offline. Changes will sync when connection is restored.</span>
    </div>
  );
}
