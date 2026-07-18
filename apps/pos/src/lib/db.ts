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
  serverId?: string;          // UUID from server after sync
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
  localCreatedAt: Date;
  localUpdatedAt: Date;
  // Exchange fields
  exchangeRef?: string;       // original order number this exchange references
  originalServerId?: string;  // server UUID of original order (used to call /orders/{id}/exchange)
  // Loyalty points fields
  customerId?: string;        // server UUID of loyalty customer
  pointsEarned?: number;
  pointsRedeemed?: number;
}

export interface LocalCustomer {
  id: string;                 // server UUID
  organizationId: string;
  name: string;
  phone: string;
  totalPoints: number;
  totalSpent: number;
  cachedAt: Date;             // when this was last fetched from server
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

export type ReceiptPaperSize = "58mm" | "80mm";

// Dispatched on window whenever the receipt paper size is changed, so any
// already-mounted component (test printer dialog, receipt dialogs, etc.)
// can pick up the new setting immediately without needing a page reload.
export const PAPER_SIZE_CHANGE_EVENT = "pos:paper-size-changed";

export interface UnknownBarcode {
  id?: number;
  barcode: string;
  scannedAt: Date;
  scanCount: number;
}

export class POSDatabase extends Dexie {
  orders!: Table<LocalOrder, number>;
  payments!: Table<LocalPayment, number>;
  products!: Table<LocalProduct, string>;
  syncMetadata!: Table<SyncMetadata, number>;
  organization!: Table<OrganizationData, string>;
  unknownBarcodes!: Table<UnknownBarcode, number>;
  customers!: Table<LocalCustomer, string>;

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

    // Version 5: Add unknownBarcodes table for barcodes with no matching product
    this.version(5).stores({
      orders:
        "++id, posLocalId, serverId, terminalId, status, syncStatus, completedAt, localCreatedAt, customerName",
      payments:
        "++id, posLocalId, serverId, orderId, terminalId, method, syncStatus, processedAt, localCreatedAt, reference",
      products: "id, sku, barcode, category, status, lastSyncedAt",
      syncMetadata: "++id, key, updatedAt",
      organization: "id, updatedAt",
      unknownBarcodes: "++id, &barcode, scannedAt",
    });

    // Version 6: Add exchangeRef index to orders for exchange feature
    this.version(6).stores({
      orders:
        "++id, posLocalId, serverId, terminalId, status, syncStatus, completedAt, localCreatedAt, customerName, exchangeRef",
      payments:
        "++id, posLocalId, serverId, orderId, terminalId, method, syncStatus, processedAt, localCreatedAt, reference",
      products: "id, sku, barcode, category, status, lastSyncedAt",
      syncMetadata: "++id, key, updatedAt",
      organization: "id, updatedAt",
      unknownBarcodes: "++id, &barcode, scannedAt",
    });

