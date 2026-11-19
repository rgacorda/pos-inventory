"use client";

import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { formatStockQuantity } from "@pos/shared-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
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
import {
  showErrorFromException,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/toast-utils";

type ArchiveKind = "product" | "delivery" | "return";
type BulkAction = "restore" | "delete";

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

function countPhrase(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function errorText(error: unknown) {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) return message.map(String).join(", ");
  if (typeof message === "string" && message.trim()) return message;
  if (error instanceof Error && error.message) return error.message;
  return "Request failed";
}

export function ArchivePanel() {
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
  const [pendingBulk, setPendingBulk] = useState<BulkAction | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadArchive();
  }, []);

  async function loadArchive(silent = false) {
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }

  async function restore(kind: ArchiveKind, id: string) {
    try {
      setBusyId(id);
      if (kind === "product") await apiClient.restoreProduct(id);
      if (kind === "delivery") await apiClient.restoreInventoryDelivery(id);
      if (kind === "return") await apiClient.restoreInventoryReturn(id);
      showSuccessToast("Restored");
      await loadArchive(true);
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
      await loadArchive(true);
    } catch (error) {
      showErrorFromException(error, "Failed to permanently delete");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmBulk() {
    if (!pendingBulk || bulkBusy) return;
    const action = pendingBulk;
    const jobs: Array<{ label: string; run: () => Promise<unknown> }> = [];
    const add = (
      rows: Array<{ id: string; label: string }>,
      run: (id: string) => Promise<unknown>,
    ) => {
      for (const row of rows) {
        jobs.push({ label: row.label, run: () => run(row.id) });
      }
    };

    const productRows = products.map((product) => ({
      id: product.id,
      label: product.name,
    }));
    const deliveryRows = deliveries.map((delivery) => ({
      id: delivery.id,
      label: delivery.invoiceNumber
        ? `${delivery.supplier} (${delivery.invoiceNumber})`
        : delivery.supplier,
    }));
    const returnRows = returns.map((inventoryReturn) => ({
      id: inventoryReturn.id,
      label: inventoryReturn.reason
        ? `${inventoryReturn.supplier} (${inventoryReturn.reason})`
        : inventoryReturn.supplier,
    }));

    if (action === "restore") {
      add(productRows, (id) => apiClient.restoreProduct(id));
      add(deliveryRows, (id) => apiClient.restoreInventoryDelivery(id));
      add(returnRows, (id) => apiClient.restoreInventoryReturn(id));
    } else {
      // Deliveries and returns reverse stock. Clear those before products
      // so a product still referenced by an archived record is tried last.
      add(deliveryRows, (id) => apiClient.permanentlyDeleteInventoryDelivery(id));
      add(returnRows, (id) => apiClient.permanentlyDeleteInventoryReturn(id));
      add(productRows, (id) => apiClient.permanentlyDeleteProduct(id));
    }

    if (jobs.length === 0) {
      setPendingBulk(null);
      return;
    }

    setBulkBusy(true);
    setBulkProgress({ done: 0, total: jobs.length });
    const failures: string[] = [];
    for (let index = 0; index < jobs.length; index += 1) {
      try {
        await jobs[index].run();
      } catch (error) {
        failures.push(`${jobs[index].label}: ${errorText(error)}`);
      }
      setBulkProgress({ done: index + 1, total: jobs.length });
    }

    const succeeded = jobs.length - failures.length;
    const verb = action === "restore" ? "Restored" : "Permanently deleted";
    if (failures.length === 0) {
      showSuccessToast(
        `${verb} ${countPhrase(succeeded, "archived record", "archived records")}`,
      );
    } else if (succeeded === 0) {
      showErrorToast(
        action === "restore" ? "Failed to restore archive" : "Failed to delete archive",
        { description: failures.slice(0, 3).join(" "), duration: 6000 },
      );
    } else {
      showWarningToast(`${verb} ${succeeded} of ${jobs.length}`, {
        description: failures.slice(0, 3).join(" "),
        duration: 6000,
      });
    }

    setBulkBusy(false);
    setBulkProgress(null);
    setPendingBulk(null);
    setView(null);
    await loadArchive(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const archivedTotal = products.length + deliveries.length + returns.length;
  const archivedSummary = [
    products.length ? countPhrase(products.length, "product", "products") : "",
    deliveries.length
      ? countPhrase(deliveries.length, "delivery", "deliveries")
      : "",
    returns.length ? countPhrase(returns.length, "return", "returns") : "",
  ]
    .filter(Boolean)
    .join(", ");
  const actionsLocked = bulkBusy || !!busyId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Archive</CardTitle>
          <CardDescription>
            Archived products, deliveries, and returns stay here with the name
            of the person who archived them. Restore puts a record back.
            Permanent delete removes it for good. Restore all and Delete all
            cover every record in this archive.
          </CardDescription>
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={archivedTotal === 0 || actionsLocked}
              onClick={() => setPendingBulk("restore")}
            >
              Restore all
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={archivedTotal === 0 || actionsLocked}
              onClick={() => setPendingBulk("delete")}
            >
              Delete all
            </Button>
          </CardAction>
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
                      busy={busyId === product.id || bulkBusy}
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
                      busy={busyId === delivery.id || bulkBusy}
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
                      busy={busyId === inventoryReturn.id || bulkBusy}
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

      <AlertDialog
        open={!!pendingBulk}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) setPendingBulk(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingBulk === "restore"
                ? "Restore the whole archive?"
                : "Permanently delete the whole archive?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBulk === "restore"
                ? `This puts ${archivedSummary} back.`
                : `This permanently deletes ${archivedSummary}. Deliveries reverse the stock they added, and returns reverse the stock they changed. A product still used by an order or another record stays archived.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingBulk === "delete" ? "destructive" : "default"}
              disabled={bulkBusy}
              onClick={(event) => {
                event.preventDefault();
                void confirmBulk();
              }}
            >
              {bulkBusy && bulkProgress
                ? `${pendingBulk === "restore" ? "Restoring" : "Deleting"} ${bulkProgress.done} of ${bulkProgress.total}`
                : pendingBulk === "restore"
                  ? "Restore all"
                  : "Delete all"}
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
