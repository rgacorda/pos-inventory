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
import { Plus, Edit, Trash2, Search, Package } from "lucide-react";
import { toast } from "sonner";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    price: "",
    cost: "",
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
      console.error("Failed to load products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sku: "",
      name: "",
      description: "",
      category: "",
      price: "",
      cost: "",
      taxRate: "0.08",
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
      cost: product.cost?.toString() || "",
      taxRate: product.taxRate?.toString() || "0.08",
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
        cost: parseFloat(formData.cost),
        taxRate: parseFloat(formData.taxRate),
        stockQuantity: parseInt(formData.stockQuantity),
        lowStockThreshold: parseInt(formData.lowStockThreshold),
      };

      await apiClient.createProduct(productData);
      toast.success("Product added successfully");
      setShowAddDialog(false);
      resetForm();
      loadProducts();
    } catch (error: any) {
      console.error("Failed to add product:", error);
      toast.error(error.response?.data?.message || "Failed to add product");
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
        cost: parseFloat(formData.cost),
        taxRate: parseFloat(formData.taxRate),
        stockQuantity: parseInt(formData.stockQuantity),
        lowStockThreshold: parseInt(formData.lowStockThreshold),
      };

      await apiClient.updateProduct(selectedProduct.id, productData);
      toast.success("Product updated successfully");
      setShowEditDialog(false);
      setSelectedProduct(null);
      resetForm();
      loadProducts();
    } catch (error: any) {
      console.error("Failed to update product:", error);
      toast.error(error.response?.data?.message || "Failed to update product");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await apiClient.deleteProduct(selectedProduct.id);
      toast.success("Product deleted successfully");
      setShowDeleteDialog(false);
      setSelectedProduct(null);
      loadProducts();
    } catch (error: any) {
      console.error("Failed to delete product:", error);
      toast.error(error.response?.data?.message || "Failed to delete product");
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="px-4 lg:px-6">
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
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.sku}
                    </TableCell>
                    <TableCell>{product.category || "N/A"}</TableCell>
                    <TableCell className="font-semibold">
                      ${Number(product.price).toFixed(2)}
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
                          product.status === "ACTIVE" ? "default" : "secondary"
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

                      {/* Add Product Dialog */}
                      <Dialog
                        open={showAddDialog}
                        onOpenChange={setShowAddDialog}
                      >
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                                <Label htmlFor="category">Category</Label>
                                <Input
                                  id="category"
                                  value={formData.category}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      category: e.target.value,
                                    })
                                  }
                                  placeholder="Beverages"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="price">Price *</Label>
                                  <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        price: e.target.value,
                                      })
                                    }
                                    placeholder="2.49"
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="cost">Cost</Label>
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
                                    placeholder="1.20"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="stockQuantity">
                                    Stock Quantity *
                                  </Label>
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
                                  <Label htmlFor="lowStockThreshold">
                                    Low Stock Alert
                                  </Label>
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
                                      <SelectItem value="ACTIVE">
                                        Active
                                      </SelectItem>
                                      <SelectItem value="INACTIVE">
                                        Inactive
                                      </SelectItem>
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
                      </Dialog>

                      {/* Edit Product Dialog */}
                      <Dialog
                        open={showEditDialog}
                        onOpenChange={setShowEditDialog}
                      >
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Edit Product</DialogTitle>
                            <DialogDescription>
                              Update product information
                            </DialogDescription>
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
                                <Label htmlFor="edit-name">
                                  Product Name *
                                </Label>
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
                                <Label htmlFor="edit-description">
                                  Description
                                </Label>
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
                                <Label htmlFor="edit-category">Category</Label>
                                <Input
                                  id="edit-category"
                                  value={formData.category}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      category: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-price">Price *</Label>
                                  <Input
                                    id="edit-price"
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        price: e.target.value,
                                      })
                                    }
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-cost">Cost</Label>
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
                                  />
                                </div>
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
                                      <SelectItem value="ACTIVE">
                                        Active
                                      </SelectItem>
                                      <SelectItem value="INACTIVE">
                                        Inactive
                                      </SelectItem>
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
                      </Dialog>

                      {/* Delete Confirmation Dialog */}
                      <AlertDialog
                        open={showDeleteDialog}
                        onOpenChange={setShowDeleteDialog}
                      >
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete{" "}
                              <span className="font-semibold">
                                {selectedProduct?.name}
                              </span>
                              . This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
