import { OrderStatus, PaymentMethod, PaymentStatus, SyncStatus } from "./enums";

/**
 * DTO for creating an order item
 */
export interface CreateOrderItemDto {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
}

/**
 * DTO for creating an order
 */
export interface CreateOrderDto {
  posLocalId: string;
  terminalId: string;
  cashierId: string;
  items: CreateOrderItemDto[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  completedAt: Date;
}

/**
 * DTO for creating a payment
 */
export interface CreatePaymentDto {
  posLocalId: string;
  orderId: string;
  orderPosLocalId: string; // Reference to order's posLocalId
  terminalId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  processedAt: Date;
}

/**
 * DTO for sync request from POS
 */
export interface SyncRequestDto {
  terminalId: string;
  lastSyncAt?: Date;
  orders: CreateOrderDto[];
  payments: CreatePaymentDto[];
}

/**
 * DTO for sync response to POS
 */
export interface SyncResponseDto {
  status: SyncStatus;
  syncedAt: Date;
  results: {
    orders: SyncResultDto[];
    payments: SyncResultDto[];
  };
  catalog?: ProductCatalogDto;
}

/**
 * DTO for individual sync result
 */
export interface SyncResultDto {
  posLocalId: string;
  status: "SUCCESS" | "DUPLICATE" | "ERROR";
  serverId?: string;
  message?: string;
}

/**
 * DTO for product catalog (cached on POS)
 */
export interface ProductCatalogDto {
  products: ProductDto[];
  lastUpdated: Date;
}

/**
 * DTO for product
 */
export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  taxRate: number;
  barcode?: string;
  imageUrl?: string;
  status: string;
  stockQuantity: number;
}

/**
 * DTO for authentication
 */
export interface LoginDto {
  email: string;
  password: string;
  terminalId?: string;
}

/**
 * DTO for authentication response
 */
export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string | null;
    organizationName?: string;
    mustChangePassword?: boolean; // True if user needs to change password on first login
  };
}

/**
 * DTO for order summary
 */
export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  terminalId: string;
  totalAmount: number;
  status: OrderStatus;
  completedAt?: Date;
  itemCount: number;
}

/**
 * DTO for payment summary
 */
export interface PaymentSummaryDto {
  id: string;
  paymentNumber: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  processedAt?: Date;
}

/**
 * DTO for inventory update
 */
export interface UpdateInventoryDto {
  productId: string;
  quantity: number;
  type: "IN" | "OUT" | "ADJUSTMENT";
  reason?: string;
}

/**
 * DTO for sales report
 */
export interface SalesReportDto {
  periodStart: Date;
  periodEnd: Date;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  paymentBreakdown: {
    method: PaymentMethod;
    amount: number;
    count: number;
  }[];
}

/**
 * DTO for creating an organization (Super Admin only)
 */
export interface CreateOrganizationDto {
  name: string;
  slug: string;
  description?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  settings?: {
    currency?: string;
    timezone?: string;
    language?: string;
    taxRate?: number;
  };
  // Admin user details (automatically created with organization)
  adminName: string;
  adminEmail: string;
  adminPassword?: string; // Optional - will generate temporary password if not provided
}

/**
 * DTO for updating an organization (Super Admin only)
 */
export interface UpdateOrganizationDto {
  name?: string;
  slug?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  settings?: {
    currency?: string;
    timezone?: string;
    language?: string;
    taxRate?: number;
  };
  isActive?: boolean;
}

/**
 * DTO for changing password
 */
export interface ChangePasswordDto {
  currentPassword?: string; // Optional for first-time password change
  newPassword: string;
  confirmPassword: string;
}

/**
 * DTO for password reset request
 */
export interface ResetPasswordRequestDto {
  email: string;
}

/**
 * DTO for password reset
 */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
