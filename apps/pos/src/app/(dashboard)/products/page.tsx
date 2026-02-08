"use client";

import { useState, useEffect } from "react";
import { useProducts } from "@/hooks/useDatabase";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Search } from "lucide-react";

export default function ProductsPage() {
  const products = useProducts();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categories, setCategories] = useState<string[]>(["All"]);

  // Extract unique categories from products
  useEffect(() => {
    if (products && products.length > 0) {
      const uniqueCategories = [
        "All",
        ...Array.from(
          new Set(
            products
              .map((p) => p.category)
              .filter((category): category is string => Boolean(category)),
          ),
        ),
      ];
      setCategories(uniqueCategories);
    }
  }, [products]);

  // Filter products by search and category
  const filteredProducts =
    products?.filter((p) => {
      const matchesCategory =
        selectedCategory === "All" || p.category === selectedCategory;
      const matchesSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description &&
          p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    }) || [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">Product Catalog</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Search and Filter Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, SKU, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <div className="w-full md:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Products Table */}
          {!products ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center text-gray-600 py-8">
              <p className="mb-4 text-lg">No products found</p>
              <p className="text-sm text-gray-500">
                {products.length === 0
                  ? "Products will be synced from the backend when online"
                  : "Try adjusting your search or filter"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden shadow-sm">
              <DataTable columns={columns} data={filteredProducts} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
