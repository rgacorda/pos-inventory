"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showErrorToast } from "@/lib/toast-utils";
import { IconX, IconPlus, IconSearch, IconPencil } from "@tabler/icons-react";

export interface ReturnItemProduct {
  id: string;
  name: string;
  sku: string;
  category?: string;
  cost: number;
  stockQuantity: number;
  barcode?: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
}

export interface ReturnLineItem {
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface QuickAddSource {
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitCost: number;
}

interface ReturnItemsEditorProps {
  products: ReturnItemProduct[];
  items: ReturnLineItem[];
  onItemsChange: (items: ReturnLineItem[]) => void;
  supplierId?: string;
  supplierName?: string;
  /** Quick-add shortcuts sourced from a linked delivery's items. */
  quickAddSource?: QuickAddSource[];
  quickAddLabel?: string;
  /** "deduct" previews stock going down (returned items); "add" previews it going up (replacement items). */
  stockEffect?: "deduct" | "add";
  itemNounSingular?: string;
  disabled?: boolean;
}

/**
 * Reusable product picker + items table for return records. Used identically
 * for the returned-items list (create/edit) and the replacement-items list
 * (resolve), so all three flows share one bug surface instead of three
 * diverging copies.
 */
export function ReturnItemsEditor({
  products,
  items,
  onItemsChange,
  supplierId,
  supplierName,
  quickAddSource = [],
  quickAddLabel = "Quick add from delivery",
  stockEffect = "deduct",
  itemNounSingular = "item",
  disabled = false,
}: ReturnItemsEditorProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeProduct, setActiveProduct] = useState<ReturnItemProduct | null>(
    null,
  );
  const [quantityInput, setQuantityInput] = useState("");
  const [unitCostInput, setUnitCostInput] = useState("");

  // Products from the selected supplier are shown first (and, unless "show
  // all products" is enabled, are the only ones shown), while still allowing
  // any other product in the system to be picked — matching the delivery
  // form's supplier-priority behavior.
  const filteredProducts = useMemo(() => {
    const terms = searchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const matchesSearch = (p: ReturnItemProduct) =>
      terms.length === 0 ||
      terms.every(
        (t) =>
          p.name.toLowerCase().includes(t) ||
          p.sku?.toLowerCase().includes(t) ||
          p.barcode?.toLowerCase().includes(t) ||
          p.category?.toLowerCase().includes(t),
      );

    return products
      .filter(matchesSearch)
      .filter((p) => {
        if (showAllProducts || !supplierId) return true;
        return !p.supplierId || p.supplierId === supplierId;
      })
      .sort((a, b) => {
        if (!supplierId) return 0;
        const aMatch = !a.supplierId || a.supplierId === supplierId ? 0 : 1;
        const bMatch = !b.supplierId || b.supplierId === supplierId ? 0 : 1;
        return aMatch - bMatch;
      });
  }, [products, searchQuery, showAllProducts, supplierId]);

  function findProductById(productId: string) {
    return products.find((p) => p.id === productId) || null;
  }

  function openAddDialogForProduct(
    product: ReturnItemProduct,
    prefill?: { quantity?: number; unitCost?: number },
  ) {
    const existingIndex = items.findIndex((i) => i.productId === product.id);
    if (existingIndex !== -1) {
      showErrorToast(`${product.name} is already in the list`, {
        description: "Edit its row below to change the quantity or cost.",
      });
      return;
    }

    setActiveProduct(product);
    setEditingIndex(null);
    setQuantityInput(prefill?.quantity ? String(prefill.quantity) : "");
    setUnitCostInput(
      prefill?.unitCost != null
        ? String(prefill.unitCost)
        : product.cost != null
          ? String(product.cost)
          : "",
    );
    setIsItemDialogOpen(true);
  }

  function openEditDialogForIndex(index: number) {
    const item = items[index];
    const product = findProductById(item.productId);
    setActiveProduct(
      product || {
        id: item.productId,
        name: item.productName,
        sku: item.productSku || "",
        cost: item.unitCost,
        stockQuantity: 0,
      },
    );
    setEditingIndex(index);
    setQuantityInput(String(item.quantity));
    setUnitCostInput(String(item.unitCost));
    setIsItemDialogOpen(true);
  }

  function closeItemDialog() {
    setIsItemDialogOpen(false);
    setActiveProduct(null);
    setEditingIndex(null);
    setQuantityInput("");
    setUnitCostInput("");
  }

  function handleSaveItem() {
    if (!activeProduct) return;
    const quantity = parseFloat(quantityInput);
    const unitCost = parseFloat(unitCostInput);

    if (!quantity || quantity <= 0) {
      showErrorToast("Please enter a valid quantity");
      return;
    }
    if (isNaN(unitCost) || unitCost < 0) {
      showErrorToast("Please enter a valid unit cost");
      return;
    }

    const newItem: ReturnLineItem = {
      productId: activeProduct.id,
      productName: activeProduct.name,
      productSku: activeProduct.sku,
      quantity,
      unitCost,
      totalCost: Math.round(quantity * unitCost * 100) / 100,
    };

    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = newItem;
      onItemsChange(updated);
    } else {
      onItemsChange([...items, newItem]);
    }

