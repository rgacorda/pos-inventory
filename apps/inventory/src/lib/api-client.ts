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
      localStorage.removeItem("organizationId");
      localStorage.removeItem("organizationName");
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
}

export const apiClient = new APIClient();
