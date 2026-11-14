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
