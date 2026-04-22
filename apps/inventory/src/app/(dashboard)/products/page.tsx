"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiClient } from "@/lib/api-client";
import { Plus, Edit, Trash2, Search, Package, AlertTriangle, Check, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { 
  showSuccessToast, 
  showErrorFromException,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES 
} from "@/lib/toast-utils";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openCategoryCombobox, setOpenCategoryCombobox] = useState(false);
  const [openEditCategoryCombobox, setOpenEditCategoryCombobox] = useState(false);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    price: "",
    packPrice: "",
    packQuantity: "",
    cost: "",
    markupPercentage: "",
    markupFixed: "",
    taxRate: "0.08",
    stockQuantity: "",
    lowStockThreshold: "10",
    barcode: "",
    status: "ACTIVE",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await apiClient.getProducts();
      setProducts(data);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("products"));
    } finally {
      setLoading(false);
    }
  };

  // Calculate selling price from cost and markups
  const calculatePrice = (cost: string, markupPercentage: string, markupFixed: string): number => {
    const costNum = parseFloat(cost) || 0;
    const percentNum = parseFloat(markupPercentage) || 0;
    const fixedNum = parseFloat(markupFixed) || 0;
    
    return costNum + (costNum * percentNum / 100) + fixedNum;
  };

  // Update price when cost or markups change
  useEffect(() => {
    if (formData.cost || formData.markupPercentage || formData.markupFixed) {
      const calculatedPrice = calculatePrice(formData.cost, formData.markupPercentage, formData.markupFixed);
      setFormData(prev => ({
        ...prev,
        price: calculatedPrice > 0 ? calculatedPrice.toFixed(2) : ""
      }));
    }
  }, [formData.cost, formData.markupPercentage, formData.markupFixed]);

  const resetForm = () => {
    setFormData({
      sku: "",
      name: "",
      description: "",
      category: "",
      price: "",
      packPrice: "",
      packQuantity: "",
      cost: "",
      markupPercentage: "",
      markupFixed: "",
      taxRate: "0",
      stockQuantity: "",
      lowStockThreshold: "10",
      barcode: "",
      status: "ACTIVE",
    });
  };

  const handleAddProduct = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setFormData({
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      category: product.category || "",
      price: product.price?.toString() || "",
      packPrice: product.packPrice?.toString() || "",
      packQuantity: product.packQuantity?.toString() || "",
      cost: product.cost?.toString() || "",
      markupPercentage: product.markupPercentage?.toString() || "",
      markupFixed: product.markupFixed?.toString() || "",
      taxRate: product.taxRate?.toString() || "0",
      stockQuantity: product.stockQuantity?.toString() || "",
      lowStockThreshold: product.lowStockThreshold?.toString() || "10",
      barcode: product.barcode || "",
      status: product.status || "ACTIVE",
    });
    setShowEditDialog(true);
  };

  const handleDeleteProduct = (product: any) => {
    setSelectedProduct(product);
    setShowDeleteDialog(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        packPrice: formData.packPrice ? parseFloat(formData.packPrice) : null,
        packQuantity: formData.packQuantity ? parseInt(formData.packQuantity) : null,
        cost: parseFloat(formData.cost),
        markupPercentage: formData.markupPercentage ? parseFloat(formData.markupPercentage) : null,
        markupFixed: formData.markupFixed ? parseFloat(formData.markupFixed) : null,
        taxRate: parseFloat(formData.taxRate),
        stockQuantity: parseInt(formData.stockQuantity),
        lowStockThreshold: parseInt(formData.lowStockThreshold),
      };

      await apiClient.createProduct(productData);
      showSuccessToast(SUCCESS_MESSAGES.CREATED("Product"));
      setShowAddDialog(false);
      resetForm();
      loadProducts();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("product"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        packPrice: formData.packPrice ? parseFloat(formData.packPrice) : null,
        packQuantity: formData.packQuantity ? parseInt(formData.packQuantity) : null,
        cost: parseFloat(formData.cost),
        markupPercentage: formData.markupPercentage ? parseFloat(formData.markupPercentage) : null,
        markupFixed: formData.markupFixed ? parseFloat(formData.markupFixed) : null,
        taxRate: parseFloat(formData.taxRate),
        stockQuantity: parseInt(formData.stockQuantity),
        lowStockThreshold: parseInt(formData.lowStockThreshold),
      };

      await apiClient.updateProduct(selectedProduct.id, productData);
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Product"));
      setShowEditDialog(false);
      setSelectedProduct(null);
      resetForm();
      loadProducts();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("product"));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await apiClient.deleteProduct(selectedProduct.id);
      showSuccessToast(SUCCESS_MESSAGES.DELETED("Product"));
      setShowDeleteDialog(false);
      setSelectedProduct(null);
      loadProducts();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("product"));
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort filtered products
  const sortedProducts = sortColumn
    ? [...filteredProducts].sort((a, b) => {
        let aValue = a[sortColumn];
        let bValue = b[sortColumn];

        // Handle special cases
        if (sortColumn === 'profit') {
          aValue = (Number(a.price) || 0) - (Number(a.cost) || 0);
          bValue = (Number(b.price) || 0) - (Number(b.cost) || 0);
        }

        // Handle null/undefined
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';

        // Convert to numbers if numeric
        if (typeof aValue === 'number' || !isNaN(Number(aValue))) {
          aValue = Number(aValue);
          bValue = Number(bValue);
        } else {
          // Convert to lowercase for string comparison
          aValue = String(aValue).toLowerCase();
          bValue = String(bValue).toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredProducts;

  // Render sort icon
  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  // Filter low stock products (stockQuantity <= lowStockThreshold)
  const lowStockProducts = products.filter(
    (p) => p.stockQuantity <= (p.lowStockThreshold || 10)
  );

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Low stock pagination
  const lowStockTotalPages = Math.ceil(lowStockProducts.length / itemsPerPage);
  const paginatedLowStockProducts = lowStockProducts.slice(
    (lowStockPage - 1) * itemsPerPage,
    lowStockPage * itemsPerPage,
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Get unique categories from products
  const uniqueCategories = Array.from(
    new Set(products.map((p) => p.category).filter((c) => c && c.trim() !== ""))
  ).sort();

  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Low Stock Alert Card */}
      {lowStockProducts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <CardTitle className="text-amber-900">Low Stock Alert</CardTitle>
                <CardDescription className="text-amber-700">
                  {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} running low on stock
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLowStockProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.sku}
                      </TableCell>
                      <TableCell>{product.category || "N/A"}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          product.stockQuantity === 0 
                            ? "text-red-600" 
                            : "text-amber-600"
                        }`}>
                          {product.stockQuantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.lowStockThreshold || 10}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₱{Number(product.price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditProduct(product)}
                          title="Update stock"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Low Stock Pagination */}
            {lowStockTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(lowStockPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(lowStockPage * itemsPerPage, lowStockProducts.length)}{" "}
                  of {lowStockProducts.length} low stock items
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLowStockPage((p) => Math.max(1, p - 1))}
                    disabled={lowStockPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(lowStockTotalPages, 5) }, (_, i) => {
                      let pageNum;
                      if (lowStockTotalPages <= 5) {
                        pageNum = i + 1;
                      } else if (lowStockPage <= 3) {
                        pageNum = i + 1;
                      } else if (lowStockPage >= lowStockTotalPages - 2) {
                        pageNum = lowStockTotalPages - 4 + i;
                      } else {
                        pageNum = lowStockPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={
                            lowStockPage === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setLowStockPage(pageNum)}
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
                    onClick={() =>
                      setLowStockPage((p) => Math.min(lowStockTotalPages, p + 1))
                    }
                    disabled={lowStockPage === lowStockTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Inventory</CardTitle>
              <CardDescription>
                View and manage all products in your store
              </CardDescription>
            </div>
            <Button onClick={handleAddProduct}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading products...</div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <div className="text-muted-foreground">No products found</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Product
                        <SortIcon column="name" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('sku')}
                    >
                      <div className="flex items-center">
                        SKU
                        <SortIcon column="sku" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center">
                        Category
                        <SortIcon column="category" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('cost')}
                    >
                      <div className="flex items-center">
                        Cost
                        <SortIcon column="cost" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('markupPercentage')}
                    >
                      <div className="flex items-center">
                        Markup %
                        <SortIcon column="markupPercentage" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('markupFixed')}
                    >
                      <div className="flex items-center">
                        Fixed ₱
                        <SortIcon column="markupFixed" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center">
                        Selling Price
                        <SortIcon column="price" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('packPrice')}
                    >
                      <div className="flex items-center">
                        Pack Price
                        <SortIcon column="packPrice" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('profit')}
                    >
                      <div className="flex items-center">
                        Profit
                        <SortIcon column="profit" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('stockQuantity')}
                    >
                      <div className="flex items-center">
                        Stock
                        <SortIcon column="stockQuantity" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon column="status" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.map((product) => {
                    const cost = Number(product.cost) || 0;
                    const sellingPrice = Number(product.price) || 0;
                    const profit = sellingPrice - cost;
                    
                    return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.sku}
                      </TableCell>
                      <TableCell>{product.category || "N/A"}</TableCell>
                      <TableCell className="font-medium">
                        ₱{cost.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {product.markupPercentage ? `${Number(product.markupPercentage).toFixed(2)}%` : "-"}
                      </TableCell>
                      <TableCell>
                        {product.markupFixed ? `₱${Number(product.markupFixed).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ₱{sellingPrice.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {product.packPrice && product.packQuantity ? (
                          <div className="text-sm">
                            <div className="font-medium text-blue-600">
                              ₱{Number(product.packPrice).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {product.packQuantity} pcs
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${
                        profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-gray-600"
                      }`}>
                        ₱{profit.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-medium ${
                            product.stockQuantity > 10
                              ? "text-green-600"
                              : product.stockQuantity > 0
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {product.stockQuantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            product.status === "ACTIVE"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            )}
          </div>
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, sortedProducts.length)}{" "}
                of {sortedProducts.length} results
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
                        variant={
                          currentPage === pageNum ? "default" : "outline"
                        }
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        {showAddDialog && (
          <DialogContent className="!max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Add a new product to your inventory
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitAdd}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sku: e.target.value,
                        })
                      }
                      placeholder="PROD-001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          barcode: e.target.value,
                        })
                      }
                      placeholder="123456789012"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                    placeholder="Coca-Cola 500ml"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Refreshing cola drink"
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
                        {formData.category || "Select or add category..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                      <Command>
                        <CommandInput 
                          placeholder="Search or type new category..." 
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="p-2 text-sm">
                              Press Enter to add &quot;{formData.category}&quot;
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {uniqueCategories.map((cat) => (
                              <CommandItem
                                key={cat}
                                value={cat}
                                onSelect={(currentValue) => {
                                  setFormData({ ...formData, category: currentValue });
                                  setOpenCategoryCombobox(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.category === cat ? "opacity-100" : "opacity-0"
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
                    <Label htmlFor="cost">Cost *</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cost: e.target.value,
                        })
                      }
                      placeholder="10.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="markupPercentage">Markup (%) </Label>
                    <Input
                      id="markupPercentage"
                      type="number"
                      step="0.01"
                      value={formData.markupPercentage}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          markupPercentage: e.target.value,
                        })
                      }
                      placeholder="20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="markupFixed">Fixed Markup (₱)</Label>
                    <Input
                      id="markupFixed"
                      type="number"
                      step="0.01"
                      value={formData.markupFixed}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          markupFixed: e.target.value,
                        })
                      }
                      placeholder="1.50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Selling Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      readOnly
                      className="bg-muted"
                      placeholder="0.00"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Auto-calculated from cost + markups</p>
                  </div>
                </div>

                {/* Tiered Pricing Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold mb-3 text-gray-700">Pack/Dozen Pricing (Optional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="packQuantity">Pack Quantity</Label>
                      <Input
                        id="packQuantity"
                        type="number"
                        value={formData.packQuantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            packQuantity: e.target.value,
                          })
                        }
                        placeholder="12"
                      />
                      <p className="text-xs text-muted-foreground">Items per pack (e.g., 12 for dozen)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="packPrice">Pack Price (₱)</Label>
                      <Input
                        id="packPrice"
                        type="number"
                        step="0.01"
                        value={formData.packPrice}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            packPrice: e.target.value,
                          })
                        }
                        placeholder="10.00"
                      />
                      <p className="text-xs text-muted-foreground">Total price for the pack</p>
                    </div>
                  </div>
                  {formData.packQuantity && formData.packPrice && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <span className="text-blue-900">
                        Per-item price when buying {formData.packQuantity} or more: 
                        <strong className="ml-1">
                          ₱{(parseFloat(formData.packPrice) / parseInt(formData.packQuantity)).toFixed(2)}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stockQuantity">Stock Quantity *</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      value={formData.stockQuantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stockQuantity: e.target.value,
                        })
                      }
                      placeholder="100"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low Stock Alert</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      value={formData.lowStockThreshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lowStockThreshold: e.target.value,
                        })
                      }
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">Tax Rate</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      step="0.01"
                      value={formData.taxRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          taxRate: e.target.value,
                        })
                      }
                      placeholder="0.08"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          status: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="OUT_OF_STOCK">
                          Out of Stock
                        </SelectItem>
                        <SelectItem value="DISCONTINUED">
                          Discontinued
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Adding..." : "Add Product"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        {showEditDialog && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>Update product information</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitEdit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU *</Label>
                    <Input
                      id="edit-sku"
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sku: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-barcode">Barcode</Label>
                    <Input
                      id="edit-barcode"
                      value={formData.barcode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          barcode: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Popover open={openEditCategoryCombobox} onOpenChange={setOpenEditCategoryCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openEditCategoryCombobox}
                        className="w-full justify-between"
                      >
                        {formData.category || "Select or add category..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                      <Command>
                        <CommandInput 
                          placeholder="Search or type new category..." 
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="p-2 text-sm">
                              Press Enter to add &quot;{formData.category}&quot;
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {uniqueCategories.map((cat) => (
                              <CommandItem
                                key={cat}
                                value={cat}
                                onSelect={(currentValue) => {
                                  setFormData({ ...formData, category: currentValue });
                                  setOpenEditCategoryCombobox(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.category === cat ? "opacity-100" : "opacity-0"
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
                    <Label htmlFor="edit-cost">Cost *</Label>
                    <Input
                      id="edit-cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cost: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-markupPercentage">Markup (%)</Label>
                    <Input
                      id="edit-markupPercentage"
                      type="number"
                      step="0.01"
                      value={formData.markupPercentage}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          markupPercentage: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-markupFixed">Fixed Markup (₱)</Label>
                    <Input
                      id="edit-markupFixed"
                      type="number"
                      step="0.01"
                      value={formData.markupFixed}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          markupFixed: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Selling Price *</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      readOnly
                      className="bg-muted"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Auto-calculated from cost + markups</p>
                  </div>
                </div>

                {/* Tiered Pricing Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold mb-3 text-gray-700">Pack/Dozen Pricing (Optional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-packQuantity">Pack Quantity</Label>
                      <Input
                        id="edit-packQuantity"
                        type="number"
                        value={formData.packQuantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            packQuantity: e.target.value,
                          })
                        }
                        placeholder="12"
                      />
                      <p className="text-xs text-muted-foreground">Items per pack (e.g., 12 for dozen)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-packPrice">Pack Price (₱)</Label>
                      <Input
                        id="edit-packPrice"
                        type="number"
                        step="0.01"
                        value={formData.packPrice}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            packPrice: e.target.value,
                          })
                        }
                        placeholder="10.00"
                      />
                      <p className="text-xs text-muted-foreground">Total price for the pack</p>
                    </div>
                  </div>
                  {formData.packQuantity && formData.packPrice && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <span className="text-blue-900">
                        Per-item price when buying {formData.packQuantity} or more: 
                        <strong className="ml-1">
                          ₱{(parseFloat(formData.packPrice) / parseInt(formData.packQuantity)).toFixed(2)}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-stockQuantity">
                      Stock Quantity *
                    </Label>
                    <Input
                      id="edit-stockQuantity"
                      type="number"
                      value={formData.stockQuantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stockQuantity: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-lowStockThreshold">
                      Low Stock Alert
                    </Label>
                    <Input
                      id="edit-lowStockThreshold"
                      type="number"
                      value={formData.lowStockThreshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lowStockThreshold: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-taxRate">Tax Rate</Label>
                    <Input
                      id="edit-taxRate"
                      type="number"
                      step="0.01"
                      value={formData.taxRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          taxRate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          status: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="OUT_OF_STOCK">
                          Out of Stock
                        </SelectItem>
                        <SelectItem value="DISCONTINUED">
                          Discontinued
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Updating..." : "Update Product"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">{selectedProduct?.name}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
