"use client";

import { useEffect, useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCoin,
  IconReceipt,
  IconPackage,
  IconCalendar,
} from "@tabler/icons-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
}

export default function FinancialsPage() {
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  useEffect(() => {
    fetchProfitLoss();
  }, [startDate, endDate]);

  async function fetchProfitLoss() {
    try {
      setLoading(true);
      const result = await apiClient.getProfitLoss(
        startDate.toISOString(),
        endDate.toISOString(),
      );
      setData(result);
    } catch (error) {
      console.error("Error fetching profit/loss:", error);
      toast.error("Failed to load financial data");
    } finally {
      setLoading(false);
    }
  }

  function setThisMonth() {
    setStartDate(startOfMonth(new Date()));
    setEndDate(endOfMonth(new Date()));
  }

  function setLastMonth() {
    const lastMonth = subMonths(new Date(), 1);
    setStartDate(startOfMonth(lastMonth));
    setEndDate(endOfMonth(lastMonth));
  }

  function setLast3Months() {
    setStartDate(subMonths(new Date(), 3));
    setEndDate(new Date());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading financial data...</div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getProfitabilityColor = (profit: number) => {
    if (profit > 0) return "text-green-600";
    if (profit < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">
            Profit & Loss Statement and financial metrics
          </p>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {format(startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                  />
                </PopoverContent>
              </Popover>
              <span className="flex items-center px-2">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {format(endDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex gap-2">
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
        </CardContent>
      </Card>

      {/* Key Metrics */}
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
              {data.revenue.ordersCount} orders
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
              {formatCurrency(data.cogs.total + data.operatingExpenses.total)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              COGS + Operating
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Profit & Loss Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Statement</CardTitle>
          <CardDescription>
            {format(new Date(data.period.startDate), "MMM d, yyyy")} -{" "}
            {format(new Date(data.period.endDate), "MMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Revenue Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Revenue</span>
              <span>{formatCurrency(data.revenue.total)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-muted-foreground pl-4">
              <span>Sales Orders ({data.revenue.ordersCount})</span>
              <span>{formatCurrency(data.revenue.total)}</span>
            </div>
          </div>

          <Separator />

          {/* Cost of Goods Sold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Cost of Goods Sold (COGS)</span>
              <span className="text-red-600">
                ({formatCurrency(data.cogs.total)})
              </span>
            </div>
            <div className="flex justify-between items-center text-sm text-muted-foreground pl-4">
              <span>Inventory Purchases ({data.cogs.deliveriesCount})</span>
              <span>({formatCurrency(data.cogs.total)})</span>
            </div>
          </div>

          <Separator />

          {/* Gross Profit */}
          <div className="flex justify-between items-center text-xl font-bold">
            <span>Gross Profit</span>
            <span className={getProfitabilityColor(data.grossProfit)}>
              {formatCurrency(data.grossProfit)}
            </span>
          </div>

          <Separator />

          {/* Operating Expenses */}
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
                  <span>
                    {type === "ELECTRICITY"
                      ? "Electricity"
                      : type === "INTERNET"
                        ? "Internet"
                        : type === "WATER"
                          ? "Water"
                          : type === "WAGES"
                            ? "Employee Wages"
                            : type === "RENT"
                              ? "Rent"
                              : type}
                  </span>
                  <span>({formatCurrency(amount)})</span>
                </div>
              ),
            )}
          </div>

          <Separator className="border-2" />

          {/* Net Profit */}
          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Net Profit</span>
            <span className={getProfitabilityColor(data.netProfit)}>
              {formatCurrency(data.netProfit)}
            </span>
          </div>

          {/* Profitability Badges */}
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

      {/* Expense Breakdown Card */}
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
                <span className="font-medium">Cost of Goods Sold</span>
                <span>{formatCurrency(data.cogs.total)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width: `${
                      (data.cogs.total /
                        (data.cogs.total + data.operatingExpenses.total)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Operating Expenses</span>
                <span>{formatCurrency(data.operatingExpenses.total)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{
                    width: `${
                      (data.operatingExpenses.total /
                        (data.cogs.total + data.operatingExpenses.total)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
