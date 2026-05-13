import Dexie, { Table } from "dexie";
import {
  Order,
  Payment,
  Product,
  OrderStatus,
  PaymentStatus,
} from "@pos/shared-types";

export interface LocalOrder extends Omit<
  Order,
  "id" | "createdAt" | "updatedAt"
> {
  id?: number;
  serverId?: string; // UUID from server after sync
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
  localCreatedAt: Date;
  localUpdatedAt: Date;
}

export interface LocalPayment extends Omit<
  Payment,
  "id" | "createdAt" | "updatedAt"
> {
  id?: number;
  serverId?: string; // UUID from server after sync
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
  localCreatedAt: Date;
  localUpdatedAt: Date;
}

export interface LocalProduct extends Product {
  lastSyncedAt: Date;
}

export interface SyncMetadata {
  id?: number;
  key: string;
  value: string;
  updatedAt: Date;
}

export interface OrganizationData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  updatedAt: Date;
}

export class POSDatabase extends Dexie {
  orders!: Table<LocalOrder, number>;
  payments!: Table<LocalPayment, number>;
  products!: Table<LocalProduct, string>;
  syncMetadata!: Table<SyncMetadata, number>;
  organization!: Table<OrganizationData, string>;

  constructor() {
    super("POSDatabase");

    this.version(1).stores({
      orders:
        "++id, posLocalId, terminalId, status, syncStatus, completedAt, localCreatedAt",
      payments:
        "++id, posLocalId, orderId, terminalId, method, syncStatus, processedAt, localCreatedAt",
      products: "id, sku, barcode, category, status, lastSyncedAt",
      syncMetadata: "++id, key, updatedAt",
    });

    // Version 2: Add indexes for customer fields and payment reference
    this.version(2).stores({
      orders:
        "++id, posLocalId, terminalId, status, syncStatus, completedAt, localCreatedAt, customerName",
      payments:
        "++id, posLocalId, orderId, terminalId, method, syncStatus, processedAt, localCreatedAt, reference",
      products: "id, sku, barcode, category, status, lastSyncedAt",
      syncMetadata: "++id, key, updatedAt",
    });

    // Version 3: Add organization table for offline store data
    this.version(3).stores({
      orders:
        "++id, posLocalId, terminalId, status, syncStatus, completedAt, localCreatedAt, customerName",
      payments:
        "++id, posLocalId, orderId, terminalId, method, syncStatus, processedAt, localCreatedAt, reference",
      products: "id, sku, barcode, category, status, lastSyncedAt",
      syncMetadata: "++id, key, updatedAt",
      organization: "id, updatedAt",
    });

    // Version 4: Add serverId field to store server UUID after sync
    this.version(4).stores({
      orders:
        "++id, posLocalId, serverId, terminalId, status, syncStatus, completedAt, localCreatedAt, customerName",
      payments:
        "++id, posLocalId, serverId, orderId, terminalId, method, syncStatus, processedAt, localCreatedAt, reference",
      products: "id, sku, barcode, category, status, lastSyncedAt",
      syncMetadata: "++id, key, updatedAt",
      organization: "id, updatedAt",
    });
  }
}

export const db = new POSDatabase();

