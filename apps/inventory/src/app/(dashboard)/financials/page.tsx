"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  showErrorFromException,
  ERROR_MESSAGES
} from "@/lib/toast-utils";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCoin,
  IconReceipt,
  IconPackage,
  IconCalendar,
  IconTruck,
} from "@tabler/icons-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

interface DeliveredGoods {
  total: number;
  goodsValue: number;
  discount: number;
  returnCredit: number;
  deliveriesCount: number;
}

interface InventoryValue {
  netValue: number;
  onHandValue: number;
  negativeValue: number;
  onHandCount: number;
  negativeCount: number;
  negativeUnits: number;
  missingCostCount: number;
  archivedValue: number;
  archivedCount: number;
  unlimitedCount: number;
}

interface ProfitLossData {
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    total: number;
    ordersCount: number;
  };
  cogs: {
    total: number;
    deliveriesCount: number;
  };
  deliveredGoods?: DeliveredGoods;
  currentMonthDeliveries?: DeliveredGoods & {
    period: {
      startDate: string;
      endDate: string;
      label: string;
    };
  };
  inventory?: InventoryValue;
  operatingExpenses: {
    total: number;
    breakdown: Record<string, number>;
  };
  grossProfit: number;
  netProfit: number;
  metrics: {
    grossMargin: number;
    netMargin: number;
  };
  trend?: {
    bucket: "day" | "month";
    points: Array<{
      date: string;
      label: string;
      revenue: number;
      purchases: number;
      profit: number;
    }>;
  };
}

const trendChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-2)" },
  purchases: { label: "Purchases", color: "var(--chart-1)" },
  profit: { label: "Profit", color: "var(--chart-4)" },
} satisfies ChartConfig;

const EXPENSE_LABELS: Record<string, string> = {
  ELECTRICITY: "Electricity",
  INTERNET: "Internet",
  WATER: "Water",
  WAGES: "Employee Wages",
  RENT: "Rent",
  OTHER: "Other",
};

function expenseLabel(type: string) {
  return EXPENSE_LABELS[type] ?? type;
}

function formatCurrency(amount: number) {
  const value = Number(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(value) ? value : 0);
}

function percentWidth(part: number, total: number) {
  const value = Number(part);
  const sum = Number(total);
  if (!Number.isFinite(value) || !Number.isFinite(sum) || sum <= 0) return 0;
  return Math.min(100, Math.max(0, (value / sum) * 100));
}

function getProfitabilityColor(profit: number) {
  if (profit > 0) return "text-green-600";
  if (profit < 0) return "text-red-600";
  return "text-gray-600";
}

