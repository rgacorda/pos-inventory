"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

const PAGE_SIZE = 10;

export interface BelowCostLine {
  orderId: string;
  orderNumber: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  loss: number;
  packQuantity: number | null;
  productCost: number | null;
}

export interface LossOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  paid: number;
  lineSales: number;
  cost: number;
  discount: number;
  profit: number;
  exchangeRef: string | null;
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

function usePagedRows<T>(rows: T[], identity: string) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [identity]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;

  return {
    pageRows: rows.slice(start, start + PAGE_SIZE),
    currentPage,
    totalPages,
    setPage,
    total: rows.length,
    start,
  };
}

function TablePager({
  currentPage,
  totalPages,
  total,
  start,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  start: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3">
      <p className="text-sm text-muted-foreground">
        Showing {start + 1} to {Math.min(start + PAGE_SIZE, total)} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-8"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/**
 * Orders that collected less than their item cost, and the individual lines
 * priced below the cost saved on the sale.
 */
export function BelowCostCard({
  lines,
  orders,
  periodLabel,
}: {
  lines: BelowCostLine[];
  orders?: LossOrder[];
  periodLabel: string;
}) {
  const itemRows = lines ?? [];
  const orderRows = orders ?? [];
  const ordersPage = usePagedRows(
    orderRows,
    orderRows.map((order) => order.orderId).join(","),
  );
  const itemsPage = usePagedRows(
    itemRows,
    itemRows.map((line) => `${line.orderId}:${line.sku}`).join(","),
  );
  const shortfall = orderRows.reduce(
    (sum, order) => sum + Math.abs(Number(order.profit || 0)),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>What reduced profit</CardTitle>
        <CardDescription>
          {orderRows.length === 0 && itemRows.length === 0
            ? `Every order ${periodLabel} collected at least the cost of its items.`
            : `Gross profit is the money collected minus item cost. ${
                orderRows.length > 0
                  ? `${formatCount(orderRows.length)} ${orderRows.length === 1 ? "order" : "orders"} ${periodLabel} collected ${formatCurrency(shortfall)} less than their items cost.`
                  : `No order ${periodLabel} collected less than its item cost.`
              }`}
        </CardDescription>
      </CardHeader>
      {orderRows.length > 0 || itemRows.length > 0 ? (
        <CardContent className="space-y-6">
          {orderRows.length > 0 ? (
            <div>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Item prices</TableHead>
                  <TableHead className="text-right">Item cost</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Shortfall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersPage.pageRows.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{order.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.exchangeRef
                          ? `Exchange of ${order.exchangeRef}`
                          : order.status}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.paid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.lineSales)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.discount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-red-600">
                      {formatCurrency(Math.abs(order.profit))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
              <TablePager
                currentPage={ordersPage.currentPage}
                totalPages={ordersPage.totalPages}
                total={ordersPage.total}
                start={ordersPage.start}
                onPageChange={ordersPage.setPage}
              />
            </div>
          ) : null}

          {itemRows.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Items priced below their saved cost</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Pack</TableHead>
                    <TableHead className="text-right">Extra cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsPage.pageRows.map((line, index) => (
                    <TableRow key={`${line.orderId}-${line.sku}-${itemsPage.start + index}`}>
                      <TableCell className="font-medium">{line.orderNumber}</TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal">
                        <div>{line.name}</div>
                        {line.sku ? (
                          <div className="text-xs text-muted-foreground">{line.sku}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(line.quantity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(line.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(line.unitCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.packQuantity != null && line.packQuantity > 0
                          ? formatCount(line.packQuantity)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-red-600">
                        {formatCurrency(line.loss)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                currentPage={itemsPage.currentPage}
                totalPages={itemsPage.totalPages}
                total={itemsPage.total}
                start={itemsPage.start}
                onPageChange={itemsPage.setPage}
              />
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
