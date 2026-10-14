"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { visibleEditHistory } from "@/lib/edit-history";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showErrorFromException, showSuccessToast } from "@/lib/toast-utils";

interface ProductEdit {
  editedAt: string;
  editedByName?: string;
  changes?: Array<{ label: string; from: string; to: string }>;
}

interface DeliveryEdit {
  editedAt: string;
  editedByName?: string;
  added?: Array<{ productName: string; quantity: number }>;
  removed?: Array<{ productName: string; quantity: number }>;
  changed?: Array<{
    productName: string;
    previousQuantity: number;
    quantity: number;
  }>;
}

interface EditedProduct {
  id: string;
  name: string;
  sku?: string;
  editHistory?: ProductEdit[] | null;
  editHistoryDismissedAt?: string | null;
}

interface EditedDelivery {
  id: string;
  supplier: string;
  invoiceNumber?: string;
  editHistory?: DeliveryEdit[] | null;
  editHistoryDismissedAt?: string | null;
}

function latest<T extends { editedAt: string }>(entries: T[]) {
  return [...entries].sort((a, b) => (a.editedAt < b.editedAt ? 1 : -1))[0];
}

function productSummary(entry: ProductEdit) {
  return (entry.changes || [])
    .map((change) => `${change.label} ${change.from} → ${change.to}`)
    .join("; ");
}

function deliverySummary(entry: DeliveryEdit) {
  const lines = [
    ...(entry.added || []).map((item) => `Added ${item.productName} × ${item.quantity}`),
    ...(entry.removed || []).map((item) => `Removed ${item.productName} × ${item.quantity}`),
    ...(entry.changed || []).map(
      (item) => `${item.productName} ${item.previousQuantity} → ${item.quantity}`,
    ),
  ];
  return lines.join("; ");
}

export default function EditsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<EditedProduct[]>([]);
  const [deliveries, setDeliveries] = useState<EditedDelivery[]>([]);
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
    loadEdits();
  }, [router]);

  async function loadEdits() {
    try {
      setLoading(true);
      const [productRows, deliveryRows] = await Promise.all([
        apiClient.getProducts(),
        apiClient.getInventoryDeliveries(),
      ]);
      setProducts(
        (productRows || []).filter(
          (product: EditedProduct) =>
            visibleEditHistory(product.editHistory, product.editHistoryDismissedAt)
              .length > 0,
        ),
      );
      setDeliveries(
        (deliveryRows || []).filter(
          (delivery: EditedDelivery) =>
            visibleEditHistory(delivery.editHistory, delivery.editHistoryDismissedAt)
              .length > 0,
        ),
      );
    } catch (error) {
      showErrorFromException(error, "Failed to load edits");
    } finally {
      setLoading(false);
    }
  }

  async function dismissProduct(id: string) {
    try {
      setBusyId(id);
      await apiClient.dismissProductEdits(id);
      showSuccessToast("Edit dismissed");
      await loadEdits();
    } catch (error) {
      showErrorFromException(error, "Failed to dismiss edit");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissDelivery(id: string) {
    try {
      setBusyId(id);
      await apiClient.dismissDeliveryEdits(id);
      showSuccessToast("Edit dismissed");
      await loadEdits();
    } catch (error) {
      showErrorFromException(error, "Failed to dismiss edit");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissAll(
    kind: "product" | "delivery",
    ids: string[],
  ) {
    if (ids.length === 0) return;
    try {
      setBusyId("all");
      await Promise.all(
        ids.map((id) =>
          kind === "product"
            ? apiClient.dismissProductEdits(id)
            : apiClient.dismissDeliveryEdits(id),
        ),
      );
      showSuccessToast("Edits dismissed");
      await loadEdits();
    } catch (error) {
      showErrorFromException(error, "Failed to dismiss edits");
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
          <CardTitle>Edited records</CardTitle>
          <CardDescription>
            Products and deliveries that still show Edited. Dismissing one
            removes that label. A later change shows it again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
              <TabsTrigger value="deliveries">
                Deliveries ({deliveries.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-3 pt-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={products.length === 0 || busyId === "all"}
                  onClick={() =>
                    dismissAll(
                      "product",
                      products.map((product) => product.id),
                    )
                  }
                >
                  Dismiss all products
                </Button>
              </div>
              <EditTable
                empty="No products are marked Edited"
                rows={products.map((product) => {
                  const edits = visibleEditHistory(
                    product.editHistory,
                    product.editHistoryDismissedAt,
                  );
                  const entry = latest(edits);
                  return {
                    id: product.id,
                    title: product.name,
                    detail: product.sku || "—",
                    when: entry
                      ? `${entry.editedByName || "Unknown user"} · ${format(new Date(entry.editedAt), "MMM d, yyyy h:mm a")}`
                      : "—",
                    summary: entry ? productSummary(entry) : "—",
                    count: edits.length,
                    onOpen: () => router.push(`/products?edit=${product.id}`),
                    onDismiss: () => dismissProduct(product.id),
                  };
                })}
                busyId={busyId}
              />
            </TabsContent>

            <TabsContent value="deliveries" className="space-y-3 pt-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deliveries.length === 0 || busyId === "all"}
                  onClick={() =>
                    dismissAll(
                      "delivery",
                      deliveries.map((delivery) => delivery.id),
                    )
                  }
                >
                  Dismiss all deliveries
                </Button>
              </div>
              <EditTable
                empty="No deliveries are marked Edited"
                rows={deliveries.map((delivery) => {
                  const edits = visibleEditHistory(
                    delivery.editHistory,
                    delivery.editHistoryDismissedAt,
                  );
                  const entry = latest(edits);
                  return {
                    id: delivery.id,
                    title: delivery.supplier,
                    detail: delivery.invoiceNumber || "—",
                    when: entry
                      ? `${entry.editedByName || "Unknown user"} · ${format(new Date(entry.editedAt), "MMM d, yyyy h:mm a")}`
                      : "—",
                    summary: entry ? deliverySummary(entry) : "—",
                    count: edits.length,
                    onOpen: () => router.push(`/deliveries/${delivery.id}/edit`),
                    onDismiss: () => dismissDelivery(delivery.id),
                  };
                })}
                busyId={busyId}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function EditTable({
  rows,
  empty,
  busyId,
}: {
  empty: string;
  busyId: string | null;
  rows: Array<{
    id: string;
    title: string;
    detail: string;
    when: string;
    summary: string;
    count: number;
    onOpen: () => void;
    onDismiss: () => void;
  }>;
}) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Record</TableHead>
            <TableHead>Latest edit</TableHead>
            <TableHead>Changes</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={row.onOpen}
              >
                <TableCell className="font-medium">
                  {row.title}
                  <div className="text-xs text-muted-foreground">{row.detail}</div>
                </TableCell>
                <TableCell>
                  {row.when}
                  <div className="text-xs text-muted-foreground">
                    {row.count} edit{row.count === 1 ? "" : "s"}
                  </div>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal">{row.summary}</TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === row.id || busyId === "all"}
                    onClick={row.onDismiss}
                  >
                    Dismiss
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
