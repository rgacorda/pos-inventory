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
 * SUPER_ADMIN: Platform owner - manages all organizations and subscriptions
 * ADMIN: Organization owner - full access to their organization
 * MANAGER: Store manager - can manage inventory and use POS
 * CASHIER: POS operator - can only process sales
 */
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  CASHIER = "CASHIER",
}

/**
 * Subscription plan enum
 */
export enum SubscriptionPlan {
  FREE = "FREE",
  BASIC = "BASIC",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
}

/**
 * Subscription status enum
 */
export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  TRIAL = "TRIAL",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
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
