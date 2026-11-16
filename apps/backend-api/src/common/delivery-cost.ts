export interface DeliveryCostStamp {
  id: string;
  deliveryDate: Date | string | null;
  createdAt: Date | string | null;
}

function instant(value: Date | string | null | undefined): number {
  if (value == null || value === '') return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Newest delivery date wins. The same date breaks by when the delivery was
 * recorded, then by id. Positive when `saving` is newer than `other`.
 */
export function compareCostUpdates(
  saving: DeliveryCostStamp,
  other: DeliveryCostStamp,
): number {
  const byDate = instant(saving.deliveryDate) - instant(other.deliveryDate);
  if (byDate !== 0) return byDate;
  const byRecorded = instant(saving.createdAt) - instant(other.createdAt);
  if (byRecorded !== 0) return byRecorded;
  if (saving.id === other.id) return 0;
  return saving.id > other.id ? 1 : -1;
}

/**
 * True when no other received cost update is strictly newer. Duplicate
 * lines on one older delivery do not count as a newer update.
 */
export function isNewestCostUpdate(
  saving: DeliveryCostStamp,
  others: DeliveryCostStamp[],
): boolean {
  return others.every((other) => compareCostUpdates(saving, other) >= 0);
}
