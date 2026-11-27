import axios, { AxiosInstance } from "axios";
import type { AuthResponseDto, LoginDto } from "@pos/shared-types";

const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

type SessionUser = {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  organizationId?: string | null;
  organizationName?: string;
  mustChangePassword?: boolean;
};

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
        this.syncTokenFromStorage();
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          (config as { sessionToken?: string }).sessionToken = this.accessToken;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (this.shouldEndSession(error)) {
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

    this.syncTokenFromStorage();
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    this.writeStoredToken(token);
  }

  getAccessToken() {
    this.syncTokenFromStorage();
    return this.accessToken;
  }

  /** Rewrite the middleware cookie from the current token. */
  persistAuthCookie() {
    if (this.accessToken) {
      this.writeAuthCookie(this.accessToken);
    }
  }

  private readCookie(name: string) {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${name}=([^;]*)`),
    );
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  private writeAuthCookie(token: string | null) {
    if (typeof document === "undefined") return;
    if (!token) {
      document.cookie =
        "accessToken=; path=/; max-age=0; SameSite=Lax";
      return;
    }
    const secure =
      window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  }

  private writeStoredToken(token: string | null) {
    if (typeof window === "undefined") return;
    try {
      if (token) localStorage.setItem("accessToken", token);
      else localStorage.removeItem("accessToken");
    } catch {
      // The cookie still lets middleware recognize the session.
    }
    this.writeAuthCookie(token);
  }

  /**
   * Keep memory, localStorage, and the cookie on the same token.
   * Browsers drop one of those stores during a work day; either remaining
   * copy is enough to stay signed in.
   */
  private syncTokenFromStorage() {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("accessToken");
    } catch {
      stored = null;
    }
    if (!stored) stored = this.readCookie("accessToken");
    if (!stored) return;
    const cookie = this.readCookie("accessToken");
    if (stored !== this.accessToken || cookie !== stored) {
      this.accessToken = stored;
      this.writeStoredToken(stored);
    }
  }

  private requestPath(error: { config?: { url?: string } }) {
    return String(error.config?.url || "").split("?")[0];
  }

  private isCredentialChallenge(error: {
    response?: { data?: { message?: unknown } };
  }) {
    const message = error.response?.data?.message;
    const text = (
      Array.isArray(message) ? message.join(" ") : String(message || "")
    ).toLowerCase();
    return text.includes("password") || text.includes("reset token");
  }

  /**
   * End the session only when this browser's current token was rejected.
   * A wrong confirmation password is also a 401, and so is a response that
   * belongs to a token we already replaced.
   */
  private shouldEndSession(error: {
    response?: { status?: number; data?: { message?: unknown } };
    config?: { url?: string; sessionToken?: string };
  }) {
    if (error.response?.status !== 401) return false;
    const path = this.requestPath(error);
    if (
      path.endsWith("/auth/login") ||
      path.endsWith("/auth/request-password-reset") ||
      path.endsWith("/auth/reset-password")
    ) {
      return false;
    }
    if (this.isCredentialChallenge(error)) return false;
    const sent = error.config?.sessionToken;
    if (typeof sent !== "string" || !sent || !this.accessToken) return false;
    return sent === this.accessToken;
  }

  private rememberUser(user: SessionUser | undefined) {
    if (!user || typeof window === "undefined") return;
    try {
      localStorage.setItem("user", JSON.stringify(user));
      if (user.organizationId) {
        localStorage.setItem("organizationId", user.organizationId);
      }
      if (user.organizationName) {
        localStorage.setItem("organizationName", user.organizationName);
      }
    } catch {
      // Profile cache is optional. The token is what keeps them signed in.
    }
  }

  async checkSession() {
    const response = await this.client.get<{
      active: boolean;
      accessToken?: string;
      user?: SessionUser;
    }>("/auth/session");
    if (response.data.accessToken) {
      this.setAccessToken(response.data.accessToken);
    } else {
      this.persistAuthCookie();
    }
    this.rememberUser(response.data.user);
    return response.data;
  }

  async logoutAllUsers() {
    const response = await this.client.post<{
      message: string;
      accessToken: string;
    }>("/auth/logout-all");
    this.setAccessToken(response.data.accessToken);
    return response.data;
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
    this.accessToken = null;
    this.writeStoredToken(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("user");
        localStorage.removeItem("organizationId");
        localStorage.removeItem("organizationName");
      } catch {
        // Cookie clear below is what the middleware checks.
      }
    }
  }

  // Password management
  async changePassword(data: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    const response = await this.client.post("/auth/change-password", data);
    return response.data;
  }

  // Products API
  async getProducts(filters?: { supplierId?: string; archived?: boolean }) {
    const response = await this.client.get("/products", { params: filters });
    return response.data;
  }

  async getProduct(id: string) {
    const response = await this.client.get(`/products/${id}`);
    return response.data;
  }

  async createProduct(data: any) {
    const response = await this.client.post("/products", data);
    return response.data;
  }

  async updateProduct(id: string, data: any) {
    const response = await this.client.put(`/products/${id}`, data);
    return response.data;
  }

  async deleteProduct(id: string) {
    await this.client.delete(`/products/${id}`);
  }

  async restoreProduct(id: string) {
    const response = await this.client.post(`/products/${id}/restore`);
    return response.data;
  }

  async permanentlyDeleteProduct(id: string) {
    await this.client.delete(`/products/${id}/permanent`);
  }

  async dismissProductEdits(id: string) {
    const response = await this.client.post(`/products/${id}/dismiss-edits`);
    return response.data;
  }

  // Users API
  async getUsers() {
    const response = await this.client.get("/users");
    return response.data;
  }

  async getUser(id: string) {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async createUser(data: any) {
    const response = await this.client.post("/users", data);
    return response.data;
  }

  async updateUser(id: string, data: any) {
    const response = await this.client.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string) {
    await this.client.delete(`/users/${id}`);
  }

  // Orders API
  async getOrders(filters?: {
    status?: string;
    terminalId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: "asc" | "desc";
  }) {
    const response = await this.client.get("/orders", { params: filters });
    return response.data;
  }

  async getOrder(id: string) {
    const response = await this.client.get(`/orders/${id}`);
    return response.data;
  }

  async getOrderStats() {
    const response = await this.client.get("/orders/stats");
    return response.data;
  }

  async getDashboardStats() {
    const response = await this.client.get("/orders/dashboard-stats");
    return response.data;
  }

  async getReportAnalytics(startDate: string, endDate: string) {
    const response = await this.client.get("/orders/report-analytics", {
      params: { startDate, endDate },
    });
    return response.data;
  }

  async getManualItems() {
    const response = await this.client.get("/orders/manual-items");
    return response.data;
  }

  async voidOrder(orderId: string) {
    const response = await this.client.post(`/orders/${orderId}/void`);
    return response.data;
  }

  // Payments API
  async getPayments(filters?: any) {
    const response = await this.client.get("/payments", { params: filters });
    return response.data;
  }

  async getPaymentStats() {
    const response = await this.client.get("/payments/stats");
    return response.data;
  }

  async getPaymentMethodStats(startDate: string, endDate: string) {
    const response = await this.client.get("/payments/method-stats", {
      params: { startDate, endDate },
    });
    return response.data;
  }

  // Terminals API
  async getTerminals() {
    const response = await this.client.get("/terminals");
    return response.data;
  }

  async getTerminal(id: string) {
    const response = await this.client.get(`/terminals/${id}`);
    return response.data;
  }

  async createTerminal(data: any) {
    const response = await this.client.post("/terminals", data);
    return response.data;
  }

  async updateTerminal(id: string, data: any) {
    const response = await this.client.put(`/terminals/${id}`, data);
    return response.data;
  }

  async deleteTerminal(id: string) {
    await this.client.delete(`/terminals/${id}`);
  }

  async syncTerminal(id: string) {
    const response = await this.client.post(`/terminals/${id}/sync`);
    return response.data;
  }

  // Organization API (for ADMIN to manage their own org)
  async getMyOrganization() {
    // Get organization ID from localStorage
    const organizationId =
      typeof window !== "undefined"
        ? localStorage.getItem("organizationId")
        : null;
    if (!organizationId) {
      throw new Error("Organization ID not found");
    }
    const response = await this.client.get(`/organizations/${organizationId}`);
    return response.data;
  }

  async updateMyOrganization(data: any) {
    const organizationId =
      typeof window !== "undefined"
        ? localStorage.getItem("organizationId")
        : null;
    if (!organizationId) {
      throw new Error("Organization ID not found");
    }
    const response = await this.client.put(
      `/organizations/${organizationId}`,
      data,
    );
    return response.data;
  }

  // Inventory Deliveries API
  async getInventoryDeliveries(filters?: any) {
    const response = await this.client.get("/inventory-deliveries", {
      params: filters,
    });
    return response.data;
  }

  async getInventoryDelivery(id: string) {
    const response = await this.client.get(`/inventory-deliveries/${id}`);
    return response.data;
  }

  async createInventoryDelivery(data: any) {
    const response = await this.client.post("/inventory-deliveries", data);
    return response.data;
  }

  async updateInventoryDelivery(id: string, data: any) {
    const response = await this.client.put(`/inventory-deliveries/${id}`, data);
    return response.data;
  }

  async deleteInventoryDelivery(id: string) {
    await this.client.delete(`/inventory-deliveries/${id}`);
  }

  async restoreInventoryDelivery(id: string) {
    const response = await this.client.post(`/inventory-deliveries/${id}/restore`);
    return response.data;
  }

  async permanentlyDeleteInventoryDelivery(id: string) {
    await this.client.delete(`/inventory-deliveries/${id}/permanent`);
  }

  async dismissDeliveryEdits(id: string) {
    const response = await this.client.post(
      `/inventory-deliveries/${id}/dismiss-edits`,
    );
    return response.data;
  }

  async getInventoryDeliveryStats(filters?: any) {
    const response = await this.client.get("/inventory-deliveries/stats", {
      params: filters,
    });
    return response.data;
  }

  // Inventory Returns API
  async getInventoryReturns(filters?: any) {
    const response = await this.client.get("/inventory-returns", {
      params: filters,
    });
    return response.data;
  }

  async getInventoryReturn(id: string) {
    const response = await this.client.get(`/inventory-returns/${id}`);
    return response.data;
  }

  async getInventoryReturnStats(filters?: any) {
    const response = await this.client.get("/inventory-returns/stats", {
      params: filters,
    });
    return response.data;
  }

  async createInventoryReturn(data: any) {
    const response = await this.client.post("/inventory-returns", data);
    return response.data;
  }

  async updateInventoryReturn(id: string, data: any) {
    const response = await this.client.put(`/inventory-returns/${id}`, data);
    return response.data;
  }

  async resolveInventoryReturn(id: string, data: any) {
    const response = await this.client.put(
      `/inventory-returns/${id}/resolve`,
      data,
    );
    return response.data;
  }

  async unresolveInventoryReturn(id: string) {
    const response = await this.client.put(
      `/inventory-returns/${id}/unresolve`,
    );
    return response.data;
  }

  async deleteInventoryReturn(id: string) {
    await this.client.delete(`/inventory-returns/${id}`);
  }

  async restoreInventoryReturn(id: string) {
    const response = await this.client.post(`/inventory-returns/${id}/restore`);
    return response.data;
  }

  async permanentlyDeleteInventoryReturn(id: string) {
    await this.client.delete(`/inventory-returns/${id}/permanent`);
  }

  // Expenses API
  async getExpenses(filters?: any) {
    const response = await this.client.get("/expenses", { params: filters });
    return response.data;
  }

  async getExpense(id: string) {
    const response = await this.client.get(`/expenses/${id}`);
    return response.data;
  }

  async createExpense(data: any) {
    const response = await this.client.post("/expenses", data);
    return response.data;
  }

  async updateExpense(id: string, data: any) {
    const response = await this.client.put(`/expenses/${id}`, data);
    return response.data;
  }

  async deleteExpense(id: string) {
    await this.client.delete(`/expenses/${id}`);
  }

  async getExpenseStats(filters?: any) {
    const response = await this.client.get("/expenses/stats", {
      params: filters,
    });
    return response.data;
  }

  // Suppliers API
  async getSuppliers() {
    const response = await this.client.get("/suppliers");
    return response.data;
  }

  async getSupplier(id: string) {
    const response = await this.client.get(`/suppliers/${id}`);
    return response.data;
  }

  async createSupplier(data: any) {
    const response = await this.client.post("/suppliers", data);
    return response.data;
  }

  async updateSupplier(id: string, data: any) {
    const response = await this.client.put(`/suppliers/${id}`, data);
    return response.data;
  }

  async deleteSupplier(id: string) {
    await this.client.delete(`/suppliers/${id}`);
  }

  async recordSupplierIncentive(
    id: string,
    data: { amount: number; incentiveDate: string; notes?: string },
  ) {
    const response = await this.client.post(`/suppliers/${id}/incentives`, data);
    return response.data;
  }

  async getSupplierIncentives(id: string) {
    const response = await this.client.get(`/suppliers/${id}/incentives`);
    return response.data;
  }

  async getSupplierPurchaseAverages(id: string) {
    const response = await this.client.get(
      `/suppliers/${id}/purchase-averages`,
    );
    return response.data;
  }

  // Financials API
  async getProfitLoss(startDate: string, endDate: string) {
    const response = await this.client.get("/financials/profit-loss", {
      params: { startDate, endDate },
    });
    return response.data;
  }

  async getFinancialSummary() {
    const response = await this.client.get("/financials/summary");
    return response.data;
  }

  // Customers API
  async getCustomers() {
    const response = await this.client.get("/customers");
    return response.data;
  }

  async getCustomer(id: string) {
    const response = await this.client.get(`/customers/${id}`);
    return response.data;
  }

  async getCustomerTransactions(id: string) {
    const response = await this.client.get(`/customers/${id}/transactions`);
    return response.data;
  }

  async createCustomer(data: { name: string; phone: string }) {
    const response = await this.client.post("/customers", data);
    return response.data;
  }

  async updateCustomer(id: string, data: { name?: string; phone?: string }) {
    const response = await this.client.put(`/customers/${id}`, data);
    return response.data;
  }

  async getLoyaltySettings() {
    const response = await this.client.get('/customers/loyalty-settings');
    return response.data;
  }

  async updateLoyaltySettings(loyaltyExpiryDays: number | null) {
    const response = await this.client.put('/customers/loyalty-settings', {
      loyaltyExpiryDays,
    });
    return response.data;
  }

  async runPointsExpiryNow() {
    const response = await this.client.post('/customers/loyalty-settings/expire-now');
    return response.data;
  }

  async resetAllPoints(password: string, reason?: string) {
    const response = await this.client.post('/customers/reset-all-points', {
      password,
      reason,
    });
    return response.data;
  }

  // Variance inventory
  async getVarianceWindow() {
    const response = await this.client.get("/inventory-variances/window");
    return response.data;
  }

  async updateVarianceWindow(data: {
    startDate: string | null;
    endDate: string | null;
  }) {
    const response = await this.client.put("/inventory-variances/window", data);
    return response.data;
  }

  async getVarianceWorksheet() {
    const response = await this.client.get("/inventory-variances");
    return response.data;
  }

  async getVarianceStock(productId: string) {
    const response = await this.client.get(
      `/inventory-variances/stock/${productId}`,
    );
    return response.data as { productId: string; stockQuantity: number };
  }

  async saveVarianceCounts(data: {
    items: {
      productId: string;
      countedQuantity: number;
      systemQuantity?: number;
    }[];
  }) {
    const response = await this.client.post("/inventory-variances", data);
    return response.data;
  }

  async checkVarianceCounts(data: { productIds?: string[] } = {}) {
    const response = await this.client.post("/inventory-variances/check", data);
    return response.data;
  }

  async applyVarianceCounts(
    data: { productIds?: string[]; skipProductIds?: string[] } = {},
  ) {
    const response = await this.client.post("/inventory-variances/apply", data);
    return response.data;
  }

  async clearVarianceCount(id: string) {
    await this.client.delete(`/inventory-variances/${id}`);
  }

  // Upload API
  async uploadReceipt(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this.client.post("/upload/receipt", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  receiptFilename(receiptUrl?: string | null) {
    if (!receiptUrl) return null;
    const name = receiptUrl.split("?")[0].split("/").pop() || "";
    return /^receipt-\d+-\d+\.(jpg|jpeg|png|gif|webp|pdf)$/i.test(name)
      ? name
      : null;
  }

  async fetchReceipt(receiptUrl: string) {
    const filename = this.receiptFilename(receiptUrl);
    if (!filename) {
      throw new Error("Receipt not found");
    }
    const response = await this.client.get(`/upload/receipts/${filename}`, {
      responseType: "blob",
    });
    return response.data as Blob;
  }

  async openReceipt(receiptUrl: string) {
    const blob = await this.fetchReceipt(receiptUrl);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async receiptPreviewUrl(receiptUrl?: string | null) {
    const filename = this.receiptFilename(receiptUrl);
    if (!filename || filename.toLowerCase().endsWith(".pdf")) return null;
    const blob = await this.fetchReceipt(receiptUrl as string);
    return URL.createObjectURL(blob);
  }
}

export const apiClient = new APIClient();
