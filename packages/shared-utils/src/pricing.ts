import { CreateOrderItemDto } from "@pos/shared-types";

/**
 * Calculate the effective unit price based on quantity and tiered pricing
 * If quantity meets or exceeds packQuantity and packPrice is set, use pack pricing
 * Otherwise use per-piece pricing
 * 
 * @param quantity - Number of items being purchased
 * @param unitPrice - Price per single item
 * @param packPrice - Total price for a pack (not per-item in pack)
 * @param packQuantity - Number of items that make a pack
 * @returns Effective price per item
 */
export function calculateEffectivePrice(
  quantity: number,
  unitPrice: number,
  packPrice?: number,
  packQuantity?: number,
): number {
  // If pack pricing is not configured, use standard unit price
  if (!packPrice || !packQuantity || packQuantity <= 0) {
    return unitPrice;
  }

  // If quantity meets or exceeds pack threshold, calculate per-item price from pack
  if (quantity >= packQuantity) {
    return packPrice / packQuantity;
  }

  // Otherwise use standard unit price
  return unitPrice;
}

/**
 * Calculate line item subtotal with tiered pricing support
 * (quantity × effective unit price based on pack pricing)
 */
export function calculateLineSubtotalWithTieredPrice(
  quantity: number,
  unitPrice: number,
  packPrice?: number,
  packQuantity?: number,
): number {
  const effectivePrice = calculateEffectivePrice(
    quantity,
    unitPrice,
    packPrice,
    packQuantity,
  );
  return Number((quantity * effectivePrice).toFixed(2));
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
