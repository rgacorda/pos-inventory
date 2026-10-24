"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import { OrderStatus } from "@pos/shared-types";
import { ExchangedItem, useCart } from "@/contexts/cart-context";
import { dbHelpers } from "@/lib/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  canExchangeReceipt,
  locateReceipt,
  LocatedReceipt,
  OFFLINE_OR_INVALID_TRANSACTION,
} from "@/lib/receipt-lookup";
import { Receipt } from "@/components/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeftRight, Delete, Printer, ScanBarcode } from "lucide-react";
import { showSuccessToast } from "@/lib/toast-utils";

function formatPaymentMethod(method?: string) {
  if (!method) return "N/A";
  return method
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusLabel(status: string) {
  if (status === OrderStatus.VOID) return "Voided";
  if (status === OrderStatus.EXCHANGE) return "Exchanged";
  if (status === OrderStatus.COMPLETED) return "Completed";
  if (status === OrderStatus.SYNCED) return "Completed";
  if (status === OrderStatus.PENDING) return "Pending";
  return status;
}

function asDate(value: Date | string | undefined) {
  if (value instanceof Date) return value;
  if (value) return new Date(value);
  return new Date();
}

function ScanReceipt() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const online = useOnlineStatus();
  const { startExchange } = useCart();
  const inputRef = useRef<HTMLInputElement>(null);
  const autoLookup = useRef<string | null>(null);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<LocatedReceipt | null>(null);

  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showExchangeDialog, setShowExchangeDialog] = useState(false);
  const [showExchangePinDialog, setShowExchangePinDialog] = useState(false);
  const [exchangePinEntry, setExchangePinEntry] = useState("");
  const [exchangePinError, setExchangePinError] = useState("");
  const [selectedReturnItems, setSelectedReturnItems] = useState<Set<number>>(
    new Set(),
  );

  const focusInput = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const runLookup = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setReceipt(null);
      setError("Invalid Transaction");
      focusInput();
      return;
    }

    setLoading(true);
    setError("");
    setReceipt(null);
    try {
      const result = await locateReceipt(trimmed);
      if (result.ok) {
        setReceipt(result.receipt);
        setCode(result.receipt.order.orderNumber);
      } else {
        setError(result.message);
      }
    } catch {
      setReceipt(null);
      setError(
        typeof navigator !== "undefined" && navigator.onLine
          ? "Invalid Transaction"
          : OFFLINE_OR_INVALID_TRANSACTION,
      );
    } finally {
      setLoading(false);
      focusInput();
    }
  }, []);

  useEffect(() => {
    const codeFromUrl = searchParams.get("code")?.trim();
    if (!codeFromUrl || autoLookup.current === codeFromUrl) return;
    autoLookup.current = codeFromUrl;
    setCode(codeFromUrl);
    void runLookup(codeFromUrl);
  }, [searchParams, runLookup]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleExchangePinInput = useCallback(async (digit: string) => {
    setExchangePinEntry((current) => {
      if (current.length >= 4) return current;
      return current + digit;
    });
  }, []);

  useEffect(() => {
    if (exchangePinEntry.length !== 4) return;
    let cancelled = false;
    void (async () => {
      const storedPin = await dbHelpers.getVoidPin();
      if (cancelled) return;
      if (exchangePinEntry === storedPin) {
        setShowExchangePinDialog(false);
        setExchangePinEntry("");
        setExchangePinError("");
        setSelectedReturnItems(new Set());
        setShowExchangeDialog(true);
      } else {
        setExchangePinError("Incorrect PIN. Try again.");
        setTimeout(() => setExchangePinEntry(""), 600);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exchangePinEntry]);

  useEffect(() => {
    if (!showExchangePinDialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        void handleExchangePinInput(event.key);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        setExchangePinEntry((current) => current.slice(0, -1));
        setExchangePinError("");
      } else if (event.key === "Escape") {
        setExchangePinEntry("");
        setExchangePinError("");
        setShowExchangePinDialog(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showExchangePinDialog, handleExchangePinInput]);

  const returnCredit = receipt
    ? (receipt.order.items ?? [])
        .filter((_, index) => selectedReturnItems.has(index))
        .reduce((sum, item) => sum + Number(item.total || 0), 0)
    : 0;

  const toggleReturnItem = (index: number) => {
    setSelectedReturnItems((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleProceedExchange = () => {
    if (!receipt || selectedReturnItems.size === 0) return;
    const items = (receipt.order.items ?? []).filter((_, index) =>
      selectedReturnItems.has(index),
    );
    const exchangedItems: ExchangedItem[] = items.map((item) => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    }));

    startExchange({
      credit: returnCredit,
      orderRef: receipt.order.orderNumber,
      serverId: receipt.order.serverId ?? null,
      posLocalId: receipt.order.posLocalId ?? null,
      items: exchangedItems,
    });

    showSuccessToast("Exchange Started", {
      description: `Credit of ${formatCurrency(returnCredit)} loaded. Add new items at the POS.`,
    });

    setShowExchangeDialog(false);
    router.push("/");
  };

  const payment = receipt?.payments[0];
  const exchangeAllowed = receipt ? canExchangeReceipt(receipt) : false;
  const cashierName = (() => {
    if (receipt?.order.cashierName) return receipt.order.cashierName;
    if (typeof window === "undefined") return "Staff";
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.name || "Staff";
  })();

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Scan Receipt</h1>
          <p className="text-sm text-muted-foreground">
            Scan the barcode on a receipt to exchange an item or reprint it.
          </p>
        </div>
        <Badge variant="outline" className={online ? "border-green-200 text-green-700 bg-green-50" : "border-amber-200 text-amber-700 bg-amber-50"}>
          {online ? "Online" : "Offline"}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-3xl mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanBarcode className="h-5 w-5" />
                Transaction barcode
              </CardTitle>
              <CardDescription>
                {online
                  ? "Looks on this terminal first, then on the server."
                  : "Offline lookup uses transactions saved on this terminal."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runLookup(code);
                }}
              >
                <Input
                  ref={inputRef}
                  value={code}
                  autoFocus
                  autoComplete="off"
                  placeholder="Scan or enter the transaction number"
                  onChange={(event) => setCode(event.target.value)}
                  aria-label="Receipt barcode"
                />
                <Button type="submit" disabled={loading} className="sm:w-32">
                  {loading ? "Looking up…" : "Look up"}
                </Button>
              </form>
              {error && (
                <p className="mt-3 text-sm font-medium text-red-600" role="alert">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          {receipt && (
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">
                  {receipt.order.orderNumber}
                </CardTitle>
                <CardDescription>
                  {formatDateTime(asDate(receipt.order.localCreatedAt))}
                  {receipt.order.cashierName ? ` · ${receipt.order.cashierName}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{statusLabel(receipt.order.status)}</Badge>
                  {payment && (
                    <Badge variant="outline">{formatPaymentMethod(payment.method)}</Badge>
                  )}
                  {receipt.order.customerName && (
                    <Badge variant="outline">{receipt.order.customerName}</Badge>
                  )}
                </div>

                {receipt.alreadyExchanged && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                    This transaction has already been exchanged
                    {receipt.exchangeChildOrderNumber
                      ? ` (${receipt.exchangeChildOrderNumber})`
                      : ""}
                    . You can still reprint the receipt.
                  </div>
                )}

                {!exchangeAllowed && !receipt.alreadyExchanged && (
                  <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    This transaction cannot be exchanged. You can still reprint the receipt.
                  </div>
                )}

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(receipt.order.items ?? []).map((item, index) => (
                        <TableRow key={`${item.productId}-${index}`}>
                          <TableCell>
                            <p className="font-medium">{item.name}</p>
                            {item.sku && item.sku !== "MANUAL" && (
                              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(item.total || 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(Number(receipt.order.totalAmount || 0))}</span>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {exchangeAllowed && (
                    <Button
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={() => {
                        setExchangePinEntry("");
                        setExchangePinError("");
                        setShowExchangePinDialog(true);
                      }}
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                      Exchange Item
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowReceiptDialog(true)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Reprint Receipt
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-12 h-12 border-2 rounded-xl flex items-center justify-center text-2xl transition-colors ${
                    index < exchangePinEntry.length
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {index < exchangePinEntry.length ? "●" : ""}
                </div>
              ))}
            </div>
            {exchangePinError && (
              <p className="text-center text-sm text-red-600 font-medium">{exchangePinError}</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  className="h-14 text-xl font-semibold"
                  onClick={() => void handleExchangePinInput(n.toString())}
                  disabled={exchangePinEntry.length >= 4}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-14"
                onClick={() => {
                  setExchangePinEntry((current) => current.slice(0, -1));
                  setExchangePinError("");
                }}
              >
                <Delete className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold"
                onClick={() => void handleExchangePinInput("0")}
                disabled={exchangePinEntry.length >= 4}
              >
                0
              </Button>
              <Button
                variant="ghost"
                className="h-14 text-sm text-gray-500"
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
              Check the items the customer is returning. The total value becomes a credit on the new order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
            {receipt?.order.items?.map((item, index) => {
              const checked = selectedReturnItems.has(index);
              return (
                <label
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-orange-400 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleReturnItem(index)}
                    className="h-4 w-4 accent-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{item.name}</div>
                    <div className="text-sm text-gray-500">
                      Qty: {item.quantity} × {formatCurrency(Number(item.unitPrice || 0))}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-800 flex-shrink-0">
                    {formatCurrency(Number(item.total || 0))}
                  </div>
                </label>
              );
            })}
          </div>
          <div
            className={`rounded-lg p-4 border-2 ${
              returnCredit > 0
                ? "border-orange-300 bg-orange-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Return Credit</span>
              <span className={`text-xl font-bold ${returnCredit > 0 ? "text-orange-700" : "text-gray-400"}`}>
                {formatCurrency(returnCredit)}
              </span>
            </div>
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

      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="flex max-h-[min(90dvh,90vh)] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Reprint Receipt</DialogTitle>
            <DialogDescription>Print receipt for this transaction</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            {receipt && (
              <Receipt
                orderNumber={receipt.order.orderNumber}
                items={(receipt.order.items || []).map((item) => ({
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: Number(item.unitPrice),
                  total: Number(item.total),
                }))}
                subtotal={Number(receipt.order.subtotal)}
                taxAmount={Number(receipt.order.taxAmount)}
                discountAmount={Number(receipt.order.discountAmount)}
                totalAmount={Number(receipt.order.totalAmount)}
                paymentMethod={payment?.method || "N/A"}
                paymentReference={payment?.reference}
                customerName={receipt.order.customerName}
                customerAddress={receipt.order.customerAddress}
                cashierName={cashierName}
                terminalName={receipt.order.terminalId || "Terminal"}
                dateTime={asDate(receipt.order.completedAt || receipt.order.localCreatedAt)}
                pointsRedeemed={receipt.order.pointsRedeemed}
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

export default function ScanReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ScanReceipt />
    </Suspense>
  );
}
