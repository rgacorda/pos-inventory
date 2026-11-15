/** A product marked unlimited is not quantity-tracked. */
export function isUnlimitedStock(
  product: { infiniteStock?: boolean } | null | undefined,
): boolean {
  return product?.infiniteStock === true;
}

/** Compact stock label. Unlimited products have no quantity. */
export function formatStockQuantity(product: {
  infiniteStock?: boolean;
  stockQuantity?: number | null;
}): string {
  if (isUnlimitedStock(product)) return "∞";
  const quantity = Number(product?.stockQuantity);
  return Number.isFinite(quantity) ? String(quantity) : "0";
}

/** Sort key that places unlimited products ahead of any finite quantity. */
export function stockSortValue(product: {
  infiniteStock?: boolean;
  stockQuantity?: number | null;
}): number {
  if (isUnlimitedStock(product)) return Number.MAX_SAFE_INTEGER;
  const quantity = Number(product?.stockQuantity);
  return Number.isFinite(quantity) ? quantity : 0;
}

/** Unlimited products can always be sold. Finite products need a positive count. */
export function hasAvailableStock(product: {
  infiniteStock?: boolean;
  stockQuantity?: number | null;
}): boolean {
  return isUnlimitedStock(product) || stockSortValue(product) > 0;
}

/**
 * Whole units only. A value that is already a whole number (within a
 * thousandth, so 6 × 1.5 stays 9) is returned as that integer. Anything
 * else, including 1.4 units, is rejected so stock and the saved quantity
 * cannot drift apart.
 */
export function wholeStockUnits(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const units = Math.round(parsed);
  if (Math.abs(parsed - units) > 0.001) return null;
  return units;
}
