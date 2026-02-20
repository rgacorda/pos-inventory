"use client";

import { useState, useMemo } from "react";
import { useProducts } from "@/hooks/useDatabase";
import { LocalProduct } from "@/lib/db";
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

interface ProductListProps {
  onAddToCart: (product: LocalProduct) => void;
}

export function ProductList({ onAddToCart }: ProductListProps) {
  const products = useProducts();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Extract unique categories from products
  const categories = useMemo(() => {
    if (!products) return [];
    const uniqueCategories = Array.from(
      new Set(
        products.map((p) => p.category).filter((c): c is string => Boolean(c)),
      ),
    );
    return uniqueCategories.sort();
  }, [products]);

  const filteredProducts =
    products?.filter((p) => {
      const matchesSearch =
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.includes(search);
      const matchesCategory =
        selectedCategory === "ALL" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }) || [];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b bg-white shadow-sm space-y-3">
        <input
          type="text"
          placeholder="Search products by name, SKU, or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!products ? (
          <div className="text-center text-gray-500 py-8">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No products found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow
                  key={product.id}
                  onClick={() => onAddToCart(product)}
                  className="cursor-pointer hover:bg-blue-50"
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="font-mono text-sm text-gray-600">
                    {product.sku}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {product.category || "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-blue-600">
                    ${Number(product.price).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        product.stockQuantity > 10
                          ? "bg-green-100 text-green-700"
                          : product.stockQuantity > 0
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {product.stockQuantity}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
