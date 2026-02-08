"use client";

import { useProducts } from "@/hooks/useDatabase";
import { formatCurrency } from "@pos/shared-utils";

export default function ProductsPage() {
  const products = useProducts();

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">📦 Product Catalog</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {!products ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              ⏳ Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="text-center text-gray-600 py-8">
              <p className="mb-4 text-lg">📦 No products available</p>
              <p className="text-sm text-gray-500">
                Products will be synced from the backend when online
              </p>
            </div>
          ) : (
            <div className="bg-white border-2 border-blue-200 rounded-xl overflow-hidden shadow-lg">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">
                      Price
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-700 font-semibold">
                        {product.sku}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-sm text-gray-600">
                            {product.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {product.category || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">
                        {formatCurrency(Number(product.price))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            product.stockQuantity > 10
                              ? "bg-green-100 text-green-700"
                              : product.stockQuantity > 0
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {product.stockQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            product.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
