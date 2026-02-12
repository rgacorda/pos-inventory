"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { Package, Users, ShoppingCart, DollarSign } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [products, users, orderStats, paymentStats] = await Promise.all([
        apiClient.getProducts(),
        apiClient.getUsers(),
        apiClient.getOrderStats(),
        apiClient.getPaymentStats(),
      ]);

      setStats({
        totalProducts: products.length,
        activeProducts: products.filter((p: any) => p.status === "ACTIVE")
          .length,
        totalUsers: users.length,
        totalOrders: orderStats.totalOrders,
        completedOrders: orderStats.completedOrders,
        totalRevenue: orderStats.totalRevenue,
        totalPayments: paymentStats.totalPayments,
        netRevenue: paymentStats.netRevenue,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Overview of your organization
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading statistics...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Products
                </CardTitle>
                <Package className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.totalProducts || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.activeProducts || 0} active
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.totalUsers || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Organization members
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Orders
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalOrders || 0}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {stats?.completedOrders || 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${((stats?.netRevenue || 0) / 1).toFixed(2)}
                </div>
                <p className="text-xs text-gray-600 mt-1">Net revenue</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-8">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a
                  href="/products"
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <Package className="h-8 w-8 text-gray-700 mb-2" />
                  <h3 className="font-semibold text-gray-900">
                    Manage Products
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Add, edit, or remove products
                  </p>
                </a>

                <a
                  href="/users"
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <Users className="h-8 w-8 text-gray-700 mb-2" />
                  <h3 className="font-semibold text-gray-900">Manage Users</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Add or manage team members
                  </p>
                </a>

                <a
                  href="/reports"
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <DollarSign className="h-8 w-8 text-gray-700 mb-2" />
                  <h3 className="font-semibold text-gray-900">View Reports</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Sales and inventory reports
                  </p>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
