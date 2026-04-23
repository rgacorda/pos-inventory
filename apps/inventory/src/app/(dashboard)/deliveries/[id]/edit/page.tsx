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

interface DeliveryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
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
  status: string;
}

export default function EditDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const deliveryId = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [isProductSearchDialogOpen, setIsProductSearchDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [openCategoryCombobox, setOpenCategoryCombobox] = useState(false);

  const [formData, setFormData] = useState({
    supplier: "",
    invoiceNumber: "",
    totalCost: "",
    status: "RECEIVED" as "PENDING" | "RECEIVED" | "CANCELLED",
    notes: "",
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
    taxRate: "0",
    stockQuantity: "0",
    lowStockThreshold: "10",
    barcode: "",
    status: "ACTIVE",
  });

  const [itemFormData, setItemFormData] = useState({
    quantity: "",
    unitCost: "",
    updatePrice: false,
    packPrice: "",
    packQuantity: "",
  });

  useEffect(() => {
    fetchProducts();
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

  async function fetchDelivery() {
    try {
      setLoading(true);
      const delivery = await apiClient.getInventoryDelivery(deliveryId);
      
      setFormData({
        supplier: delivery.supplier,
        invoiceNumber: delivery.invoiceNumber || "",
        totalCost: delivery.totalCost.toString(),
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
      taxRate: "0",
      stockQuantity: "0",
      lowStockThreshold: "10",
      barcode: "",
      status: "ACTIVE",
    });
  }

  function resetItemForm() {
    setItemFormData({
      quantity: "",
      unitCost: "",
      updatePrice: false,
      packPrice: "",
      packQuantity: "",
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
        quantity: "",
        unitCost: product.cost.toString(),
        updatePrice: false,
        packPrice: product.packPrice?.toString() || "",
        packQuantity: product.packQuantity?.toString() || "",
      });
    }
    setIsAddItemDialogOpen(true);
  }

  async function handleAddItemToDelivery() {
    if (!selectedProductId || !itemFormData.quantity || !itemFormData.unitCost) {
      showErrorToast("Please fill in all fields");
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const quantity = parseFloat(itemFormData.quantity);
    const unitCost = parseFloat(itemFormData.unitCost);
    const totalCost = quantity * unitCost;

    // Update product stock and optionally price
    try {
      const updateData: any = {
        stockQuantity: product.stockQuantity + quantity,
      };

      if (itemFormData.updatePrice) {
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
        quantity,
        unitCost,
        totalCost,
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
        quantity: "",
        unitCost: productFormData.cost,
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

  function updateTotalCost(itemsList: DeliveryItem[]) {
    const total = itemsList.reduce((sum, item) => sum + item.totalCost, 0);
    setFormData({ ...formData, totalCost: total.toFixed(2) });
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
    if (!formData.supplier) {
      showErrorToast("Please enter supplier name");
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

      await apiClient.updateInventoryDelivery(deliveryId, {
        ...formData,
        deliveryDate: deliveryDate.toISOString(),
        totalCost: parseFloat(formData.totalCost),
        items: items,
        receiptImageUrl,
      });

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
              <Input
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
                placeholder="Supplier name"
              />
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
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          ₱{item.unitCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ₱{item.totalCost.toFixed(2)}
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
                    const query = productSearchQuery.toLowerCase();
                    return (
                      product.name.toLowerCase().includes(query) ||
                      product.sku.toLowerCase().includes(query) ||
                      product.barcode?.toLowerCase().includes(query) ||
                      product.category?.toLowerCase().includes(query)
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
                  const query = productSearchQuery.toLowerCase();
                  return (
                    product.name.toLowerCase().includes(query) ||
                    product.sku.toLowerCase().includes(query) ||
                    product.barcode?.toLowerCase().includes(query) ||
                    product.category?.toLowerCase().includes(query)
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
              <Label>Quantity *</Label>
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
              <p className="text-xs text-muted-foreground">
                This will be added to the current stock
              </p>
            </div>

            <div className="space-y-2">
              <Label>Unit Cost *</Label>
              <Input
                type="number"
                step="0.01"
                value={itemFormData.unitCost}
                onChange={(e) =>
                  setItemFormData({ ...itemFormData, unitCost: e.target.value })
                }
                placeholder="Cost per unit"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="updatePrice"
                checked={itemFormData.updatePrice}
                onChange={(e) =>
                  setItemFormData({ ...itemFormData, updatePrice: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="updatePrice" className="cursor-pointer font-normal">
                Update product cost with this unit cost
              </Label>
            </div>

            {/* Pack Pricing */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3">Pack/Dozen Pricing (Optional)</h4>
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

            {itemFormData.updatePrice && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                <p className="text-amber-900">
                  The product's cost will be updated to ₱{itemFormData.unitCost || "0.00"}.
                  {products.find(p => p.id === selectedProductId)?.markupPercentage || 
                   products.find(p => p.id === selectedProductId)?.markupFixed ? (
                    <> The selling price will be automatically recalculated based on markups.</>
                  ) : null}
                </p>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm space-y-1">
              <p className="font-medium text-blue-900">Current Product Info:</p>
              <p className="text-blue-800">
                Stock: {products.find(p => p.id === selectedProductId)?.stockQuantity || 0} 
                {itemFormData.quantity && ` → ${(products.find(p => p.id === selectedProductId)?.stockQuantity || 0) + parseFloat(itemFormData.quantity)}`}
              </p>
              <p className="text-blue-800">
                Cost: ₱{Number(products.find(p => p.id === selectedProductId)?.cost || 0).toFixed(2)}
                {itemFormData.updatePrice && itemFormData.unitCost && ` → ₱${parseFloat(itemFormData.unitCost).toFixed(2)}`}
              </p>
              {(products.find(p => p.id === selectedProductId)?.packPrice || itemFormData.packPrice) && (
                <p className="text-blue-800">
                  Pack: {products.find(p => p.id === selectedProductId)?.packQuantity || 0} @ ₱{Number(products.find(p => p.id === selectedProductId)?.packPrice || 0).toFixed(2)}
                  {(itemFormData.packPrice || itemFormData.packQuantity) && ` → ${itemFormData.packQuantity || products.find(p => p.id === selectedProductId)?.packQuantity || 0} @ ₱${Number(itemFormData.packPrice || products.find(p => p.id === selectedProductId)?.packPrice || 0).toFixed(2)}`}
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
    </div>
  );
}
