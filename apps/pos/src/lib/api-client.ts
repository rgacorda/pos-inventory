import axios, { AxiosInstance } from "axios";
import { db, dbHelpers, type LocalProduct } from "./db";
import type {
  SyncRequestDto,
  SyncResponseDto,
  ProductCatalogPageDto,
  CreateOrderDto,
  CreatePaymentDto,
  LoginDto,
  AuthResponseDto,
  ExchangeOrderDto,
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
        if (error.response?.status === 401 && this.isCurrentSession(error)) {
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

  private isCurrentSession(error: { config?: { headers?: Record<string, unknown> } }) {
    const headers = error.config?.headers;
    const raw = headers?.Authorization ?? headers?.authorization;
    const failedToken = typeof raw === "string" ? raw : "";
    if (!failedToken || !this.accessToken) {
      return true;
    }
    return failedToken === `Bearer ${this.accessToken}`;
  }

  async checkSession() {
    await this.client.get("/auth/session");
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

  async getCatalog(params: {
    terminalId?: string;
    since?: string;
    cursor?: string;
    asOf?: string;
    count?: number;
    stockSum?: number;
    limit?: number;
  }): Promise<ProductCatalogPageDto> {
    const response = await this.client.get<ProductCatalogPageDto>(
      "/pos/sync/catalog",
      { params, timeout: 60000 },
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

  async voidOrder(orderId: string): Promise<any> {
    const response = await this.client.post(`/orders/${orderId}/void`);
    return response.data;
  }

  async exchangeOrder(serverId: string, data: ExchangeOrderDto): Promise<any> {
    const response = await this.client.post(`/orders/${serverId}/exchange`, data);
    return response.data;
  }

  async lookupOrderByNumber(orderNumber: string): Promise<any> {
    const response = await this.client.get("/orders/lookup", {
      params: { orderNumber },
    });
    return response.data;
  }

  async lookupCustomerByPhone(phone: string): Promise<any | null> {
    const response = await this.client.get(`/customers/lookup`, {
      params: { phone },
    });
    return response.data;
  }

  async getCustomerDirectory(params: {
    since?: string;
    count?: number;
  }): Promise<{
    customers: Array<{
      id: string;
      organizationId: string;
      name: string;
      phone: string;
      totalPoints: number;
      totalSpent: number;
    }>;
    complete: boolean;
    unchanged?: boolean;
    total: number;
    asOf: string;
  }> {
    const response = await this.client.get("/pos/sync/customers", {
      params,
      timeout: 30000,
    });
    return response.data;
  }

  async searchCustomersByName(q: string): Promise<any[]> {
    const response = await this.client.get(`/customers/search`, {
      params: { q },
    });
    return response.data ?? [];
  }

  async registerCustomer(data: { name: string; phone: string }): Promise<any> {
    const response = await this.client.post(`/customers`, data);
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
  private isCatalogSyncing = false;
  private catalogSyncQueued = false;
  private catalogSyncEnabled = false;
  private catalogVisibilityBound = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private catalogInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private isRetryActive = false;
  private syncRequestCheckInterval: NodeJS.Timeout | null = null;
  private lastSyncRequestCheck = 0;
  private hasPendingItems = false;

  // Product edits are checked on their own. The check is one small request
  // when nothing changed, so a few seconds is enough for prices and stock
  // to show up on the register without waiting for the sales upload.
  private readonly CATALOG_SYNC_MS = 5000;

  // Max orders/payments per sync request to avoid timeouts on large backlogs
  private readonly BATCH_SIZE = 25;

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async startAutoSync(intervalMs: number = 60000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Products start immediately and keep polling while sales upload.
    this.startCatalogSync();

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
    this.stopCatalogSync();
    this.stopRetryMonitoring();
    this.stopSyncRequestMonitoring();
  }

  private startCatalogSync() {
    this.catalogSyncEnabled = true;
    this.bindCatalogVisibility();
    void this.syncProductsNow();
    if (this.catalogInterval) {
      clearInterval(this.catalogInterval);
    }
    this.catalogInterval = setInterval(() => {
      void this.syncProductsNow();
    }, this.CATALOG_SYNC_MS);
  }

  private stopCatalogSync() {
    this.catalogSyncEnabled = false;
    if (this.catalogInterval) {
      clearInterval(this.catalogInterval);
      this.catalogInterval = null;
    }
  }

  private bindCatalogVisibility() {
    if (this.catalogVisibilityBound || typeof document === "undefined") return;
    this.catalogVisibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (this.catalogSyncEnabled && document.visibilityState === "visible") {
        void this.syncProductsNow();
      }
    });
  }

  /**
   * Pull product changes without waiting for the sales sync. Overlapping
   * checks are skipped so a slow page cannot stack on the next tick.
   */
  private async syncProductsNow() {
    if (!this.catalogSyncEnabled) return;
    if (this.isCatalogSyncing) {
      this.catalogSyncQueued = true;
      return;
    }
    if (!apiClient.isOnline() || !apiClient.getAccessToken()) return;

    this.isCatalogSyncing = true;
    try {
      const terminalId = await dbHelpers.getTerminalId();
      if (!terminalId) return;
      await this.syncProductCatalog(terminalId);
      await this.syncCustomerDirectory();
    } catch (error) {
      console.error("Product catalog sync failed:", error);
    } finally {
      this.isCatalogSyncing = false;
      if (this.catalogSyncQueued && this.catalogSyncEnabled) {
        this.catalogSyncQueued = false;
        void this.syncProductsNow();
      } else {
        this.catalogSyncQueued = false;
      }
    }
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

      const { orders, payments } = await dbHelpers.getPendingSyncItems();

      if (orders.length > 0) {
        console.log(`🔍 Sync check: ${orders.length} order(s) ready to sync`);
      }

      if (orders.length === 0 && payments.length === 0) {
        console.log("No orders to upload");
        this.hasPendingItems = false;
      } else {
        console.log(
          `Syncing ${orders.length} orders and ${payments.length} payments in batches of ${this.BATCH_SIZE}...`,
        );

        await this.syncBatchedItems(orders, payments, terminalId);

        // Clear sync request flag
        try {
          await apiClient.clearSyncRequest(terminalId);
        } catch (error) {
          console.error("Failed to clear sync request flag:", error);
        }

        this.hasPendingItems = false;
      }

      void this.syncProductsNow();
      console.log("Sync completed successfully");
      return true;
    } catch (error) {
      console.error("Sync failed:", error);
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

      const { orders, payments } =
        await dbHelpers.getFailedAndPendingSyncItems();

      if (orders.length === 0 && payments.length === 0) {
        console.log("No failed or pending items to retry");
        if (this.isRetryActive) {
          this.stopAutoRetry();
        }
        return true;
      }

      console.log(
        `Retrying sync for ${orders.length} orders and ${payments.length} payments in batches of ${this.BATCH_SIZE}...`,
      );

      await this.syncBatchedItems(orders, payments, terminalId);
      void this.syncProductsNow();

      console.log("Retry sync completed successfully");

      const remainingCounts = await dbHelpers.getFailedItemsCount();
      if (remainingCounts.total === 0 && this.isRetryActive) {
        console.log("All items synced successfully, stopping automatic retry");
        this.stopAutoRetry();
      }

      return true;
    } catch (error) {
      console.error("Retry sync failed:", error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Core batching engine — sends orders first (in BATCH_SIZE chunks), then payments.
   * Payments are sent after all orders so the server can always find the parent order.
   * Each batch marks only its own items as "syncing", so a failure in one batch
   * doesn't reset already-synced batches.
   */
  private async syncBatchedItems(
    allOrders: any[],
    allPayments: any[],
    terminalId: string,
  ): Promise<void> {
    const lastSyncAt = await dbHelpers.getLastSyncTime();
    let lastSyncedAt: Date | null = null;

    // Sales have to reach the server before an exchange of those sales.
    // Otherwise the exchange is saved with nothing to put back, and a later
    // retry sees it as a duplicate and never restores the returned units.
    const orderedOrders = [...allOrders].sort((a, b) => {
      const aExchange = a.exchangeRef ? 1 : 0;
      const bExchange = b.exchangeRef ? 1 : 0;
      if (aExchange !== bExchange) return aExchange - bExchange;
      const aTime = new Date(a.completedAt ?? a.localCreatedAt ?? 0).getTime();
      const bTime = new Date(b.completedAt ?? b.localCreatedAt ?? 0).getTime();
      return aTime - bTime;
    });
    const orderBatches = this.chunkArray(orderedOrders, this.BATCH_SIZE);
    const paymentBatches = this.chunkArray(allPayments, this.BATCH_SIZE);
    const totalBatches = orderBatches.length + paymentBatches.length;
    let batchNum = 0;

    // Phase 1: sync orders
    for (const batch of orderBatches) {
      batchNum++;
      console.log(
        `Syncing order batch ${batchNum}/${totalBatches} (${batch.length} orders)...`,
      );
      await this.markItemsAsSyncing(batch, []);
      try {
        const orders = await this.toOrderDtos(batch);
        if (orders.length === 0) continue;
        const req: SyncRequestDto = {
          terminalId,
          lastSyncAt: lastSyncAt || undefined,
          orders,
          payments: [],
        };
        const response = await apiClient.sync(req);
        await this.processSyncResults(response);
        lastSyncedAt = new Date(response.syncedAt);
      } catch (error) {
        // Keep going so one bad batch does not block the rest of the retry.
        await this.markItemsAsError(error);
        console.error("Order batch failed:", error);
      }
    }

    // Phase 2: sync payments (all orders are now on the server)
    for (const batch of paymentBatches) {
      batchNum++;
      console.log(
        `Syncing payment batch ${batchNum}/${totalBatches} (${batch.length} payments)...`,
      );
      await this.markItemsAsSyncing([], batch);
      try {
        const payments = batch.map(this.convertLocalPaymentToDto);
        const req: SyncRequestDto = {
          terminalId,
          lastSyncAt: lastSyncAt || undefined,
          orders: [],
          payments,
        };
        const response = await apiClient.sync(req);
        await this.processSyncResults(response);
        lastSyncedAt = new Date(response.syncedAt);
      } catch (error) {
        await this.markItemsAsError(error);
        console.error("Payment batch failed:", error);
      }
    }

    if (lastSyncedAt) {
      await dbHelpers.updateLastSyncTime(lastSyncedAt);
    }
  }

  /**
   * Copies this store's loyalty customers onto the register. A customer
   * saved on one terminal is then found by name on the others, including
   * when the live name search request fails.
   */
  private async syncCustomerDirectory() {
    try {
      const since = await dbHelpers.getCustomersAsOf();
      const count = await db.customers.count();
      const page = await apiClient.getCustomerDirectory({
        since: since || undefined,
        count,
      });

      if (!page.complete && !page.unchanged && (page.customers ?? []).length === 0) {
        return;
      }

      if (page.unchanged) {
        if (page.asOf) await dbHelpers.setCustomersAsOf(page.asOf);
        return;
      }

      const now = new Date();
      const customers = (page.customers ?? [])
        .filter((customer) => customer?.id)
        .map((customer) => ({
          id: customer.id,
          organizationId: customer.organizationId,
          name: customer.name,
          phone: customer.phone,
          totalPoints: Number(customer.totalPoints) || 0,
          totalSpent: Number(customer.totalSpent) || 0,
          cachedAt: now,
        }));

      if (page.complete) {
        await db.transaction("rw", db.customers, async () => {
          if (customers.length > 0) await db.customers.bulkPut(customers);
          const seen = new Set(customers.map((customer) => customer.id));
          const localIds = await db.customers.toCollection().primaryKeys();
          const stale = localIds.filter((id) => !seen.has(String(id)));
          if (stale.length > 0) {
            await db.customers.bulkDelete(stale as string[]);
          }
        });
        console.log(`Loyalty customers synced (${customers.length})`);
      } else if (customers.length > 0) {
        await db.customers.bulkPut(customers);
        console.log(`Loyalty customers updated (${customers.length})`);
      }

      if (page.asOf) await dbHelpers.setCustomersAsOf(page.asOf);
    } catch (error) {
      console.error("Failed to sync loyalty customers:", error);
    }
  }

  private async syncProductCatalog(terminalId: string) {
    try {
      await this.syncCatalogPages(terminalId);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        await this.syncProductCatalogLegacy(terminalId);
        return;
      }
      console.error("Failed to sync product catalog:", error);
    }
  }

  private async syncProductCatalogLegacy(terminalId: string) {
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
  }

  /**
   * Downloads the same non-archived products inventory shows.
   * Unchanged catalogs return in one small request. Edits come back as a
   * delta. A count or stock mismatch downloads every page and then removes
   * local products the server no longer has. The local catalog is not cleared
   * first, so a failed page leaves the previous products in place.
   */
  private async syncCatalogPages(terminalId: string) {
    const limit = 500;
    const snapshot = await this.catalogSnapshot();
    let since = (await dbHelpers.getCatalogAsOf()) || undefined;
    let full = !since;
    let cursor: string | undefined;
    let asOf: string | undefined;
    let checkedDelta = false;
    const seen = new Set<string>();

    for (let guard = 0; guard < 10000; guard++) {
      const page = await apiClient.getCatalog({
        terminalId,
        limit,
        cursor,
        asOf,
        since: full ? undefined : since,
        count: cursor ? undefined : snapshot.count,
        stockSum: cursor ? undefined : snapshot.stockSum,
      });

      if (page.unchanged) {
        if (page.asOf) await dbHelpers.setCatalogAsOf(page.asOf);
        return;
      }

      if (page.resync && !full) {
        full = true;
        seen.clear();
      }

      asOf = page.asOf || asOf;
      const products = Array.isArray(page.products)
        ? page.products.filter((product) => product?.id)
        : [];

      if (products.length > 0) {
        const now = new Date();
        await db.products.bulkPut(
          products.map(
            (product) =>
              ({
                ...product,
                lastSyncedAt: now,
              }) as LocalProduct,
          ),
        );
      }

      if (full) {
        for (const product of products) seen.add(String(product.id));
      } else if (page.removedIds?.length) {
        await db.products.bulkDelete(page.removedIds);
      }

      const next = page.nextCursor || undefined;
      if (next && next !== cursor) {
        cursor = next;
        continue;
      }

      if (full) {
        if ((page.total ?? 0) > 0 && seen.size === 0) {
          console.error(
            "Catalog sync returned no products; keeping the current catalog",
          );
          return;
        }
        const localIds = await db.products.toCollection().primaryKeys();
        const stale = localIds.filter((id) => !seen.has(String(id)));
        if (stale.length > 0) {
          await db.products.bulkDelete(stale as string[]);
        }
      } else if (!checkedDelta) {
        checkedDelta = true;
        const after = await this.catalogSnapshot();
        if (after.count !== page.total || after.stockSum !== page.stockSum) {
          full = true;
          cursor = undefined;
          asOf = undefined;
          since = undefined;
          seen.clear();
          continue;
        }
      }

      if (page.asOf) await dbHelpers.setCatalogAsOf(page.asOf);
      console.log(
        full
          ? `Catalog synced (${seen.size} products)`
          : "Catalog updated",
      );
      return;
    }

    console.error("Catalog sync stopped after too many pages");
  }

  private async catalogSnapshot(): Promise<{ count: number; stockSum: number }> {
    const products = await db.products.toArray();
    let stockSum = 0;
    for (const product of products) {
      if (product.infiniteStock) continue;
      stockSum += Math.round(Number(product.stockQuantity) || 0);
    }
    return { count: products.length, stockSum };
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
    // Batch-fetch orders then update in parallel (one Dexie query instead of N)
    if (response.results.orders.length > 0) {
      const orderIds = response.results.orders.map((r) => r.posLocalId);
      const localOrders = await db.orders
        .where("posLocalId")
        .anyOf(orderIds)
        .toArray();
      const orderMap = new Map(localOrders.map((o) => [o.posLocalId, o]));

      await Promise.all(
        response.results.orders.map((result) => {
          const localOrder = orderMap.get(result.posLocalId);
          if (!localOrder?.id) return;
          return db.orders.update(
            localOrder.id,
            this.localSyncUpdate(result),
          );
        }),
      );
    }

    // Batch-fetch payments then update in parallel
    if (response.results.payments.length > 0) {
      const paymentIds = response.results.payments.map((r) => r.posLocalId);
      const localPayments = await db.payments
        .where("posLocalId")
        .anyOf(paymentIds)
        .toArray();
      const paymentMap = new Map(
        localPayments.map((p) => [p.posLocalId, p]),
      );

      await Promise.all(
        response.results.payments.map((result) => {
          const localPayment = paymentMap.get(result.posLocalId);
          if (!localPayment?.id) return;
          return db.payments.update(
            localPayment.id,
            this.localSyncUpdate(result),
          );
        }),
      );
    }
  }

  private localSyncUpdate(result: {
    status: string;
    serverId?: string;
    message?: string;
  }): {
    serverId?: string;
    syncStatus: "synced" | "pending" | "error";
    syncError?: string;
  } {
    if (result.status === "SUCCESS" || result.status === "DUPLICATE") {
      return {
        serverId: result.serverId,
        syncStatus: "synced",
        syncError: undefined,
      };
    }
    if (result.message?.startsWith("WAITING:")) {
      return {
        syncStatus: "pending",
        syncError: result.message.slice("WAITING:".length).trim(),
      };
    }
    return {
      syncStatus: "error",
      syncError: result.message || "Sync failed",
    };
  }

  private async updateProductCatalog(catalog: any) {
    const products = catalog.products.map((p: any) => ({
      ...p,
      lastSyncedAt: new Date(),
    }));

    await db.transaction("rw", db.products, async () => {
      await db.products.clear();
      await db.products.bulkPut(products);
    });

    console.log(`Updated ${products.length} products in catalog`);
  }

  private async toOrderDtos(orders: any[]): Promise<CreateOrderDto[]> {
    const dtos: CreateOrderDto[] = [];
    for (const order of orders) {
      try {
        dtos.push(this.convertLocalOrderToDto(order));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        console.error(`Skipping unsyncable order ${order?.orderNumber}:`, error);
        if (order?.id) {
          await db.orders.update(order.id, {
            syncStatus: "error",
            syncError: message,
          });
        }
      }
    }
    return dtos;
  }

  private money(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100) / 100;
  }

  private convertLocalOrderToDto(order: any): CreateOrderDto {
    const items = Array.isArray(order.items) ? order.items : [];
    return {
      posLocalId: order.posLocalId,
      terminalId: order.terminalId,
      cashierId: order.cashierId,
      cashierName: order.cashierName,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      customerId: order.customerId,
      pointsRedeemed: Number.isFinite(Number(order.pointsRedeemed))
        ? Math.max(0, Math.floor(Number(order.pointsRedeemed)))
        : undefined,
      items: items.map((item: any) => ({
        productId: item?.productId != null ? String(item.productId) : "",
        sku: item?.sku || "UNKNOWN",
        name: item?.name || "Item",
        quantity: Math.max(0, Math.round(Number(item?.quantity) || 0)),
        unitPrice: this.money(item?.unitPrice),
        ...(Number.isFinite(Number(item?.unitCost)) && Number(item.unitCost) >= 0
          ? { unitCost: this.money(item.unitCost) }
          : {}),
        taxRate: Number.isFinite(Number(item?.taxRate)) ? Number(item.taxRate) : 0,
        discountAmount: this.money(item?.discountAmount),
      })),
      subtotal: this.money(order.subtotal),
      taxAmount: this.money(order.taxAmount),
      discountAmount: this.money(order.discountAmount),
      totalAmount: this.money(order.totalAmount),
      completedAt: order.completedAt,
      exchangeRef: order.exchangeRef,
      originalPosLocalId: order.originalPosLocalId,
      returnedItems: order.returnedItems,
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
