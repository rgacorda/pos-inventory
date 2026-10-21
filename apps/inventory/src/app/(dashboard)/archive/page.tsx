"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { formatStockQuantity } from "@pos/shared-utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { showErrorFromException, showSuccessToast } from "@/lib/toast-utils";

type ArchiveKind = "product" | "delivery" | "return";

interface ArchivedProduct {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  infiniteStock?: boolean;
  deletedAt?: string | null;
  deletedByName?: string | null;
}

interface ArchivedLine {
  productId: string;
  productName: string;
  quantity: number;
  productDeleted?: boolean;
}

interface ArchivedDelivery {
  id: string;
  supplier: string;
  invoiceNumber?: string;
  deliveryDate: string;
  totalCost: number;
  status: string;
  items?: ArchivedLine[];
  deletedAt?: string | null;
  deletedByName?: string | null;
}

interface ArchivedReturn {
  id: string;
  supplier: string;
  reason?: string | null;
  status: string;
  returnedTotalCost: number;
  returnedItems?: ArchivedLine[];
  createdAt: string;
  deletedAt?: string | null;
  deletedByName?: string | null;
}

function archivedBy(name?: string | null, at?: string | null) {
  const who = name || "Unknown user";
  if (!at) return who;
  return `${who} · ${format(new Date(at), "MMM d, yyyy h:mm a")}`;
}

