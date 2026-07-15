import { CreateOrderItemDto } from "@pos/shared-types";

/**
 * Determine which pricing tier applies for a given quantity.
 * Priority: pack (highest threshold) → half-pack → individual.
 */
export type PriceTier = "pack" | "halfPack" | "unit";

export function getActivePriceTier(
  quantity: number,
  packPrice?: number,
  packQuantity?: number,
  halfPackPrice?: number,
  halfPackQuantity?: number,
): PriceTier {
  if (packPrice && packQuantity && packQuantity > 0 && quantity >= packQuantity) {
    return "pack";
  }
  if (halfPackPrice && halfPackQuantity && halfPackQuantity > 0 && quantity >= halfPackQuantity) {
    return "halfPack";
  }
  return "unit";
}

/**
 * Breakdown of how a quantity decomposes into full packs, half-packs, and
 * leftover individual pieces, along with the subtotal for each portion.
 */
export interface PriceBreakdown {
  packs: number;
  halfPacks: number;
  units: number;
  packSubtotal: number;
  halfPackSubtotal: number;
  unitSubtotal: number;
  total: number;
}

/**
 * Decompose a quantity into the greatest number of full packs, then
 * half-packs, then leftover individual pieces — and price each portion at
 * its own tier. This ensures a quantity like "1 pack + 1 pc" is priced as
 * (packPrice + 1 × unitPrice) rather than discounting the extra piece at
 * the pack's per-unit rate.
 *
 * @param quantity       - Number of items being purchased
 * @param unitPrice      - Price per single item
 * @param packPrice      - Total sell price for a full pack (optional)
 * @param packQuantity   - Items that make a full pack (optional)
 * @param halfPackPrice  - Total sell price for a half-pack (optional)
 * @param halfPackQuantity - Items that make a half-pack (optional)
 */
export function calculatePriceBreakdown(
  quantity: number,
  unitPrice: number,
  packPrice?: number,
  packQuantity?: number,
  halfPackPrice?: number,
  halfPackQuantity?: number,
): PriceBreakdown {
  let remaining = Math.max(0, quantity);
  let packs = 0;
  let halfPacks = 0;

  if (packPrice && packQuantity && packQuantity > 0) {
    packs = Math.floor(remaining / packQuantity);
    remaining -= packs * packQuantity;
  }

  if (halfPackPrice && halfPackQuantity && halfPackQuantity > 0) {
    halfPacks = Math.floor(remaining / halfPackQuantity);
    remaining -= halfPacks * halfPackQuantity;
  }

  const units = remaining;
  const packSubtotal = Number((packs * (packPrice || 0)).toFixed(2));
  const halfPackSubtotal = Number((halfPacks * (halfPackPrice || 0)).toFixed(2));
  const unitSubtotal = Number((units * unitPrice).toFixed(2));
  const total = Number((packSubtotal + halfPackSubtotal + unitSubtotal).toFixed(2));

  return { packs, halfPacks, units, packSubtotal, halfPackSubtotal, unitSubtotal, total };
}

/**
 * Calculate the effective (blended) unit price based on quantity and tiered
 * pricing, e.g. for a quantity made up of a full pack plus one extra piece,
 * this returns the average price per unit across the whole quantity so that
 * `effectivePrice * quantity` equals the correct blended total.
 *
 * @param quantity       - Number of items being purchased
 * @param unitPrice      - Price per single item
 * @param packPrice      - Total sell price for a full pack (optional)
 * @param packQuantity   - Items that make a full pack (optional)
 * @param halfPackPrice  - Total sell price for a half-pack (optional)
 * @param halfPackQuantity - Items that make a half-pack (optional)
 * @returns Effective (blended) price per item
 */
export function calculateEffectivePrice(
  quantity: number,
  unitPrice: number,
  packPrice?: number,
  packQuantity?: number,
  halfPackPrice?: number,
  halfPackQuantity?: number,
): number {
  if (quantity <= 0) return unitPrice;
  const breakdown = calculatePriceBreakdown(
    quantity,
    unitPrice,
    packPrice,
    packQuantity,
    halfPackPrice,
    halfPackQuantity,
  );
  return breakdown.total / quantity;
}

/**
 * Calculate line item subtotal with tiered pricing support. Decomposes the
 * quantity into packs, half-packs, and leftover units so mixed quantities
 * (e.g. 1 pack + 1 pc) are priced correctly per-tier.
 */
export function calculateLineSubtotalWithTieredPrice(
  quantity: number,
  unitPrice: number,
  packPrice?: number,
  packQuantity?: number,
  halfPackPrice?: number,
  halfPackQuantity?: number,
): number {
  const breakdown = calculatePriceBreakdown(
    quantity,
    unitPrice,
    packPrice,
    packQuantity,
    halfPackPrice,
    halfPackQuantity,
  );
  return breakdown.total;
}

/**
 * Calculate line item subtotal (quantity × unit price)
 */
export function calculateLineSubtotal(
  quantity: number,
  unitPrice: number,
): number {
  return Number((quantity * unitPrice).toFixed(2));
}

/**
 * Calculate line item total (subtotal - discount + tax)
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  taxRate: number,
  discountAmount: number = 0,
): number {
  const subtotal = calculateLineSubtotal(quantity, unitPrice);
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * taxRate;
  return Number((afterDiscount + tax).toFixed(2));
}

/**
 * Calculate order subtotal from items
 */
export function calculateOrderSubtotal(
  items: Array<{ quantity: number; unitPrice: number }>,
): number {
  const total = items.reduce((sum, item) => {
    return sum + calculateLineSubtotal(item.quantity, item.unitPrice);
  }, 0);
  return Number(total.toFixed(2));
}

/**
 * Calculate order total amount
 */
export function calculateOrderTotal(
  subtotal: number,
  taxAmount: number,
  discountAmount: number = 0,
): number {
  return Number((subtotal - discountAmount + taxAmount).toFixed(2));
}

/**
 * Apply percentage discount
 */
export function applyPercentageDiscount(
  amount: number,
  discountPercent: number,
): number {
  const discount = amount * (discountPercent / 100);
  return Number(discount.toFixed(2));
}

/**
 * Apply fixed discount (ensures non-negative result)
 */
export function applyFixedDiscount(
  amount: number,
  discountAmount: number,
): number {
  const result = Math.max(0, amount - discountAmount);
  return Number(result.toFixed(2));
}

/**
 * Calculate profit margin
 */
export function calculateProfitMargin(price: number, cost: number): number {
  if (price === 0) return 0;
  return Number((((price - cost) / price) * 100).toFixed(2));
}

/**
 * Calculate markup percentage
 */
export function calculateMarkup(price: number, cost: number): number {
  if (cost === 0) return 0;
  return Number((((price - cost) / cost) * 100).toFixed(2));
}

/**
 * Round to nearest currency unit (e.g., 0.05 for some currencies)
 */
export function roundCurrency(
  amount: number,
  precision: number = 0.01,
): number {
  return Number((Math.round(amount / precision) * precision).toFixed(2));
}
