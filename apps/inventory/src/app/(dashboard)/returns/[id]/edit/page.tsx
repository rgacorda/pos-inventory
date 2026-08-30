"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  showSuccessToast,
  showErrorFromException,
  showErrorToast,
  showWarningToast,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import { IconArrowLeft } from "@tabler/icons-react";
import { format } from "date-fns";
import {
  ReturnItemsEditor,
  ReturnItemProduct,
  ReturnLineItem,
  QuickAddSource,
} from "@/components/returns/return-items-editor";

interface Supplier {
  id: string;
  name: string;
}

interface DeliveryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

interface InventoryDelivery {
  id: string;
  supplier: string;
  supplierId?: string | null;
  deliveryDate: string;
  invoiceNumber?: string;
  totalCost: number;
  items: DeliveryItem[];
}

const REASON_SUGGESTIONS = [
  "Damaged",
  "Expired",
  "Wrong Item",
  "Excess Stock",
  "Quality Issue",
];

export default function EditInventoryReturnPage() {
  const router = useRouter();
  const params = useParams();
  const returnId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<ReturnItemProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<InventoryDelivery[]>([]);

  const [formData, setFormData] = useState({
    supplierId: "",
    deliveryId: "",
    reason: "",
    notes: "",
  });
  const [returnedItems, setReturnedItems] = useState<ReturnLineItem[]>([]);

  useEffect(() => {
    loadData();
  }, [returnId]);

  async function loadData() {
    try {
      setLoading(true);
      const [inventoryReturn, productsData, suppliersData, deliveriesData] =
        await Promise.all([
          apiClient.getInventoryReturn(returnId),
          apiClient.getProducts(),
          apiClient.getSuppliers(),
          apiClient.getInventoryDeliveries(),
        ]);

      if (inventoryReturn.status === "RESOLVED") {
        showWarningToast("Resolved returns cannot be edited", {
          description: "Unresolve it first from the Returns list to make changes.",
        });
        router.push("/returns");
        return;
      }

      setProducts(productsData);
      setSuppliers(suppliersData);
      setDeliveries(deliveriesData);
      setFormData({
        supplierId: inventoryReturn.supplierId || "",
        deliveryId: inventoryReturn.deliveryId || "",
        reason: inventoryReturn.reason || "",
        notes: inventoryReturn.notes || "",
      });
      setReturnedItems(inventoryReturn.returnedItems || []);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("return"));
      router.push("/returns");
    } finally {
      setLoading(false);
    }
  }

  const deliveriesForSupplier = useMemo(
    () =>
      formData.supplierId
        ? deliveries.filter((d) => d.supplierId === formData.supplierId)
        : [],
    [deliveries, formData.supplierId],
  );

  const selectedDelivery = deliveries.find((d) => d.id === formData.deliveryId);

  const quickAddSource: QuickAddSource[] = useMemo(() => {
    if (!selectedDelivery) return [];
    return selectedDelivery.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitCost: item.unitCost,
    }));
  }, [selectedDelivery]);

  function handleSupplierChange(supplierId: string) {
    setFormData((prev) => ({ ...prev, supplierId, deliveryId: "" }));
  }

  const currentSupplierName = suppliers.find(
    (s) => s.id === formData.supplierId,
  )?.name;

  async function handleSubmit() {
    if (!formData.supplierId) {
      showErrorToast("Please select a supplier");
      return;
    }
    if (returnedItems.length === 0) {
      showErrorToast("Please add at least one item to return");
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.updateInventoryReturn(returnId, {
        supplierId: formData.supplierId,
        deliveryId: formData.deliveryId || null,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
        returnedItems,
      });
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Return"));
      router.push("/returns");
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("return"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/returns")}>
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back to Returns
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Return</CardTitle>
          <CardDescription>
            Update the items being sent back to the supplier. Stock is
            adjusted automatically by the change in quantities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select
                value={formData.supplierId}
                onValueChange={handleSupplierChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linked Delivery (optional)</Label>
              <Select
                value={formData.deliveryId || "NONE"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    deliveryId: value === "NONE" ? "" : value,
                  }))
                }
                disabled={!formData.supplierId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not linked to a specific delivery" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">
                    Not linked to a specific delivery
                  </SelectItem>
                  {deliveriesForSupplier.map((delivery) => (
                    <SelectItem key={delivery.id} value={delivery.id}>
                      {format(new Date(delivery.deliveryDate), "MMM d, yyyy")}
                      {" • "}
                      {delivery.invoiceNumber || "No invoice #"}
                      {" • "}₱{Number(delivery.totalCost || 0).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={formData.reason}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="e.g. Damaged, Expired, Wrong Item"
                list="return-reason-suggestions"
              />
              <datalist id="return-reason-suggestions">
                {REASON_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <Label className="text-lg font-semibold">Returned Items</Label>
            <ReturnItemsEditor
              products={products}
              items={returnedItems}
              onItemsChange={setReturnedItems}
              supplierId={formData.supplierId || undefined}
              supplierName={currentSupplierName}
              quickAddSource={quickAddSource}
              quickAddLabel={
                selectedDelivery
                  ? "Quick add from linked delivery"
                  : undefined
              }
              stockEffect="deduct"
              itemNounSingular="returned item"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Optional notes"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => router.push("/returns")}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
