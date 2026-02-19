"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconTrendingUp,
  IconShoppingCart,
  IconCash,
  IconAlertTriangle,
  IconUsers,
  IconPackage,
  IconReceipt,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Page() {
  const [todayStats, setTodayStats] = useState({
    revenue: 0,
    orders: 0,
    averageOrderValue: 0,
  });
  const [allTimeStats, setAllTimeStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    activeProducts: 0,
    totalUsers: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Load all dashboard data in parallel
      const [
        productsData,
        usersData,
        orderStatsData,
        paymentsStatsData,
        ordersData,
      ] = await Promise.all([
        apiClient.getProducts(),
        apiClient.getUsers(),
        apiClient.getOrderStats(),
        apiClient.getPaymentStats(),
        apiClient.getOrders(),
      ]);

      // Calculate today's stats
      const todayOrders = ordersData.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today;
      });

      const todayRevenue = todayOrders.reduce(
        (sum: number, order: any) => sum + Number(order.totalAmount || 0),
        0,
      );

      const todayOrderCount = todayOrders.length;
      const averageOrderValue =
        todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

      setTodayStats({
        revenue: todayRevenue,
        orders: todayOrderCount,
        averageOrderValue,
      });

      // Calculate all-time stats
      const totalProducts = productsData.length;
      const activeProducts = productsData.filter(
        (p: any) => p.status === "ACTIVE",
      ).length;

      setAllTimeStats({
        totalRevenue: paymentsStatsData?.netRevenue || 0,
        totalOrders: orderStatsData?.totalOrders || 0,
        totalProducts,
        activeProducts,
        totalUsers: usersData.length,
      });

      // Find low stock products
      const lowStock = productsData.filter(
        (p: any) =>
          p.status === "ACTIVE" &&
          p.stockQuantity <= (p.lowStockThreshold || 10),
      );
      setLowStockProducts(lowStock.slice(0, 5));

      // Get recent orders
      setRecentOrders(ordersData.slice(0, 5));
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Today's Performance */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Today's Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Revenue
              </CardTitle>
              <IconCash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${todayStats.revenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {todayStats.orders} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Orders
              </CardTitle>
              <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.orders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                New orders today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Average Order Value
              </CardTitle>
              <IconReceipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${todayStats.averageOrderValue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Per order</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* All-Time Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <IconTrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${allTimeStats.totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Orders
              </CardTitle>
              <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTimeStats.totalOrders}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <IconPackage className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTimeStats.activeProducts}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {allTimeStats.totalProducts} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Team</CardTitle>
              <IconUsers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTimeStats.totalUsers}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active members
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Low Stock Alerts & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-orange-500" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Products running low on inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                All products are well stocked
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku}
                      </p>
                    </div>
                    <Badge
                      variant={
                        product.stockQuantity === 0
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {product.stockQuantity} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No orders yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        ${Number(order.totalAmount).toFixed(2)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
