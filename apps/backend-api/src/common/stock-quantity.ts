import { EntityManager } from 'typeorm';
import { ProductEntity } from '../entities/product.entity';

/**
 * Whole units only. Delivery and return payloads sometimes carry quantity
 * as a string; adding that with `+` concatenates ("10" + "5" => "105")
 * and then the integer column stores 105.
 */
export function toStockUnits(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

export function sumStockByProduct(
  items: Array<{ productId?: string | null; quantity?: unknown }> = [],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item?.productId) continue;
    const quantity = toStockUnits(item.quantity);
    if (quantity === 0) continue;
    totals.set(item.productId, (totals.get(item.productId) || 0) + quantity);
  }
  return totals;
}

/**
 * Returned lines that may be put back into stock. A product cannot come
 * back in a greater quantity than the sale took out, and a product that
 * was never on the sale is ignored. Manual lines are kept for the receipt
 * but they are not quantity-tracked.
 */
export function capReturnedLines<
  T extends { productId?: string | null; quantity?: unknown },
>(
  sold: Array<{ productId?: string | null; quantity?: unknown }> = [],
  returned: T[] = [],
): T[] {
  const remaining = sumStockByProduct(
    sold.filter(
      (line) => line?.productId && !String(line.productId).startsWith('manual-'),
    ),
  );
  const capped: T[] = [];
  for (const line of returned) {
    const productId = line?.productId ? String(line.productId) : '';
    if (!productId) continue;
    if (productId.startsWith('manual-')) {
      capped.push(line);
      continue;
    }
    const quantity = Math.max(0, toStockUnits(line.quantity));
    const left = remaining.get(productId) || 0;
    const allowed = Math.min(quantity, Math.max(0, left));
    if (allowed <= 0) continue;
    remaining.set(productId, left - allowed);
    capped.push({ ...line, quantity: allowed });
  }
  return capped;
}

/**
 * Pieces still out on a sale after an earlier restock, such as an exchange.
 * Quantities already put back are not returned again.
 */
export function quantitiesStillSold(
  sold: Array<{ productId?: string | null; quantity?: unknown }> = [],
  alreadyRestored: Array<{ productId?: string | null; quantity?: unknown }> = [],
): Array<{ productId: string; quantity: number }> {
  const restored = sumStockByProduct(alreadyRestored);
  const remaining: Array<{ productId: string; quantity: number }> = [];
  for (const [productId, quantity] of sumStockByProduct(sold)) {
    const left = quantity - (restored.get(productId) || 0);
    if (left > 0) remaining.push({ productId, quantity: left });
  }
  return remaining;
}

/**
 * Adds `delta` to stockQuantity in SQL (`stockQuantity = stockQuantity + delta`).
 * Unlimited products are skipped. This does not read the row and write it
 * back, so a sale that commits in between cannot be overwritten.
 */
export async function adjustTrackedStock(
  manager: EntityManager,
  productId: string,
  delta: number,
  organizationId?: string | null,
): Promise<number> {
  const units = toStockUnits(delta);
  if (!productId || units === 0) return 0;

  const where: Record<string, unknown> = {
    id: productId,
    infiniteStock: false,
  };
  if (organizationId) where.organizationId = organizationId;

  const result = await manager.increment(
    ProductEntity,
    where,
    'stockQuantity',
    units,
  );
  return result.affected ?? 0;
}