    // Version 7: Add customers offline cache + loyalty point fields on orders
    this.version(7).stores({
      orders:
        "++id, posLocalId, serverId, terminalId, status, syncStatus, completedAt, localCreatedAt, customerName, exchangeRef, customerId",
      payments:
        "++id, posLocalId, serverId, orderId, terminalId, method, syncStatus, processedAt, localCreatedAt, reference",
      products: "id, sku, barcode, category, status, lastSyncedAt",
      syncMetadata: "++id, key, updatedAt",
      organization: "id, updatedAt",
      unknownBarcodes: "++id, &barcode, scannedAt",
      customers: "id, phone, organizationId, cachedAt",
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

  // Get count of failed items (excludes voided orders and payments for voided orders)
  async getFailedItemsCount() {
    const voidedOrderIds = await dbHelpers.getVoidedOrderPosLocalIds();

    const allErrorOrders = await db.orders
      .where("syncStatus")
      .equals("error")
      .toArray();
    const errorOrders = allErrorOrders.filter(order => order.status !== "VOID").length;

    const allErrorPayments = await db.payments
      .where("syncStatus")
      .equals("error")
      .toArray();
    const errorPayments = allErrorPayments.filter(p => !voidedOrderIds.has(p.orderId)).length;

    const allPendingOrders = await db.orders
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingOrders = allPendingOrders.filter(
      order => order.status !== "VOID"
    ).length;

    const allPendingPayments = await db.payments
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingPayments = allPendingPayments.filter(
      payment => !voidedOrderIds.has(payment.orderId)
    ).length;

    console.log(`📊 Sync status: ${errorOrders} error orders, ${errorPayments} error payments, ${pendingOrders} pending orders, ${pendingPayments} pending payments`);

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

  // Save an unmatched barcode (upsert: increment scan count if already exists)
  async saveUnknownBarcode(barcode: string) {
    const existing = await db.unknownBarcodes
      .where("barcode")
      .equals(barcode)
      .first();
    if (existing && existing.id != null) {
      await db.unknownBarcodes.update(existing.id, {
        scannedAt: new Date(),
        scanCount: existing.scanCount + 1,
      });
    } else {
      await db.unknownBarcodes.add({
        barcode,
        scannedAt: new Date(),
        scanCount: 1,
      });
    }
  },

  // Get all unknown barcodes sorted by most recently scanned
  async getUnknownBarcodes() {
    const all = await db.unknownBarcodes.toArray();
    return all.sort(
      (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
    );
  },

  // Dismiss (delete) a saved unknown barcode by id
  async dismissUnknownBarcode(id: number) {
    await db.unknownBarcodes.delete(id);
  },

  // Cache a customer record fetched from the server
  async cacheCustomer(customer: Omit<LocalCustomer, "cachedAt">) {
    await db.customers.put({ ...customer, cachedAt: new Date() });
  },

  // Look up a customer from the local cache by phone
  async getCachedCustomerByPhone(phone: string): Promise<LocalCustomer | undefined> {
    return db.customers.where("phone").equals(phone).first();
  },

  // Look up a customer by server ID from cache
  async getCachedCustomerById(id: string): Promise<LocalCustomer | undefined> {
    return db.customers.get(id);
  },

  // Search cached customers by name (case-insensitive substring)
  async searchCachedCustomersByName(
    q: string,
    limit = 20,
  ): Promise<LocalCustomer[]> {
    const lower = q.toLowerCase();
    const all = await db.customers.toArray();
    return all
      .filter((c) => c.name.toLowerCase().includes(lower))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  },

  // Cache multiple customers at once (e.g. from bulk search results)
  async cacheCustomers(customers: Omit<LocalCustomer, "cachedAt">[]) {
    const now = new Date();
    await db.customers.bulkPut(customers.map((c) => ({ ...c, cachedAt: now })));
  },

  // Get void PIN (defaults to "0000" if never set)
  async getVoidPin(): Promise<string> {
    const metadata = await db.syncMetadata
      .where("key")
      .equals("voidPin")
      .first();
    return metadata ? metadata.value : "0000";
  },

  // Set void PIN
  async setVoidPin(pin: string) {
    const existing = await db.syncMetadata
      .where("key")
      .equals("voidPin")
      .first();

    if (existing) {
      await db.syncMetadata.update(existing.id!, {
        value: pin,
        updatedAt: new Date(),
      });
    } else {
      await db.syncMetadata.add({
        key: "voidPin",
        value: pin,
        updatedAt: new Date(),
      });
    }
  },

  // Get receipt paper size (defaults to "58mm" if never set)
  async getPaperSize(): Promise<ReceiptPaperSize> {
    const metadata = await db.syncMetadata
      .where("key")
      .equals("receiptPaperSize")
      .first();
    return metadata?.value === "80mm" ? "80mm" : "58mm";
  },

  // Set receipt paper size — persists until explicitly changed again
  async setPaperSize(paperSize: ReceiptPaperSize) {
    const existing = await db.syncMetadata
      .where("key")
      .equals("receiptPaperSize")
      .first();

    if (existing) {
      await db.syncMetadata.update(existing.id!, {
        value: paperSize,
        updatedAt: new Date(),
      });
    } else {
      await db.syncMetadata.add({
        key: "receiptPaperSize",
        value: paperSize,
        updatedAt: new Date(),
      });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(PAPER_SIZE_CHANGE_EVENT, { detail: paperSize }),
      );
    }
  },
};
