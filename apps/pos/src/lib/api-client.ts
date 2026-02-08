import axios, { AxiosInstance } from "axios";
import { db, dbHelpers } from "./db";
import type {
  SyncRequestDto,
  SyncResponseDto,
  CreateOrderDto,
  CreatePaymentDto,
  LoginDto,
  AuthResponseDto,
} from "@pos/shared-types";

class APIClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Load token from localStorage on initialization
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("accessToken");
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("accessToken", token);
      } else {
        localStorage.removeItem("accessToken");
      }
    }
  }

  getAccessToken() {
    return this.accessToken;
  }

  async login(credentials: LoginDto): Promise<AuthResponseDto> {
    const response = await this.client.post<AuthResponseDto>(
      "/auth/login",
      credentials,
    );
    this.setAccessToken(response.data.accessToken);
    return response.data;
  }

  logout() {
    this.setAccessToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
    }
  }

  async sync(syncRequest: SyncRequestDto): Promise<SyncResponseDto> {
    const response = await this.client.post<SyncResponseDto>(
      "/pos/sync",
      syncRequest,
    );
    return response.data;
  }

  isOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  }
}

export const apiClient = new APIClient();

// Sync service for managing offline/online sync
export class SyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  async startAutoSync(intervalMs: number = 60000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Initial sync
    await this.performSync();

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async performSync(): Promise<boolean> {
    if (this.isSyncing) {
      console.log("Sync already in progress, skipping...");
      return false;
    }

    if (!apiClient.isOnline()) {
      console.log("Offline, skipping sync...");
      return false;
    }

    if (!apiClient.getAccessToken()) {
      console.log("Not authenticated, skipping sync...");
      return false;
    }

    this.isSyncing = true;

    try {
      const terminalId = await dbHelpers.getTerminalId();
      if (!terminalId) {
        throw new Error("Terminal ID not set");
      }

      // Get pending items
      const { orders, payments } = await dbHelpers.getPendingSyncItems();

      if (orders.length === 0 && payments.length === 0) {
        console.log("No items to sync");
        await this.syncProductCatalog(terminalId);
        return true;
      }

      console.log(
        `Syncing ${orders.length} orders and ${payments.length} payments...`,
      );

      // Mark items as syncing
      await this.markItemsAsSyncing(orders, payments);

      // Prepare sync request
      const lastSyncAt = await dbHelpers.getLastSyncTime();
      const syncRequest: SyncRequestDto = {
        terminalId,
        lastSyncAt: lastSyncAt || undefined,
        orders: orders.map(this.convertLocalOrderToDto),
        payments: payments.map(this.convertLocalPaymentToDto),
      };

      // Send sync request
      const response = await apiClient.sync(syncRequest);

      // Process results
      await this.processSyncResults(response);

      // Update product catalog if included
      if (response.catalog) {
        await this.updateProductCatalog(response.catalog);
      }

      // Update last sync time
      await dbHelpers.updateLastSyncTime(response.syncedAt);

      console.log("Sync completed successfully");
      return true;
    } catch (error) {
      console.error("Sync failed:", error);
      await this.markItemsAsError(error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncProductCatalog(terminalId: string) {
    try {
      const lastSyncAt = await dbHelpers.getLastSyncTime();
      const response = await apiClient.sync({
        terminalId,
        lastSyncAt: lastSyncAt || undefined,
        orders: [],
        payments: [],
      });

      if (response.catalog) {
        await this.updateProductCatalog(response.catalog);
      }

      await dbHelpers.updateLastSyncTime(response.syncedAt);
    } catch (error) {
      console.error("Failed to sync product catalog:", error);
    }
  }

  private async markItemsAsSyncing(orders: any[], payments: any[]) {
    await Promise.all([
      ...orders.map((order) =>
        db.orders.update(order.id!, { syncStatus: "syncing" }),
      ),
      ...payments.map((payment) =>
        db.payments.update(payment.id!, { syncStatus: "syncing" }),
      ),
    ]);
  }

  private async markItemsAsError(error: any) {
    const errorMessage = error.message || "Sync failed";

    const syncingOrders = await db.orders
      .where("syncStatus")
      .equals("syncing")
      .toArray();
    const syncingPayments = await db.payments
      .where("syncStatus")
      .equals("syncing")
      .toArray();

    await Promise.all([
      ...syncingOrders.map((order) =>
        db.orders.update(order.id!, {
          syncStatus: "error",
          syncError: errorMessage,
        }),
      ),
      ...syncingPayments.map((payment) =>
        db.payments.update(payment.id!, {
          syncStatus: "error",
          syncError: errorMessage,
        }),
      ),
    ]);
  }

  private async processSyncResults(response: SyncResponseDto) {
    // Process order results
    for (const result of response.results.orders) {
      const localOrder = await db.orders
        .where("posLocalId")
        .equals(result.posLocalId)
        .first();

      if (localOrder) {
        if (result.status === "SUCCESS" || result.status === "DUPLICATE") {
          await db.orders.update(localOrder.id!, {
            syncStatus: "synced",
            syncError: undefined,
          });
        } else {
          await db.orders.update(localOrder.id!, {
            syncStatus: "error",
            syncError: result.message || "Sync failed",
          });
        }
      }
    }

    // Process payment results
    for (const result of response.results.payments) {
      const localPayment = await db.payments
        .where("posLocalId")
        .equals(result.posLocalId)
        .first();

      if (localPayment) {
        if (result.status === "SUCCESS" || result.status === "DUPLICATE") {
          await db.payments.update(localPayment.id!, {
            syncStatus: "synced",
            syncError: undefined,
          });
        } else {
          await db.payments.update(localPayment.id!, {
            syncStatus: "error",
            syncError: result.message || "Sync failed",
          });
        }
      }
    }
  }

  private async updateProductCatalog(catalog: any) {
    const products = catalog.products.map((p: any) => ({
      ...p,
      lastSyncedAt: new Date(),
    }));

    await db.transaction("rw", db.products, async () => {
      // Clear all existing products to avoid showing stale data
      await db.products.clear();

      // Add all products from the catalog
      for (const product of products) {
        await db.products.put(product);
      }
    });

    console.log(`Updated ${products.length} products in catalog`);
  }

  private convertLocalOrderToDto(order: any): CreateOrderDto {
    return {
      posLocalId: order.posLocalId,
      terminalId: order.terminalId,
      cashierId: order.cashierId,
      items: order.items,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      completedAt: order.completedAt,
    };
  }

  private convertLocalPaymentToDto(payment: any): CreatePaymentDto {
    return {
      posLocalId: payment.posLocalId,
      orderId: payment.orderId, // posLocalId of the order
      orderPosLocalId: payment.orderId, // Same as orderId for POS
      terminalId: payment.terminalId,
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference || payment.paymentNumber,
      processedAt: payment.processedAt,
    };
  }
}

export const syncService = new SyncService();
