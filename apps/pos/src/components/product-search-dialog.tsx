"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocalProduct } from "@/lib/db";
import {
  PRODUCT_SEARCH_LIMIT,
  SearchableProduct,
  searchIndexedProducts,
  uniqueCategories,
} from "@/lib/product-search";
import { Eye, EyeOff, Search } from "lucide-react";

interface ProductSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchIndex: SearchableProduct[];
  loading: boolean;
  onSelectProduct: (product: LocalProduct) => void;
}

export function ProductSearchDialog({
  open,
  onOpenChange,
  searchIndex,
  loading,
  onSelectProduct,
}: ProductSearchDialogProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showItemCounts, setShowItemCounts] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput), 120);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!open) {
      setSearchInput("");
      setDebouncedQuery("");
      setSelectedCategory("All");
    }
  }, [open]);

  const categories = useMemo(
    () => uniqueCategories(searchIndex),
    [searchIndex],
  );

  const trimmedQuery = debouncedQuery.trim();
  const shouldSearch = trimmedQuery.length > 0 || selectedCategory !== "All";

  const { results, hasMore } = useMemo(() => {
    if (!shouldSearch) return { results: [] as LocalProduct[], hasMore: false };
    return searchIndexedProducts(
      searchIndex,
      trimmedQuery,
      selectedCategory,
      PRODUCT_SEARCH_LIMIT,
    );
  }, [searchIndex, trimmedQuery, selectedCategory, shouldSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-7xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Search Products</DialogTitle>
          <DialogDescription>
            Type a name, SKU, or barcode. Results are limited for faster loading.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div className="flex gap-3 flex-shrink-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg focus:outline-none"
                autoFocus
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[200px] h-10">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3 flex items-center gap-2"
              onClick={() => setShowItemCounts(!showItemCounts)}
            >
              {showItemCounts ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Stock
            </Button>
          </div>

          <div className="flex-1 border rounded-lg overflow-hidden">
            <div className="h-full overflow-y-auto">
              {loading ? (
                <div className="text-center text-gray-600 py-8">
                  Loading products...
                </div>
              ) : !shouldSearch ? (
                <div className="text-center text-gray-500 py-12 px-6">
                  <Search className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium text-gray-700">Type to search</p>
                  <p className="text-sm mt-1">
                    Enter a product name, SKU, or barcode, or pick a category.
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  No products found
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      {showItemCounts && (
                        <TableHead className="text-right">Stock</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((product) => (
                      <TableRow
                        key={product.id}
                        onClick={() => onSelectProduct(product)}
                        className="hover:bg-blue-50 cursor-pointer"
                      >
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            <div className="font-semibold">
                              ₱{product.price.toFixed(2)}
                            </div>
                            {product.packPrice && product.packQuantity && (
                              <div className="text-xs text-green-600">
                                ₱{product.packPrice.toFixed(2)}/
                                {product.packQuantity}pc
                              </div>
                            )}
                            {product.halfPackPrice &&
                              product.halfPackQuantity && (
                                <div className="text-xs text-indigo-500">
                                  ₱{product.halfPackPrice.toFixed(2)}/
                                  {product.halfPackQuantity}pc
                                </div>
                              )}
                          </div>
                        </TableCell>
                        {showItemCounts && (
                          <TableCell className="text-right">
                            {product.stockQuantity}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          {shouldSearch && results.length > 0 && (
            <p className="text-xs text-gray-500 flex-shrink-0">
              Showing {results.length}
              {hasMore ? ` of more than ${PRODUCT_SEARCH_LIMIT}` : ""} match
              {results.length === 1 ? "" : "es"}
              {hasMore ? ". Type more to narrow results." : "."}
            </p>
          )}
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
