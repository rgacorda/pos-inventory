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

export class POSDatabase extends Dexie {
  orders!: Table<LocalOrder, number>;
  payments!: Table<LocalPayment, number>;
  products!: Table<LocalProduct, string>;
  syncMetadata!: Table<SyncMetadata, number>;

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
  }
}

export const db = new POSDatabase();

// Helper functions for common operations
export const dbHelpers = {
  // Get all pending items for sync
  async getPendingSyncItems() {
    const orders = await db.orders
      .where("syncStatus")
      .equals("pending")
      .toArray();

    const payments = await db.payments
      .where("syncStatus")
      .equals("pending")
      .toArray();

    return { orders, payments };
  },

  // Get all failed and pending items for retry (including previous days)
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

    return {
      orders: [...pendingOrders, ...errorOrders],
      payments: [...pendingPayments, ...errorPayments],
    };
  },

  // Get count of failed items
  async getFailedItemsCount() {
    const errorOrders = await db.orders
      .where("syncStatus")
      .equals("error")
      .count();

    const errorPayments = await db.payments
      .where("syncStatus")
      .equals("error")
      .count();

    const pendingOrders = await db.orders
      .where("syncStatus")
      .equals("pending")
      .count();

    const pendingPayments = await db.payments
      .where("syncStatus")
      .equals("pending")
      .count();

    return {
      failed: errorOrders + errorPayments,
      pending: pendingOrders + pendingPayments,
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
};
