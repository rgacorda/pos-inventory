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
