/**
 * Calculate tax amount based on subtotal and tax rate
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Number((subtotal * taxRate).toFixed(2));
}

/**
 * Calculate tax-inclusive price
 */
export function calculateTaxInclusive(price: number, taxRate: number): number {
  return Number((price * (1 + taxRate)).toFixed(2));
}

/**
 * Calculate tax-exclusive price from tax-inclusive price
 */
export function calculateTaxExclusive(
  priceWithTax: number,
  taxRate: number,
): number {
  return Number((priceWithTax / (1 + taxRate)).toFixed(2));
}

/**
 * Extract tax amount from tax-inclusive price
 */
export function extractTax(priceWithTax: number, taxRate: number): number {
  const basePrice = calculateTaxExclusive(priceWithTax, taxRate);
  return Number((priceWithTax - basePrice).toFixed(2));
}

/**
 * Calculate total tax for multiple items with different tax rates
 */
export function calculateTotalTax(
  items: Array<{ subtotal: number; taxRate: number }>,
): number {
  const total = items.reduce((sum, item) => {
    return sum + calculateTax(item.subtotal, item.taxRate);
  }, 0);
  return Number(total.toFixed(2));
}
