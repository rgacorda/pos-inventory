"use client";

import { useState } from "react";
import { useTodaysOrders } from "@/hooks/useDatabase";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import { LocalOrder } from "@/lib/db";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function OrdersPage() {
  const orders = useTodaysOrders();
  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">Today's Transactions</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {!orders ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              Loading transactions...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              No transactions yet today
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={orders}
              onRowClick={setSelectedOrder}
            />
          )}
        </div>
      </div>

      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      >
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6">
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedOrder && formatDateTime(selectedOrder.localCreatedAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
              <div className="h-full flex flex-col space-y-4">
                <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                  <div>
                    <div className="text-sm text-gray-600">Transaction ID</div>
                    <div className="font-semibold">
                      {selectedOrder.orderNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="flex gap-2 mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedOrder.status === "COMPLETED"
                            ? "bg-green-100 text-green-700"
                            : selectedOrder.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {selectedOrder.status}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedOrder.syncStatus === "synced"
                            ? "bg-green-100 text-green-700"
                            : selectedOrder.syncStatus === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : selectedOrder.syncStatus === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {selectedOrder.syncStatus === "synced"
                          ? "✓ Synced"
                          : selectedOrder.syncStatus === "pending"
                            ? "⏳ Pending"
                            : selectedOrder.syncStatus === "error"
                              ? "✗ Error"
                              : "⟳ Syncing"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 flex-1 min-h-0 overflow-hidden">
                  <div className="text-sm font-medium mb-3">Items</div>
                  <ScrollArea className="h-[calc(100%-2rem)]">
                    <div className="space-y-2 pr-4">
                      {selectedOrder.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded"
                        >
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              Qty: {item.quantity} ×{" "}
                              {formatCurrency(item.unitPrice)}
                            </div>
                          </div>
                          <div className="font-semibold">
                            {formatCurrency(item.total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-t pt-4 space-y-2 flex-shrink-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span>{formatCurrency(selectedOrder.taxAmount)}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>
                        -{formatCurrency(selectedOrder.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
