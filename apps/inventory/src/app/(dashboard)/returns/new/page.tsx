"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  showSuccessToast,
  showErrorFromException,
  showErrorToast,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import { IconPlus, IconArrowLeft } from "@tabler/icons-react";
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

export default function NewInventoryReturnPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ReturnItemProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<InventoryDelivery[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [isCreateSupplierDialogOpen, setIsCreateSupplierDialogOpen] =
    useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    name: "",
    contactNumber: "",
    email: "",
  });

  const [formData, setFormData] = useState({
    supplierId: "",
    deliveryId: "",
    reason: "",
    notes: "",
  });
  const [returnedItems, setReturnedItems] = useState<ReturnLineItem[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchDeliveries();
  }, []);

  async function fetchProducts() {
    try {
      const data = await apiClient.getProducts();
      setProducts(data);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("products"));
    }
  }

  async function fetchSuppliers() {
    try {
      const data = await apiClient.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("suppliers"));
    }
  }

  async function fetchDeliveries() {
    try {
      const data = await apiClient.getInventoryDeliveries();
      setDeliveries(data);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("deliveries"));
    }
  }

  function resetSupplierForm() {
    setSupplierFormData({ name: "", contactNumber: "", email: "" });
  }

  async function handleCreateSupplier() {
    if (!supplierFormData.name.trim()) {
      showErrorToast("Please enter a supplier name");
      return;
    }
    try {
      const savedSupplier = await apiClient.createSupplier(supplierFormData);
      showSuccessToast(SUCCESS_MESSAGES.CREATED("Supplier"));
      await fetchSuppliers();
      setFormData((prev) => ({ ...prev, supplierId: savedSupplier.id }));
      setIsCreateSupplierDialogOpen(false);
      resetSupplierForm();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("supplier"));
    }
  }

  // Only deliveries from the currently selected supplier make sense to link
  // a return to, so switching supplier clears any stale delivery selection.
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
      await apiClient.createInventoryReturn({
        supplierId: formData.supplierId,
        deliveryId: formData.deliveryId || undefined,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
        returnedItems,
      });
      showSuccessToast(SUCCESS_MESSAGES.CREATED("Return"));
      router.push("/returns");
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("return"));
    } finally {
      setSubmitting(false);
    }
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
          <CardTitle>New Return</CardTitle>
          <CardDescription>
            Record items being sent back to a supplier. Stock is deducted for
            these items immediately and stays deducted until the return is
            marked resolved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.supplierId}
                  onValueChange={handleSupplierChange}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No suppliers yet
                      </div>
                    ) : (
                      suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCreateSupplierDialogOpen(true)}
                  title="Add new supplier"
                >
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
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
                  <SelectValue
                    placeholder={
                      formData.supplierId
                        ? "Not linked to a specific delivery"
                        : "Select a supplier first"
                    }
                  />
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
              {submitting ? "Creating..." : "Create Return"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create New Supplier Dialog */}
      <Dialog
        open={isCreateSupplierDialogOpen}
        onOpenChange={setIsCreateSupplierDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>
              Quickly add a supplier without leaving this page. You can fill
              in more details later from the Suppliers page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supplier Name *</Label>
              <Input
                value={supplierFormData.name}
                onChange={(e) =>
                  setSupplierFormData({
                    ...supplierFormData,
                    name: e.target.value,
                  })
                }
                placeholder="Enter supplier name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input
                value={supplierFormData.contactNumber}
                onChange={(e) =>
                  setSupplierFormData({
                    ...supplierFormData,
                    contactNumber: e.target.value,
                  })
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={supplierFormData.email}
                onChange={(e) =>
                  setSupplierFormData({
                    ...supplierFormData,
                    email: e.target.value,
                  })
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateSupplierDialogOpen(false);
                resetSupplierForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSupplier}>Add Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
