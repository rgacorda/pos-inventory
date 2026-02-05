'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, dbHelpers } from '@/lib/db';

export function usePendingSyncCount() {
  const count = useLiveQuery(async () => {
    const { orders, payments } = await dbHelpers.getPendingSyncItems();
    return orders.length + payments.length;
  }, []);

  return count ?? 0;
}

export function useProducts() {
  return useLiveQuery(() => dbHelpers.getActiveProducts(), []);
}

export function useProductSearch(query: string) {
  return useLiveQuery(
    () => (query ? dbHelpers.searchProducts(query) : dbHelpers.getActiveProducts()),
    [query]
  );
}

export function useTodaysOrders() {
  return useLiveQuery(() => dbHelpers.getTodaysOrders(), []);
}

export function useOrdersByStatus(status: any) {
  return useLiveQuery(() => dbHelpers.getOrdersByStatus(status), [status]);
}

export function useLastSyncTime() {
  return useLiveQuery(() => dbHelpers.getLastSyncTime(), []);
}