    closeItemDialog();
  }

  function removeItem(index: number) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  function handleQuickAdd(source: QuickAddSource) {
    const product = findProductById(source.productId);
    if (!product) {
      showErrorToast("Product not found", {
        description: `${source.productName} may no longer exist and can't be quick-added.`,
      });
      return;
    }
    openAddDialogForProduct(product, {
      quantity: source.quantity,
      unitCost: source.unitCost,
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.totalCost, 0);

  const previewQuantity = parseFloat(quantityInput) || 0;
  const previewStock = activeProduct?.stockQuantity ?? 0;
  const previewAfterStock =
    stockEffect === "deduct"
      ? previewStock - previewQuantity
      : previewStock + previewQuantity;
  const wouldGoNegative = stockEffect === "deduct" && previewAfterStock < 0;

  return (
    <div className="space-y-4">
      {quickAddSource.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            {quickAddLabel}
          </Label>
          <div className="flex flex-wrap gap-2">
            {quickAddSource.map((source) => {
              const alreadyAdded = items.some(
                (i) => i.productId === source.productId,
              );
              return (
                <Button
                  key={source.productId}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || alreadyAdded}
                  onClick={() => handleQuickAdd(source)}
                >
                  <IconPlus className="h-3.5 w-3.5 mr-1" />
                  {source.productName} ({source.quantity})
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-left font-normal"
        disabled={disabled}
        onClick={() => setIsSearchOpen(true)}
      >
        <IconSearch className="h-4 w-4 mr-2" />
        Search products to add...
      </Button>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-6 text-muted-foreground"
                >
                  No {itemNounSingular}s added yet
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={`${item.productId}-${index}`}>
                  <TableCell className="font-medium">
                    {item.productName}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {item.productSku || "—"}
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
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => openEditDialogForIndex(index)}
                    >
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => removeItem(index)}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
            {items.length > 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Total:
                </TableCell>
                <TableCell className="text-right font-semibold">
                  ₱{subtotal.toFixed(2)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Product Search Dialog */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Search Products</DialogTitle>
            <DialogDescription>
              Search and select a product to add to this {itemNounSingular}{" "}
              list
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {supplierId && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {showAllProducts ? (
                    <>
                      Showing all products •{" "}
                      <span className="font-medium">
                        {supplierName || "this supplier"}
                      </span>
                      &apos;s products shown first
                    </>
                  ) : (
                    <>
                      Showing products from{" "}
                      <span className="font-medium">
                        {supplierName || "this supplier"}
                      </span>{" "}
                      only
                    </>
                  )}
                </p>
                <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                  <Checkbox
                    checked={showAllProducts}
                    onCheckedChange={(checked) =>
                      setShowAllProducts(checked === true)
                    }
                  />
                  Show all products
                </label>
              </div>
            )}

            <ScrollArea className="h-[360px] border rounded-md">
              <div className="p-2">
                {filteredProducts.map((product) => {
                  const isOtherSupplier =
                    !!supplierId &&
                    !!product.supplierId &&
                    product.supplierId !== supplierId;
                  const alreadyAdded = items.some(
                    (i) => i.productId === product.id,
                  );
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery("");
                        openAddDialogForProduct(product);
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{product.name}</p>
                            {alreadyAdded && (
                              <Badge variant="secondary" className="text-xs">
                                Added
                              </Badge>
                            )}
                            {isOtherSupplier && (
                              <Badge variant="outline" className="text-xs">
                                {product.supplier?.name || "Other supplier"}
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
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No products found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Item Dialog */}
      <Dialog
        open={isItemDialogOpen}
        onOpenChange={(open) => !open && closeItemDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit" : "Add"} {itemNounSingular}
            </DialogTitle>
            <DialogDescription>{activeProduct?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder="Enter quantity"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost (₱) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={unitCostInput}
                onChange={(e) => setUnitCostInput(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm space-y-1">
              <p className="text-blue-800">
                Current Stock: {previewStock}
                {previewQuantity > 0 && (
                  <span
                    className={`ml-1 font-semibold ${wouldGoNegative ? "text-red-600" : "text-green-700"}`}
                  >
                    {" → "}
                    {previewAfterStock}
                  </span>
                )}
              </p>
              <p className="text-blue-800">
                Line Total:{" "}
                <span className="font-semibold">
                  ₱
                  {(
                    (parseFloat(quantityInput) || 0) *
                    (parseFloat(unitCostInput) || 0)
                  ).toFixed(2)}
                </span>
              </p>
              {wouldGoNegative && (
                <p className="text-red-600 text-xs font-medium">
                  Warning: this would take stock below zero.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeItemDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>
              {editingIndex !== null ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
