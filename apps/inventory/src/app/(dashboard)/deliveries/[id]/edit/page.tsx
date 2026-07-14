"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { format } from "date-fns";
import {
  showSuccessToast,
  showErrorFromException,
  showErrorToast,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import { IconX, IconPlus, IconArrowLeft, IconSearch } from "@tabler/icons-react";
import { Check, ChevronsUpDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type QuantityType = "UNIT" | "PACK" | "HALF_PACK";

interface DeliveryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  isFree?: boolean;
  updateProductCost?: boolean;
  packInfo?: {
    type: "PACK" | "HALF_PACK";
    packs: number;
    unitsPerPack: number;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  price: number;
  cost: number;
  stockQuantity: number;
  barcode?: string;
  taxRate?: number;
  lowStockThreshold?: number;
  markupPercentage?: number;
  markupFixed?: number;
  packPrice?: number;
  packQuantity?: number;
  halfPackPrice?: number;
  halfPackQuantity?: number;
  status: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function EditDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const deliveryId = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [isCreateSupplierDialogOpen, setIsCreateSupplierDialogOpen] = useState(false);
  const [isProductSearchDialogOpen, setIsProductSearchDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [openCategoryCombobox, setOpenCategoryCombobox] = useState(false);

  const [formData, setFormData] = useState({
    supplierId: "",
    legacySupplierName: "",
    invoiceNumber: "",
    totalCost: "",
    discountAmount: "",
    status: "RECEIVED" as "PENDING" | "RECEIVED" | "CANCELLED",
    notes: "",
  });

  const [supplierFormData, setSupplierFormData] = useState({
    name: "",
    contactNumber: "",
    email: "",
  });

  const [productFormData, setProductFormData] = useState({
    name: "",
    sku: "",
    description: "",
    category: "",
    price: "",
    packPrice: "",
    packQuantity: "",
    cost: "",
    markupPercentage: "",
    markupFixed: "",
    addonPrice: "",
    convenienceMarkupPercentage: "",
    convenienceMarkup: "",
    taxRate: "0",
    stockQuantity: "0",
    lowStockThreshold: "10",
    barcode: "",
    status: "ACTIVE",
  });

  const [itemFormData, setItemFormData] = useState({
    quantityType: "UNIT" as QuantityType,
    quantity: "",
    unitCost: "",
    isFree: false,
    updatePrice: false,
    packPrice: "",
    packQuantity: "",
  });

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchDelivery();
  }, [deliveryId]);

  // Calculate selling price from cost and markups
  useEffect(() => {
    if (productFormData.cost || productFormData.markupPercentage || productFormData.markupFixed) {
      const costNum = parseFloat(productFormData.cost) || 0;
      const percentNum = parseFloat(productFormData.markupPercentage) || 0;
      const fixedNum = parseFloat(productFormData.markupFixed) || 0;
      const calculatedPrice = costNum + (costNum * percentNum / 100) + fixedNum;
      
      setProductFormData(prev => ({
        ...prev,
        price: calculatedPrice > 0 ? calculatedPrice.toFixed(2) : ""
      }));
    }
  }, [productFormData.cost, productFormData.markupPercentage, productFormData.markupFixed]);

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
      setFormData({ ...formData, supplierId: savedSupplier.id });
      setIsCreateSupplierDialogOpen(false);
      resetSupplierForm();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("supplier"));
    }
  }

  async function fetchDelivery() {
    try {
      setLoading(true);
      const delivery = await apiClient.getInventoryDelivery(deliveryId);
      
      setFormData({
        // Legacy deliveries created before suppliers were linked may not
        // have a supplierId - the free-text name is kept for display and
        // is preserved on save unless a supplier is explicitly selected.
        supplierId: delivery.supplierId || "",
        legacySupplierName: delivery.supplier || "",
        invoiceNumber: delivery.invoiceNumber || "",
        totalCost: delivery.totalCost.toString(),
        discountAmount: delivery.discountAmount ? delivery.discountAmount.toString() : "",
        status: delivery.status,
        notes: delivery.notes || "",
      });
      
      setDeliveryDate(new Date(delivery.deliveryDate));
      setItems(delivery.items || []);
      
      if (delivery.receiptImageUrl) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        setPreviewUrl(baseUrl + delivery.receiptImageUrl);
      }
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("delivery"));
      router.push("/deliveries");
    } finally {
      setLoading(false);
    }
  }

  // Get unique categories from products
  const uniqueCategories = Array.from(
    new Set(products.map((p) => p.category).filter((c) => c && c.trim() !== ""))
  ).sort();

  const selectedProductForItem = products.find((p) => p.id === selectedProductId) || null;
  const itemMultiplier = getUnitMultiplier(itemFormData.quantityType, selectedProductForItem);
  const itemEnteredQuantity = parseFloat(itemFormData.quantity) || 0;
  const itemTotalUnits = itemEnteredQuantity * itemMultiplier;

  function resetProductForm() {
    setProductFormData({
      name: "",
      sku: "",
      description: "",
      category: "",
      price: "",
      packPrice: "",
      packQuantity: "",
      cost: "",
      markupPercentage: "",
      markupFixed: "",
      addonPrice: "",
      convenienceMarkupPercentage: "",
      convenienceMarkup: "",
      taxRate: "0",
      stockQuantity: "0",
      lowStockThreshold: "10",
      barcode: "",
      status: "ACTIVE",
    });
  }

  function resetItemForm() {
    setItemFormData({
      quantityType: "UNIT",
      quantity: "",
      unitCost: "",
      isFree: false,
      updatePrice: false,
      packPrice: "",
      packQuantity: "",
    });
  }

  // Returns how many individual units make up one of the given quantity type
  // for a product (e.g. 1 pack = product.packQuantity individual units).
  function getUnitMultiplier(type: QuantityType, product?: Product | null) {
    if (type === "PACK") return product?.packQuantity || 1;
    if (type === "HALF_PACK") return product?.halfPackQuantity || 1;
    return 1;
  }

  function handleOpenAddItemDialog() {
    if (!selectedProductId) {
      showErrorToast("Please select a product first");
      return;
    }
    
    const product = products.find(p => p.id === selectedProductId);
    if (product) {
      setItemFormData({
        quantityType: "UNIT",
        quantity: "",
        unitCost: product.cost.toString(),
        isFree: false,
        updatePrice: false,
        packPrice: product.packPrice?.toString() || "",
        packQuantity: product.packQuantity?.toString() || "",
      });
    }
    setIsAddItemDialogOpen(true);
  }

  async function handleAddItemToDelivery() {
    if (!selectedProductId || !itemFormData.quantity) {
      showErrorToast("Please fill in all fields");
      return;
    }

    if (!itemFormData.isFree && !itemFormData.unitCost) {
      showErrorToast("Please fill in all fields");
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const enteredQuantity = parseFloat(itemFormData.quantity);
    const multiplier = getUnitMultiplier(itemFormData.quantityType, product);
    const totalUnits = enteredQuantity * multiplier;

    const isFree = itemFormData.isFree;
    const enteredCost = isFree ? 0 : parseFloat(itemFormData.unitCost) || 0;
    // Cost is always stored per individual unit, regardless of how it was entered.
    const unitCost = isFree ? 0 : enteredCost / multiplier;
    const totalCost = isFree ? 0 : enteredQuantity * enteredCost;
    // Buying by pack/half-pack means the per-unit cost is derived (packPrice ÷
    // packQuantity), so the product's cost is kept in sync automatically. For
    // individual units it's only synced when explicitly requested.
    const updateProductCost =
      !isFree && (itemFormData.quantityType !== "UNIT" || itemFormData.updatePrice);

    // Update product stock and optionally price
    try {
      const updateData: any = {
        stockQuantity: product.stockQuantity + totalUnits,
      };

      // Tag the product with the delivery's supplier so it can be filtered
      // by supplier later on.
      if (formData.supplierId) {
        updateData.supplierId = formData.supplierId;
      }

      if (updateProductCost) {
        updateData.cost = unitCost;
        // Recalculate price based on new cost if markups exist
        if (product.markupPercentage || product.markupFixed) {
          const percentNum = product.markupPercentage || 0;
          const fixedNum = product.markupFixed || 0;
          updateData.price = unitCost + (unitCost * percentNum / 100) + fixedNum;
        }
      }

      // Update pack pricing if provided
      if (itemFormData.packPrice) {
        updateData.packPrice = parseFloat(itemFormData.packPrice);
      }
      if (itemFormData.packQuantity) {
        updateData.packQuantity = parseInt(itemFormData.packQuantity);
      }

      await apiClient.updateProduct(product.id, updateData);

      const newItem: DeliveryItem = {
        productId: product.id,
        productName: product.name,
        quantity: totalUnits,
        unitCost,
        totalCost,
        isFree,
        updateProductCost,
        ...(itemFormData.quantityType !== "UNIT" && {
          packInfo: {
            type: itemFormData.quantityType,
            packs: enteredQuantity,
            unitsPerPack: multiplier,
          },
        }),
      };

      setItems([...items, newItem]);
      updateTotalCost([...items, newItem]);
      
      setIsAddItemDialogOpen(false);
      setSelectedProductId("");
      resetItemForm();
      
      showSuccessToast(SUCCESS_MESSAGES.ADDED("Item"));
      await fetchProducts(); // Refresh products to show updated stock
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("product stock"));
    }
  }

  async function handleCreateProduct() {
    try {
      const productData = {
        sku: productFormData.sku,
        name: productFormData.name,
        description: productFormData.description,
        category: productFormData.category,
        price: parseFloat(productFormData.price),
        packPrice: productFormData.packPrice ? parseFloat(productFormData.packPrice) : null,
        packQuantity: productFormData.packQuantity ? parseInt(productFormData.packQuantity) : null,
        cost: parseFloat(productFormData.cost),
        markupPercentage: productFormData.markupPercentage ? parseFloat(productFormData.markupPercentage) : null,
        markupFixed: productFormData.markupFixed ? parseFloat(productFormData.markupFixed) : null,
        addonPrice: productFormData.addonPrice ? parseFloat(productFormData.addonPrice) : 0,
        convenienceMarkupPercentage: productFormData.convenienceMarkupPercentage ? parseFloat(productFormData.convenienceMarkupPercentage) : null,
        convenienceMarkup: productFormData.convenienceMarkup ? parseFloat(productFormData.convenienceMarkup) : 0,
        taxRate: parseFloat(productFormData.taxRate),
        stockQuantity: parseInt(productFormData.stockQuantity),
        lowStockThreshold: parseInt(productFormData.lowStockThreshold),
        barcode: productFormData.barcode,
        status: productFormData.status,
      };

      const savedProduct = await apiClient.createProduct(productData);
      showSuccessToast(SUCCESS_MESSAGES.CREATED("Product"));

      await fetchProducts();
      setIsCreateProductDialogOpen(false);
      setSelectedProductId(savedProduct.id);
      
      // Pre-populate item form with product details
      setItemFormData({
        quantityType: "UNIT",
        quantity: "",
        unitCost: productFormData.cost,
        isFree: false,
        updatePrice: false,
        packPrice: productFormData.packPrice || "",
        packQuantity: productFormData.packQuantity || "",
      });
      
      // Open the add item dialog
      setIsAddItemDialogOpen(true);
      
      resetProductForm();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("product"));
    }
  }

  function removeItem(index: number) {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    updateTotalCost(updatedItems);
  }

  function getItemsSubtotal(itemsList: DeliveryItem[]) {
    return itemsList.reduce((sum, item) => sum + item.totalCost, 0);
  }

  // Recomputes the final totalCost as items subtotal minus any supplier
  // discount. Pass discountOverride when updating from the discount input's
  // onChange, since formData may not have re-rendered with the new value yet.
  function updateTotalCost(itemsList: DeliveryItem[], discountOverride?: string) {
    const subtotal = getItemsSubtotal(itemsList);
    const discount = parseFloat(discountOverride ?? formData.discountAmount) || 0;
    const total = Math.max(subtotal - discount, 0);
    setFormData((prev) => ({ ...prev, totalCost: total.toFixed(2) }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  }

  function clearFile() {
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  async function handleSubmit() {
    if (!formData.supplierId && !formData.legacySupplierName) {
      showErrorToast("Please select a supplier");
      return;
    }

    if (items.length === 0) {
      showErrorToast("Please add at least one item");
      return;
    }

    try {
      setUploading(true);
      let receiptImageUrl = previewUrl || "";

      if (selectedFile) {
        const uploadResult = await apiClient.uploadReceipt(selectedFile);
        receiptImageUrl = uploadResult.url;
      }

      const payload: Record<string, any> = {
        invoiceNumber: formData.invoiceNumber,
        totalCost: parseFloat(formData.totalCost),
        discountAmount: parseFloat(formData.discountAmount) || 0,
        status: formData.status,
        notes: formData.notes,
        deliveryDate: deliveryDate.toISOString(),
        items: items,
        receiptImageUrl,
      };

      // Only send supplierId when the admin actually picked a supplier from
      // the list, so legacy free-text deliveries are left untouched unless
      // explicitly re-linked.
      if (formData.supplierId) {
        payload.supplierId = formData.supplierId;
      }

      await apiClient.updateInventoryDelivery(deliveryId, payload);

      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Delivery"));
      router.push("/deliveries");
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("delivery"));
    } finally {
      setUploading(false);
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/deliveries")}
        >
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Back to Deliveries
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Delivery</CardTitle>
          <CardDescription>
            Update delivery information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Delivery Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, supplierId: value })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        formData.legacySupplierName
                          ? `Legacy: ${formData.legacySupplierName}`
                          : "Select a supplier"
                      }
                    />
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
              {!formData.supplierId && formData.legacySupplierName && (
                <p className="text-xs text-muted-foreground">
                  This delivery uses a legacy free-text supplier: &quot;
                  {formData.legacySupplierName}&quot;. Select a supplier above to
                  link it going forward, or leave as-is to keep it unchanged.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoiceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceNumber: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {format(deliveryDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={(date) => date && setDeliveryDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Discount Amount (₱)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.discountAmount}
                onChange={(e) => {
                  const discount = e.target.value;
                  setFormData((prev) => ({ ...prev, discountAmount: discount }));
                  updateTotalCost(items, discount);
                }}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Flat discount from the supplier, subtracted from the items subtotal
              </p>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Delivery Items</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateProductDialogOpen(true)}
              >
                <IconPlus className="h-4 w-4 mr-2" />
                Create New Product
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label>Select Product</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProductSearchDialogOpen(true)}
                  className="w-full justify-start text-left font-normal mt-2"
                >
                  <IconSearch className="h-4 w-4 mr-2" />
                  {selectedProductId
                    ? products.find(p => p.id === selectedProductId)?.name || "Choose a product to add"
                    : "Search products..."}
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  onClick={handleOpenAddItemDialog}
                  disabled={!selectedProductId}
                >
                  <IconPlus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>

            {items.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.productName}
                          {item.isFree && (
                            <span className="ml-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                              FREE
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                          {item.packInfo && (
                            <div className="text-xs text-muted-foreground">
                              {item.packInfo.packs} {item.packInfo.type === "PACK" ? "pack" : "half pack"}
                              {item.packInfo.packs === 1 ? "" : "s"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.isFree ? "—" : `₱${item.unitCost.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.isFree ? (
                            <span className="font-medium text-emerald-700">FREE</span>
                          ) : (
                            `₱${item.totalCost.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <IconX className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right text-muted-foreground">
                        Subtotal:
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ₱{getItemsSubtotal(items).toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {parseFloat(formData.discountAmount) > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right text-muted-foreground">
                          Discount:
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          -₱{(parseFloat(formData.discountAmount) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Total:
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ₱{formData.totalCost}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes"
              rows={3}
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Receipt Image</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
            />
            {previewUrl && (
              <div className="mt-2 relative inline-block">
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="max-h-40 rounded border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={clearFile}
                  className="absolute top-2 right-2"
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => router.push("/deliveries")}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? "Updating..." : "Update Delivery"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Product Search Dialog */}
      <Dialog open={isProductSearchDialogOpen} onOpenChange={setIsProductSearchDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Search Products</DialogTitle>
            <DialogDescription>
              Search and select a product to add to the delivery
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or barcode..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
              <div className="p-2">
                {products
                  .filter(product => {
                    if (!productSearchQuery) return true;
                    
                    // Split search query into individual terms for multi-word search
                    const searchTerms = productSearchQuery.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
                    
                    // Check if ALL search terms are present in any of the product fields
                    return searchTerms.every(term => 
                      product.name.toLowerCase().includes(term) ||
                      product.sku.toLowerCase().includes(term) ||
                      product.barcode?.toLowerCase().includes(term) ||
                      product.category?.toLowerCase().includes(term)
                    );
                  })
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setSelectedProductId(product.id);
                        setIsProductSearchDialogOpen(false);
                        setProductSearchQuery("");
                      }}
                      className={`w-full text-left p-3 rounded-lg hover:bg-accent transition-colors ${
                        selectedProductId === product.id ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {product.sku}
                            {product.category && ` • ${product.category}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">₱{Number(product.cost || 0).toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">
                            Stock: {product.stockQuantity}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                {products.filter(product => {
                  if (!productSearchQuery) return true;
                  
                  // Split search query into individual terms for multi-word search
                  const searchTerms = productSearchQuery.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
                  
                  // Check if ALL search terms are present in any of the product fields
                  return searchTerms.every(term => 
                    product.name.toLowerCase().includes(term) ||
                    product.sku.toLowerCase().includes(term) ||
                    product.barcode?.toLowerCase().includes(term) ||
                    product.category?.toLowerCase().includes(term)
                  );
                }).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No products found</p>
                    <p className="text-sm mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsProductSearchDialogOpen(false);
                setProductSearchQuery("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item to Delivery Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item to Delivery</DialogTitle>
            <DialogDescription>
              {products.find(p => p.id === selectedProductId)?.name && (
                <>Adding: {products.find(p => p.id === selectedProductId)?.name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantity Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={itemFormData.quantityType === "UNIT" ? "default" : "outline"}
                  onClick={() => setItemFormData({ ...itemFormData, quantityType: "UNIT" })}
                >
                  Unit
                </Button>
                <Button
                  type="button"
                  variant={itemFormData.quantityType === "PACK" ? "default" : "outline"}
                  disabled={!selectedProductForItem?.packQuantity}
                  onClick={() => setItemFormData({ ...itemFormData, quantityType: "PACK" })}
                >
                  Pack
                </Button>
                <Button
                  type="button"
                  variant={itemFormData.quantityType === "HALF_PACK" ? "default" : "outline"}
                  disabled={!selectedProductForItem?.halfPackQuantity}
                  onClick={() => setItemFormData({ ...itemFormData, quantityType: "HALF_PACK" })}
                >
                  Half Pack
                </Button>
              </div>
              {(selectedProductForItem?.packQuantity || selectedProductForItem?.halfPackQuantity) ? (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {selectedProductForItem?.packQuantity ? (
                    <p>
                      Pack: {selectedProductForItem.packQuantity} pcs
                      {selectedProductForItem.packPrice
                        ? ` · sells for ₱${Number(selectedProductForItem.packPrice).toFixed(2)}`
                        : ""}
                    </p>
                  ) : (
                    <p>Pack: not configured for this product</p>
                  )}
                  {selectedProductForItem?.halfPackQuantity ? (
                    <p>
                      Half Pack: {selectedProductForItem.halfPackQuantity} pcs
                      {selectedProductForItem.halfPackPrice
                        ? ` · sells for ₱${Number(selectedProductForItem.halfPackPrice).toFixed(2)}`
                        : ""}
                    </p>
                  ) : (
                    <p>Half Pack: not configured for this product</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This product has no pack/half-pack configured — only individual units can be received.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Quantity {itemFormData.quantityType === "PACK" ? "(packs)" : itemFormData.quantityType === "HALF_PACK" ? "(half packs)" : "(units)"} *
              </Label>
              <Input
                type="number"
                step="0.01"
                value={itemFormData.quantity}
                onChange={(e) =>
                  setItemFormData({ ...itemFormData, quantity: e.target.value })
                }
                placeholder="Enter quantity received"
                required
              />
              {itemFormData.quantityType !== "UNIT" && itemFormData.quantity && (
                <p className="text-xs text-muted-foreground">
                  = {itemTotalUnits} individual unit{itemTotalUnits === 1 ? "" : "s"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                This will be added to the current stock
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isFree"
                checked={itemFormData.isFree}
                onCheckedChange={(checked) =>
                  setItemFormData({
                    ...itemFormData,
                    isFree: checked === true,
                    updatePrice: checked === true ? false : itemFormData.updatePrice,
                  })
                }
              />
              <Label htmlFor="isFree" className="cursor-pointer font-normal">
                Free item (given by supplier at no cost — updates stock, excluded from total)
              </Label>
            </div>

            <div className="space-y-2">
              <Label>
                Cost per {itemFormData.quantityType === "PACK" ? "Pack" : itemFormData.quantityType === "HALF_PACK" ? "Half Pack" : "Unit"}
                {!itemFormData.isFree && " *"}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={itemFormData.isFree ? "0" : itemFormData.unitCost}
                onChange={(e) =>
                  setItemFormData({ ...itemFormData, unitCost: e.target.value })
                }
                placeholder="Cost from supplier"
                disabled={itemFormData.isFree}
                required={!itemFormData.isFree}
              />
              {itemFormData.quantityType !== "UNIT" && itemFormData.unitCost && !itemFormData.isFree && (
                <p className="text-xs text-muted-foreground">
                  = ₱{(itemMultiplier > 0 ? (parseFloat(itemFormData.unitCost) || 0) / itemMultiplier : 0).toFixed(2)} per unit
                </p>
              )}
            </div>

            {itemFormData.quantityType !== "UNIT" ? (
              <p className="text-xs text-muted-foreground -mt-2">
                Since this was bought by {itemFormData.quantityType === "PACK" ? "pack" : "half pack"}, the product&apos;s cost per unit will automatically update to the computed value above.
              </p>
            ) : (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updatePrice"
                  checked={itemFormData.updatePrice}
                  disabled={itemFormData.isFree}
                  onCheckedChange={(checked) =>
                    setItemFormData({ ...itemFormData, updatePrice: checked === true })
                  }
                />
                <Label htmlFor="updatePrice" className="cursor-pointer font-normal">
                  Update product cost with this unit cost
                </Label>
              </div>
            )}

            {/* Pack Pricing */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3">Update Product&apos;s Pack Pricing (Optional)</h4>
              <p className="text-xs text-muted-foreground mb-3">
                This sets/updates the product&apos;s own pack configuration (selling side) — separate from the Quantity Type above.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pack Quantity</Label>
                  <Input
                    type="number"
                    value={itemFormData.packQuantity}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, packQuantity: e.target.value })
                    }
                    placeholder="12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Items per pack (e.g., 12 for dozen)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Pack Price (₱)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemFormData.packPrice}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, packPrice: e.target.value })
                    }
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total price for the pack
                  </p>
                </div>
              </div>
            </div>

            {(itemFormData.quantityType !== "UNIT" || itemFormData.updatePrice) && !itemFormData.isFree && itemFormData.unitCost && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                <p className="text-amber-900">
                  The product's cost will be updated to ₱
                  {(itemMultiplier > 0 ? (parseFloat(itemFormData.unitCost) || 0) / itemMultiplier : 0).toFixed(2)}{" "}
                  per unit.
                  {selectedProductForItem?.markupPercentage || selectedProductForItem?.markupFixed ? (
                    <> The selling price will be automatically recalculated based on markups.</>
                  ) : null}
                </p>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm space-y-1">
              <p className="font-medium text-blue-900">Current Product Info:</p>
              <p className="text-blue-800">
                Stock: {selectedProductForItem?.stockQuantity || 0} 
                {itemFormData.quantity && ` → ${(selectedProductForItem?.stockQuantity || 0) + itemTotalUnits}`}
              </p>
              <p className="text-blue-800">
                Cost: ₱{Number(selectedProductForItem?.cost || 0).toFixed(2)} / unit
                {(itemFormData.quantityType !== "UNIT" || itemFormData.updatePrice) && !itemFormData.isFree && itemFormData.unitCost &&
                  ` → ₱${(itemMultiplier > 0 ? (parseFloat(itemFormData.unitCost) || 0) / itemMultiplier : 0).toFixed(2)} / unit`}
              </p>
              <p className="text-blue-800">
                Line Total:{" "}
                {itemFormData.isFree ? (
                  <span className="font-semibold text-emerald-700">FREE</span>
                ) : (
                  <span className="font-semibold">
                    ₱{(itemEnteredQuantity * (parseFloat(itemFormData.unitCost) || 0)).toFixed(2)}
                  </span>
                )}
              </p>
              {(selectedProductForItem?.packPrice || itemFormData.packPrice) && (
                <p className="text-blue-800">
                  Pack: {selectedProductForItem?.packQuantity || 0} @ ₱{Number(selectedProductForItem?.packPrice || 0).toFixed(2)}
                  {(itemFormData.packPrice || itemFormData.packQuantity) && ` → ${itemFormData.packQuantity || selectedProductForItem?.packQuantity || 0} @ ₱${Number(itemFormData.packPrice || selectedProductForItem?.packPrice || 0).toFixed(2)}`}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddItemDialogOpen(false);
                resetItemForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddItemToDelivery}>
              Add to Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Product Dialog */}
      <Dialog open={isCreateProductDialogOpen} onOpenChange={setIsCreateProductDialogOpen}>
        <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>
              Add a new product to your inventory
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input
                  value={productFormData.sku}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, sku: e.target.value })
                  }
                  placeholder="PROD-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input
                  value={productFormData.barcode}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, barcode: e.target.value })
                  }
                  placeholder="123456789012"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={productFormData.name}
                onChange={(e) =>
                  setProductFormData({ ...productFormData, name: e.target.value })
                }
                placeholder="Product name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={productFormData.description}
                onChange={(e) =>
                  setProductFormData({ ...productFormData, description: e.target.value })
                }
                placeholder="Product description"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Popover open={openCategoryCombobox} onOpenChange={setOpenCategoryCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCategoryCombobox}
                    className="w-full justify-between"
                  >
                    {productFormData.category || "Select or add category..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command>
                    <CommandInput 
                      placeholder="Search or type new category..." 
                      value={productFormData.category}
                      onValueChange={(value) => setProductFormData({ ...productFormData, category: value })}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2 text-sm">
                          Press Enter to add &quot;{productFormData.category}&quot;
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {uniqueCategories.map((cat) => (
                          <CommandItem
                            key={cat}
                            value={cat}
                            onSelect={(currentValue) => {
                              setProductFormData({ ...productFormData, category: currentValue });
                              setOpenCategoryCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                productFormData.category === cat ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cat}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {uniqueCategories.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Existing: {uniqueCategories.join(", ")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productFormData.cost}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, cost: e.target.value })
                  }
                  placeholder="10.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Markup (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productFormData.markupPercentage}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, markupPercentage: e.target.value })
                  }
                  placeholder="20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fixed Markup (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productFormData.markupFixed}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, markupFixed: e.target.value })
                  }
                  placeholder="1.50"
                />
              </div>
              <div className="space-y-2">
                <Label>Selling Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productFormData.price}
                  readOnly
                  className="bg-muted"
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from cost + markups
                </p>
              </div>
            </div>

            {/* Convenience Markup */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3">Convenience Store Markup (Optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Convenience Markup (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productFormData.convenienceMarkupPercentage}
                    onChange={(e) =>
                      setProductFormData({ ...productFormData, convenienceMarkupPercentage: e.target.value })
                    }
                    placeholder="5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fixed Convenience Markup (₱)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productFormData.convenienceMarkup}
                    onChange={(e) =>
                      setProductFormData({ ...productFormData, convenienceMarkup: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Optional convenience store markup (e.g., 5% or ₱1.50)
              </p>
            </div>

            {/* Add-on Price */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3">Add-on Price (Optional)</h4>
              <div className="space-y-2">
                <Label>Refrigeration/Add-on Fee (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productFormData.addonPrice}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, addonPrice: e.target.value })
                  }
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Optional fee for refrigeration or special handling (e.g., ₱2.00)
                </p>
              </div>
            </div>

            {/* Pack Pricing */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3">Pack/Dozen Pricing (Optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pack Quantity</Label>
                  <Input
                    type="number"
                    value={productFormData.packQuantity}
                    onChange={(e) =>
                      setProductFormData({ ...productFormData, packQuantity: e.target.value })
                    }
                    placeholder="12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Items per pack (e.g., 12 for dozen)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Pack Price (₱)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productFormData.packPrice}
                    onChange={(e) =>
                      setProductFormData({ ...productFormData, packPrice: e.target.value })
                    }
                    placeholder="10.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total price for the pack
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Initial Stock Quantity</Label>
                <Input
                  type="number"
                  value={productFormData.stockQuantity}
                  readOnly
                  className="bg-muted"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Stock will be added from delivery quantity
                </p>
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert</Label>
                <Input
                  type="number"
                  value={productFormData.lowStockThreshold}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, lowStockThreshold: e.target.value })
                  }
                  placeholder="10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productFormData.taxRate}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, taxRate: e.target.value })
                  }
                  placeholder="0.08"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={productFormData.status}
                  onValueChange={(value) =>
                    setProductFormData({ ...productFormData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                    <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateProductDialogOpen(false);
                resetProductForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProduct}>
              Create Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Supplier Dialog */}
      <Dialog open={isCreateSupplierDialogOpen} onOpenChange={setIsCreateSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>
              Quickly add a supplier without leaving this page. You can fill in
              more details later from the Suppliers page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supplier Name *</Label>
              <Input
                value={supplierFormData.name}
                onChange={(e) =>
                  setSupplierFormData({ ...supplierFormData, name: e.target.value })
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
                  setSupplierFormData({ ...supplierFormData, contactNumber: e.target.value })
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
                  setSupplierFormData({ ...supplierFormData, email: e.target.value })
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
