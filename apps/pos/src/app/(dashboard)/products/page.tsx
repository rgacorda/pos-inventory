"use client";

import { useMemo, useState } from "react";
import {
  useLocalOrders,
  useProducts,
  useUnknownBarcodes,
} from "@/hooks/useDatabase";
import { dbHelpers } from "@/lib/db";
import { formatCurrency } from "@pos/shared-utils";
import { OrderStatus } from "@pos/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ClipboardCopy,
  Package,
  Search,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

interface ManualSaleItem {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId: string;
  catalogName?: string;
  catalogSku?: string;
  orderNumber: string;
  customerName?: string;
  createdAt: Date;
}

function isCatalogBasedManualItem(productId: string) {
  return !productId.startsWith("manual-");
}

export default function ProductsPage() {
  const orders = useLocalOrders();
  const products = useProducts();
  const unknownBarcodes = useUnknownBarcodes();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const handleDismissBarcode = async (id: number) => {
    await dbHelpers.dismissUnknownBarcode(id);
  };

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 1500);
  };

  const catalogById = useMemo(() => {
    const map = new Map<string, { name: string; sku: string }>();
    products?.forEach((product) => {
      map.set(product.id, { name: product.name, sku: product.sku });
    });
    return map;
  }, [products]);

  const { customItems, catalogItems } = useMemo(() => {
    const custom: ManualSaleItem[] = [];
    const catalog: ManualSaleItem[] = [];

    if (!orders) {
      return { customItems: custom, catalogItems: catalog };
    }

    orders
      .filter((order) => order.status !== OrderStatus.VOID)
      .forEach((order) => {
        (order.items ?? [])
          .filter((item) => item.sku === "MANUAL")
          .forEach((item, index) => {
            const catalogProduct = catalogById.get(item.productId);
            const saleItem: ManualSaleItem = {
              key: `${order.posLocalId}-${item.productId}-${index}`,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              productId: item.productId,
              catalogName: catalogProduct?.name,
              catalogSku: catalogProduct?.sku,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              createdAt: order.localCreatedAt,
            };

            if (isCatalogBasedManualItem(item.productId)) {
              catalog.push(saleItem);
            } else {
              custom.push(saleItem);
            }
          });
      });

    return { customItems: custom, catalogItems: catalog };
  }, [orders, catalogById]);

  const filterItems = (items: ManualSaleItem[]) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.orderNumber.toLowerCase().includes(query) ||
        item.customerName?.toLowerCase().includes(query) ||
        item.catalogName?.toLowerCase().includes(query) ||
        item.catalogSku?.toLowerCase().includes(query),
    );
  };

  const filteredCustomItems = filterItems(customItems);
  const filteredCatalogItems = filterItems(catalogItems);

  const renderItemsTable = (
    items: ManualSaleItem[],
    emptyLabel: string,
    showCatalogSource: boolean,
  ) => {
    if (!orders) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading items...
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <div className="text-muted-foreground">{emptyLabel}</div>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Name</TableHead>
            {showCatalogSource && <TableHead>Catalog Product</TableHead>}
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.key}>
              <TableCell className="font-medium">{item.name}</TableCell>
              {showCatalogSource && (
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span>{item.catalogName || "Catalog product"}</span>
                    {item.catalogSku && (
                      <span className="text-xs text-muted-foreground">
                        SKU: {item.catalogSku}
                      </span>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell>
                <Badge variant="outline">{item.orderNumber}</Badge>
              </TableCell>
              <TableCell>{item.customerName || "Walk-in"}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(item.unitPrice)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(item.total)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(item.createdAt), "MMM d, h:mm a")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">Manual Items</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto space-y-4">
          {unknownBarcodes && unknownBarcodes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 bg-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-amber-800">
                    Unmatched Barcodes ({unknownBarcodes.length})
                  </span>
                  <p className="text-xs text-amber-700 mt-0.5">
                    These barcodes were scanned at the POS but had no matching
                    product.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-amber-100">
                {unknownBarcodes.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-amber-100/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-mono font-semibold text-gray-900 text-sm">
                        {entry.barcode}
                      </span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">
                          First scanned:{" "}
                          {new Date(entry.scannedAt).toLocaleString()}
                        </span>
                        <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                          {entry.scanCount}× scanned
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs border-amber-300 hover:bg-amber-100"
                      onClick={() => handleCopyBarcode(entry.barcode)}
                    >
                      <ClipboardCopy className="h-3 w-3" />
                      {copiedBarcode === entry.barcode ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() =>
                        entry.id != null && handleDismissBarcode(entry.id)
                      }
                      title="Dismiss"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Manual Items</CardTitle>
              <CardDescription>
                Items added through manual entry, split by custom input and
                catalog products from the database
              </CardDescription>
              <div className="pt-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by item, order, customer, or catalog product..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="custom">
                <TabsList>
                  <TabsTrigger value="custom">
                    Custom Input ({filteredCustomItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="catalog">
                    From Catalog ({filteredCatalogItems.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="custom" className="mt-4">
                  <div className="max-h-[600px] overflow-auto">
                    {renderItemsTable(
                      filteredCustomItems,
                      searchQuery
                        ? "No custom items match your search"
                        : "No custom manual items yet",
                      false,
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="catalog" className="mt-4">
                  <div className="max-h-[600px] overflow-auto">
                    {renderItemsTable(
                      filteredCatalogItems,
                      searchQuery
                        ? "No catalog-based items match your search"
                        : "No catalog-based manual items yet",
                      true,
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
