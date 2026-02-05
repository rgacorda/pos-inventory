'use client';

import { useState } from 'react';
import { useProducts } from '@/hooks/useDatabase';
import { LocalProduct } from '@/lib/db';

interface ProductListProps {
  onAddToCart: (product: LocalProduct) => void;
}

export function ProductList({ onAddToCart }: ProductListProps) {
  const products = useProducts();
  const [search, setSearch] = useState('');

  const filteredProducts = products?.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  ) || [];

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-4 border-b bg-white shadow-sm">
        <input
          type="text"
          placeholder="Search products by name, SKU, or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!products ? (
          <div className="text-center text-gray-500 py-8">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No products found</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                className="p-4 bg-white border-2 border-gray-200 rounded-xl text-left hover:bg-blue-50 hover:border-blue-400 hover:shadow-lg transition-all transform hover:scale-105"
              >
                <div className="font-semibold text-gray-800 mb-1">{product.name}</div>
                <div className="text-xs text-gray-600 mb-2 font-mono">{product.sku}</div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-blue-600">
                    ${Number(product.price).toFixed(2)}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    product.stockQuantity > 10 
                      ? 'bg-green-100 text-green-700'
                      : product.stockQuantity > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    Stock: {product.stockQuantity}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
