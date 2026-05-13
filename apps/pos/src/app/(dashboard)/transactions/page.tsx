"use client";

import { useState, useMemo } from "react";
import { useTodaysOrders, usePaymentsByOrder } from "@/hooks/useDatabase";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import { LocalOrder, db } from "@/lib/db";
import { apiClient } from "@/lib/api-client";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/receipt";
import { Printer, XCircle } from "lucide-react";
import {
  showSuccessToast,
  showErrorToast,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import { OrderStatus } from "@pos/shared-types";

export default function OrdersPage() {
  const orders = useTodaysOrders();
  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const payments = usePaymentsByOrder(selectedOrder?.posLocalId || null);

  // Get current user name for cashier field
  const getUserName = () => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      const userData = userStr ? JSON.parse(userStr) : null;
      return userData?.name || "Staff";
    }
    return "Staff";
  };

  // Sort orders by date (newest first)
  const sortedOrders = useMemo(() => {
    if (!orders) return null;
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.localCreatedAt).getTime();
      const dateB = new Date(b.localCreatedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  }, [orders]);

  const handleReprint = () => {
    setShowReceiptDialog(true);
  };

  const handleVoidTransaction = async () => {
    if (!selectedOrder) return;

    // Only pending/error orders can be voided
    // Synced orders must be refunded through inventory system
    if (selectedOrder.syncStatus === "synced") {
      showErrorToast("Cannot Void Synced Transaction", {
        description: "This transaction has been synced to the server. Please process a refund through the inventory system.",
      });
      setShowVoidConfirm(false);
      return;
    }

    // Block voiding while sync is actively in progress — the order is already
    // being sent to the server in this cycle. Wait for the cycle to finish.
    if (selectedOrder.syncStatus === "syncing") {
      showErrorToast("Sync In Progress", {
        description: "This transaction is currently being synced. Please wait a moment and try again.",
      });
      setShowVoidConfirm(false);
      return;
    }

    setIsVoiding(true);
    
    // Store order data before closing modal (selectedOrder might become stale)
    const orderToVoid = {
      id: selectedOrder.id,
      orderNumber: selectedOrder.orderNumber,
      posLocalId: selectedOrder.posLocalId,
    };
    
    console.log(`Starting void for order ${orderToVoid.orderNumber}`, orderToVoid);

    try {
      // Validate we have required IDs
      if (!orderToVoid.id || !orderToVoid.posLocalId) {
        throw new Error("Missing required order identifiers");
      }

      // Step 1: Mark order as VOID and set syncStatus to "synced" so it is
      // permanently removed from all sync queues. Setting syncStatus to "synced"
      // signals "no further sync action needed" — the order was cancelled locally
      // and should never be sent to the server.
      await db.orders.update(orderToVoid.id, {
        status: OrderStatus.VOID,
        syncStatus: "synced",
        syncError: undefined,
        localUpdatedAt: new Date(),
      });
      
      // Verify the update was successful
      const updatedOrder = await db.orders.get(orderToVoid.id);
      console.log(`✓ Order ${orderToVoid.orderNumber} marked as VOID. Verification:`, {
        status: updatedOrder?.status,
        syncStatus: updatedOrder?.syncStatus,
      });
      
      if (updatedOrder?.status !== "VOID") {
        throw new Error(`Update verification failed: status=${updatedOrder?.status}`);
      }

      // Step 2: Payments are excluded from sync automatically because:
      // a) the order is now syncStatus "synced" so it won't be in any sync payload
      // b) dbHelpers filter payments by voided order IDs as an extra safety net
      console.log(`✓ Order voided and removed from sync queue`);


      // Step 3: Show success message
      showSuccessToast("Transaction Voided", {
        description: "Transaction voided successfully (was not yet synced to server).",
      });

      // Step 4: Close dialogs and clear selection
      setShowVoidConfirm(false);
      setSelectedOrder(null);
      
      console.log(`✅ Void complete for order ${orderToVoid.orderNumber}`);
    } catch (error: any) {
      console.error("Failed to void transaction:", error);
      showErrorToast("Void Failed", {
        description: error.message || "Unable to void transaction. Please try again.",
      });
    } finally {
      setIsVoiding(false);
    }
  };

  // Check if order can be voided
  const canVoidOrder = (order: LocalOrder | null) => {
    if (!order) return false;
    // Cannot void already-voided orders
    if (order.status === OrderStatus.VOID) return false;
    // Cannot void synced orders — must use refund in inventory system
    if (order.syncStatus === "synced") return false;
    // Cannot void while a sync cycle is actively sending this order to the server
    if (order.syncStatus === "syncing") return false;
    return true;
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">Today's Transactions</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {!sortedOrders ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              Loading transactions...
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              No transactions yet today
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={sortedOrders}
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
                              : selectedOrder.status === "VOID"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {selectedOrder.status === "VOID" ? "✗ VOIDED" : selectedOrder.status}
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

                {/* Customer Details Section */}
                {(selectedOrder.customerName || selectedOrder.customerAddress) && (
                  <div className="border-t pt-4 flex-shrink-0">
                    <div className="text-sm font-medium mb-2">Customer Details</div>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedOrder.customerName && (
                        <div>
                          <div className="text-sm text-gray-600">Name</div>
                          <div className="font-medium">{selectedOrder.customerName}</div>
                        </div>
                      )}
                      {selectedOrder.customerAddress && (
                        <div>
                          <div className="text-sm text-gray-600">Address</div>
                          <div className="font-medium">{selectedOrder.customerAddress}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Information Section */}
                {payments && payments.length > 0 && (
                  <div className="border-t pt-4 flex-shrink-0">
                    <div className="text-sm font-medium mb-2">Payment Information</div>
                    <div className="space-y-2">
                      {payments.map((payment, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-600">Method</div>
                            <div className="font-medium capitalize">
                              {payment.method.replace(/_/g, ' ').toLowerCase()}
                            </div>
                          </div>
                          {payment.reference && (
                            <div>
                              <div className="text-sm text-gray-600">Reference</div>
                              <div className="font-medium">{payment.reference}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
          <DialogFooter className="px-6 pb-6 flex-col sm:flex-row gap-2">
            {canVoidOrder(selectedOrder) && (
              <Button
                variant="destructive"
                onClick={() => setShowVoidConfirm(true)}
                className="w-full sm:w-auto"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Void Transaction
              </Button>
            )}
            {selectedOrder?.syncStatus === "synced" && selectedOrder?.status !== OrderStatus.VOID && (
              <div className="w-full text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">
                <strong>Note:</strong> This transaction has been synced to the server. 
                To reverse it, please process a <strong>Refund</strong> through the Inventory System.
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleReprint}
              className="w-full sm:w-auto"
            >
              <Printer className="h-4 w-4 mr-2" />
              Reprint Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Transaction?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Are you sure you want to void this transaction?</p>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  <strong>This will:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Mark the transaction as VOIDED</li>
                    <li>Prevent it from syncing to the server</li>
                    <li>No stock changes (transaction hasn't reached server yet)</li>
                    <li>Keep transaction visible for audit trail</li>
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                  <strong>Note:</strong> Voiding is only available within 5 minutes of transaction creation (before sync). 
                  For synced transactions, use the <strong>Refund Process</strong> in the Inventory System to return stock and void.
                </div>
                {selectedOrder && (
                  <p className="text-sm font-medium pt-2">
                    Transaction: {selectedOrder.orderNumber}<br />
                    Amount: {formatCurrency(selectedOrder.totalAmount)}<br />
                    Status: {selectedOrder.syncStatus === "synced" ? "✓ Synced to server" : "⏳ Pending sync"}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidTransaction}
              disabled={isVoiding}
              className="bg-red-600 hover:bg-red-700"
            >
              {isVoiding ? "Voiding..." : "Yes, Void Transaction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reprint Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprint Receipt</DialogTitle>
            <DialogDescription>
              Print receipt for this transaction
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedOrder && payments && payments.length > 0 && (
              <Receipt
                orderNumber={selectedOrder.orderNumber}
                items={selectedOrder.items || []}
                subtotal={selectedOrder.subtotal}
                taxAmount={selectedOrder.taxAmount}
                discountAmount={selectedOrder.discountAmount}
                totalAmount={selectedOrder.totalAmount}
                paymentMethod={payments[0].method}
                paymentReference={payments[0].reference}
                customerName={selectedOrder.customerName}
                customerAddress={selectedOrder.customerAddress}
                cashierName={getUserName()}
                terminalName={selectedOrder.terminalId || "Terminal"}
                dateTime={selectedOrder.localCreatedAt}
                onPrintComplete={() => {
                  setShowReceiptDialog(false);
                }}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReceiptDialog(false)}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
