"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import {
  BelowCostCard,
  MispricedProductsCard,
  ProductActionChecklist,
  type BelowCostLine,
  type CatalogProductPrice,
  type LossOrder,
} from "@/components/below-cost-lines";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { showErrorFromException, ERROR_MESSAGES } from "@/lib/toast-utils";
import { IconCalendar } from "@tabler/icons-react";
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";

export function ProblemsPanel() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(() => startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => endOfDay(new Date()));
  const [lines, setLines] = useState<BelowCostLine[]>([]);
  const [orders, setOrders] = useState<LossOrder[]>([]);
  const [products, setProducts] = useState<CatalogProductPrice[]>([]);
  const [productsReady, setProductsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getProducts()
      .then((rows) => {
        if (!cancelled) setProducts(rows || []);
      })
      .catch((error) => {
        if (!cancelled) {
          showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("products"));
        }
      })
      .finally(() => {
        if (!cancelled) setProductsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const from = startOfDay(startDate);
        const to = endOfDay(endDate);
        const rangeStart = (from <= to ? from : startOfDay(endDate)).toISOString();
        const rangeEnd = (from <= to ? to : endOfDay(startDate)).toISOString();
        const analytics = await apiClient.getReportAnalytics(rangeStart, rangeEnd);
        if (cancelled) return;
        setLines(analytics.summary?.belowCost ?? []);
        setOrders(analytics.summary?.lossOrders ?? []);
      } catch (error) {
        if (!cancelled) {
          showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("problems"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return (
    <div className="space-y-6" aria-busy={loading}>
      <p className="text-muted-foreground">
        Products whose current price is below cost, and the sales that collected less than their item cost.
      </p>

      <MispricedProductsCard
        products={products}
        ready={productsReady}
        onUpdated={(saved) =>
          setProducts((current) =>
            current.map((product) =>
              product.id === saved.id ? { ...product, ...saved } : product,
            ),
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
        <span className="text-sm text-muted-foreground text-center sm:px-1">to</span>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setStartDate(startOfDay(new Date()));
            setEndDate(endOfDay(new Date()));
          }}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const now = new Date();
            setStartDate(startOfMonth(now));
            setEndDate(endOfMonth(now));
          }}
        >
          This month
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading problems…</p>
      ) : (
        <>
          <ProductActionChecklist
            lines={lines}
            products={products}
            productsReady={productsReady}
          />
          <BelowCostCard
            lines={lines}
            orders={orders}
            periodLabel="in this period"
          />
        </>
      )}
    </div>
  );
}
