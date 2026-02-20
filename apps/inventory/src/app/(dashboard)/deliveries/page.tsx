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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  IconPackage,
  IconPlus,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
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
import { IconX } from "@tabler/icons-react";

interface DeliveryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface InventoryDelivery {
  id: string;
  supplier: string;
  deliveryDate: string;
  totalCost: number;
  items: DeliveryItem[];
  status: "PENDING" | "RECEIVED" | "CANCELLED";
  notes?: string;
  invoiceNumber?: string;
  receiptImageUrl?: string;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stockQuantity: number;
  status: string;
}

export default function InventoryDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<InventoryDelivery[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] =
    useState<InventoryDelivery | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<string>("");
  const [itemUnitCost, setItemUnitCost] = useState<string>("");

  const [formData, setFormData] = useState({
    supplier: "",
    invoiceNumber: "",
    totalCost: "",
    status: "RECEIVED" as "PENDING" | "RECEIVED" | "CANCELLED",
    notes: "",
  });

  const [newProductData, setNewProductData] = useState({
    name: "",
    sku: "",
    category: "GENERAL",
    price: "",
    cost: "",
    stockQuantity: "0",
    barcode: "",
    taxRate: "0",
    lowStockThreshold: "10",
  });

  useEffect(() => {
    fetchDeliveries();
    fetchProducts();
  }, []);

  async function fetchDeliveries() {
    try {
      setLoading(true);
      const data = await apiClient.getInventoryDeliveries();
      setDeliveries(data);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      const data = await apiClient.getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    }
  }

  function addItem() {
    if (!selectedProductId || !itemQuantity || !itemUnitCost) {
      toast.error("Please fill all item fields");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const quantity = parseFloat(itemQuantity);
    const unitCost = parseFloat(itemUnitCost);
    const totalCost = quantity * unitCost;

    const newItem: DeliveryItem = {
      productId: product.id,
      productName: product.name,
      quantity,
      unitCost,
      totalCost,
    };

    setItems([...items, newItem]);
    setSelectedProductId("");
    setItemQuantity("");
    setItemUnitCost("");
    updateTotalCost([...items, newItem]);
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

  async function handleCreateProduct() {
    try {
      const productPayload = {
        ...newProductData,
        price: parseFloat(newProductData.price),
        cost: parseFloat(newProductData.cost),
        stockQuantity: parseInt(newProductData.stockQuantity),
        taxRate: parseFloat(newProductData.taxRate),
        lowStockThreshold: parseInt(newProductData.lowStockThreshold),
        status: "ACTIVE",
      };

      const createdProduct = await apiClient.createProduct(productPayload);
      toast.success("Product created successfully");
      setIsAddProductDialogOpen(false);

      // Refresh products and select the new one
      await fetchProducts();
      setSelectedProductId(createdProduct.id);

      // Reset form
      setNewProductData({
        name: "",
        sku: "",
        category: "GENERAL",
        price: "",
        cost: "",
        stockQuantity: "0",
        barcode: "",
        taxRate: "0",
        lowStockThreshold: "10",
      });
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to create product");
    }
  }

  async function handleCreate() {
    try {
      setUploading(true);
      let receiptImageUrl = "";

      // Upload receipt if file is selected
      if (selectedFile) {
        const uploadResult = await apiClient.uploadReceipt(selectedFile);
        receiptImageUrl = uploadResult.url;
      }

      await apiClient.createInventoryDelivery({
        ...formData,
        deliveryDate: deliveryDate.toISOString(),
        totalCost: parseFloat(formData.totalCost),
        items: items,
        receiptImageUrl,
      });
      toast.success("Delivery created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      fetchDeliveries();
    } catch (error) {
      console.error("Error creating delivery:", error);
      toast.error("Failed to create delivery");
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedDelivery) return;

    try {
      setUploading(true);
      let receiptImageUrl = selectedDelivery.receiptImageUrl || "";

      // Upload new receipt if file is selected
      if (selectedFile) {
        const uploadResult = await apiClient.uploadReceipt(selectedFile);
        receiptImageUrl = uploadResult.url;
      }

      await apiClient.updateInventoryDelivery(selectedDelivery.id, {
        ...formData,
        deliveryDate: deliveryDate.toISOString(),
        totalCost: parseFloat(formData.totalCost),
        items: items,
        receiptImageUrl,
      });
      toast.success("Delivery updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      fetchDeliveries();
    } catch (error) {
      console.error("Error updating delivery:", error);
      toast.error("Failed to update delivery");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this delivery?")) return;

    try {
      await apiClient.deleteInventoryDelivery(id);
      toast.success("Delivery deleted successfully");
      fetchDeliveries();
    } catch (error) {
      console.error("Error deleting delivery:", error);
      toast.error("Failed to delete delivery");
    }
  }

  function resetForm() {
    setFormData({
      supplier: "",
      invoiceNumber: "",
      totalCost: "",
      status: "RECEIVED",
      notes: "",
    });
    setDeliveryDate(new Date());
    setSelectedDelivery(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setItems([]);
    setSelectedProductId("");
    setItemQuantity("");
    setItemUnitCost("");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Create preview for images
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

  function openEditDialog(delivery: InventoryDelivery) {
    setSelectedDelivery(delivery);
    setFormData({
      supplier: delivery.supplier,
      invoiceNumber: delivery.invoiceNumber || "",
      totalCost: delivery.totalCost.toString(),
      status: delivery.status,
      notes: delivery.notes || "",
    });
    setDeliveryDate(new Date(delivery.deliveryDate));
    setItems(delivery.items || []);
    // Set preview if there's an existing receipt
    if (delivery.receiptImageUrl) {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      setPreviewUrl(baseUrl + delivery.receiptImageUrl);
    }
    setIsEditDialogOpen(true);
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      delivery.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || delivery.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const paginatedDeliveries = filteredDeliveries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      RECEIVED: "default",
      PENDING: "secondary",
      CANCELLED: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (loading) {
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inventory Deliveries</CardTitle>
              <CardDescription>
                Track your inventory purchases and deliveries
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <IconPlus className="mr-2 h-4 w-4" />
              Add Delivery
            </Button>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <Input
              placeholder="Search by supplier or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <IconPackage className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        No deliveries found
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDeliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">
                        {delivery.supplier}
                      </TableCell>
                      <TableCell>{delivery.invoiceNumber || "—"}</TableCell>
                      <TableCell>
                        {format(new Date(delivery.deliveryDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        ${Number(delivery.totalCost).toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                      <TableCell>
                        {delivery.receiptImageUrl ? (
                          <a
                            href={
                              (process.env.NEXT_PUBLIC_API_URL ||
                                "http://localhost:3000") +
                              delivery.receiptImageUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(delivery)}
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(delivery.id)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredDeliveries.length)} of{" "}
            {filteredDeliveries.length} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Delivery</DialogTitle>
            <DialogDescription>
              Record a new inventory delivery or purchase
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-1">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
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
                <Label>Total Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.totalCost}
                  onChange={(e) =>
                    setFormData({ ...formData, totalCost: e.target.value })
                  }
                  placeholder="0.00"
                />
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

              {/* Items Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Delivery Items
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddProductDialogOpen(true)}
                  >
                    <IconPlus className="h-3 w-3 mr-1" />
                    New Product
                  </Button>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Select
                      value={selectedProductId}
                      onValueChange={setSelectedProductId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder="Select product"
                          className="truncate"
                        />
                      </SelectTrigger>
                      <SelectContent className="max-w-[300px]">
                        {products.map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id}
                            className="truncate"
                          >
                            <span className="truncate block">
                              {product.name} ({product.sku})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Unit Cost"
                      value={itemUnitCost}
                      onChange={(e) => setItemUnitCost(e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={addItem}
                      className="w-full"
                    >
                      <IconPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">
                            Unit Cost
                          </TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium text-sm">
                              {item.productName}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              ${item.unitCost.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              ${item.totalCost.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                              >
                                <IconX className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

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
              <div className="space-y-2">
                <Label>Receipt Image</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                />
                {previewUrl && (
                  <div className="mt-2 relative">
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={uploading}>
              {uploading ? "Uploading..." : "Create Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Delivery</DialogTitle>
            <DialogDescription>Update delivery information</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-1">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input
                  value={formData.invoiceNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, invoiceNumber: e.target.value })
                  }
                />
              </div>
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
                <Label>Total Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.totalCost}
                  onChange={(e) =>
                    setFormData({ ...formData, totalCost: e.target.value })
                  }
                />
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

              {/* Items Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Delivery Items
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddProductDialogOpen(true)}
                  >
                    <IconPlus className="h-3 w-3 mr-1" />
                    New Product
                  </Button>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Select
                      value={selectedProductId}
                      onValueChange={setSelectedProductId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder="Select product"
                          className="truncate"
                        />
                      </SelectTrigger>
                      <SelectContent className="max-w-[300px]">
                        {products.map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id}
                            className="truncate"
                          >
                            <span className="truncate block">
                              {product.name} ({product.sku})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Unit Cost"
                      value={itemUnitCost}
                      onChange={(e) => setItemUnitCost(e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={addItem}
                      className="w-full"
                    >
                      <IconPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">
                            Unit Cost
                          </TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium text-sm">
                              {item.productName}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              ${item.unitCost.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              ${item.totalCost.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                              >
                                <IconX className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt Image</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                />
                {previewUrl && (
                  <div className="mt-2 relative">
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
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={uploading}>
              {uploading ? "Updating..." : "Update Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <AlertDialog
        open={isAddProductDialogOpen}
        onOpenChange={setIsAddProductDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Product</AlertDialogTitle>
            <AlertDialogDescription>
              Add a new product to your inventory
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  value={newProductData.name}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      name: e.target.value,
                    })
                  }
                  placeholder="Product name"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input
                  value={newProductData.sku}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      sku: e.target.value,
                    })
                  }
                  placeholder="SKU code"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newProductData.category}
                  onValueChange={(value) =>
                    setNewProductData({ ...newProductData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="FOOD_BEVERAGE">
                      Food & Beverage
                    </SelectItem>
                    <SelectItem value="ELECTRONICS">Electronics</SelectItem>
                    <SelectItem value="CLOTHING">Clothing</SelectItem>
                    <SelectItem value="HOME_GARDEN">Home & Garden</SelectItem>
                    <SelectItem value="HEALTH_BEAUTY">
                      Health & Beauty
                    </SelectItem>
                    <SelectItem value="SPORTS">Sports & Outdoors</SelectItem>
                    <SelectItem value="BOOKS_MEDIA">Books & Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input
                  value={newProductData.barcode}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      barcode: e.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Selling Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProductData.price}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      price: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProductData.cost}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      cost: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProductData.taxRate}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      taxRate: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsAddProductDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateProduct}>
              Create Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