function formatAxisCurrency(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}₱${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₱${Math.round(abs)}`;
}

function profitHeadline(profit: number) {
  if (profit > 0) return `Profitable by ${formatCurrency(profit)}`;
  if (profit < 0) return `Loss of ${formatCurrency(Math.abs(profit))}`;
  return "Revenue matches purchases";
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  const amount = Math.abs(Number(count) || 0);
  return `${amount.toLocaleString("en-PH")} ${amount === 1 ? singular : pluralLabel}`;
}

export default function FinancialsPage() {
  const router = useRouter();
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [startDate, setStartDate] = useState<Date>(() =>
    startOfDay(subMonths(new Date(), 3)),
  );
  const [endDate, setEndDate] = useState<Date>(() => endOfDay(new Date()));
  const requestSeq = useRef(0);
  const dataRef = useRef<ProfitLossData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const user = localStorage.getItem("user");
    if (!user) return;
    try {
      const userData = JSON.parse(user);
      if (userData?.role === "MANAGER") {
        router.push("/products");
      }
    } catch {
      // A corrupt session should not blank the page.
    }
  }, [router]);

  useEffect(() => {
    if (startOfDay(startDate).getTime() > startOfDay(endDate).getTime()) {
      setRangeError("Choose an end date on or after the start date.");
      setLoading(false);
      return;
    }
    setRangeError(null);

    const seq = ++requestSeq.current;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const result = await apiClient.getProfitLoss(
          startOfDay(startDate).toISOString(),
          endOfDay(endDate).toISOString(),
        );
        if (cancelled || seq !== requestSeq.current) return;
        dataRef.current = result;
        setData(result);
        setLoadError(null);
      } catch (error) {
        if (cancelled || seq !== requestSeq.current) return;
        showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("financial data"));
        if (!dataRef.current) {
          setLoadError("Financial data could not be loaded.");
        }
      } finally {
        if (!cancelled && seq === requestSeq.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      requestSeq.current += 1;
    };
  }, [startDate, endDate, reloadKey]);

  function setThisMonth() {
    const now = new Date();
    setStartDate(startOfDay(startOfMonth(now)));
    setEndDate(endOfDay(endOfMonth(now)));
  }

  function setLastMonth() {
    const lastMonth = subMonths(new Date(), 1);
    setStartDate(startOfDay(startOfMonth(lastMonth)));
    setEndDate(endOfDay(endOfMonth(lastMonth)));
  }

  function setLast3Months() {
    setStartDate(startOfDay(subMonths(new Date(), 3)));
    setEndDate(endOfDay(new Date()));
  }

  const delivered = data?.deliveredGoods ?? (data
    ? {
        total: Number(data.cogs.total) || 0,
        goodsValue: Number(data.cogs.total) || 0,
        discount: 0,
        returnCredit: 0,
        deliveriesCount: data.cogs.deliveriesCount,
      }
    : null);
  const inventory = data?.inventory;
  const monthDeliveries = data?.currentMonthDeliveries;
  const expenseTotal =
    delivered && data
      ? Number(delivered.total) + Number(data.operatingExpenses.total)
      : 0;

  return (
    <div className="px-4 lg:px-6 space-y-6" aria-busy={loading}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">
            Inventory value, this month&apos;s deliveries, and profit & loss
          </p>
        </div>
        {loading && data ? (
          <p className="text-sm text-muted-foreground">Updating…</p>
        ) : null}
      </div>

      {inventory && monthDeliveries ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Inventory value
              </CardTitle>
              <IconPackage className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${getProfitabilityColor(inventory.netValue)}`}
              >
                {formatCurrency(inventory.netValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current unit cost × quantity, including stock below zero
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">On hand</p>
                  <p className="font-medium">
                    {formatCurrency(inventory.onHandValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {plural(inventory.onHandCount, "product")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Negative stock</p>
                  <p
                    className={`font-medium ${inventory.negativeCount > 0 ? "text-red-600" : ""}`}
                  >
                    {formatCurrency(inventory.negativeValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {plural(inventory.negativeCount, "product")}
                    {inventory.negativeCount > 0
                      ? ` · ${plural(inventory.negativeUnits, "unit")}`
                      : ""}
                  </p>
                </div>
              </div>
              {inventory.missingCostCount > 0 ? (
                <p className="text-xs text-amber-600 mt-3">
                  {plural(inventory.missingCostCount, "product")}{" "}
                  {inventory.missingCostCount === 1 ? "has" : "have"} quantity
                  but no unit cost, so {inventory.missingCostCount === 1 ? "it adds" : "they add"}{" "}
                  {formatCurrency(0)}.
                </p>
              ) : null}
              {inventory.archivedCount > 0 ? (
                <p className="text-xs text-muted-foreground mt-2">
                  {plural(inventory.archivedCount, "archived product")} with
                  remaining stock ({formatCurrency(inventory.archivedValue)}){" "}
                  {inventory.archivedCount === 1 ? "is" : "are"} left out.
                </p>
              ) : null}
              {inventory.unlimitedCount > 0 ? (
                <p className="text-xs text-muted-foreground mt-2">
                  {plural(inventory.unlimitedCount, "unlimited-stock product")}{" "}
                  {inventory.unlimitedCount === 1 ? "is" : "are"} left out
                  because {inventory.unlimitedCount === 1 ? "it has" : "they have"} no
                  quantity.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Delivered goods this month
              </CardTitle>
              <IconTruck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(monthDeliveries.total)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cost paid · {monthDeliveries.period.label} ·{" "}
                {plural(monthDeliveries.deliveriesCount, "received delivery", "received deliveries")}
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Goods value</span>
                  <span className="font-medium">
                    {formatCurrency(monthDeliveries.goodsValue)}
                  </span>
                </div>
                {monthDeliveries.discount > 0 ? (
                  <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>Supplier discounts</span>
                    <span>{formatCurrency(monthDeliveries.discount)}</span>
                  </div>
                ) : null}
                {monthDeliveries.returnCredit > 0 ? (
                  <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>Return credits</span>
                    <span>{formatCurrency(monthDeliveries.returnCredit)}</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto justify-start">
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {format(startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(startOfDay(date))}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground text-center sm:px-2">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto justify-start">
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {format(endDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(endOfDay(date))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-8" />
            <Separator className="block sm:hidden" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={setThisMonth}>
                This Month
              </Button>
              <Button variant="outline" size="sm" onClick={setLastMonth}>
                Last Month
              </Button>
              <Button variant="outline" size="sm" onClick={setLast3Months}>
                Last 3 Months
              </Button>
            </div>
          </div>
          {rangeError ? (
            <p className="text-sm text-red-600 mt-3">{rangeError}</p>
          ) : null}
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading financial data...</div>
        </div>
      ) : null}

      {!data && loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load financials</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {data && delivered ? (
        <>
          {data.trend && data.trend.points.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Purchases and revenue</CardTitle>
                <CardDescription>
                  Goods purchased to sell, compared with revenue.{" "}
                  {data.trend.bucket === "month"
                    ? "Each point is a month."
                    : "Each point is a day."}{" "}
                  Profit is revenue minus those purchases.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p
                    className={`text-2xl font-bold ${getProfitabilityColor(data.grossProfit)}`}
                  >
                    {profitHeadline(data.grossProfit)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Revenue {formatCurrency(data.revenue.total)} · Purchases{" "}
                    {formatCurrency(delivered.total)}
                  </p>
                </div>
                <ChartContainer
                  config={trendChartConfig}
                  className="aspect-auto h-[280px] w-full"
                >
                  <ComposedChart
                    data={data.trend.points}
                    margin={{ left: 8, right: 8, top: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={28}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={64}
                      tickFormatter={formatAxisCurrency}
                    />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => {
                            const key = String(name);
                            const seriesLabel =
                              key === "purchases"
                                ? "Purchases"
                                : key === "profit"
                                  ? "Profit"
                                  : "Revenue";
                            return (
                              <div className="flex w-full items-center justify-between gap-4">
                                <span className="text-muted-foreground">
                                  {seriesLabel}
                                </span>
                                <span className="font-mono font-medium tabular-nums">
                                  {formatCurrency(Number(value))}
                                </span>
                              </div>
                            );
                          }}
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
                    <Area
                      dataKey="purchases"
                      type="monotone"
                      fill="var(--color-purchases)"
                      fillOpacity={0.15}
                      stroke="var(--color-purchases)"
                      strokeWidth={2}
                    />
                    <Line
                      dataKey="profit"
                      type="monotone"
                      stroke="var(--color-profit)"
                      strokeWidth={2}
                      dot={data.trend.points.length < 8}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <IconCoin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.revenue.total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {plural(data.revenue.ordersCount, "order")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${getProfitabilityColor(data.grossProfit)}`}
                >
                  {formatCurrency(data.grossProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.metrics.grossMargin}% margin
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                {data.netProfit >= 0 ? (
                  <IconTrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <IconTrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${getProfitabilityColor(data.netProfit)}`}
                >
                  {formatCurrency(data.netProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.metrics.netMargin}% margin
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Expenses
                </CardTitle>
                <IconReceipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(expenseTotal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Deliveries + operating
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Statement</CardTitle>
              <CardDescription>
                {format(new Date(data.period.startDate), "MMM d, yyyy")} -{" "}
                {format(new Date(data.period.endDate), "MMM d, yyyy")}. Gross
                profit is revenue minus delivered goods in this period.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Revenue</span>
                  <span>{formatCurrency(data.revenue.total)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground pl-4">
                  <span>Sales ({data.revenue.ordersCount})</span>
                  <span>{formatCurrency(data.revenue.total)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Delivered goods</span>
                  <span className="text-red-600">
                    ({formatCurrency(delivered.total)})
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground pl-4">
                  <span>
                    Received deliveries ({delivered.deliveriesCount})
                  </span>
                  <span>({formatCurrency(delivered.total)})</span>
                </div>
                {delivered.goodsValue !== delivered.total ? (
                  <div className="flex justify-between items-center text-sm text-muted-foreground pl-4">
                    <span>Goods value before discounts and credits</span>
                    <span>{formatCurrency(delivered.goodsValue)}</span>
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="flex justify-between items-center text-xl font-bold">
                <span>Gross Profit</span>
                <span className={getProfitabilityColor(data.grossProfit)}>
                  {formatCurrency(data.grossProfit)}
                </span>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Operating Expenses</span>
                  <span className="text-red-600">
                    ({formatCurrency(data.operatingExpenses.total)})
                  </span>
                </div>
                {Object.entries(data.operatingExpenses.breakdown).map(
                  ([type, amount]) => (
                    <div
                      key={type}
                      className="flex justify-between items-center text-sm text-muted-foreground pl-4"
                    >
                      <span>{expenseLabel(type)}</span>
                      <span>({formatCurrency(amount)})</span>
                    </div>
                  ),
                )}
              </div>

              <Separator className="border-2" />

              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Net Profit</span>
                <span className={getProfitabilityColor(data.netProfit)}>
                  {formatCurrency(data.netProfit)}
                </span>
              </div>

              <div className="flex gap-4 pt-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Gross Margin: {data.metrics.grossMargin}%
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      data.metrics.netMargin >= 0 ? "default" : "destructive"
                    }
                  >
                    Net Margin: {data.metrics.netMargin}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>
                Cost composition for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Delivered goods</span>
                    <span>{formatCurrency(delivered.total)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${percentWidth(delivered.total, expenseTotal)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Operating Expenses</span>
                    <span>{formatCurrency(data.operatingExpenses.total)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500"
                      style={{
                        width: `${percentWidth(data.operatingExpenses.total, expenseTotal)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
