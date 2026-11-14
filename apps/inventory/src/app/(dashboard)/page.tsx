"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { showErrorFromException, ERROR_MESSAGES } from "@/lib/toast-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  IconAlertTriangle,
  IconCash,
  IconPackage,
  IconReceipt,
  IconRefresh,
  IconShoppingCart,
  IconTrendingDown,
  IconTrendingUp,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react";

interface DashboardStats {
  timezone: string;
  asOf: string;
  nowHour: number;
  today: {
    date: string;
    revenue: number;
    orders: number;
    averageOrderValue: number;
    unitsSold: number;
    unitsReturned: number;
    discount: number;
    cogs: number;
    grossProfit: number;
    margin: number;
  };
  yesterday: { date: string; revenue: number; orders: number };
  hourly: Array<{ hour: number; revenue: number; orders: number }>;
  topProducts: Array<{
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    timeLabel: string;
    totalAmount: number;
    status: string;
    cashierName: string;
    itemCount: number;
  }>;
  payments: Array<{ method: string; amount: number; count: number }>;
  inventory: {
    totalProducts: number;
    activeProducts: number;
    outOfStock: number;
    lowStock: number;
    onHandValue: number;
    alerts: Array<{
      id: string;
      name: string;
      sku: string;
      stockQuantity: number;
      threshold: number;
    }>;
  };
  deliveries: {
    receivedCount: number;
    receivedCost: number;
    pendingCount: number;
  };
  overview: {
    netRevenue: number;
    totalOrders: number;
    totalProducts: number;
    activeProducts: number;
    teamSize: number;
  };
}

const hourlyChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-2)" },
} satisfies ChartConfig;

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  DIGITAL_WALLET: "E-Wallet",
  STORE_CREDIT: "Store credit",
};

