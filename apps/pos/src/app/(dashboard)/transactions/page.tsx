"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTodaysOrders, usePaymentsByOrder } from "@/hooks/useDatabase";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import { LocalOrder, dbHelpers } from "@/lib/db";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/receipt";
import { Printer, ArrowLeftRight, Delete } from "lucide-react";
import {
  showSuccessToast,
  showErrorToast,
} from "@/lib/toast-utils";
import { OrderStatus } from "@pos/shared-types";
import { useCart, ExchangedItem } from "@/contexts/cart-context";

export default function OrdersPage() {
  const router = useRouter();
  const orders = useTodaysOrders();
  const { startExchange } = useCart();

  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showExchangeDialog, setShowExchangeDialog] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Set<number>>(new Set());
  const payments = usePaymentsByOrder(selectedOrder?.posLocalId || null);

  // Exchange PIN gate
  const [showExchangePinDialog, setShowExchangePinDialog] = useState(false);
  const [exchangePinEntry, setExchangePinEntry] = useState("");
  const [exchangePinError, setExchangePinError] = useState("");

  // Keyboard support for the exchange PIN dialog
  useEffect(() => {
    if (!showExchangePinDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleExchangePinInput(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleExchangePinBackspace();
      } else if (e.key === "Escape") {
        setExchangePinEntry("");
        setExchangePinError("");
        setShowExchangePinDialog(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExchangePinDialog, exchangePinEntry]);

  const getUserName = () => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      const userData = userStr ? JSON.parse(userStr) : null;
      return userData?.name || "Staff";
    }
    return "Staff";
  };

  const sortedOrders = useMemo(() => {
    if (!orders) return null;
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.localCreatedAt).getTime();
      const dateB = new Date(b.localCreatedAt).getTime();
      return dateB - dateA;
    });
  }, [orders]);

  // ── Exchange helpers ──────────────────────────────────────────────────────

  const canExchange = (order: LocalOrder | null) => {
    if (!order) return false;
    return order.status === OrderStatus.COMPLETED;
  };

  const returnCredit = useMemo(() => {
    if (!selectedOrder) return 0;
    return (selectedOrder.items ?? [])
      .filter((_, idx) => selectedReturnItems.has(idx))
      .reduce((sum, item) => sum + item.total, 0);
  }, [selectedOrder, selectedReturnItems]);

  const toggleReturnItem = (idx: number) => {
    setSelectedReturnItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Opens PIN dialog first; item selection opens after correct PIN
  const handleOpenExchange = () => {
    setExchangePinEntry("");
    setExchangePinError("");
    setShowExchangePinDialog(true);
  };

  const handleExchangePinInput = async (digit: string) => {
    if (exchangePinEntry.length >= 4) return;
    const newPin = exchangePinEntry + digit;
    setExchangePinEntry(newPin);

    if (newPin.length === 4) {
      const storedPin = await dbHelpers.getVoidPin();
      if (newPin === storedPin) {
        setShowExchangePinDialog(false);
        setExchangePinEntry("");
        setExchangePinError("");
        setSelectedReturnItems(new Set());
        setShowExchangeDialog(true);
      } else {
        setExchangePinError("Incorrect PIN. Try again.");
        setTimeout(() => setExchangePinEntry(""), 600);
      }
    }
  };

  const handleExchangePinBackspace = () => {
    setExchangePinEntry((prev) => prev.slice(0, -1));
    setExchangePinError("");
  };

  const handleProceedExchange = () => {
    if (!selectedOrder || selectedReturnItems.size === 0) return;

    const items = (selectedOrder.items ?? []).filter((_, idx) =>
      selectedReturnItems.has(idx)
    );

    const exchangedItems: ExchangedItem[] = items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    }));

    startExchange({
      credit: returnCredit,
      orderRef: selectedOrder.orderNumber,
      serverId: selectedOrder.serverId ?? null,
      items: exchangedItems,
    });

    showSuccessToast("Exchange Started", {
      description: `Credit of ${formatCurrency(returnCredit)} loaded. Add new items at the POS.`,
    });

    setShowExchangeDialog(false);
    setSelectedOrder(null);
    router.push("/");
  };

  // ─────────────────────────────────────────────────────────────────────────

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

      {/* ── Transaction Details Dialog ── */}
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
                    <div className="font-semibold">{selectedOrder.orderNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="flex gap-2 mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedOrder.status === "COMPLETED"
                            ? "bg-green-100 text-green-700"
                            : selectedOrder.status === "EXCHANGE"
                              ? "bg-orange-100 text-orange-700"
                              : selectedOrder.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-700"
                                : selectedOrder.status === "VOID"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {selectedOrder.status === "VOID"
                          ? "✗ VOIDED"
                          : selectedOrder.status === "EXCHANGE"
                            ? "⇄ EXCHANGE"
                            : selectedOrder.status}
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

                {/* Exchange reference badge */}
                {selectedOrder.exchangeRef && (
                  <div className="flex-shrink-0 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-orange-800">
                    <ArrowLeftRight className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Exchange of <strong>{selectedOrder.exchangeRef}</strong>
                    </span>
                  </div>
                )}

                {/* Customer Details */}
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

                {/* Payment Info */}
                {payments && payments.length > 0 && (
                  <div className="border-t pt-4 flex-shrink-0">
                    <div className="text-sm font-medium mb-2">Payment Information</div>
                    <div className="space-y-2">
                      {payments.map((payment, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-600">Method</div>
                            <div className="font-medium capitalize">
                              {payment.method.replace(/_/g, " ").toLowerCase()}
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

                {/* Items */}
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
                              Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                            </div>
                          </div>
                          <div className="font-semibold">{formatCurrency(item.total)}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Totals */}
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
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Exchange Credit Applied</span>
                      <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
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
            {canExchange(selectedOrder) && (
              <Button
                variant="outline"
                onClick={handleOpenExchange}
                className="w-full sm:w-auto border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Exchange Item
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowReceiptDialog(true)}
              className="w-full sm:w-auto"
            >
              <Printer className="h-4 w-4 mr-2" />
              Reprint Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Exchange PIN Gate ── */}
      <Dialog
        open={showExchangePinDialog}
        onOpenChange={(open) => {
          if (!open) {
            setExchangePinEntry("");
            setExchangePinError("");
          }
          setShowExchangePinDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Supervisor Authorization</DialogTitle>
            <DialogDescription className="text-center">
              Enter the 4-digit PIN to proceed with the exchange
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-5">
            {/* PIN dot display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 border-2 rounded-xl flex items-center justify-center text-2xl transition-colors ${
                    i < exchangePinEntry.length
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {i < exchangePinEntry.length ? "●" : ""}
                </div>
              ))}
            </div>

            {exchangePinError && (
              <p className="text-center text-sm text-red-600 font-medium animate-pulse">
                {exchangePinError}
              </p>
            )}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  className="h-14 text-xl font-semibold hover:bg-gray-100"
                  onClick={() => handleExchangePinInput(n.toString())}
                  disabled={exchangePinEntry.length >= 4}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-14 hover:bg-gray-100"
                onClick={handleExchangePinBackspace}
              >
                <Delete className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold hover:bg-gray-100"
                onClick={() => handleExchangePinInput("0")}
                disabled={exchangePinEntry.length >= 4}
              >
                0
              </Button>
              <Button
                variant="ghost"
                className="h-14 text-sm text-gray-500 hover:bg-gray-100"
                onClick={() => {
                  setExchangePinEntry("");
                  setExchangePinError("");
                  setShowExchangePinDialog(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Exchange Item Selection Dialog ── */}
      <Dialog
        open={showExchangeDialog}
        onOpenChange={(open) => {
          if (!open) setSelectedReturnItems(new Set());
          setShowExchangeDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Items to Return</DialogTitle>
            <DialogDescription>
              Check the items the customer is returning. The total value becomes
              a credit on the new order.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
            {selectedOrder?.items?.map((item, idx) => {
              const checked = selectedReturnItems.has(idx);
              return (
                <label
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-orange-400 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleReturnItem(idx)}
                    className="h-4 w-4 accent-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{item.name}</div>
                    <div className="text-sm text-gray-500">
                      Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-800 flex-shrink-0">
                    {formatCurrency(item.total)}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Credit summary */}
          <div
            className={`rounded-lg p-4 border-2 transition-colors ${
              returnCredit > 0
                ? "border-orange-300 bg-orange-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Return Credit</span>
              <span
                className={`text-xl font-bold ${
                  returnCredit > 0 ? "text-orange-700" : "text-gray-400"
                }`}
              >
                {formatCurrency(returnCredit)}
              </span>
            </div>
            {returnCredit > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                This credit will be deducted from the new order total.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedReturnItems(new Set());
                setShowExchangeDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProceedExchange}
              disabled={selectedReturnItems.size === 0}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Proceed to Exchange
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reprint Receipt Dialog ── */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="flex max-h-[min(90dvh,90vh)] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Reprint Receipt</DialogTitle>
            <DialogDescription>Print receipt for this transaction</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
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
                onPrintComplete={() => setShowReceiptDialog(false)}
              />
            )}
          </div>
          <DialogFooter className="shrink-0">
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
