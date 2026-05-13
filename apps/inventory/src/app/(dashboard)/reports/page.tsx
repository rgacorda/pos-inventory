"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart,
  Legend,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import {
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Monitor,
  CreditCard,
  Clock,
  FileText,
} from "lucide-react";
import {
  showSuccessToast,
  showErrorFromException,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import { format, parseISO, startOfDay, eachDayOfInterval } from "date-fns";

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() - 30)),
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalProducts: 0,
    totalProfit: 0,
  });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [cashierPerformance, setCashierPerformance] = useState<any[]>([]);
  const [terminalPerformance, setTerminalPerformance] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [hourlySales, setHourlySales] = useState<any[]>([]);

  // Products tab UI state
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const PRODUCTS_PER_PAGE = 25;
  const [chartTopN, setChartTopN] = useState(20);

  // Redirect MANAGER users
  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      if (user) {
        const userData = JSON.parse(user);
        if (userData.role === "MANAGER") {
          router.push("/products");
          return;
        }
      }
    }
  }, [router]);

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [orders, products, payments] = await Promise.all([
        apiClient.getOrders(),
        apiClient.getProducts(),
        apiClient.getPayments(),
      ]);

      // Filter orders by date range (excluding voided orders)
      const filteredOrders = orders.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= endDate && order.status !== "VOID";
      });

      // Calculate stats
      const totalRevenue = filteredOrders.reduce(
        (sum: number, order: any) => sum + Number(order.totalAmount || 0),
        0,
      );
      const totalProfit = filteredOrders.reduce(
        (sum: number, order: any) =>
          sum + Number(order.totalAmount || 0) - Number(order.taxAmount || 0),
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
        totalProfit,
      });

      // Build a product lookup map for name resolution
      const productMap: { [key: string]: any } = {};
      products.forEach((p: any) => {
        productMap[p.id] = p;
      });

      // Calculate top products
      const productSales: { [key: string]: any } = {};
      filteredOrders.forEach((order: any) => {
        order.items?.forEach((item: any) => {
          const productId = item.productId;
          if (!productSales[productId]) {
            // Prefer the embedded product object, fall back to the products list
            const resolvedProduct =
              (item.product?.name ? item.product : null) ??
              productMap[productId] ??
              item.product;
            productSales[productId] = {
              product: resolvedProduct,
              totalQuantity: 0,
              totalRevenue: 0,
            };
          }
          productSales[productId].totalQuantity += item.quantity;
          productSales[productId].totalRevenue +=
            item.quantity * item.unitPrice;
        });
      });

      const topProductsArray = Object.values(productSales).sort(
        (a: any, b: any) => b.totalRevenue - a.totalRevenue,
      );

      setTopProducts(topProductsArray);
      setRecentOrders(filteredOrders.slice(0, 10));

      // Calculate sales trend (daily)
      const datesInRange = eachDayOfInterval({
        start: startDate,
        end: endDate,
      });

      const dailySales = datesInRange.map((date) => {
        const dayOrders = filteredOrders.filter((order: any) => {
          const orderDate = startOfDay(new Date(order.createdAt));
          return orderDate.getTime() === startOfDay(date).getTime();
        });

        const revenue = dayOrders.reduce(
          (sum: number, order: any) => sum + Number(order.totalAmount || 0),
          0,
        );

        return {
          date: format(date, "MMM dd"),
          revenue: Math.round(revenue * 100) / 100,
          orders: dayOrders.length,
        };
      });

      setSalesTrend(dailySales);

      // Calculate cashier performance
      const cashierStats: { [key: string]: any } = {};
      filteredOrders.forEach((order: any) => {
        const cashierId = order.cashierId || "Unknown";
        const cashierName = order.cashier?.name || "Unknown";

        if (!cashierStats[cashierId]) {
          cashierStats[cashierId] = {
            name: cashierName,
            orders: 0,
            revenue: 0,
          };
        }

        cashierStats[cashierId].orders += 1;
        cashierStats[cashierId].revenue += Number(order.totalAmount || 0);
      });

      const cashierArray = Object.values(cashierStats).sort(
        (a: any, b: any) => b.revenue - a.revenue,
      );
      setCashierPerformance(cashierArray);

      // Calculate terminal performance
      const terminalStats: { [key: string]: any } = {};
      filteredOrders.forEach((order: any) => {
        const terminalId = order.terminalId || "Unknown";
        const terminalName = order.terminal?.name || "Unknown";

        if (!terminalStats[terminalId]) {
          terminalStats[terminalId] = {
            name: terminalName,
            orders: 0,
            revenue: 0,
          };
        }

        terminalStats[terminalId].orders += 1;
        terminalStats[terminalId].revenue += Number(order.totalAmount || 0);
      });

      const terminalArray = Object.values(terminalStats).sort(
        (a: any, b: any) => b.revenue - a.revenue,
      );
      setTerminalPerformance(terminalArray);

      // Calculate payment methods breakdown
      const filteredPayments = payments.filter((payment: any) => {
        const paymentDate = new Date(payment.createdAt);
        return paymentDate >= startDate && paymentDate <= endDate;
      });

      const paymentMethodStats: { [key: string]: number } = {};
      filteredPayments.forEach((payment: any) => {
        const method = payment.method || "UNKNOWN";
        paymentMethodStats[method] =
          (paymentMethodStats[method] || 0) + Number(payment.amount || 0);
      });

      const paymentMethodsArray = Object.entries(paymentMethodStats).map(
        ([method, amount]) => ({
          method: method.charAt(0) + method.slice(1).toLowerCase(),
          amount: Math.round(amount * 100) / 100,
        }),
      );
      setPaymentMethods(paymentMethodsArray);

      // Calculate hourly sales pattern
      const hourlyStats: {
        [key: number]: { revenue: number; orders: number };
      } = {};
      for (let i = 0; i < 24; i++) {
        hourlyStats[i] = { revenue: 0, orders: 0 };
      }

      filteredOrders.forEach((order: any) => {
        const hour = new Date(order.createdAt).getHours();
        hourlyStats[hour].revenue += Number(order.totalAmount || 0);
        hourlyStats[hour].orders += 1;
      });

      const hourlyArray = Object.entries(hourlyStats).map(([hour, data]) => ({
        hour: `${hour}:00`,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
      }));
      setHourlySales(hourlyArray);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("report data"));
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    try {
      let csvContent = "";

      // Add report header
      csvContent += `Sales Report\n`;
      csvContent += `Period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}\n`;
      csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

      // Add summary stats
      csvContent += `Summary Statistics\n`;
      csvContent += `Total Revenue,₱${stats.totalRevenue.toFixed(2)}\n`;
      csvContent += `Total Orders,${stats.totalOrders}\n`;
      csvContent += `Average Order Value,₱${stats.averageOrderValue.toFixed(2)}\n`;
      csvContent += `Total Profit,₱${stats.totalProfit.toFixed(2)}\n\n`;

      // Add top products
      csvContent += `Top Selling Products\n`;
      csvContent += `Rank,Product,SKU,Units Sold,Revenue\n`;
      topProducts.forEach((item: any, index: number) => {
        csvContent += `${index + 1},${item.product?.name || "Unknown"},${item.product?.sku || "N/A"},${item.totalQuantity},₱${item.totalRevenue.toFixed(2)}\n`;
      });
      csvContent += `\n`;

      // Add cashier performance
      if (cashierPerformance.length > 0) {
        csvContent += `Cashier Performance\n`;
        csvContent += `Cashier,Orders,Revenue\n`;
        cashierPerformance.forEach((cashier: any) => {
          csvContent += `${cashier.name},${cashier.orders},₱${cashier.revenue.toFixed(2)}\n`;
        });
        csvContent += `\n`;
      }

      // Add terminal performance
      if (terminalPerformance.length > 0) {
        csvContent += `Terminal Performance\n`;
        csvContent += `Terminal,Orders,Revenue\n`;
        terminalPerformance.forEach((terminal: any) => {
          csvContent += `${terminal.name},${terminal.orders},₱${terminal.revenue.toFixed(2)}\n`;
        });
        csvContent += `\n`;
      }

      // Add recent orders
      csvContent += `Recent Orders\n`;
      csvContent += `Date,Order ID,Items,Total,Status\n`;
      recentOrders.forEach((order) => {
        csvContent += `${new Date(order.createdAt).toLocaleDateString()},${order.id},${order.items?.length || 0},₱${Number(order.totalAmount || 0).toFixed(2)},${order.status}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprehensive-sales-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccessToast(SUCCESS_MESSAGES.EXPORTED("Report"));
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.EXPORT_FAILED("report"));
    }
  };

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Sales Reports & Analytics</CardTitle>
              <CardDescription>
                Comprehensive insights for your business
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={exportToCSV}
                disabled={loading || recentOrders.length === 0}
                variant="outline"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap sm:gap-4 pt-4">
            <Calendar className="h-5 w-5 text-muted-foreground hidden sm:block" />
            {/* Quick range buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setStartDate(startOfDay(today));
                  setEndDate(today);
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const weekAgo = new Date();
                  weekAgo.setDate(now.getDate() - 6);
                  setStartDate(startOfDay(weekAgo));
                  setEndDate(now);
                }}
              >
                Weekly
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const monthAgo = new Date();
                  monthAgo.setDate(now.getDate() - 29);
                  setStartDate(startOfDay(monthAgo));
                  setEndDate(now);
                }}
              >
                Monthly
              </Button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto justify-start"
                >
                  {format(startDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                />
              </PopoverContent>
            </Popover>
            <span className="hidden sm:inline">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto justify-start"
                >
                  {format(endDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                />
              </PopoverContent>
            </Popover>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₱{Number(stats.totalRevenue || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  For selected period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Profit
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₱{Number(stats.totalProfit || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Revenue minus tax
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
                  Avg: ₱{Number(stats.averageOrderValue || 0).toFixed(2)}
                </p>
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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {/* Sales Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Sales Trend</CardTitle>
                  <CardDescription>
                    Daily revenue and order count
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {salesTrend.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No sales data for selected period
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={salesTrend}>
                        <defs>
                          <linearGradient
                            id="colorRevenue"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Top Selling Products</CardTitle>
                      <CardDescription>
                        Best performers by revenue —{" "}
                        {topProducts.length} product
                        {topProducts.length !== 1 ? "s" : ""} sold in period
                      </CardDescription>
                    </div>
                    <Input
                      placeholder="Search by name or SKU…"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setProductPage(1);
                      }}
                      className="w-full sm:w-64"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {topProducts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No sales data for selected period
                    </p>
                  ) : (() => {
                      const filtered = topProducts.filter((item: any) => {
                        if (!productSearch) return true;
                        const q = productSearch.toLowerCase();
                        return (
                          item.product?.name?.toLowerCase().includes(q) ||
                          item.product?.sku?.toLowerCase().includes(q)
                        );
                      });
                      const totalPages = Math.max(
                        1,
                        Math.ceil(filtered.length / PRODUCTS_PER_PAGE),
                      );
                      const safePage = Math.min(productPage, totalPages);
                      const pageItems = filtered.slice(
                        (safePage - 1) * PRODUCTS_PER_PAGE,
                        safePage * PRODUCTS_PER_PAGE,
                      );
                      const globalOffset = (safePage - 1) * PRODUCTS_PER_PAGE;

                      return (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">Rank</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">
                                  Units Sold
                                </TableHead>
                                <TableHead className="text-right">
                                  Revenue
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pageItems.map((item: any, i: number) => {
                                const rank = globalOffset + i;
                                return (
                                  <TableRow key={rank}>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          rank === 0
                                            ? "default"
                                            : rank <= 2
                                              ? "secondary"
                                              : "outline"
                                        }
                                      >
                                        #{rank + 1}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {item.product?.name || "Unknown Product"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {item.product?.sku || "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {item.totalQuantity}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      ₱
                                      {Number(item.totalRevenue || 0).toFixed(
                                        2,
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>

                          {/* Pagination */}
                          <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                            <span>
                              Showing{" "}
                              {filtered.length === 0
                                ? 0
                                : globalOffset + 1}
                              –
                              {Math.min(
                                globalOffset + PRODUCTS_PER_PAGE,
                                filtered.length,
                              )}{" "}
                              of {filtered.length}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={safePage <= 1}
                                onClick={() => setProductPage((p) => p - 1)}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={safePage >= totalPages}
                                onClick={() => setProductPage((p) => p + 1)}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                </CardContent>
              </Card>

              {/* Product Performance Chart */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>Top Products Revenue Chart</CardTitle>
                    <Select
                      value={String(chartTopN)}
                      onValueChange={(v) => setChartTopN(Number(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">Top 10</SelectItem>
                        <SelectItem value="20">Top 20</SelectItem>
                        <SelectItem value="50">Top 50</SelectItem>
                        <SelectItem value="100">Top 100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {topProducts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No data available
                    </p>
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(300, chartTopN * 28)}
                    >
                      <BarChart
                        data={topProducts.slice(0, chartTopN)}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          type="category"
                          dataKey="product.name"
                          width={180}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="totalRevenue"
                          fill="hsl(var(--primary))"
                          name="Revenue"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4">
              {/* Cashier Performance */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <CardTitle>Cashier Performance</CardTitle>
                  </div>
                  <CardDescription>Sales by team member</CardDescription>
                </CardHeader>
                <CardContent>
                  {cashierPerformance.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No cashier data available
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cashier</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">
                            Avg/Order
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashierPerformance.map(
                          (cashier: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {cashier.name}
                              </TableCell>
                              <TableCell className="text-right">
                                {cashier.orders}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                ₱{cashier.revenue.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                ₱{(cashier.revenue / cashier.orders).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Terminal Performance */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    <CardTitle>Terminal Performance</CardTitle>
                  </div>
                  <CardDescription>Sales by POS terminal</CardDescription>
                </CardHeader>
                <CardContent>
                  {terminalPerformance.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No terminal data available
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Terminal</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">
                            Avg/Order
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {terminalPerformance.map(
                          (terminal: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {terminal.name}
                              </TableCell>
                              <TableCell className="text-right">
                                {terminal.orders}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                ₱{terminal.revenue.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                ₱
                                {(terminal.revenue / terminal.orders).toFixed(
                                  2,
                                )}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    <CardTitle>Payment Methods Breakdown</CardTitle>
                  </div>
                  <CardDescription>Revenue by payment type</CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentMethods.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No payment data available
                    </p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={paymentMethods}
                            dataKey="amount"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label
                          >
                            {paymentMethods.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="space-y-4">
                        {paymentMethods.map((method: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded"
                                style={{
                                  backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))`,
                                }}
                              />
                              <p className="font-medium">{method.method}</p>
                            </div>
                            <p className="font-semibold">
                              ₱{method.amount.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Patterns Tab */}
            <TabsContent value="patterns" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <CardTitle>Hourly Sales Pattern</CardTitle>
                  </div>
                  <CardDescription>
                    Sales distribution throughout the day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hourlySales.every((h) => h.orders === 0) ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hourly data available
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={hourlySales}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="orders"
                          fill="hsl(var(--primary))"
                          name="Orders"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peak Hours Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {hourlySales
                      .filter((h) => h.orders > 0)
                      .sort((a, b) => b.orders - a.orders)
                      .slice(0, 5)
                      .map((hourData, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded"
                        >
                          <div className="flex items-center gap-3">
                            <Badge>{hourData.hour}</Badge>
                            <span className="text-sm">
                              {hourData.orders} orders
                            </span>
                          </div>
                          <span className="font-semibold">
                            ₱{hourData.revenue.toFixed(2)}
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
