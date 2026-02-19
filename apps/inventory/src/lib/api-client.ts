import axios, { AxiosInstance } from "axios";
import type { AuthResponseDto, LoginDto } from "@pos/shared-types";

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

  // Products API
  async getProducts() {
    const response = await this.client.get("/products");
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
  async getOrders(filters?: any) {
    const response = await this.client.get("/orders", { params: filters });
    return response.data;
  }

  async getOrderStats() {
    const response = await this.client.get("/orders/stats");
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

  async getInventoryDeliveryStats(filters?: any) {
    const response = await this.client.get("/inventory-deliveries/stats", {
      params: filters,
    });
    return response.data;
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
}

export const apiClient = new APIClient();
