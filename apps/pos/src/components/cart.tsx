'use client';

import { LocalProduct } from '@/lib/db';
import { calculateLineSubtotal, calculateTax, calculateOrderTotal } from '@pos/shared-utils';

export interface CartItem {
  product: LocalProduct;
  quantity: number;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

export function Cart({ items, onUpdateQuantity, onRemoveItem, onCheckout }: CartProps) {
  const subtotal = items.reduce((sum, item) => {
    return sum + calculateLineSubtotal(item.quantity, Number(item.product.price));
  }, 0);

  const taxAmount = items.reduce((sum, item) => {
    const lineSubtotal = calculateLineSubtotal(item.quantity, Number(item.product.price));
    return sum + calculateTax(lineSubtotal, Number(item.product.taxRate));
  }, 0);

  const total = calculateOrderTotal(subtotal, taxAmount, 0);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-50 to-white">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md">
        <h2 className="text-lg font-bold">🛒 Current Order</h2>
        <div className="text-sm text-blue-100">{items.length} items</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            🛍️ Cart is empty. Add products to start an order.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const lineTotal = calculateLineSubtotal(item.quantity, Number(item.product.price));
              return (
                <div key={item.product.id} className="bg-white p-3 rounded-lg border-2 border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{item.product.name}</div>
                      <div className="text-xs text-gray-600 font-mono">{item.product.sku}</div>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.product.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 border-2 border-gray-300 rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors font-bold disabled:opacity-30"
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-bold text-gray-800">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        className="w-8 h-8 border-2 border-gray-300 rounded-lg hover:bg-green-500 hover:text-white hover:border-green-500 transition-colors font-bold"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        ${Number(item.product.price).toFixed(2)} each
                      </div>
                      <div className="font-bold text-blue-600">
                        ${lineTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-t-4 border-blue-500 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Subtotal:</span>
            <span className="font-semibold text-gray-800">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Tax:</span>
            <span className="font-semibold text-gray-800">${taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold border-t-2 border-blue-300 pt-2">
            <span className="text-gray-800">Total:</span>
            <span className="text-blue-600">${total.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold text-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          💳 Checkout
        </button>
      </div>
    </div>
  );
}
