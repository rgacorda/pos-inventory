/**
 * Order status enum
 */
export enum OrderStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  SYNCED = "SYNCED",
  VOID = "VOID",
}

/**
 * Payment method enum
 */
export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  DIGITAL_WALLET = "DIGITAL_WALLET",
  STORE_CREDIT = "STORE_CREDIT",
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  REFUNDED = "REFUNDED",
  FAILED = "FAILED",
}

/**
 * Sync status enum
 */
export enum SyncStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CONFLICT = "CONFLICT",
}

/**
 * User role enum
 */
export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  CASHIER = "CASHIER",
  INVENTORY_MANAGER = "INVENTORY_MANAGER",
}

/**
 * Product status enum
 */
export enum ProductStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DISCONTINUED = "DISCONTINUED",
}

/**
 * Transaction type enum
 */
export enum TransactionType {
  SALE = "SALE",
  REFUND = "REFUND",
  VOID = "VOID",
  ADJUSTMENT = "ADJUSTMENT",
}
