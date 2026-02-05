import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  UserRole,
} from "./enums";

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product entity
 */
export interface Product extends BaseEntity {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  cost?: number;
  taxRate: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  barcode?: string;
  imageUrl?: string;
  status: ProductStatus;
}

/**
 * Order entity
 */
export interface Order extends BaseEntity {
  orderNumber: string;
  posLocalId: string; // Local ID from POS terminal for deduplication
  terminalId: string;
  cashierId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: OrderStatus;
  completedAt?: Date;
  syncedAt?: Date;
  items: OrderItem[];
}

/**
 * Order item entity
 */
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  subtotal: number;
  total: number;
}

/**
 * Payment entity
 */
export interface Payment extends BaseEntity {
  paymentNumber: string;
  posLocalId: string; // Local ID from POS terminal for deduplication
  orderId: string;
  terminalId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  reference?: string;
  processedAt?: Date;
  syncedAt?: Date;
}

/**
 * Terminal entity
 */
export interface Terminal extends BaseEntity {
  terminalId: string;
  name: string;
  location?: string;
  lastSyncAt?: Date;
  isActive: boolean;
}

/**
 * User entity
 */
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  terminalId?: string;
  isActive: boolean;
}

/**
 * Inventory transaction entity
 */
export interface InventoryTransaction extends BaseEntity {
  productId: string;
  quantity: number;
  type: "IN" | "OUT" | "ADJUSTMENT";
  reason?: string;
  reference?: string;
  userId: string;
}
