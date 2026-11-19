"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { catalogPricingIssues } from "@pos/shared-utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const ACTION_CHECK_KEY = "inventory-product-action-checks";

export interface ProductAction {
  key: string;
  name: string;
  sku: string;
  extraCost: number;
  sales: number;
  quantity: number;
  action: string;
}

function pieceCostIfPackWasSaved(line: BelowCostLine): number | null {
  const pack = line.packQuantity;
  const cost = line.productCost ?? line.unitCost;
  if (!pack || pack <= 1 || !(cost > 0) || !(line.unitPrice > 0)) return null;
  const perPiece = Math.round((cost / pack) * 100) / 100;
  if (Math.abs(line.unitPrice - perPiece) / line.unitPrice <= 0.2) return perPiece;
  return null;
}

function actionForLine(line: BelowCostLine): string {
  const perPiece = pieceCostIfPackWasSaved(line);
  const cost = line.productCost ?? line.unitCost;
  if (perPiece != null && line.packQuantity) {
    return `Saved cost ${formatCurrency(cost)} is the pack price for ${formatCount(line.packQuantity)}. Set the product cost to ${formatCurrency(perPiece)} per piece.`;
  }
  if (line.packQuantity && line.packQuantity > 1) {
    return `Sold at ${formatCurrency(line.unitPrice)} with a saved cost of ${formatCurrency(line.unitCost)}. Pack size ${formatCount(line.packQuantity)} does not explain the gap. Raise the price or correct the cost.`;
  }
  return `Sold at ${formatCurrency(line.unitPrice)} with a saved cost of ${formatCurrency(line.unitCost)}. Raise the price or correct the cost.`;
}

export function productActions(lines: BelowCostLine[]): ProductAction[] {
  const groups = new Map<string, ProductAction & { sampleLoss: number }>();
  for (const line of lines) {
    const key = (line.sku || line.name || "item").trim();
    const loss = Math.abs(Number(line.loss) || 0);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        key,
        name: line.name,
        sku: line.sku,
        extraCost: loss,
        sales: 1,
        quantity: Number(line.quantity) || 0,
        action: actionForLine(line),
        sampleLoss: loss,
      });
      continue;
    }
    current.extraCost += loss;
    current.sales += 1;
    current.quantity += Number(line.quantity) || 0;
    if (loss > current.sampleLoss) {
      current.sampleLoss = loss;
      current.action = actionForLine(line);
      current.name = line.name;
    }
  }
  return [...groups.values()]
    .map(({ sampleLoss: _sampleLoss, ...action }) => action)
    .sort((a, b) => b.extraCost - a.extraCost);
}

function readActionChecks(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTION_CHECK_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, true>;
  } catch {
    return {};
  }
}

/** Products sold below the cost saved on the sale, with the change to make. */
export function ProductActionChecklist({ lines }: { lines: BelowCostLine[] }) {
  const actions = useMemo(() => productActions(lines), [lines]);
  const [checked, setChecked] = useState<Record<string, true>>({});

  useEffect(() => {
    setChecked(readActionChecks());
  }, []);

  const ordered = [...actions].sort((a, b) => {
    const aDone = checked[a.key] ? 1 : 0;
    const bDone = checked[b.key] ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.extraCost - a.extraCost;
  });
  const openCount = actions.filter((action) => !checked[action.key]).length;

  function toggle(key: string, value: boolean) {
    setChecked((current) => {
      const next = { ...current };
      if (value) next[key] = true;
      else delete next[key];
      localStorage.setItem(ACTION_CHECK_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products to fix</CardTitle>
        <CardDescription>
          {actions.length === 0
            ? "No product in this period was sold below its saved cost."
            : `${formatCount(openCount)} of ${formatCount(actions.length)} still need a price or cost change. Check one off after it is corrected. The check stays on this browser.`}
        </CardDescription>
      </CardHeader>
      {ordered.length > 0 ? (
        <CardContent className="space-y-3">
          {ordered.map((action) => {
            const done = Boolean(checked[action.key]);
            return (
              <label
                key={action.key}
                className={`flex items-start gap-3 rounded-md border p-3 ${done ? "opacity-60" : ""}`}
              >
                <Checkbox
                  checked={done}
                  onCheckedChange={(value) => toggle(action.key, value === true)}
                  className="mt-0.5"
                  aria-label={`Mark ${action.name} as done`}
                />
                <span className="min-w-0">
                  <span className={`block font-medium ${done ? "line-through" : ""}`}>
                    {action.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {action.sku ? `${action.sku} · ` : ""}
                    {formatCount(action.sales)} {action.sales === 1 ? "sale" : "sales"}
                    {" · "}
                    extra cost {formatCurrency(action.extraCost)}
                  </span>
                  <span className="mt-1 block text-sm">{action.action}</span>
                </span>
              </label>
            );
          })}
        </CardContent>
      ) : null}
    </Card>
  );
}

export interface CatalogProductPrice {
  id: string;
  name?: string;
  sku?: string;
  status?: string;
  cost?: number | string | null;
  price?: number | string | null;
  packQuantity?: number | string | null;
  packPrice?: number | string | null;
  halfPackQuantity?: number | string | null;
  halfPackPrice?: number | string | null;
}

/** Current catalog prices that are below the saved cost. */
export function MispricedProductsCard({
  products,
  ready = true,
}: {
  products: CatalogProductPrice[];
  ready?: boolean;
}) {
  const router = useRouter();
  const rows = useMemo(
    () =>
      (products ?? [])
        .filter((product) => !product.status || product.status === "ACTIVE")
        .map((product) => ({
          product,
          issues: catalogPricingIssues(product),
        }))
        .filter((row) => row.issues.length > 0)
        .sort((a, b) => {
          const gap = (row: { issues: { cost: number; price: number }[] }) =>
            row.issues.reduce((sum, issue) => sum + (issue.cost - issue.price), 0);
          return gap(b) - gap(a);
        }),
    [products],
  );
  const page = usePagedRows(
    rows,
    rows.map((row) => row.product.id).join(","),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wrongly priced products</CardTitle>
        <CardDescription>
          {!ready
            ? "Checking current product prices."
            : rows.length === 0
              ? "Every active product is priced at or above its saved cost."
              : `${formatCount(rows.length)} ${rows.length === 1 ? "product has" : "products have"} a selling price below the saved cost. Open one to correct it.`}
        </CardDescription>
      </CardHeader>
      {rows.length > 0 ? (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead className="text-right">Selling price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.pageRows.map((row) => (
                <TableRow
                  key={row.product.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/products?edit=${row.product.id}`)}
                >
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{row.product.name || "Unnamed product"}</div>
                    {row.product.sku ? (
                      <div className="text-xs text-muted-foreground">{row.product.sku}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {row.issues.map((issue) => (
                      <div key={issue.label} className="py-1">
                        <div className="font-medium">{issue.label}</div>
                        <div className="text-xs text-muted-foreground">{issue.action}</div>
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.issues.map((issue) => (
                      <div key={issue.label} className="py-1">
                        {formatCurrency(issue.price)}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-red-600">
                    {row.issues.map((issue) => (
                      <div key={issue.label} className="py-1">
                        {formatCurrency(issue.cost)}
                      </div>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePager
            currentPage={page.currentPage}
            totalPages={page.totalPages}
            total={page.total}
            start={page.start}
            onPageChange={page.setPage}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
