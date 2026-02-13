"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import {
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
} from "lucide-react";
import { toast } from "sonner";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalProducts: 0,
  });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [orders, products] = await Promise.all([
        apiClient.getOrders(),
        apiClient.getProducts(),
      ]);

      // Filter orders by date range
      const filteredOrders = orders.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        return orderDate >= start && orderDate <= end;
      });

      // Calculate stats
      const totalRevenue = filteredOrders.reduce(
        (sum: number, order: any) => sum + (order.totalAmount || 0),
        0,
      );
      const totalOrders = filteredOrders.length;
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setStats({
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalProducts: products.length,
      });

      // Calculate top products
      const productSales: { [key: string]: any } = {};
      filteredOrders.forEach((order: any) => {
        order.items?.forEach((item: any) => {
          const productId = item.productId;
          if (!productSales[productId]) {
            productSales[productId] = {
              product: item.product,
              totalQuantity: 0,
              totalRevenue: 0,
            };
          }
          productSales[productId].totalQuantity += item.quantity;
          productSales[productId].totalRevenue +=
            item.quantity * item.unitPrice;
        });
      });

      const topProductsArray = Object.values(productSales)
        .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      setTopProducts(topProductsArray);
      setRecentOrders(filteredOrders.slice(0, 10));
    } catch (error) {
      console.error("Failed to load report data:", error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    try {
      const headers = ["Date", "Order ID", "Items", "Total", "Status"];
      const rows = recentOrders.map((order) => [
        new Date(order.createdAt).toLocaleDateString(),
        order.id,
        order.items?.length || 0,
        order.totalAmount?.toFixed(2) || "0.00",
        order.status,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${dateRange.start}-to-${dateRange.end}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Report exported successfully");
    } catch (error) {
      console.error("Failed to export report:", error);
      toast.error("Failed to export report");
    }
  };

  return (
    <div className="px-4 lg:px-6">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sales Reports</CardTitle>
              <CardDescription>
                Analytics and insights for your business
              </CardDescription>
            </div>
            <Button
              onClick={exportToCSV}
              disabled={loading || recentOrders.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
            />
            <span>to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
            />
            <Button onClick={loadReportData} disabled={loading}>
              Apply
            </Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading reports...</div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stats.totalRevenue.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  For selected period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Orders
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Completed transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Order Value
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stats.averageOrderValue.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Per transaction</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                <p className="text-xs text-muted-foreground">In catalog</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No sales data for selected period
                </p>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Badge>{index + 1}</Badge>
                        <div>
                          <p className="font-medium">
                            {item.product?.name || "Unknown Product"}
                          </p>
                          {item.product?.sku && (
                            <p className="text-xs text-muted-foreground">
                              SKU: {item.product.sku}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ${item.totalRevenue.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.totalQuantity} units sold
                        </p>
                      </div>
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
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No orders for selected period
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          #{order.id}
                        </TableCell>
                        <TableCell>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{order.items?.length || 0}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${order.totalAmount?.toFixed(2) || "0.00"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === "COMPLETED"
                                ? "default"
                                : order.status === "PENDING"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