// Helper functions for common operations
export const dbHelpers = {
  // Get posLocalIds of all voided orders (used to exclude their payments from sync)
  async getVoidedOrderPosLocalIds(): Promise<Set<string>> {
    const voidedOrders = await db.orders
      .where("status")
      .equals("VOID")
      .toArray();
    return new Set(voidedOrders.map(o => o.posLocalId));
  },

  // Get all pending items for sync (excluding voided orders and their payments)
  async getPendingSyncItems() {
    const allPendingOrders = await db.orders
      .where("syncStatus")
      .equals("pending")
      .toArray();

    // Filter out voided orders
    const orders = allPendingOrders.filter(order => order.status !== "VOID");

    const allPendingPayments = await db.payments
      .where("syncStatus")
      .equals("pending")
      .toArray();

    // Filter out payments whose parent order is voided
    const voidedOrderIds = await dbHelpers.getVoidedOrderPosLocalIds();
    const payments = allPendingPayments.filter(p => !voidedOrderIds.has(p.orderId));

    return { orders, payments };
  },

  // Get all failed and pending items for retry (including previous days, excluding voided orders and their payments)
  async getFailedAndPendingSyncItems() {
    const pendingOrders = await db.orders
      .where("syncStatus")
      .equals("pending")
      .toArray();

    const errorOrders = await db.orders
      .where("syncStatus")
      .equals("error")
      .toArray();

    const pendingPayments = await db.payments
      .where("syncStatus")
      .equals("pending")
      .toArray();

    const errorPayments = await db.payments
      .where("syncStatus")
      .equals("error")
      .toArray();

    // Filter out voided orders from both pending and error lists
    const nonVoidedPendingOrders = pendingOrders.filter(order => order.status !== "VOID");
    const nonVoidedErrorOrders = errorOrders.filter(order => order.status !== "VOID");

    // Filter out payments whose parent order is voided
    const voidedOrderIds = await dbHelpers.getVoidedOrderPosLocalIds();
    const nonVoidedPendingPayments = pendingPayments.filter(p => !voidedOrderIds.has(p.orderId));
    const nonVoidedErrorPayments = errorPayments.filter(p => !voidedOrderIds.has(p.orderId));

    return {
      orders: [...nonVoidedPendingOrders, ...nonVoidedErrorOrders],
      payments: [...nonVoidedPendingPayments, ...nonVoidedErrorPayments],
    };
  },

  // Get count of failed items (excludes pending orders within 5-minute void window, voided orders, and payments for voided orders)
  async getFailedItemsCount() {
    // Get voided order IDs once to reuse across all payment filters
    const voidedOrderIds = await dbHelpers.getVoidedOrderPosLocalIds();

    // Get error orders (excluding voided ones)
    const allErrorOrders = await db.orders
      .where("syncStatus")
      .equals("error")
      .toArray();
    
    const errorOrders = allErrorOrders.filter(order => order.status !== "VOID").length;

    // Get error payments (excluding those for voided orders)
    const allErrorPayments = await db.payments
      .where("syncStatus")
      .equals("error")
      .toArray();

    const errorPayments = allErrorPayments.filter(p => !voidedOrderIds.has(p.orderId)).length;

    // For pending orders, only count those older than 5 minutes (excluding voided ones)
    // (recent orders are still in void window, not "failed")
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const allPendingOrders = await db.orders
      .where("syncStatus")
      .equals("pending")
      .toArray();
    
    const pendingOrders = allPendingOrders.filter(order => {
      // Exclude voided orders (they keep pending status but should never sync)
      if (order.status === "VOID") return false;
      
      const orderTime = order.localCreatedAt instanceof Date 
        ? order.localCreatedAt 
        : new Date(order.localCreatedAt);
      return orderTime <= fiveMinutesAgo;
    }).length;

    // For pending payments, only count those older than 5 minutes and not for voided orders
    const allPendingPayments = await db.payments
      .where("syncStatus")
      .equals("pending")
      .toArray();
    
    const pendingPayments = allPendingPayments.filter(payment => {
      // Exclude payments whose parent order is voided
      if (voidedOrderIds.has(payment.orderId)) return false;

      const paymentTime = payment.localCreatedAt instanceof Date 
        ? payment.localCreatedAt 
        : new Date(payment.localCreatedAt);
      return paymentTime <= fiveMinutesAgo;
    }).length;

    console.log(`📊 Sync status: ${errorOrders} error orders, ${errorPayments} error payments, ${pendingOrders} pending orders (>5min), ${pendingPayments} pending payments (>5min)`);

    // Log details of error items for debugging
    if (errorOrders > 0) {
      const errorOrderDetails = allErrorOrders
        .filter(o => o.status !== "VOID")
        .map(o => ({
          orderNumber: o.orderNumber,
          status: o.status,
          syncError: o.syncError,
          age: `${Math.round((Date.now() - new Date(o.localCreatedAt).getTime()) / 60000)}min`,
        }));
      console.log(`❌ Orders with sync errors:`, errorOrderDetails);
    }
    if (errorPayments > 0) {
      const errorPaymentDetails = allErrorPayments
        .filter(p => !voidedOrderIds.has(p.orderId))
        .map(p => ({
          posLocalId: p.posLocalId,
          orderId: p.orderId,
          syncError: p.syncError,
          age: `${Math.round((Date.now() - new Date(p.localCreatedAt).getTime()) / 60000)}min`,
        }));
      console.log(`❌ Payments with sync errors:`, errorPaymentDetails);
    }

    return {
      failed: errorOrders + errorPayments, // Only actual errors
      pending: pendingOrders + pendingPayments, // Old pending items (for monitoring)
      total: errorOrders + errorPayments + pendingOrders + pendingPayments,
    };
  },

  // Get last sync time
  async getLastSyncTime(): Promise<Date | null> {
    const metadata = await db.syncMetadata
      .where("key")
      .equals("lastSyncAt")
      .first();

    return metadata ? new Date(metadata.value) : null;
  },

  // Update last sync time
  async updateLastSyncTime(date: Date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const existing = await db.syncMetadata
      .where("key")
      .equals("lastSyncAt")
      .first();

    if (existing) {
      await db.syncMetadata.update(existing.id!, {
        value: dateObj.toISOString(),
        updatedAt: new Date(),
      });
    } else {
      await db.syncMetadata.add({
        key: "lastSyncAt",
        value: dateObj.toISOString(),
        updatedAt: new Date(),
      });
    }
  },

  // Get terminal ID
  async getTerminalId(): Promise<string | null> {
    const metadata = await db.syncMetadata
      .where("key")
      .equals("terminalId")
      .first();

    return metadata ? metadata.value : null;
  },

  // Set terminal ID
  async setTerminalId(terminalId: string) {
    const existing = await db.syncMetadata
      .where("key")
      .equals("terminalId")
      .first();

    if (existing) {
      await db.syncMetadata.update(existing.id!, {
        value: terminalId,
        updatedAt: new Date(),
      });
    } else {
      await db.syncMetadata.add({
        key: "terminalId",
        value: terminalId,
        updatedAt: new Date(),
      });
    }
  },

  // Get active products
  async getActiveProducts() {
    return db.products.where("status").equals("ACTIVE").toArray();
  },

  // Search products
  async searchProducts(query: string) {
    const lowerQuery = query.toLowerCase();
    return db.products
      .filter((p) => {
        const nameMatch = p.name?.toLowerCase().includes(lowerQuery) ?? false;
        const skuMatch = p.sku?.toLowerCase().includes(lowerQuery) ?? false;
        const barcodeMatch = p.barcode?.includes(query) ?? false;
        return nameMatch || skuMatch || barcodeMatch;
      })
      .toArray();
  },

  // Get orders by status
  async getOrdersByStatus(status: OrderStatus) {
    return db.orders
      .where("status")
      .equals(status)
      .reverse()
      .sortBy("localCreatedAt");
  },

  // Get today's orders
  async getTodaysOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return db.orders.where("localCreatedAt").above(today).toArray();
  },

  // Clear all synced orders older than N days
  async clearOldSyncedOrders(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    await db.orders
      .where("syncStatus")
      .equals("synced")
      .and((order) => order.localCreatedAt < cutoffDate)
      .delete();
  },

  // Get payments for an order
  async getPaymentsByOrder(orderPosLocalId: string) {
    return db.payments
      .where("orderId")
      .equals(orderPosLocalId)
      .toArray();
  },

  // Set organization data
  async setOrganization(orgData: Omit<OrganizationData, "updatedAt">) {
    await db.organization.put({
      ...orgData,
      updatedAt: new Date(),
    });
  },

  // Get organization data
  async getOrganization() {
    const allOrgs = await db.organization.toArray();
    return allOrgs.length > 0 ? allOrgs[0] : null;
  },
};
