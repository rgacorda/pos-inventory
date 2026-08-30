"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type QuantityType = "UNIT" | "PACK" | "HALF_PACK";

interface DeliveryItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  isFree?: boolean;
  updateProductCost?: boolean;
  // Manual selling-price overrides, applied together with the cost sync
  // above (i.e. only once the delivery is RECEIVED) so pricing changes
  // never partially apply if the delivery itself is never saved.
  priceOverride?: number;
  packPriceOverride?: number;
  packQuantityOverride?: number;
  halfPackPriceOverride?: number;
  halfPackQuantityOverride?: number;
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
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

export default function NewDeliveryPage() {
  const router = useRouter();
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
  const [showAllOtherProducts, setShowAllOtherProducts] = useState(false);
  const [openCategoryCombobox, setOpenCategoryCombobox] = useState(false);

  const [formData, setFormData] = useState({
    supplierId: "",
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
    sellingPrice: "",
    packPrice: "",
    packQuantity: "",
    halfPackPrice: "",
    halfPackQuantity: "",
  });

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  // Calculate selling price from cost and markups for new product creation
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

  // Get unique categories from products
  const uniqueCategories = Array.from(
    new Set(products.map((p) => p.category).filter((c) => c && c.trim() !== ""))
  ).sort();

  const selectedProductForItem = products.find((p) => p.id === selectedProductId) || null;
  const itemMultiplier = getUnitMultiplier(itemFormData.quantityType, selectedProductForItem);
  const itemEnteredQuantity = parseFloat(itemFormData.quantity) || 0;
  const itemTotalUnits = itemEnteredQuantity * itemMultiplier;

  // Live "Pricing & Profit" preview for the Add Item dialog. The unit cost
  // is derived from whatever was entered above (per unit, pack, or half
  // pack), then used as the basis for pack/half-pack cost so the profit
  // numbers always reflect the cost that's about to be saved - not the
  // product's current (stale) cost.
  const previewUnitCost = itemFormData.isFree
    ? 0
    : itemMultiplier > 0
      ? (parseFloat(itemFormData.unitCost) || 0) / itemMultiplier
      : 0;
  const previewSellingPrice = parseFloat(itemFormData.sellingPrice) || 0;
  const previewUnitProfit = previewSellingPrice - previewUnitCost;

  const previewPackQuantity = parseInt(itemFormData.packQuantity) || 0;
  const previewPackPrice = parseFloat(itemFormData.packPrice) || 0;
  const previewPackCost = previewUnitCost * previewPackQuantity;
  const previewPackProfit = previewPackPrice - previewPackCost;

  const previewHalfPackQuantity = parseInt(itemFormData.halfPackQuantity) || 0;
  const previewHalfPackPrice = parseFloat(itemFormData.halfPackPrice) || 0;
  const previewHalfPackCost = previewUnitCost * previewHalfPackQuantity;
  const previewHalfPackProfit = previewHalfPackPrice - previewHalfPackCost;

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
      sellingPrice: "",
      packPrice: "",
      packQuantity: "",
      halfPackPrice: "",
      halfPackQuantity: "",
    });
  }

  // Returns how many individual units make up one of the given quantity type
  // for a product (e.g. 1 pack = product.packQuantity individual units).
  function getUnitMultiplier(type: QuantityType, product?: Product | null) {
    if (type === "PACK") return product?.packQuantity || 1;
    if (type === "HALF_PACK") return product?.halfPackQuantity || 1;
    return 1;
  }

  // Switching quantity type (unit/pack/half-pack) should rescale the entered
  // cost so it keeps representing the same per-unit cost, instead of leaving
  // the raw number unchanged (which made "cost per pack" look identical to
  // "cost per unit").
  function handleQuantityTypeChange(type: QuantityType) {
    const oldMultiplier = getUnitMultiplier(itemFormData.quantityType, selectedProductForItem);
    const newMultiplier = getUnitMultiplier(type, selectedProductForItem);
    const enteredCost = parseFloat(itemFormData.unitCost) || 0;
    const perUnitCost = oldMultiplier > 0 ? enteredCost / oldMultiplier : enteredCost;
    const rescaledCost = perUnitCost * newMultiplier;

    setItemFormData({
      ...itemFormData,
      quantityType: type,
      unitCost: rescaledCost > 0 ? rescaledCost.toFixed(2) : itemFormData.unitCost,
    });
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
        unitCost: product.cost?.toString() || "0",
        isFree: false,
        sellingPrice: product.price?.toString() || "",
        packPrice: product.packPrice?.toString() || "",
        packQuantity: product.packQuantity?.toString() || "",
        halfPackPrice: product.halfPackPrice?.toString() || "",
        halfPackQuantity: product.halfPackQuantity?.toString() || "",
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
    // The product's cost per unit is always kept in sync with the latest
    // delivery price (whether bought by unit, pack, or half-pack), unless
    // the item was free (free items carry no real purchase price).
    const updateProductCost = !isFree;

    // Manual selling-price overrides entered in the Pricing & Profit section
    // below. These are only sent when they differ from "unset" so a blank
    // field never accidentally wipes out an existing price. They're applied
    // by the backend at the same time as the cost sync above (i.e. only once
    // the delivery is RECEIVED), never immediately, so nothing is left
    // half-applied if this delivery is never saved.
    const sellingPriceNum = parseFloat(itemFormData.sellingPrice) || 0;
    const packPriceNum = parseFloat(itemFormData.packPrice) || 0;
    const packQuantityNum = parseInt(itemFormData.packQuantity) || 0;
    const halfPackPriceNum = parseFloat(itemFormData.halfPackPrice) || 0;
    const halfPackQuantityNum = parseInt(itemFormData.halfPackQuantity) || 0;

    // Just add item to local state - backend will handle stock/cost updates when delivery is submitted
    const newItem: DeliveryItem = {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      quantity: totalUnits,
      unitCost,
      totalCost,
      isFree,
      updateProductCost,
      ...(!isFree && sellingPriceNum > 0 && { priceOverride: sellingPriceNum }),
      ...(!isFree && packQuantityNum > 0 && { packQuantityOverride: packQuantityNum }),
      ...(!isFree && packPriceNum > 0 && { packPriceOverride: packPriceNum }),
      ...(!isFree && halfPackQuantityNum > 0 && { halfPackQuantityOverride: halfPackQuantityNum }),
      ...(!isFree && halfPackPriceNum > 0 && { halfPackPriceOverride: halfPackPriceNum }),
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
      resetProductForm();
      
      // Automatically open Add Item dialog with the new product
      setTimeout(() => {
        setItemFormData({
          quantityType: "UNIT",
          quantity: "",
          unitCost: productData.cost.toString(),
          isFree: false,
          sellingPrice: productData.price?.toString() || "",
          packPrice: productData.packPrice?.toString() || "",
          packQuantity: productData.packQuantity?.toString() || "",
          halfPackPrice: "",
          halfPackQuantity: "",
        });
        setIsAddItemDialogOpen(true);
      }, 100);
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
    if (!formData.supplierId) {
      showErrorToast("Please select a supplier");
      return;
    }

    if (items.length === 0) {
      showErrorToast("Please add at least one item");
      return;
    }

    try {
      setUploading(true);
      let receiptImageUrl = "";

      if (selectedFile) {
        const uploadResult = await apiClient.uploadReceipt(selectedFile);
        receiptImageUrl = uploadResult.url;
      }

      await apiClient.createInventoryDelivery({
        ...formData,
        deliveryDate: deliveryDate.toISOString(),
        totalCost: parseFloat(formData.totalCost),
        discountAmount: parseFloat(formData.discountAmount) || 0,
        items: items,
        receiptImageUrl,
      });

      showSuccessToast(SUCCESS_MESSAGES.CREATED("Delivery"));
      router.push("/deliveries");
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("delivery"));
    } finally {
      setUploading(false);
    }
  }

  const currentSupplierName = suppliers.find((s) => s.id === formData.supplierId)?.name;

  // Products matching the delivery's selected supplier are shown first.
  // Products with no supplier (and from other suppliers) stay hidden unless
  // "show all other products" is toggled — picking one reassigns it once received.
  const searchDialogGroups = useMemo(() => {
    const searchTerms = productSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    const matchesSearch = (product: Product) =>
      searchTerms.length === 0 ||
      searchTerms.every(
        (term) =>
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term) ||
          product.barcode?.toLowerCase().includes(term) ||
          product.category?.toLowerCase().includes(term)
      );

    const matching = products.filter(matchesSearch);

    if (!formData.supplierId) {
      return [{ key: "all", label: null as string | null, products: matching }];
    }

    const supplierProducts = matching.filter(
      (product) => product.supplierId === formData.supplierId
    );
    const noSupplierProducts = matching.filter((product) => !product.supplierId);
    const otherSupplierProducts = matching.filter(
      (product) => !!product.supplierId && product.supplierId !== formData.supplierId
    );

    const groups: { key: string; label: string | null; products: Product[] }[] = [
      {
        key: "supplier",
        label: currentSupplierName
          ? `From ${currentSupplierName}`
          : "This supplier",
        products: supplierProducts,
      },
    ];

    if (showAllOtherProducts) {
      groups.push(
        { key: "no-supplier", label: "No supplier", products: noSupplierProducts },
        { key: "other", label: "Other suppliers", products: otherSupplierProducts }
      );
    }

    return groups.filter((group) => group.products.length > 0);
  }, [
    products,
    productSearchQuery,
    showAllOtherProducts,
    formData.supplierId,
    currentSupplierName,
  ]);

  const searchDialogProductCount = searchDialogGroups.reduce(
    (count, group) => count + group.products.length,
    0
  );

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
          <CardTitle>Create New Delivery</CardTitle>
          <CardDescription>
            Record a new inventory delivery or purchase
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
                      <TableHead>SKU</TableHead>
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
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {item.productSku}
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
                      <TableCell colSpan={4} className="text-right text-muted-foreground">
                        Subtotal:
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ₱{getItemsSubtotal(items).toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {parseFloat(formData.discountAmount) > 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-right text-muted-foreground">
                          Discount:
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          -₱{(parseFloat(formData.discountAmount) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-semibold">
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
              {uploading ? "Creating..." : "Create Delivery"}
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

            {formData.supplierId ? (
              <div className="rounded-md border bg-muted/50 px-3 py-2 space-y-2">
                <p className="text-sm font-medium">
                  {currentSupplierName || "This supplier"}&apos;s products are prioritized
                </p>
                <p className="text-xs text-muted-foreground">
                  {showAllOtherProducts
                    ? "This supplier's products are listed first, followed by products with no supplier and from other suppliers."
                    : "Only this supplier's products are shown. Products with no supplier or from other suppliers are hidden."}
                </p>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={showAllOtherProducts}
                    onCheckedChange={(checked) =>
                      setShowAllOtherProducts(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <span>Show all other products from suppliers and no supplier</span>
                </label>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a supplier above to filter this list by supplier
              </p>
            )}

            <ScrollArea className="h-[400px] border rounded-md">
              <div className="p-2">
                {searchDialogGroups.map((group) => (
                  <div key={group.key}>
                    {group.label && (
                      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide sticky top-0 bg-background z-10">
                        {group.label}
                      </p>
                    )}
                    {group.products.map((product) => {
                      const isOtherSupplier =
                        !!formData.supplierId &&
                        !!product.supplierId &&
                        product.supplierId !== formData.supplierId;
                      const isNoSupplier =
                        !!formData.supplierId && !product.supplierId;
                      return (
                        <button
                          key={product.id}
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setIsProductSearchDialogOpen(false);
                            setProductSearchQuery("");
                          }}
                          className={`w-full text-left p-3 rounded-lg hover:bg-accent transition-colors ${
                            selectedProductId === product.id ? "bg-accent" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{product.name}</p>
                                {isOtherSupplier && (
                                  <Badge variant="outline" className="text-xs">
                                    {product.supplier?.name || "Other supplier"}
                                  </Badge>
                                )}
                                {isNoSupplier && (
                                  <Badge variant="outline" className="text-xs">
                                    No supplier
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                SKU: {product.sku}
                                {product.category && ` • ${product.category}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                ₱{Number(product.cost || 0).toFixed(2)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Stock: {product.stockQuantity}
                              </p>
                            </div>
                          </div>
                          {(isOtherSupplier || isNoSupplier) && (
                            <p className="text-xs text-amber-600 mt-1">
                              Selecting this will {isNoSupplier ? "assign" : "reassign"} it to{" "}
                              {currentSupplierName || "this delivery's supplier"} once received
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {searchDialogProductCount === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No products found</p>
                    <p className="text-sm mt-1">
                      {!showAllOtherProducts && formData.supplierId
                        ? "Try showing all other products or a different search term"
                        : "Try a different search term"}
                    </p>
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
        <DialogContent className="!max-w-2xl">
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
                  onClick={() => handleQuantityTypeChange("UNIT")}
                >
                  Unit
                </Button>
                <Button
                  type="button"
                  variant={itemFormData.quantityType === "PACK" ? "default" : "outline"}
                  disabled={!selectedProductForItem?.packQuantity}
                  onClick={() => handleQuantityTypeChange("PACK")}
                >
                  Pack
                </Button>
                <Button
                  type="button"
                  variant={itemFormData.quantityType === "HALF_PACK" ? "default" : "outline"}
                  disabled={!selectedProductForItem?.halfPackQuantity}
                  onClick={() => handleQuantityTypeChange("HALF_PACK")}
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
                Stock will be updated when delivery is submitted
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

            {!itemFormData.isFree && (
              <p className="text-xs text-muted-foreground -mt-2">
                {itemFormData.quantityType === "UNIT"
                  ? "The product's cost per unit will automatically update to this value."
                  : `Since this was bought by ${itemFormData.quantityType === "PACK" ? "pack" : "half pack"}, the product's cost per unit will automatically update to the computed value above.`}
              </p>
            )}

            {!itemFormData.isFree && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">Selling Price &amp; Potential Profit</h4>
                  <p className="text-xs text-muted-foreground">
                    Read left to right: cost, sell price, then profit. Sell prices update with cost when this delivery is submitted. Pack size here is for future sales — not the quantity received above.
                  </p>
                </div>

                {/* Unit */}
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Per unit</p>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cost</Label>
                      <div className="h-9 flex items-center text-sm font-medium tabular-nums">
                        ₱{previewUnitCost.toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sell price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={itemFormData.sellingPrice}
                        onChange={(e) => setItemFormData({ ...itemFormData, sellingPrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Potential profit</Label>
                      <div className={`h-9 flex items-center text-sm font-semibold tabular-nums ${previewUnitProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ₱{previewUnitProfit.toFixed(2)}
                        {previewSellingPrice > 0 && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({((previewUnitProfit / previewSellingPrice) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pack */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pack</p>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Items in pack</Label>
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={itemFormData.packQuantity}
                        onChange={(e) => setItemFormData({ ...itemFormData, packQuantity: e.target.value })}
                        placeholder="12"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cost</Label>
                      <div className="h-9 flex items-center text-sm font-medium tabular-nums">
                        ₱{previewPackCost.toFixed(2)}
                      </div>
                      {previewPackQuantity > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ₱{previewUnitCost.toFixed(2)} / item
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sell price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={itemFormData.packPrice}
                        onChange={(e) => setItemFormData({ ...itemFormData, packPrice: e.target.value })}
                        placeholder="0.00"
                      />
                      {previewPackQuantity > 0 && previewPackPrice > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ₱{(previewPackPrice / previewPackQuantity).toFixed(2)} / item
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Potential profit</Label>
                      <div className={`h-9 flex items-center text-sm font-semibold tabular-nums ${previewPackProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {previewPackQuantity > 0 && previewPackPrice > 0 ? (
                          <>
                            ₱{previewPackProfit.toFixed(2)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({((previewPackProfit / previewPackPrice) * 100).toFixed(1)}%)
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-normal text-muted-foreground">Set qty &amp; price</span>
                        )}
                      </div>
                      {previewPackQuantity > 0 && previewPackPrice > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ₱{(previewPackProfit / previewPackQuantity).toFixed(2)} / item
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Half Pack */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Half pack</p>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Items in half pack</Label>
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={itemFormData.halfPackQuantity}
                        onChange={(e) => setItemFormData({ ...itemFormData, halfPackQuantity: e.target.value })}
                        placeholder="6"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cost</Label>
                      <div className="h-9 flex items-center text-sm font-medium tabular-nums">
                        ₱{previewHalfPackCost.toFixed(2)}
                      </div>
                      {previewHalfPackQuantity > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ₱{previewUnitCost.toFixed(2)} / item
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sell price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={itemFormData.halfPackPrice}
                        onChange={(e) => setItemFormData({ ...itemFormData, halfPackPrice: e.target.value })}
                        placeholder="0.00"
                      />
                      {previewHalfPackQuantity > 0 && previewHalfPackPrice > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ₱{(previewHalfPackPrice / previewHalfPackQuantity).toFixed(2)} / item
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Potential profit</Label>
                      <div className={`h-9 flex items-center text-sm font-semibold tabular-nums ${previewHalfPackProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {previewHalfPackQuantity > 0 && previewHalfPackPrice > 0 ? (
                          <>
                            ₱{previewHalfPackProfit.toFixed(2)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({((previewHalfPackProfit / previewHalfPackPrice) * 100).toFixed(1)}%)
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-normal text-muted-foreground">Set qty &amp; price</span>
                        )}
                      </div>
                      {previewHalfPackQuantity > 0 && previewHalfPackPrice > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ₱{(previewHalfPackProfit / previewHalfPackQuantity).toFixed(2)} / item
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm space-y-1">
              <p className="font-medium text-blue-900">Preview (updates when delivery is submitted):</p>
              <p className="text-blue-800">
                Current Stock: {selectedProductForItem?.stockQuantity || 0}
                {itemFormData.quantity && (
                  <span className="text-green-700 font-semibold">
                    {" → "}{(selectedProductForItem?.stockQuantity || 0) + itemTotalUnits}
                  </span>
                )}
              </p>
              <p className="text-blue-800">
                Product Cost: ₱{Number(selectedProductForItem?.cost || 0).toFixed(2)} / unit
                {!itemFormData.isFree && itemFormData.unitCost && (
                  <span className="text-green-700 font-semibold">
                    {" → "}₱{(itemMultiplier > 0 ? (parseFloat(itemFormData.unitCost) || 0) / itemMultiplier : 0).toFixed(2)} / unit
                  </span>
                )}
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
              {!itemFormData.isFree && previewSellingPrice > 0 && previewSellingPrice !== Number(selectedProductForItem?.price || 0) && (
                <p className="text-blue-800">
                  Selling Price: ₱{Number(selectedProductForItem?.price || 0).toFixed(2)} / unit
                  <span className="text-green-700 font-semibold">
                    {" → "}₱{previewSellingPrice.toFixed(2)} / unit
                  </span>
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
        <DialogContent className="!max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  value="0"
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Stock will be set from delivery quantity
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
