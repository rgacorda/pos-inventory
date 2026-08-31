"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import {
  IconBuildingStore,
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconEye,
  IconEyeOff,
  IconPackage,
  IconCash,
  IconTruck,
} from "@tabler/icons-react";

interface Supplier {
  id: string;
  name: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  website?: string;
  websiteUsername?: string;
  websitePassword?: string;
  notes?: string;
  totalIncentiveGiven?: number;
  lastIncentiveDate?: string | null;
  createdAt: string;
}

interface SupplierIncentive {
  id: string;
  amount: number;
  incentiveDate: string;
  notes?: string;
  createdAt: string;
}

interface SupplierProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost?: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  status: string;
  packQuantity?: number;
  halfPackQuantity?: number;
}

type QuantityType = "UNIT" | "PACK" | "HALF_PACK";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});

  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false);
  const [productsSupplier, setProductsSupplier] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loadingSupplierProducts, setLoadingSupplierProducts] = useState(false);
  const [isSelectingForDelivery, setIsSelectingForDelivery] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<string, string>>({});
  const [productQuantityTypes, setProductQuantityTypes] = useState<Record<string, QuantityType>>({});
  const [submittingPendingDelivery, setSubmittingPendingDelivery] = useState(false);

  const [isIncentiveDialogOpen, setIsIncentiveDialogOpen] = useState(false);
  const [incentiveSupplier, setIncentiveSupplier] = useState<Supplier | null>(null);
  const [incentiveFormData, setIncentiveFormData] = useState({
    amount: "",
    incentiveDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [incentiveHistory, setIncentiveHistory] = useState<SupplierIncentive[]>([]);
  const [loadingIncentiveHistory, setLoadingIncentiveHistory] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    contactNumber: "",
    email: "",
    address: "",
    website: "",
    websiteUsername: "",
    websitePassword: "",
    notes: "",
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      showErrorFromException(error, "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = () => {
    setFormData({
      name: "",
      contactNumber: "",
      email: "",
      address: "",
      website: "",
      websiteUsername: "",
      websitePassword: "",
      notes: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactNumber: supplier.contactNumber || "",
      email: supplier.email || "",
      address: supplier.address || "",
      website: supplier.website || "",
      websiteUsername: supplier.websiteUsername || "",
      websitePassword: supplier.websitePassword || "",
      notes: supplier.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteDialog(true);
  };

  const handleRecordIncentive = async (supplier: Supplier) => {
    setIncentiveSupplier(supplier);
    setIncentiveFormData({
      amount: "",
      incentiveDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setIsIncentiveDialogOpen(true);
    setLoadingIncentiveHistory(true);
    try {
      const history = await apiClient.getSupplierIncentives(supplier.id);
      setIncentiveHistory(history);
    } catch (error) {
      showErrorFromException(error, "Failed to load incentive history");
      setIncentiveHistory([]);
    } finally {
      setLoadingIncentiveHistory(false);
    }
  };

  const handleSubmitIncentive = async () => {
    if (!incentiveSupplier) return;

    const amount = parseFloat(incentiveFormData.amount);
    if (!amount || amount <= 0) {
      showErrorFromException(new Error("Amount must be greater than zero"), "Validation Error");
      return;
    }
    if (!incentiveFormData.incentiveDate) {
      showErrorFromException(new Error("Date is required"), "Validation Error");
      return;
    }

    try {
      await apiClient.recordSupplierIncentive(incentiveSupplier.id, {
        amount,
        incentiveDate: incentiveFormData.incentiveDate,
        notes: incentiveFormData.notes || undefined,
      });
      showSuccessToast(SUCCESS_MESSAGES.ADDED("Incentive"));
      setIsIncentiveDialogOpen(false);
      setIncentiveSupplier(null);
      loadSuppliers();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.SAVE_FAILED("incentive"));
    }
  };

  const resetDeliverySelection = () => {
    setIsSelectingForDelivery(false);
    setSelectedProductIds([]);
    setProductQuantities({});
    setProductQuantityTypes({});
  };

  const getDefaultQuantityType = (product: SupplierProduct): QuantityType =>
    product.packQuantity ? "PACK" : "UNIT";

  const getUnitMultiplier = (type: QuantityType, product: SupplierProduct) => {
    if (type === "PACK") return product.packQuantity || 1;
    if (type === "HALF_PACK") return product.halfPackQuantity || 1;
    return 1;
  };

  const ensureQuantityDefaults = (product: SupplierProduct) => {
    setProductQuantities((prev) =>
      prev[product.id] ? prev : { ...prev, [product.id]: "1" },
    );
    setProductQuantityTypes((prev) =>
      prev[product.id] ? prev : { ...prev, [product.id]: getDefaultQuantityType(product) },
    );
  };

  const handleViewSupplierProducts = async (supplier: Supplier) => {
    setProductsSupplier(supplier);
    setIsProductsDialogOpen(true);
    resetDeliverySelection();
    setLoadingSupplierProducts(true);
    try {
      const data = await apiClient.getProducts({ supplierId: supplier.id });
      const sorted = [...data].sort(
        (a: SupplierProduct, b: SupplierProduct) => a.stockQuantity - b.stockQuantity
      );
      setSupplierProducts(sorted);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("products"));
      setSupplierProducts([]);
    } finally {
      setLoadingSupplierProducts(false);
    }
  };

  const toggleProductSelection = (productId: string, checked?: boolean) => {
    const product = supplierProducts.find((item) => item.id === productId);
    setSelectedProductIds((prev) => {
      const isSelected = prev.includes(productId);
      const shouldSelect = checked ?? !isSelected;
      if (shouldSelect && !isSelected) {
        return [...prev, productId];
      }
      if (!shouldSelect && isSelected) {
        return prev.filter((id) => id !== productId);
      }
      return prev;
    });
    if (product) {
      ensureQuantityDefaults(product);
    }
  };

  const toggleSelectAllProducts = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(supplierProducts.map((product) => product.id));
      setProductQuantities((prev) => {
        const next = { ...prev };
        for (const product of supplierProducts) {
          if (!next[product.id]) next[product.id] = "1";
        }
        return next;
      });
      setProductQuantityTypes((prev) => {
        const next = { ...prev };
        for (const product of supplierProducts) {
          if (!next[product.id]) next[product.id] = getDefaultQuantityType(product);
        }
        return next;
      });
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleCreatePendingDelivery = async () => {
    if (!productsSupplier) return;

    const selected = supplierProducts.filter((product) =>
      selectedProductIds.includes(product.id),
    );
    if (selected.length === 0) {
      showErrorFromException(
        new Error("Select at least one product"),
        "Validation Error",
      );
      return;
    }

    const items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      packInfo?: {
        type: "PACK" | "HALF_PACK";
        packs: number;
        unitsPerPack: number;
      };
    }> = [];

    for (const product of selected) {
      const enteredQuantity = parseFloat(productQuantities[product.id] || "0");
      if (!enteredQuantity || enteredQuantity <= 0) {
        showErrorFromException(
          new Error(`Enter a quantity greater than zero for ${product.name}`),
          "Validation Error",
        );
        return;
      }

      const quantityType = productQuantityTypes[product.id] || getDefaultQuantityType(product);
      if (quantityType === "PACK" && !product.packQuantity) {
        showErrorFromException(
          new Error(`${product.name} has no pack size configured`),
          "Validation Error",
        );
        return;
      }
      if (quantityType === "HALF_PACK" && !product.halfPackQuantity) {
        showErrorFromException(
          new Error(`${product.name} has no half-pack size configured`),
          "Validation Error",
        );
        return;
      }

      const multiplier = getUnitMultiplier(quantityType, product);
      const totalUnits = enteredQuantity * multiplier;
      const unitCost = Number(product.cost) || 0;
      items.push({
        productId: product.id,
        productName: product.name,
        quantity: totalUnits,
        unitCost,
        totalCost: totalUnits * unitCost,
        ...(quantityType !== "UNIT" && {
          packInfo: {
            type: quantityType,
            packs: enteredQuantity,
            unitsPerPack: multiplier,
          },
        }),
      });
    }

    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);

    try {
      setSubmittingPendingDelivery(true);
      await apiClient.createInventoryDelivery({
        supplierId: productsSupplier.id,
        deliveryDate: new Date().toISOString(),
        totalCost,
        discountAmount: 0,
        items,
        status: "PENDING",
        notes: `Queued from ${productsSupplier.name} product list`,
      });
      showSuccessToast(SUCCESS_MESSAGES.CREATED("Pending delivery"), {
        description: "Open Deliveries and use the check mark to receive it when it arrives.",
      });
      resetDeliverySelection();
      setIsProductsDialogOpen(false);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("delivery"));
    } finally {
      setSubmittingPendingDelivery(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!formData.name) {
      showErrorFromException(new Error("Supplier name is required"), "Validation Error");
      return;
    }

    try {
      await apiClient.createSupplier(formData);
      showSuccessToast(SUCCESS_MESSAGES.ADDED("Supplier"));
      setIsAddDialogOpen(false);
      loadSuppliers();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.SAVE_FAILED("supplier"));
    }
  };

  const handleUpdateSupplier = async () => {
    if (!selectedSupplier) return;

    try {
      await apiClient.updateSupplier(selectedSupplier.id, formData);
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Supplier"));
      setIsEditDialogOpen(false);
      setSelectedSupplier(null);
      loadSuppliers();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("supplier"));
    }
  };

  const confirmDelete = async () => {
    if (!selectedSupplier) return;

    try {
      await apiClient.deleteSupplier(selectedSupplier.id);
      showSuccessToast(SUCCESS_MESSAGES.DELETED("Supplier"));
      setShowDeleteDialog(false);
      setSelectedSupplier(null);
      loadSuppliers();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("supplier"));
    }
  };

  const togglePasswordVisibility = (supplierId: string) => {
    setShowPassword(prev => ({
      ...prev,
      [supplierId]: !prev[supplierId]
    }));
  };
  // Ensure URL has protocol
  const ensureProtocol = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  const formatCurrency = (value: number) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  // Filter suppliers by search query
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      supplier.name?.toLowerCase().includes(search) ||
      supplier.contactNumber?.toLowerCase().includes(search) ||
      supplier.email?.toLowerCase().includes(search) ||
      supplier.website?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>
                Manage your supplier information and credentials
              </CardDescription>
            </div>
            <Button onClick={handleAddSupplier}>
              <IconPlus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="max-h-[600px] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading suppliers...</div>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <IconBuildingStore className="h-12 w-12 text-muted-foreground mb-4" />
                <div className="text-muted-foreground">
                  {searchQuery ? "No suppliers found" : "No suppliers added yet"}
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="text-right">Total Incentive</TableHead>
                    <TableHead>Last Incentive</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow
                      key={supplier.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewSupplierProducts(supplier)}
                    >
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.contactNumber || "-"}</TableCell>
                      <TableCell>{supplier.email || "-"}</TableCell>
                      <TableCell>
                        {supplier.website ? (
                          <a
                            href={ensureProtocol(supplier.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Visit
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{supplier.websiteUsername || "-"}</TableCell>
                      <TableCell>
                        {supplier.websitePassword ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {showPassword[supplier.id]
                                ? supplier.websitePassword
                                : "••••••••"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePasswordVisibility(supplier.id);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              {showPassword[supplier.id] ? (
                                <IconEyeOff className="h-3 w-3" />
                              ) : (
                                <IconEye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(supplier.totalIncentiveGiven || 0))}
                      </TableCell>
                      <TableCell>
                        {supplier.lastIncentiveDate
                          ? formatDate(supplier.lastIncentiveDate)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Record incentive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecordIncentive(supplier);
                            }}
                          >
                            <IconCash className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSupplier(supplier);
                            }}
                          >
                            <IconEdit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSupplier(supplier);
                            }}
                          >
                            <IconTrash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Supplier Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>
              Enter the supplier information and credentials
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Supplier Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter supplier name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                value={formData.contactNumber}
                onChange={(e) =>
                  setFormData({ ...formData, contactNumber: e.target.value })
                }
                placeholder="Enter contact number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="Enter email address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Enter address"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="websiteUsername">Website Username</Label>
              <Input
                id="websiteUsername"
                value={formData.websiteUsername}
                onChange={(e) =>
                  setFormData({ ...formData, websiteUsername: e.target.value })
                }
                placeholder="Enter website username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="websitePassword">Website Password</Label>
              <Input
                id="websitePassword"
                type="password"
                value={formData.websitePassword}
                onChange={(e) =>
                  setFormData({ ...formData, websitePassword: e.target.value })
                }
                placeholder="Enter website password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes about this supplier"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSupplier}>Add Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>
              Update the supplier information and credentials
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Supplier Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter supplier name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contactNumber">Contact Number</Label>
              <Input
                id="edit-contactNumber"
                value={formData.contactNumber}
                onChange={(e) =>
                  setFormData({ ...formData, contactNumber: e.target.value })
                }
                placeholder="Enter contact number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="Enter email address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Enter address"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-websiteUsername">Website Username</Label>
              <Input
                id="edit-websiteUsername"
                value={formData.websiteUsername}
                onChange={(e) =>
                  setFormData({ ...formData, websiteUsername: e.target.value })
                }
                placeholder="Enter website username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-websitePassword">Website Password</Label>
              <Input
                id="edit-websitePassword"
                type="password"
                value={formData.websitePassword}
                onChange={(e) =>
                  setFormData({ ...formData, websitePassword: e.target.value })
                }
                placeholder="Enter website password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes about this supplier"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSupplier}>Update Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Products Dialog */}
      <Dialog
        open={isProductsDialogOpen}
        onOpenChange={(open) => {
          setIsProductsDialogOpen(open);
          if (!open) resetDeliverySelection();
        }}
      >
        <DialogContent className="!max-w-5xl max-h-[90vh] !overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl">Products from {productsSupplier?.name}</DialogTitle>
            <DialogDescription>
              {isSelectingForDelivery
                ? "Tick products and enter quantities in units or packs. Stock is not updated until the delivery is received."
                : "Sorted by stock quantity, lowest first"}
            </DialogDescription>
          </DialogHeader>

          {loadingSupplierProducts ? (
            <div className="flex min-h-0 flex-1 items-center justify-center py-12">
              <div className="text-muted-foreground">Loading products...</div>
            </div>
          ) : supplierProducts.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-12">
              <IconPackage className="h-12 w-12 text-muted-foreground mb-4" />
              <div className="text-muted-foreground">
                No products linked to this supplier yet
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Products get linked automatically when a delivery from this supplier is received.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {supplierProducts.length} product{supplierProducts.length === 1 ? "" : "s"}
                  {isSelectingForDelivery && selectedProductIds.length > 0
                    ? ` · ${selectedProductIds.length} selected`
                    : ""}
                </p>
                {!isSelectingForDelivery && (
                  <Button size="sm" onClick={() => setIsSelectingForDelivery(true)}>
                    <IconTruck className="mr-2 h-4 w-4" />
                    Add to Pending Delivery
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                    <TableRow>
                      {isSelectingForDelivery && (
                        <TableHead className="w-10 py-3">
                          <Checkbox
                            checked={
                              selectedProductIds.length === supplierProducts.length
                                ? true
                                : selectedProductIds.length > 0
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) =>
                              toggleSelectAllProducts(checked === true)
                            }
                            aria-label="Select all products"
                          />
                        </TableHead>
                      )}
                      <TableHead className="text-base py-3">Product</TableHead>
                      <TableHead className="text-base py-3">SKU</TableHead>
                      <TableHead className="text-right text-base py-3">Price</TableHead>
                      <TableHead className="text-right text-base py-3">Stock Quantity</TableHead>
                      <TableHead className="text-right text-base py-3">Packs Sellable</TableHead>
                      {isSelectingForDelivery && (
                        <TableHead className="text-right text-base py-3 w-56">
                          Quantity
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierProducts.map((product) => {
                      const isLowStock =
                        product.stockQuantity <= (product.lowStockThreshold ?? 10);
                      const packsSellable = product.packQuantity
                        ? Math.floor((Number(product.stockQuantity) || 0) / Number(product.packQuantity))
                        : null;
                      const isSelected = selectedProductIds.includes(product.id);
                      const quantityType =
                        productQuantityTypes[product.id] || getDefaultQuantityType(product);
                      const enteredQuantity = parseFloat(productQuantities[product.id] || "0") || 0;
                      const unitMultiplier = getUnitMultiplier(quantityType, product);
                      const totalUnits = enteredQuantity * unitMultiplier;
                      return (
                        <TableRow
                          key={product.id}
                          className={
                            isSelectingForDelivery
                              ? `cursor-pointer ${isSelected ? "bg-muted/50" : ""}`
                              : undefined
                          }
                          onClick={() => {
                            if (isSelectingForDelivery) {
                              toggleProductSelection(product.id);
                            }
                          }}
                        >
                          {isSelectingForDelivery && (
                            <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  toggleProductSelection(product.id, checked === true)
                                }
                                aria-label={`Select ${product.name}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium py-3">{product.name}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground py-3">
                            {product.sku}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            ₱{Number(product.price || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <span className={isLowStock ? "font-semibold text-red-600" : ""}>
                              {product.stockQuantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-3">
                            {packsSellable !== null ? (
                              <span
                                className={
                                  packsSellable > 0
                                    ? "font-medium text-blue-600"
                                    : "font-medium text-red-600"
                                }
                              >
                                {packsSellable} pack{packsSellable === 1 ? "" : "s"}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          {isSelectingForDelivery && (
                            <TableCell
                              className="text-right py-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={productQuantities[product.id] ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setProductQuantities((prev) => ({
                                      ...prev,
                                      [product.id]: value,
                                    }));
                                    if (!isSelected && Number(value) > 0) {
                                      toggleProductSelection(product.id, true);
                                    }
                                  }}
                                  placeholder="0"
                                  className="h-8 w-20 text-right"
                                />
                                <Select
                                  value={quantityType}
                                  onValueChange={(value) => {
                                    setProductQuantityTypes((prev) => ({
                                      ...prev,
                                      [product.id]: value as QuantityType,
                                    }));
                                    if (!isSelected) {
                                      toggleProductSelection(product.id, true);
                                    }
                                  }}
                                >
                                  <SelectTrigger size="sm" className="h-8 w-[118px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="UNIT">Units</SelectItem>
                                    <SelectItem
                                      value="PACK"
                                      disabled={!product.packQuantity}
                                    >
                                      Packs
                                      {product.packQuantity
                                        ? ` (${product.packQuantity})`
                                        : ""}
                                    </SelectItem>
                                    <SelectItem
                                      value="HALF_PACK"
                                      disabled={!product.halfPackQuantity}
                                    >
                                      Half packs
                                      {product.halfPackQuantity
                                        ? ` (${product.halfPackQuantity})`
                                        : ""}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {quantityType !== "UNIT" && enteredQuantity > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  = {totalUnits} unit{totalUnits === 1 ? "" : "s"}
                                </p>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0">
            {isSelectingForDelivery ? (
              <>
                <Button variant="outline" onClick={resetDeliverySelection}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePendingDelivery}
                  disabled={submittingPendingDelivery || selectedProductIds.length === 0}
                >
                  {submittingPendingDelivery
                    ? "Adding..."
                    : `Add ${selectedProductIds.length} item${selectedProductIds.length === 1 ? "" : "s"} as Pending`}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsProductsDialogOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Incentive Dialog */}
      <Dialog open={isIncentiveDialogOpen} onOpenChange={setIsIncentiveDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Incentive</DialogTitle>
            <DialogDescription>
              Record money given to {incentiveSupplier?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="incentive-amount">Amount (₱) *</Label>
              <Input
                id="incentive-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={incentiveFormData.amount}
                onChange={(e) =>
                  setIncentiveFormData({ ...incentiveFormData, amount: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="incentive-date">Date Given *</Label>
              <Input
                id="incentive-date"
                type="date"
                value={incentiveFormData.incentiveDate}
                onChange={(e) =>
                  setIncentiveFormData({ ...incentiveFormData, incentiveDate: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="incentive-notes">Notes</Label>
              <Textarea
                id="incentive-notes"
                value={incentiveFormData.notes}
                onChange={(e) =>
                  setIncentiveFormData({ ...incentiveFormData, notes: e.target.value })
                }
                placeholder="Optional notes about this incentive"
                rows={2}
              />
            </div>

            {incentiveSupplier && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Total given so far: </span>
                  <span className="font-medium">
                    {formatCurrency(Number(incentiveSupplier.totalIncentiveGiven || 0))}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Last incentive: </span>
                  <span className="font-medium">
                    {incentiveSupplier.lastIncentiveDate
                      ? formatDate(incentiveSupplier.lastIncentiveDate)
                      : "Never"}
                  </span>
                </p>
              </div>
            )}

            {loadingIncentiveHistory ? (
              <div className="text-sm text-muted-foreground py-2">Loading history...</div>
            ) : incentiveHistory.length > 0 ? (
              <div className="space-y-2">
                <Label>Recent History</Label>
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incentiveHistory.map((incentive) => (
                        <TableRow key={incentive.id}>
                          <TableCell className="text-sm">
                            {formatDate(incentive.incentiveDate)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(Number(incentive.amount))}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {incentive.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIncentiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitIncentive}>Record Incentive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the supplier &quot;{selectedSupplier?.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
