"use client";

import { useEffect, useRef, useState } from "react";
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
import { Plus, Edit, Trash2, Search, Package, AlertTriangle, Check, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { 
  showSuccessToast, 
  showErrorFromException,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES 
} from "@/lib/toast-utils";

const PRODUCT_TABLE_COLUMNS: { id: string; label: string }[] = [
  { id: "name", label: "Product" },
  { id: "sku", label: "SKU" },
  { id: "category", label: "Category" },
  { id: "supplier", label: "Supplier" },
  { id: "cost", label: "Cost" },
  { id: "markupPercentage", label: "Markup %" },
  { id: "markupFixed", label: "Fixed ₱" },
  { id: "price", label: "Selling Price" },
  { id: "packPrice", label: "Pack / Half-Pack" },
  { id: "packsAvailable", label: "Packs Sellable" },
  { id: "profit", label: "Profit" },
  { id: "stockQuantity", label: "Stock" },
  { id: "status", label: "Status" },
];

const DEFAULT_HIDDEN_PRODUCT_COLUMNS = ["markupPercentage", "markupFixed", "sku", "category"];

const PRODUCT_TABLE_COLUMNS_STORAGE_KEY = "products-table-hidden-columns";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isCreateSupplierDialogOpen, setIsCreateSupplierDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openCategoryCombobox, setOpenCategoryCombobox] = useState(false);
  const [openEditCategoryCombobox, setOpenEditCategoryCombobox] = useState(false);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    new Set(DEFAULT_HIDDEN_PRODUCT_COLUMNS)
  );
  const itemsPerPage = 20;
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    supplierId: "",
    price: "",
    cost: "",
    markupPercentage: "",
    markupFixed: "",
    packQuantity: "",
    packMarkupPercentage: "",
    packMarkupFixed: "",
    packPrice: "",
    halfPackQuantity: "",
    halfPackMarkupPercentage: "",
    halfPackMarkupFixed: "",
    halfPackPrice: "",
    addonPrice: "0",
    convenienceMarkupPercentage: "",
    convenienceMarkup: "0",
    taxRate: "0.08",
    stockQuantity: "",
    lowStockThreshold: "10",
    barcode: "",
    status: "ACTIVE",
  });
  const [supplierFormData, setSupplierFormData] = useState({
    name: "",
    contactNumber: "",
    email: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProducts();
    loadSuppliers();
  }, []);

  // Restore any previously saved column visibility preference, falling back
  // to the defaults (markup %, fixed markup, SKU, and category hidden).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRODUCT_TABLE_COLUMNS_STORAGE_KEY);
      if (stored) {
        setHiddenColumns(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore malformed/unavailable storage and keep the defaults.
    }
  }, []);

  const isColumnVisible = (columnId: string) => !hiddenColumns.has(columnId);

  const toggleColumn = (columnId: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      try {
        localStorage.setItem(PRODUCT_TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage errors (e.g. private browsing mode).
      }
      return next;
    });
  };

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

  const loadSuppliers = async () => {
    try {
      const data = await apiClient.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("suppliers"));
    }
  };

  const resetSupplierForm = () => {
    setSupplierFormData({ name: "", contactNumber: "", email: "" });
  };

  const handleCreateSupplier = async () => {
    if (!supplierFormData.name.trim()) {
      showErrorFromException(new Error("Supplier name is required"), "Validation Error");
      return;
    }

    try {
      const savedSupplier = await apiClient.createSupplier(supplierFormData);
      showSuccessToast(SUCCESS_MESSAGES.CREATED("Supplier"));
      await loadSuppliers();
      setFormData((prev) => ({ ...prev, supplierId: savedSupplier.id }));
      setIsCreateSupplierDialogOpen(false);
      resetSupplierForm();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("supplier"));
    }
  };

  const computePrice = (cost: string, pct: string, fixed: string): number => {
    const c = parseFloat(cost) || 0;
    const p = parseFloat(pct) || 0;
    const f = parseFloat(fixed) || 0;
    return c + (c * p / 100) + f;
  };

  // Pack/half-pack pricing keeps a "base" price (cost x quantity, or a
  // manually-typed price) separate from the displayed price so that markup
  // (percentage and/or fixed) is always layered ON TOP of that base instead
  // of replacing it. Without this, editing a markup field recomputed the
  // price from cost x quantity alone and silently discarded any manually
  // entered pack price.
  const packBaseRef = useRef(0);
  const halfPackBaseRef = useRef(0);
  const skipPackBaseSyncRef = useRef(false);
  const skipHalfPackBaseSyncRef = useRef(false);

  const applyTieredMarkup = (base: number, pct: string, fixed: string): number => {
    const p = parseFloat(pct) || 0;
    const f = parseFloat(fixed) || 0;
    return base + (base * p) / 100 + f;
  };

  // Reverse-solve the base price so that base + markup === the value the
  // user just typed, keeping future markup edits consistent.
  const deriveBaseFromDisplayedPrice = (displayed: number, pct: string, fixed: string): number => {
    const p = parseFloat(pct) || 0;
    const f = parseFloat(fixed) || 0;
    const denom = 1 + p / 100;
    return denom !== 0 ? (displayed - f) / denom : displayed;
  };

  // Manually typing a Pack/Half-Pack price updates the underlying base (via
  // reverse-solve) instead of being blown away the next time a markup field
  // changes, so pack price + markup now correctly combine.
  const handleManualPackPriceChange = (value: string) => {
    const displayed = parseFloat(value) || 0;
    packBaseRef.current = deriveBaseFromDisplayedPrice(displayed, formData.packMarkupPercentage, formData.packMarkupFixed);
    setFormData(prev => ({ ...prev, packPrice: value }));
  };

  const handleManualHalfPackPriceChange = (value: string) => {
    const displayed = parseFloat(value) || 0;
    halfPackBaseRef.current = deriveBaseFromDisplayedPrice(displayed, formData.halfPackMarkupPercentage, formData.halfPackMarkupFixed);
    setFormData(prev => ({ ...prev, halfPackPrice: value }));
  };

  useEffect(() => {
    if (formData.cost || formData.markupPercentage || formData.markupFixed) {
      const calculated = computePrice(formData.cost, formData.markupPercentage, formData.markupFixed);
      setFormData(prev => ({ ...prev, price: calculated > 0 ? calculated.toFixed(2) : "" }));
    }
  }, [formData.cost, formData.markupPercentage, formData.markupFixed]);

  // Recompute the pack base whenever cost/quantity change (the most
  // authoritative source), then re-apply whatever markup is currently set.
  useEffect(() => {
    if (skipPackBaseSyncRef.current) {
      skipPackBaseSyncRef.current = false;
      return;
    }
    if (!formData.packQuantity) {
      packBaseRef.current = 0;
      setFormData(prev => ({ ...prev, packPrice: "" }));
      return;
    }
    const cost = parseFloat(formData.cost) || 0;
    const qty = parseInt(formData.packQuantity) || 0;
    packBaseRef.current = cost * qty;
    setFormData(prev => {
      const calculated = applyTieredMarkup(packBaseRef.current, prev.packMarkupPercentage, prev.packMarkupFixed);
      return { ...prev, packPrice: calculated > 0 ? calculated.toFixed(2) : "" };
    });
  }, [formData.cost, formData.packQuantity]);

  // Markup changes always combine with the current base (never overwrite it).
  useEffect(() => {
    if (!formData.packQuantity) return;
    const calculated = applyTieredMarkup(packBaseRef.current, formData.packMarkupPercentage, formData.packMarkupFixed);
    setFormData(prev => ({ ...prev, packPrice: calculated > 0 ? calculated.toFixed(2) : "" }));
  }, [formData.packMarkupPercentage, formData.packMarkupFixed]);

  useEffect(() => {
    if (skipHalfPackBaseSyncRef.current) {
      skipHalfPackBaseSyncRef.current = false;
      return;
    }
    if (!formData.halfPackQuantity) {
      halfPackBaseRef.current = 0;
      setFormData(prev => ({ ...prev, halfPackPrice: "" }));
      return;
    }
    const cost = parseFloat(formData.cost) || 0;
    const qty = parseInt(formData.halfPackQuantity) || 0;
    halfPackBaseRef.current = cost * qty;
    setFormData(prev => {
      const calculated = applyTieredMarkup(halfPackBaseRef.current, prev.halfPackMarkupPercentage, prev.halfPackMarkupFixed);
      return { ...prev, halfPackPrice: calculated > 0 ? calculated.toFixed(2) : "" };
    });
  }, [formData.cost, formData.halfPackQuantity]);

  useEffect(() => {
    if (!formData.halfPackQuantity) return;
    const calculated = applyTieredMarkup(halfPackBaseRef.current, formData.halfPackMarkupPercentage, formData.halfPackMarkupFixed);
    setFormData(prev => ({ ...prev, halfPackPrice: calculated > 0 ? calculated.toFixed(2) : "" }));
  }, [formData.halfPackMarkupPercentage, formData.halfPackMarkupFixed]);

  const resetForm = () => {
    setFormData({
      sku: "",
      name: "",
      description: "",
      category: "",
      supplierId: "",
      price: "",
      cost: "",
      markupPercentage: "",
      markupFixed: "",
      packQuantity: "",
      packMarkupPercentage: "",
      packMarkupFixed: "",
      packPrice: "",
      halfPackQuantity: "",
      halfPackMarkupPercentage: "",
      halfPackMarkupFixed: "",
      halfPackPrice: "",
      addonPrice: "0",
      convenienceMarkupPercentage: "",
      convenienceMarkup: "0",
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

    // Seed the pack/half-pack base refs from the product's own saved values
    // (reverse-solving out any already-applied markup) so the cost/quantity
    // sync effect doesn't clobber a legacy/manual price when the dialog opens.
    const packQty = Number(product.packQuantity) || 0;
    const packPriceVal = Number(product.packPrice) || 0;
    packBaseRef.current = packPriceVal > 0
      ? deriveBaseFromDisplayedPrice(packPriceVal, product.packMarkupPercentage?.toString() || "", product.packMarkupFixed?.toString() || "")
      : (Number(product.cost) || 0) * packQty;
    skipPackBaseSyncRef.current = true;

    const halfPackQty = Number(product.halfPackQuantity) || 0;
    const halfPackPriceVal = Number(product.halfPackPrice) || 0;
    halfPackBaseRef.current = halfPackPriceVal > 0
      ? deriveBaseFromDisplayedPrice(halfPackPriceVal, product.halfPackMarkupPercentage?.toString() || "", product.halfPackMarkupFixed?.toString() || "")
      : (Number(product.cost) || 0) * halfPackQty;
    skipHalfPackBaseSyncRef.current = true;

    setFormData({
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      category: product.category || "",
      supplierId: product.supplierId || product.supplier?.id || "",
      price: product.price?.toString() || "",
      cost: product.cost?.toString() || "",
      markupPercentage: product.markupPercentage?.toString() || "",
      markupFixed: product.markupFixed?.toString() || "",
      packQuantity: product.packQuantity?.toString() || "",
      packMarkupPercentage: product.packMarkupPercentage?.toString() || "",
      packMarkupFixed: product.packMarkupFixed?.toString() || "",
      packPrice: product.packPrice?.toString() || "",
      halfPackQuantity: product.halfPackQuantity?.toString() || "",
      halfPackMarkupPercentage: product.halfPackMarkupPercentage?.toString() || "",
      halfPackMarkupFixed: product.halfPackMarkupFixed?.toString() || "",
      halfPackPrice: product.halfPackPrice?.toString() || "",
      addonPrice: product.addonPrice?.toString() || "0",
      convenienceMarkupPercentage: product.convenienceMarkupPercentage?.toString() || "",
      convenienceMarkup: product.convenienceMarkup?.toString() || "0",
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
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        supplierId: formData.supplierId || null,
        barcode: formData.barcode || undefined,
        status: formData.status,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost),
        markupPercentage: formData.markupPercentage ? parseFloat(formData.markupPercentage) : null,
        markupFixed: formData.markupFixed ? parseFloat(formData.markupFixed) : null,
        packQuantity: formData.packQuantity ? parseInt(formData.packQuantity) : null,
        packMarkupPercentage: formData.packMarkupPercentage ? parseFloat(formData.packMarkupPercentage) : null,
        packMarkupFixed: formData.packMarkupFixed ? parseFloat(formData.packMarkupFixed) : null,
        packPrice: formData.packPrice ? parseFloat(formData.packPrice) : null,
        halfPackQuantity: formData.halfPackQuantity ? parseInt(formData.halfPackQuantity) : null,
        halfPackMarkupPercentage: formData.halfPackMarkupPercentage ? parseFloat(formData.halfPackMarkupPercentage) : null,
        halfPackMarkupFixed: formData.halfPackMarkupFixed ? parseFloat(formData.halfPackMarkupFixed) : null,
        halfPackPrice: formData.halfPackPrice ? parseFloat(formData.halfPackPrice) : null,
        addonPrice: formData.addonPrice ? parseFloat(formData.addonPrice) : 0,
        convenienceMarkupPercentage: formData.convenienceMarkupPercentage ? parseFloat(formData.convenienceMarkupPercentage) : null,
        convenienceMarkup: formData.convenienceMarkup ? parseFloat(formData.convenienceMarkup) : 0,
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
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        supplierId: formData.supplierId || null,
        barcode: formData.barcode || undefined,
        status: formData.status,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost),
        markupPercentage: formData.markupPercentage ? parseFloat(formData.markupPercentage) : null,
        markupFixed: formData.markupFixed ? parseFloat(formData.markupFixed) : null,
        packQuantity: formData.packQuantity ? parseInt(formData.packQuantity) : null,
        packMarkupPercentage: formData.packMarkupPercentage ? parseFloat(formData.packMarkupPercentage) : null,
        packMarkupFixed: formData.packMarkupFixed ? parseFloat(formData.packMarkupFixed) : null,
        packPrice: formData.packPrice ? parseFloat(formData.packPrice) : null,
        halfPackQuantity: formData.halfPackQuantity ? parseInt(formData.halfPackQuantity) : null,
        halfPackMarkupPercentage: formData.halfPackMarkupPercentage ? parseFloat(formData.halfPackMarkupPercentage) : null,
        halfPackMarkupFixed: formData.halfPackMarkupFixed ? parseFloat(formData.halfPackMarkupFixed) : null,
        halfPackPrice: formData.halfPackPrice ? parseFloat(formData.halfPackPrice) : null,
        addonPrice: formData.addonPrice ? parseFloat(formData.addonPrice) : 0,
        convenienceMarkupPercentage: formData.convenienceMarkupPercentage ? parseFloat(formData.convenienceMarkupPercentage) : null,
        convenienceMarkup: formData.convenienceMarkup ? parseFloat(formData.convenienceMarkup) : 0,
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

  // Split search query into individual terms for multi-word search
  const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
  const filteredProducts = products.filter((p) => {
    if (searchQuery === "" || searchTerms.length === 0) return true;
    
    // Check if ALL search terms are present in any of the product fields
    return searchTerms.every(term => 
      p.name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term) ||
      p.supplier?.name?.toLowerCase().includes(term)
    );
  });

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

        if (sortColumn === 'supplier') {
          aValue = a.supplier?.name || '';
          bValue = b.supplier?.name || '';
        }

        if (sortColumn === 'packsAvailable') {
          aValue = a.packQuantity
            ? Math.floor((Number(a.stockQuantity) || 0) / Number(a.packQuantity))
            : -1;
          bValue = b.packQuantity
            ? Math.floor((Number(b.stockQuantity) || 0) / Number(b.packQuantity))
            : -1;
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
    (p) => p.stockQuantity <= (p.lowStockThreshold ?? 10)
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
      {/* Product Inventory Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PRODUCT_TABLE_COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={isColumnVisible(column.id)}
                    onCheckedChange={() => toggleColumn(column.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
                    {isColumnVisible('name') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          Product
                          <SortIcon column="name" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('sku') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('sku')}
                      >
                        <div className="flex items-center">
                          SKU
                          <SortIcon column="sku" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('category') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('category')}
                      >
                        <div className="flex items-center">
                          Category
                          <SortIcon column="category" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('supplier') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('supplier')}
                      >
                        <div className="flex items-center">
                          Supplier
                          <SortIcon column="supplier" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('cost') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('cost')}
                      >
                        <div className="flex items-center">
                          Cost
                          <SortIcon column="cost" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('markupPercentage') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('markupPercentage')}
                      >
                        <div className="flex items-center">
                          Markup %
                          <SortIcon column="markupPercentage" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('markupFixed') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('markupFixed')}
                      >
                        <div className="flex items-center">
                          Fixed ₱
                          <SortIcon column="markupFixed" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('price') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('price')}
                      >
                        <div className="flex items-center">
                          Selling Price
                          <SortIcon column="price" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('packPrice') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('packPrice')}
                      >
                        <div className="flex items-center">
                          Pack / Half-Pack
                          <SortIcon column="packPrice" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('packsAvailable') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('packsAvailable')}
                      >
                        <div className="flex items-center">
                          Packs Sellable
                          <SortIcon column="packsAvailable" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('profit') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('profit')}
                      >
                        <div className="flex items-center">
                          Profit
                          <SortIcon column="profit" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('stockQuantity') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('stockQuantity')}
                      >
                        <div className="flex items-center">
                          Stock
                          <SortIcon column="stockQuantity" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible('status') && (
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Status
                          <SortIcon column="status" />
                        </div>
                      </TableHead>
                    )}
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
                      {isColumnVisible('name') && (
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                      )}
                      {isColumnVisible('sku') && (
                        <TableCell className="font-mono text-sm">
                          {product.sku}
                        </TableCell>
                      )}
                      {isColumnVisible('category') && (
                        <TableCell>{product.category || "N/A"}</TableCell>
                      )}
                      {isColumnVisible('supplier') && (
                        <TableCell>
                          {product.supplier?.name || (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('cost') && (
                        <TableCell className="font-medium">
                          ₱{cost.toFixed(2)}
                        </TableCell>
                      )}
                      {isColumnVisible('markupPercentage') && (
                        <TableCell>
                          {product.markupPercentage ? `${Number(product.markupPercentage).toFixed(2)}%` : "-"}
                        </TableCell>
                      )}
                      {isColumnVisible('markupFixed') && (
                        <TableCell>
                          {product.markupFixed ? `₱${Number(product.markupFixed).toFixed(2)}` : "-"}
                        </TableCell>
                      )}
                      {isColumnVisible('price') && (
                        <TableCell className="font-semibold text-green-600">
                          ₱{sellingPrice.toFixed(2)}
                        </TableCell>
                      )}
                      {isColumnVisible('packPrice') && (
                        <TableCell>
                          {product.packPrice || product.halfPackPrice ? (
                            <div className="text-sm space-y-1">
                              {product.packPrice && product.packQuantity && (
                                <div>
                                  <div className="font-medium text-blue-600">
                                    ₱{Number(product.packPrice).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Pack · {product.packQuantity} pcs
                                  </div>
                                </div>
                              )}
                              {product.halfPackPrice && product.halfPackQuantity && (
                                <div>
                                  <div className="font-medium text-indigo-600">
                                    ₱{Number(product.halfPackPrice).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Half · {product.halfPackQuantity} pcs
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('packsAvailable') && (
                        <TableCell>
                          {product.packQuantity ? (
                            (() => {
                              const packsSellable = Math.floor(
                                (Number(product.stockQuantity) || 0) / Number(product.packQuantity)
                              );
                              return (
                                <span
                                  className={`font-medium ${
                                    packsSellable > 0 ? "text-blue-600" : "text-red-600"
                                  }`}
                                >
                                  {packsSellable} pack{packsSellable === 1 ? "" : "s"}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('profit') && (
                        <TableCell className={`font-medium ${
                          profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-gray-600"
                        }`}>
                          ₱{profit.toFixed(2)}
                        </TableCell>
                      )}
                      {isColumnVisible('stockQuantity') && (
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
                      )}
                      {isColumnVisible('status') && (
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
                      )}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, sortedProducts.length)}{" "}
                of {sortedProducts.length} results
              </p>
              <div className="flex flex-wrap items-center gap-2">
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
                        {product.lowStockThreshold ?? 10}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(lowStockPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(lowStockPage * itemsPerPage, lowStockProducts.length)}{" "}
                  of {lowStockProducts.length} low stock items
                </p>
                <div className="flex flex-wrap items-center gap-2">
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

                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.supplierId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, supplierId: value })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a supplier (optional)" />
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
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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

                {/* Convenience Markup Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold mb-3 text-gray-700">Convenience Store Markup (Optional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="convenienceMarkupPercentage">Convenience Markup (%)</Label>
                      <Input
                        id="convenienceMarkupPercentage"
                        type="number"
                        step="0.01"
                        value={formData.convenienceMarkupPercentage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            convenienceMarkupPercentage: e.target.value,
                          })
                        }
                        placeholder="5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="convenienceMarkup">Fixed Convenience Markup (₱)</Label>
                      <Input
                        id="convenienceMarkup"
                        type="number"
                        step="0.01"
                        value={formData.convenienceMarkup}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            convenienceMarkup: e.target.value,
                          })
                        }
                        placeholder="2.00"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Optional convenience store markup. Cashier can choose to add this when scanning the product.
                  </p>
                </div>

                {/* Add-on Price Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="addonPrice">
                      Add-on Price (Refrigeration Fee)
                    </Label>
                    <Input
                      id="addonPrice"
                      type="number"
                      step="0.01"
                      value={formData.addonPrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          addonPrice: e.target.value,
                        })
                      }
                      placeholder="5.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional fee for refrigeration, cooling, etc. Cashier can choose to add this when scanning the product.
                    </p>
                  </div>
                </div>

                {/* Tiered Pricing Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold mb-4 text-gray-700">Tiered Pricing (Optional)</h4>

                  {/* Pack */}
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pack</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                    <div className="space-y-2">
                      <Label htmlFor="packQuantity">Pack Qty</Label>
                      <Input
                        id="packQuantity"
                        type="number"
                        value={formData.packQuantity}
                        onChange={(e) => setFormData({ ...formData, packQuantity: e.target.value })}
                        placeholder="12"
                      />
                      <p className="text-xs text-muted-foreground">Items per pack</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="packMarkupPercentage">Pack Markup (%)</Label>
                      <Input
                        id="packMarkupPercentage"
                        type="number"
                        step="0.01"
                        value={formData.packMarkupPercentage}
                        onChange={(e) => setFormData({ ...formData, packMarkupPercentage: e.target.value })}
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="packMarkupFixed">Pack Markup (₱)</Label>
                      <Input
                        id="packMarkupFixed"
                        type="number"
                        step="0.01"
                        value={formData.packMarkupFixed}
                        onChange={(e) => setFormData({ ...formData, packMarkupFixed: e.target.value })}
                        placeholder="5.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="packPrice">Pack Price (₱)</Label>
                      <Input
                        id="packPrice"
                        type="number"
                        step="0.01"
                        value={formData.packPrice}
                        onChange={(e) => handleManualPackPriceChange(e.target.value)}
                        placeholder="120.00"
                      />
                      <p className="text-xs text-muted-foreground">Type to set base price; markup above adds on top</p>
                    </div>
                  </div>
                  {formData.packQuantity && formData.packPrice && (
                    <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <span className="text-blue-900">
                        Pack sell price ({formData.packQuantity} pcs):&nbsp;
                        <strong>₱{parseFloat(formData.packPrice).toFixed(2)}</strong>
                        &nbsp;·&nbsp;per item:&nbsp;
                        <strong>₱{(parseFloat(formData.packPrice) / parseInt(formData.packQuantity)).toFixed(2)}</strong>
                      </span>
                    </div>
                  )}

                  {/* Half-Pack */}
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Half-Pack</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                    <div className="space-y-2">
                      <Label htmlFor="halfPackQuantity">Half-Pack Qty</Label>
                      <Input
                        id="halfPackQuantity"
                        type="number"
                        value={formData.halfPackQuantity}
                        onChange={(e) => setFormData({ ...formData, halfPackQuantity: e.target.value })}
                        placeholder="6"
                      />
                      <p className="text-xs text-muted-foreground">Items per half-pack</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="halfPackMarkupPercentage">Half-Pack Markup (%)</Label>
                      <Input
                        id="halfPackMarkupPercentage"
                        type="number"
                        step="0.01"
                        value={formData.halfPackMarkupPercentage}
                        onChange={(e) => setFormData({ ...formData, halfPackMarkupPercentage: e.target.value })}
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="halfPackMarkupFixed">Half-Pack Markup (₱)</Label>
                      <Input
                        id="halfPackMarkupFixed"
                        type="number"
                        step="0.01"
                        value={formData.halfPackMarkupFixed}
                        onChange={(e) => setFormData({ ...formData, halfPackMarkupFixed: e.target.value })}
                        placeholder="3.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="halfPackPrice">Half-Pack Price (₱)</Label>
                      <Input
                        id="halfPackPrice"
                        type="number"
                        step="0.01"
                        value={formData.halfPackPrice}
                        onChange={(e) => handleManualHalfPackPriceChange(e.target.value)}
                        placeholder="65.00"
                      />
                      <p className="text-xs text-muted-foreground">Type to set base price; markup above adds on top</p>
                    </div>
                  </div>
                  {formData.halfPackQuantity && formData.halfPackPrice && (
                    <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-sm">
                      <span className="text-indigo-900">
                        Half-pack sell price ({formData.halfPackQuantity} pcs):&nbsp;
                        <strong>₱{parseFloat(formData.halfPackPrice).toFixed(2)}</strong>
                        &nbsp;·&nbsp;per item:&nbsp;
                        <strong>₱{(parseFloat(formData.halfPackPrice) / parseInt(formData.halfPackQuantity)).toFixed(2)}</strong>
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
          <DialogContent className="!max-w-4xl max-h-[90vh] overflow-y-auto">
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

                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.supplierId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, supplierId: value })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a supplier (optional)" />
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
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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

                {/* Convenience Markup Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold mb-3 text-gray-700">Convenience Store Markup (Optional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-convenienceMarkupPercentage">Convenience Markup (%)</Label>
                      <Input
                        id="edit-convenienceMarkupPercentage"
                        type="number"
                        step="0.01"
                        value={formData.convenienceMarkupPercentage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            convenienceMarkupPercentage: e.target.value,
                          })
                        }
                        placeholder="5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-convenienceMarkup">Fixed Convenience Markup (₱)</Label>
                      <Input
                        id="edit-convenienceMarkup"
                        type="number"
                        step="0.01"
                        value={formData.convenienceMarkup}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            convenienceMarkup: e.target.value,
                          })
                        }
                        placeholder="2.00"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Optional convenience store markup. Cashier can choose to add this when scanning the product.
                  </p>
                </div>

                {/* Add-on Price Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-addonPrice">
                      Add-on Price (Refrigeration Fee)
                    </Label>
                    <Input
                      id="edit-addonPrice"
                      type="number"
                      step="0.01"
                      value={formData.addonPrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          addonPrice: e.target.value,
                        })
                      }
                      placeholder="5.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional fee for refrigeration, cooling, etc. Cashier can choose to add this when scanning the product.
                    </p>
                  </div>
                </div>

                {/* Tiered Pricing Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold mb-4 text-gray-700">Tiered Pricing (Optional)</h4>

                  {/* Pack */}
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pack</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-packQuantity">Pack Qty</Label>
                      <Input
                        id="edit-packQuantity"
                        type="number"
                        value={formData.packQuantity}
                        onChange={(e) => setFormData({ ...formData, packQuantity: e.target.value })}
                        placeholder="12"
                      />
                      <p className="text-xs text-muted-foreground">Items per pack</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-packMarkupPercentage">Pack Markup (%)</Label>
                      <Input
                        id="edit-packMarkupPercentage"
                        type="number"
                        step="0.01"
                        value={formData.packMarkupPercentage}
                        onChange={(e) => setFormData({ ...formData, packMarkupPercentage: e.target.value })}
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-packMarkupFixed">Pack Markup (₱)</Label>
                      <Input
                        id="edit-packMarkupFixed"
                        type="number"
                        step="0.01"
                        value={formData.packMarkupFixed}
                        onChange={(e) => setFormData({ ...formData, packMarkupFixed: e.target.value })}
                        placeholder="5.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-packPrice">Pack Price (₱)</Label>
                      <Input
                        id="edit-packPrice"
                        type="number"
                        step="0.01"
                        value={formData.packPrice}
                        onChange={(e) => handleManualPackPriceChange(e.target.value)}
                        placeholder="120.00"
                      />
                      <p className="text-xs text-muted-foreground">Type to set base price; markup above adds on top</p>
                    </div>
                  </div>
                  {formData.packQuantity && formData.packPrice && (
                    <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <span className="text-blue-900">
                        Pack sell price ({formData.packQuantity} pcs):&nbsp;
                        <strong>₱{parseFloat(formData.packPrice).toFixed(2)}</strong>
                        &nbsp;·&nbsp;per item:&nbsp;
                        <strong>₱{(parseFloat(formData.packPrice) / parseInt(formData.packQuantity)).toFixed(2)}</strong>
                      </span>
                    </div>
                  )}

                  {/* Half-Pack */}
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Half-Pack</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-halfPackQuantity">Half-Pack Qty</Label>
                      <Input
                        id="edit-halfPackQuantity"
                        type="number"
                        value={formData.halfPackQuantity}
                        onChange={(e) => setFormData({ ...formData, halfPackQuantity: e.target.value })}
                        placeholder="6"
                      />
                      <p className="text-xs text-muted-foreground">Items per half-pack</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-halfPackMarkupPercentage">Half-Pack Markup (%)</Label>
                      <Input
                        id="edit-halfPackMarkupPercentage"
                        type="number"
                        step="0.01"
                        value={formData.halfPackMarkupPercentage}
                        onChange={(e) => setFormData({ ...formData, halfPackMarkupPercentage: e.target.value })}
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-halfPackMarkupFixed">Half-Pack Markup (₱)</Label>
                      <Input
                        id="edit-halfPackMarkupFixed"
                        type="number"
                        step="0.01"
                        value={formData.halfPackMarkupFixed}
                        onChange={(e) => setFormData({ ...formData, halfPackMarkupFixed: e.target.value })}
                        placeholder="3.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-halfPackPrice">Half-Pack Price (₱)</Label>
                      <Input
                        id="edit-halfPackPrice"
                        type="number"
                        step="0.01"
                        value={formData.halfPackPrice}
                        onChange={(e) => handleManualHalfPackPriceChange(e.target.value)}
                        placeholder="65.00"
                      />
                      <p className="text-xs text-muted-foreground">Type to set base price; markup above adds on top</p>
                    </div>
                  </div>
                  {formData.halfPackQuantity && formData.halfPackPrice && (
                    <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-sm">
                      <span className="text-indigo-900">
                        Half-pack sell price ({formData.halfPackQuantity} pcs):&nbsp;
                        <strong>₱{parseFloat(formData.halfPackPrice).toFixed(2)}</strong>
                        &nbsp;·&nbsp;per item:&nbsp;
                        <strong>₱{(parseFloat(formData.halfPackPrice) / parseInt(formData.halfPackQuantity)).toFixed(2)}</strong>
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
