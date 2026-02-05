import { CreateOrderDto, CreatePaymentDto } from "@pos/shared-types";

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate order data
 */
export function validateOrder(order: CreateOrderDto): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!order.posLocalId || order.posLocalId.trim() === "") {
    errors.push("posLocalId is required");
  }

  if (!order.terminalId || order.terminalId.trim() === "") {
    errors.push("terminalId is required");
  }

  if (!order.cashierId || order.cashierId.trim() === "") {
    errors.push("cashierId is required");
  }

  if (!order.items || order.items.length === 0) {
    errors.push("Order must have at least one item");
  }

  if (order.subtotal < 0) {
    errors.push("Subtotal cannot be negative");
  }

  if (order.totalAmount < 0) {
    errors.push("Total amount cannot be negative");
  }

  // Validate items
  order.items?.forEach((item, index) => {
    if (item.quantity <= 0) {
      errors.push(`Item ${index + 1}: quantity must be positive`);
    }
    if (item.unitPrice < 0) {
      errors.push(`Item ${index + 1}: unit price cannot be negative`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Validate payment data
 */
export function validatePayment(payment: CreatePaymentDto): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!payment.posLocalId || payment.posLocalId.trim() === "") {
    errors.push("posLocalId is required");
  }

  if (!payment.orderId && !payment.orderPosLocalId) {
    errors.push("Either orderId or orderPosLocalId is required");
  }

  if (!payment.terminalId || payment.terminalId.trim() === "") {
    errors.push("terminalId is required");
  }

  if (payment.amount <= 0) {
    errors.push("Payment amount must be positive");
  }

  if (!payment.method) {
    errors.push("Payment method is required");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate SKU format
 */
export function isValidSku(sku: string): boolean {
  // SKU should be alphanumeric with optional hyphens/underscores
  const skuRegex = /^[A-Za-z0-9_-]+$/;
  return skuRegex.test(sku) && sku.length >= 3 && sku.length <= 50;
}

/**
 * Validate barcode format (EAN-13, UPC, etc.)
 */
export function isValidBarcode(barcode: string): boolean {
  // Basic validation for numeric barcodes (8-14 digits)
  const barcodeRegex = /^\d{8,14}$/;
  return barcodeRegex.test(barcode);
}
