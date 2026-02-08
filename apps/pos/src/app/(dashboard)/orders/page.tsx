"use client";

import { useTodaysOrders } from "@/hooks/useDatabase";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";

export default function OrdersPage() {
  const orders = useTodaysOrders();

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">📋 Today's Orders</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {!orders ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              ⏳ Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              📭 No orders yet today
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border-2 border-blue-100 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-lg text-gray-800">
                        {order.orderNumber}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDateTime(order.localCreatedAt)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-xl font-bold text-blue-600">
                        {formatCurrency(order.totalAmount)}
                      </div>
                      <div className="flex gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === "COMPLETED"
                              ? "bg-green-100 text-green-700"
                              : order.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            order.syncStatus === "synced"
                              ? "bg-green-100 text-green-700"
                              : order.syncStatus === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : order.syncStatus === "error"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {order.syncStatus === "synced"
                            ? "✓ Synced"
                            : order.syncStatus === "pending"
                              ? "⏳ Pending"
                              : order.syncStatus === "error"
                                ? "✗ Error"
                                : "⟳ Syncing"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="text-sm font-medium mb-2">Items:</div>
                    <div className="space-y-1">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t mt-3 pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax:</span>
                      <span>{formatCurrency(order.taxAmount)}</span>
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount:</span>
                        <span>-{formatCurrency(order.discountAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
