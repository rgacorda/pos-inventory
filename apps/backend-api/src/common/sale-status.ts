import { OrderStatus } from '@pos/shared-types';

/**
 * Sales that count as revenue. An exchange total is the amount still paid
 * after the return credit, so it belongs with completed and synced sales.
 * Pending drafts and voids do not.
 */
export const SALE_STATUSES = [
  OrderStatus.COMPLETED,
  OrderStatus.SYNCED,
  OrderStatus.EXCHANGE,
] as const;

/** Safe to interpolate: values come from the enum above, not from input. */
export const SALE_STATUS_SQL = SALE_STATUSES.map((status) => `'${status}'`).join(
  ', ',
);

/** Pending drafts and voids have not taken stock. Sales have. */
export function isSaleStatus(status: string | null | undefined): boolean {
  return (SALE_STATUSES as readonly string[]).includes(String(status ?? ''));
}

/**
 * An exchange may put returned units back once. A void already put the
 * whole sale back, and a second exchange must not add those units again.
 */
export function exchangeShouldRestoreStock(order: {
  exchangedAt?: Date | string | null;
  status?: string | null;
}): boolean {
  if (order.exchangedAt) return false;
  if (order.status === OrderStatus.VOID) return false;
  return true;
}
