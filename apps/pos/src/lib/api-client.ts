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

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          this.logout();
          if (
            typeof window !== "undefined" &&
            window.location.pathname !== "/login"
          ) {
            window.location.href = "/login";
          }
        }
        console.error("API Error:", {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
        return Promise.reject(error);
      },
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
        // Set cookie for middleware access
        document.cookie = `accessToken=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      } else {
        localStorage.removeItem("accessToken");
        // Remove cookie
        document.cookie =
          "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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
      localStorage.removeItem("organizationId");
      localStorage.removeItem("organizationName");
      // Clear cookie
      document.cookie =
        "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }

  async sync(syncRequest: SyncRequestDto): Promise<SyncResponseDto> {
    const response = await this.client.post<SyncResponseDto>(
      "/pos/sync",
      syncRequest,
    );
    return response.data;
  }

  async checkSyncRequest(
    terminalId: string,
  ): Promise<{ syncRequested: boolean }> {
    const response = await this.client.get<{ syncRequested: boolean }>(
      `/terminals/check-sync/${terminalId}`,
    );
    return response.data;
  }

  async clearSyncRequest(terminalId: string): Promise<{ success: boolean }> {
    const response = await this.client.post<{ success: boolean }>(
      `/terminals/clear-sync/${terminalId}`,
    );
    return response.data;
  }

  async getTerminals(): Promise<any[]> {
    const response = await this.client.get<any[]>("/terminals");
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
  private retryInterval: NodeJS.Timeout | null = null;
  private isRetryActive = false;
  private syncRequestCheckInterval: NodeJS.Timeout | null = null;
  private lastSyncRequestCheck = 0;
  private hasPendingItems = false;

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

    // Start monitoring for failed syncs
    this.startRetryMonitoring();

    // Start monitoring for manual sync requests from admin
    this.startSyncRequestMonitoring();
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.stopRetryMonitoring();
    this.stopSyncRequestMonitoring();
  }

  private async startRetryMonitoring() {
    // Check immediately on startup
    const checkForFailed = async () => {
      const counts = await dbHelpers.getFailedItemsCount();

      if (counts.total > 0 && !this.isRetryActive) {
        console.log(
          `Detected ${counts.total} failed/pending items, starting automatic retry...`,
        );
        this.startAutoRetry();
      } else if (counts.total === 0 && this.isRetryActive) {
        console.log("No more failed items, stopping automatic retry");
        this.stopAutoRetry();
      }
    };

    // Check immediately
    await checkForFailed();

    // Then check every 30 seconds
    const checkInterval = setInterval(checkForFailed, 30000);

    // Store the monitoring interval
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    this.retryInterval = checkInterval;
  }

  private stopRetryMonitoring() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
    this.stopAutoRetry();
  }

  private async startSyncRequestMonitoring() {
    // Adaptive polling: check more frequently when there are pending items,
    // less frequently when everything is synced
    const checkForSyncRequest = async () => {
      try {
        const terminalId = localStorage.getItem("terminalId");
        if (!terminalId) {
          return; // No terminal configured
        }

        // First, check if we have pending items locally (fast, no network)
        const counts = await dbHelpers.getFailedItemsCount();
        this.hasPendingItems = counts.total > 0;

        const now = Date.now();
        const timeSinceLastCheck = now - this.lastSyncRequestCheck;

        // Adaptive polling strategy:
        // - If we have pending items: check backend every 30s (admin might want recent data synced)
        // - If no pending items: check backend every 5 minutes (idle state, reduce load)
        const checkInterval = this.hasPendingItems ? 30000 : 300000; // 30s vs 5min

        // Skip backend check if we checked recently and no pending items
        if (!this.hasPendingItems && timeSinceLastCheck < checkInterval) {
          return; // Skip this check cycle
        }

        // Make network request to check sync flag
        this.lastSyncRequestCheck = now;
        const response = await apiClient.checkSyncRequest(terminalId);

        if (response.syncRequested && !this.isSyncing) {
          console.log("Sync requested by admin, performing immediate sync...");
          await this.performSync();
        }
      } catch (error) {
        // Silently fail - don't disrupt normal operations if backend unavailable
        console.error("Error checking for sync request:", error);
      }
    };

    // Check immediately
    await checkForSyncRequest();

    // Run check cycle every 10 seconds (actual backend polling uses adaptive intervals)
    this.syncRequestCheckInterval = setInterval(checkForSyncRequest, 10000);
  }

  private stopSyncRequestMonitoring() {
    if (this.syncRequestCheckInterval) {
      clearInterval(this.syncRequestCheckInterval);
      this.syncRequestCheckInterval = null;
    }
  }

  private autoRetryInterval: NodeJS.Timeout | null = null;

  private startAutoRetry() {
    if (this.autoRetryInterval || this.isRetryActive) {
      return; // Already running
    }

    this.isRetryActive = true;
    console.log("Starting automatic retry for failed syncs...");

    // Retry immediately
    this.retryFailedSync();

    // Set up recurring retry every 2 minutes
    this.autoRetryInterval = setInterval(() => {
      this.retryFailedSync();
    }, 120000);
  }

  private stopAutoRetry() {
    if (this.autoRetryInterval) {
      clearInterval(this.autoRetryInterval);
      this.autoRetryInterval = null;
    }
    this.isRetryActive = false;
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
        this.hasPendingItems = false; // Update flag for adaptive polling
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

      // Clear sync request flag if it was set
      try {
        await apiClient.clearSyncRequest(terminalId);
      } catch (error) {
        // Non-critical error - log but don't fail the sync
        console.error("Failed to clear sync request flag:", error);
      }

      // Update flag for adaptive polling (all items synced successfully)
      this.hasPendingItems = false;

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

  // Retry sync for all failed and pending items (including previous days)
  async retryFailedSync(): Promise<boolean> {
    if (this.isSyncing) {
      console.log("Sync already in progress, skipping retry...");
      return false;
    }

    if (!apiClient.isOnline()) {
      console.log("Offline, cannot retry sync...");
      return false;
    }

    if (!apiClient.getAccessToken()) {
      console.log("Not authenticated, cannot retry sync...");
      return false;
    }

    this.isSyncing = true;

    try {
      const terminalId = await dbHelpers.getTerminalId();
      if (!terminalId) {
        throw new Error("Terminal ID not set");
      }

      // Get all failed and pending items (including from previous days)
      const { orders, payments } =
        await dbHelpers.getFailedAndPendingSyncItems();

      if (orders.length === 0 && payments.length === 0) {
        console.log("No failed or pending items to retry");
        // Stop auto-retry if it's running
        if (this.isRetryActive) {
          this.stopAutoRetry();
        }
        return true;
      }

      console.log(
        `Retrying sync for ${orders.length} orders and ${payments.length} payments (including previous failed attempts)...`,
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

      console.log("Retry sync completed successfully");

      // Check if all items are now synced
      const remainingCounts = await dbHelpers.getFailedItemsCount();
      if (remainingCounts.total === 0 && this.isRetryActive) {
        console.log("All items synced successfully, stopping automatic retry");
        this.stopAutoRetry();
      }

      return true;
    } catch (error) {
      console.error("Retry sync failed:", error);
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
      items: order.items.map((item: any) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discountAmount: item.discountAmount || 0,
      })),
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
      orderId: payment.orderId,
      orderPosLocalId: payment.orderId,
      terminalId: payment.terminalId,
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference || payment.paymentNumber,
      processedAt: payment.processedAt,
    };
  }
}

export const syncService = new SyncService();
