/**
 * One settlement for a sale line, shared by the sync writer and the
 * order API. The register's subtotal and total are kept when it sends
 * them: a pack price does not always equal quantity × the rounded unit
 * price, and peso rounding can add a few centavos to one line.
 */

export function ledgerMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/** order_items.taxRate is numeric(5,4), so values must be below 10. */
export function ledgerTaxRate(value: unknown): number {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return Math.min(9.9999, Math.round(rate * 10000) / 10000);
}

function hasRecordedAmount(value: unknown): boolean {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

export interface SaleLineInput {
  quantity?: unknown;
  unitPrice?: unknown;
  price?: unknown;
  discountAmount?: unknown;
  discount?: unknown;
  taxRate?: unknown;
  subtotal?: unknown;
  total?: unknown;
}

export interface SettledSaleLine {
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  subtotal: number;
  total: number;
}

export function settleSaleLine(item: SaleLineInput): SettledSaleLine {
  const quantity = Math.max(0, Math.round(Number(item.quantity) || 0));
  const unitPrice = ledgerMoney(item.unitPrice ?? item.price);
  const discountAmount = ledgerMoney(item.discountAmount ?? item.discount);
  const taxRate = ledgerTaxRate(item.taxRate);
  const computedSubtotal = ledgerMoney(quantity * unitPrice);
  const subtotal = hasRecordedAmount(item.subtotal)
    ? ledgerMoney(item.subtotal)
    : computedSubtotal;
  const computedTotal = ledgerMoney(
    subtotal - discountAmount + subtotal * taxRate,
  );
  const total = hasRecordedAmount(item.total)
    ? ledgerMoney(item.total)
    : computedTotal;
  return {
    quantity,
    unitPrice,
    discountAmount,
    taxRate,
    subtotal,
    total,
  };
}