function num(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatCount(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatAxisCurrency(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `₱${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `₱${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `₱${(abs / 1_000).toFixed(1)}k`;
  return `₱${Math.round(abs)}`;
}

function hourLabel(hour: number) {
  const clock = hour % 12 || 12;
  return `${clock} ${hour < 12 ? "AM" : "PM"}`;
}

function formatBusinessDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatClock(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || "Asia/Manila",
  }).format(date);
}

function paymentLabel(method: string) {
  return PAYMENT_LABELS[method] ?? method.replaceAll("_", " ").toLowerCase();
}

function statusLabel(status: string) {
  if (status === "EXCHANGE") return "Exchange";
  if (status === "PENDING") return "Pending";
  if (status === "SYNCED") return "Synced";
  return "";
}

function skippedRole() {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem("user");
  if (!raw) return false;
  try {
    const role = JSON.parse(raw).role;
    return role === "CASHIER" || role === "MANAGER";
  } catch {
    return false;
  }
}

function RevenueComparison({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous <= 0 && current <= 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">No sales yesterday</p>
    );
  }
  if (previous <= 0) {
    return (
      <p className="mt-1 text-xs text-emerald-600">
        Yesterday was {formatCurrency(0)}
      </p>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">Level with yesterday</p>
    );
  }
  const up = pct > 0;
  const Icon = up ? IconTrendingUp : IconTrendingDown;
  return (
    <p
      className={`mt-1 flex items-center gap-1 text-xs ${up ? "text-emerald-600" : "text-red-600"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}
      {pct.toFixed(1)}% from yesterday
    </p>
  );
}

function OrderComparison({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  if (diff === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">Same as yesterday</p>
    );
  }
  const up = diff > 0;
  return (
    <p className={`mt-1 text-xs ${up ? "text-emerald-600" : "text-red-600"}`}>
      {formatCount(Math.abs(diff))} {up ? "more" : "fewer"} than yesterday
    </p>
  );
}

export default function Page() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("user");
    if (!raw) return;
    try {
      const role = JSON.parse(raw).role;
      if (role === "CASHIER") {
        router.replace("/variance");
        return;
      }
      if (role === "MANAGER") {
        router.push("/products");
      }
    } catch {
      // A bad local user record should not block the dashboard.
    }
  }, [router]);

  const loadDashboard = useCallback(async (initial: boolean) => {
    if (skippedRole() || inFlight.current) return;
    inFlight.current = true;
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await apiClient.getDashboardStats();
      setStats(data);
      setLoadError(null);
    } catch (error) {
      if (initial) {
        setLoadError("The latest sales figures could not be loaded.");
        showErrorFromException(
          error,
          ERROR_MESSAGES.LOAD_FAILED("dashboard data"),
        );
      } else {
        setLoadError("Showing the last update. Refresh failed.");
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (skippedRole()) return;
    void loadDashboard(true);
    const tick = () => {
      if (document.visibilityState === "visible") void loadDashboard(false);
    };
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [loadDashboard]);

  if (loading && !stats) {
    return (
      <div className="space-y-6 px-4 lg:px-6">
        <Skeleton className="h-16 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load the dashboard</CardTitle>
            <CardDescription>
              {loadError ?? "The latest sales figures could not be loaded."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void loadDashboard(true)}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { today, yesterday, inventory, deliveries, overview } = stats;
  const chartPoints = stats.hourly
    .filter((point) => point.hour <= stats.nowHour)
    .map((point) => ({
      ...point,
      label: hourLabel(point.hour),
    }));
  const firstSale = chartPoints.findIndex(
    (point) => point.revenue > 0 || point.orders > 0,
  );
  const chartSeries = firstSale === -1 ? [] : chartPoints.slice(firstSale);
  const paymentTotal = stats.payments.reduce(
    (sum, payment) => sum + num(payment.amount),
    0,
  );
  const topRevenue = Math.max(
    ...stats.topProducts.map((product) => num(product.revenue)),
    1,
  );
  const profitTone =
    today.grossProfit > 0
      ? "text-emerald-600"
      : today.grossProfit < 0
        ? "text-red-600"
        : "";
  const alertCount = inventory.outOfStock + inventory.lowStock;

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {formatBusinessDate(today.date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {loadError
              ? loadError
              : `Updated ${formatClock(stats.asOf, stats.timezone)}`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDashboard(false)}
            disabled={refreshing}
          >
            <IconRefresh className={refreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Today&apos;s performance</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orders">View orders</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <IconCash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(today.revenue)}
              </div>
              <RevenueComparison
                current={today.revenue}
                previous={yesterday.revenue}
              />
              {today.discount > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(today.discount)} in discounts
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCount(today.orders)}
              </div>
              <OrderComparison
                current={today.orders}
                previous={yesterday.orders}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCount(today.unitsSold)} items sold
                {today.unitsReturned > 0
                  ? ` · ${formatCount(today.unitsReturned)} returned`
                  : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Average order
              </CardTitle>
              <IconReceipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(today.averageOrderValue)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {today.orders > 0
                  ? "Per completed sale today"
                  : "Waiting for the first sale"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Gross profit
              </CardTitle>
              <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profitTone}`}>
                {formatCurrency(today.grossProfit)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {today.revenue > 0
                  ? `${today.margin.toFixed(1)}% margin · cost ${formatCurrency(today.cogs)}`
                  : "Revenue minus the cost of goods sold"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Sales by hour</CardTitle>
            <CardDescription>
              {chartSeries.length > 0
                ? `From the first sale through ${hourLabel(stats.nowHour)}`
                : "Sales land here as orders come in today"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartSeries.length > 0 ? (
              <ChartContainer
                config={hourlyChartConfig}
                className="aspect-auto h-[240px] w-full"
              >
                <AreaChart
                  data={chartSeries}
                  margin={{ left: 8, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={56}
                    tickFormatter={formatAxisCurrency}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_label, payload) => {
                          const point = payload?.[0]?.payload as
                            | { label?: string; orders?: number }
                            | undefined;
                          if (!point) return "";
                          const orders = num(point.orders);
                          return `${point.label} · ${formatCount(orders)} ${orders === 1 ? "order" : "orders"}`;
                        }}
                        formatter={(value) => (
                          <span className="font-mono font-medium tabular-nums">
                            {formatCurrency(num(value))}
                          </span>
                        )}
                      />
                    }
                  />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    fill="var(--color-revenue)"
                    fillOpacity={0.2}
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                No sales yet today
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>
              {paymentTotal > 0
                ? formatCurrency(paymentTotal)
                : "No payments recorded today"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cash, card, and e-wallet totals show up after the first payment.
              </p>
            ) : (
              stats.payments.map((payment) => {
                const share =
                  paymentTotal > 0
                    ? (num(payment.amount) / paymentTotal) * 100
                    : 0;
                return (
                  <div key={payment.method} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {paymentLabel(payment.method)}
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCount(payment.count)}{" "}
                      {payment.count === 1 ? "payment" : "payments"} ·{" "}
                      {share.toFixed(0)}%
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Top items today</CardTitle>
              <CardDescription>Highest sales by line total</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/reports">Reports</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bestsellers appear after the first sale.
              </p>
            ) : (
              stats.topProducts.map((product, index) => (
                <div key={`${product.sku}-${product.name}`} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <span className="mr-2 text-muted-foreground">
                          {index + 1}
                        </span>
                        {product.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.sku || "No SKU"} · {formatCount(product.quantity)}{" "}
                        sold
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">
                      {formatCurrency(product.revenue)}
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-chart-2"
                      style={{
                        width: `${Math.max((num(product.revenue) / topRevenue) * 100, 4)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Stock to watch</CardTitle>
              <CardDescription>
                {alertCount > 0
                  ? `${formatCount(inventory.outOfStock)} out of stock · ${formatCount(inventory.lowStock)} running low`
                  : "Tracked products are above their alert levels"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/products">Products</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {inventory.alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconPackage className="h-4 w-4" />
                On-hand stock is valued at {formatCurrency(inventory.onHandValue)}
              </div>
            ) : (
              inventory.alerts.map((product) => {
                const out = product.stockQuantity <= 0;
                const width = out
                  ? 0
                  : Math.min(
                      100,
                      (product.stockQuantity / Math.max(product.threshold, 1)) *
                        100,
                    );
                return (
                  <div key={product.id} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {product.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {product.sku || "No SKU"} · alert at{" "}
                          {formatCount(product.threshold)}
                        </p>
                      </div>
                      <Badge variant={out ? "destructive" : "secondary"}>
                        {out ? (
                          <IconAlertTriangle className="h-3 w-3" />
                        ) : null}
                        {out
                          ? "Out"
                          : `${formatCount(product.stockQuantity)} left`}
                      </Badge>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${out ? "bg-red-500" : "bg-amber-500"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
            <div className="flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <IconTruck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p>
                    {formatCount(deliveries.receivedCount)}{" "}
                    {deliveries.receivedCount === 1
                      ? "delivery"
                      : "deliveries"}{" "}
                    received · {formatCurrency(deliveries.receivedCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {deliveries.pendingCount > 0
                      ? `${formatCount(deliveries.pendingCount)} still pending`
                      : "Nothing waiting to be received"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/deliveries">Deliveries</Link>
              </Button>
            </div>
            {inventory.alerts.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                On-hand stock value {formatCurrency(inventory.onHandValue)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Latest sales</CardTitle>
            <CardDescription>Most recent orders from today</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orders">All orders</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {stats.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet today</p>
          ) : (
            <div className="divide-y">
              {stats.recentOrders.map((order) => {
                const label = statusLabel(order.status);
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {order.orderNumber}
                        </p>
                        {label ? (
                          <Badge variant="outline">{label}</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.timeLabel || "Today"} · {order.cashierName} ·{" "}
                        {formatCount(order.itemCount)}{" "}
                        {order.itemCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">
                      {formatCurrency(order.totalAmount)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Overview</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total revenue
              </CardTitle>
              <IconTrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(overview.netRevenue)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Payments minus refunds
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total orders
              </CardTitle>
              <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCount(overview.totalOrders)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Excluding voids
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
                {formatCount(overview.activeProducts)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCount(overview.totalProducts)} total
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
                {formatCount(overview.teamSize)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Active accounts
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