export default function ArchivePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ArchivedProduct[]>([]);
  const [deliveries, setDeliveries] = useState<ArchivedDelivery[]>([]);
  const [returns, setReturns] = useState<ArchivedReturn[]>([]);
  const [view, setView] = useState<
    | { kind: "delivery"; record: ArchivedDelivery }
    | { kind: "return"; record: ArchivedReturn }
    | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<
    { kind: ArchiveKind; id: string; label: string } | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (user?.role !== "ADMIN") {
        router.replace("/");
        return;
      }
    } catch {
      router.replace("/");
      return;
    }
    setAllowed(true);
    loadArchive();
  }, [router]);

  async function loadArchive() {
    try {
      setLoading(true);
      const [productRows, deliveryRows, returnRows] = await Promise.all([
        apiClient.getProducts({ archived: true }),
        apiClient.getInventoryDeliveries({ archived: true }),
        apiClient.getInventoryReturns({ archived: true }),
      ]);
      setProducts(productRows || []);
      setDeliveries(deliveryRows || []);
      setReturns(returnRows || []);
    } catch (error) {
      showErrorFromException(error, "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }

  async function restore(kind: ArchiveKind, id: string) {
    try {
      setBusyId(id);
      if (kind === "product") await apiClient.restoreProduct(id);
      if (kind === "delivery") await apiClient.restoreInventoryDelivery(id);
      if (kind === "return") await apiClient.restoreInventoryReturn(id);
      showSuccessToast("Restored");
      await loadArchive();
    } catch (error) {
      showErrorFromException(error, "Failed to restore");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmPermanentDelete() {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    try {
      setBusyId(id);
      if (kind === "product") await apiClient.permanentlyDeleteProduct(id);
      if (kind === "delivery") await apiClient.permanentlyDeleteInventoryDelivery(id);
      if (kind === "return") await apiClient.permanentlyDeleteInventoryReturn(id);
      showSuccessToast("Permanently deleted");
      setPendingDelete(null);
      setView(null);
      await loadArchive();
    } catch (error) {
      showErrorFromException(error, "Failed to permanently delete");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Archive</CardTitle>
          <CardDescription>
            Archived products, deliveries, and returns stay here with the name
            of the person who archived them. Restore puts a record back.
            Permanent delete removes it for good.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
              <TabsTrigger value="deliveries">
                Deliveries ({deliveries.length})
              </TabsTrigger>
              <TabsTrigger value="returns">Returns ({returns.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="pt-4">
              <ArchiveTable
                empty="No archived products"
                headers={["Product", "SKU", "Stock", "Archived by", ""]}
                rows={products.map((product) => ({
                  id: product.id,
                  cells: [
                    product.name,
                    product.sku,
                    formatStockQuantity(product),
                    archivedBy(product.deletedByName, product.deletedAt),
                  ],
                  actions: (
                    <RowActions
                      busy={busyId === product.id}
                      onRestore={() => restore("product", product.id)}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "product",
                          id: product.id,
                          label: product.name,
                        })
                      }
                    />
                  ),
                }))}
              />
            </TabsContent>

            <TabsContent value="deliveries" className="pt-4">
              <ArchiveTable
                empty="No archived deliveries"
                headers={["Supplier", "Invoice", "Date", "Total", "Archived by", ""]}
                rows={deliveries.map((delivery) => ({
                  id: delivery.id,
                  onClick: () => setView({ kind: "delivery", record: delivery }),
                  cells: [
                    delivery.supplier,
                    delivery.invoiceNumber || "—",
                    format(new Date(delivery.deliveryDate), "MMM d, yyyy"),
                    `₱${Number(delivery.totalCost || 0).toFixed(2)}`,
                    archivedBy(delivery.deletedByName, delivery.deletedAt),
                  ],
                  actions: (
                    <RowActions
                      busy={busyId === delivery.id}
                      onRestore={() => restore("delivery", delivery.id)}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "delivery",
                          id: delivery.id,
                          label: delivery.supplier,
                        })
                      }
                    />
                  ),
                }))}
              />
            </TabsContent>

            <TabsContent value="returns" className="pt-4">
              <ArchiveTable
                empty="No archived returns"
                headers={["Supplier", "Reason", "Total", "Archived by", ""]}
                rows={returns.map((inventoryReturn) => ({
                  id: inventoryReturn.id,
                  onClick: () => setView({ kind: "return", record: inventoryReturn }),
                  cells: [
                    inventoryReturn.supplier,
                    inventoryReturn.reason || "—",
                    `₱${Number(inventoryReturn.returnedTotalCost || 0).toFixed(2)}`,
                    archivedBy(inventoryReturn.deletedByName, inventoryReturn.deletedAt),
                  ],
                  actions: (
                    <RowActions
                      busy={busyId === inventoryReturn.id}
                      onRestore={() => restore("return", inventoryReturn.id)}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "return",
                          id: inventoryReturn.id,
                          label: inventoryReturn.supplier,
                        })
                      }
                    />
                  ),
                }))}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={(open) => !open && setView(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {view?.kind === "delivery" ? "Archived delivery" : "Archived return"}
            </DialogTitle>
            <DialogDescription>
              {view
                ? archivedBy(
                    view.record.deletedByName,
                    view.record.deletedAt,
                  )
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(view?.kind === "delivery"
                  ? view.record.items
                  : view?.record.returnedItems
                )?.map((item, index) => (
                  <TableRow key={`${item.productId}-${index}`}>
                    <TableCell>
                      {item.productName}
                      {item.productDeleted && (
                        <Badge variant="destructive" className="ml-2">
                          Deleted
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {pendingDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "product" &&
                "This removes the product for good. It fails if the product is still used by an order or another record."}
              {pendingDelete?.kind === "delivery" &&
                "This removes the delivery and reverses any stock it added. It also drops out of Financials."}
              {pendingDelete?.kind === "return" &&
                "This removes the return and reverses the stock it changed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermanentDelete}>
              Permanently delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  busy,
  onRestore,
  onDelete,
}: {
  busy: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <Button variant="outline" size="sm" disabled={busy} onClick={onRestore}>
        Restore
      </Button>
      <Button variant="destructive" size="sm" disabled={busy} onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}

function ArchiveTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  empty: string;
  rows: Array<{
    id: string;
    cells: string[];
    actions: ReactNode;
    onClick?: () => void;
  }>;
}) {
  return (
    <div className="max-h-[600px] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className={header === "" ? "text-right" : undefined}>
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.onClick ? "cursor-pointer" : undefined}
                onClick={row.onClick}
              >
                {row.cells.map((cell, index) => (
                  <TableCell key={index} className={index === 0 ? "font-medium" : undefined}>
                    {cell}
                  </TableCell>
                ))}
                <TableCell className="text-right">{row.actions}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
