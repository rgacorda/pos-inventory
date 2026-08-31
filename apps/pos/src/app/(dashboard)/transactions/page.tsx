"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useTodaysOrders,
  useTodaysPayments,
  usePaymentsByOrder,
} from "@/hooks/useDatabase";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import { LocalOrder, LocalPayment, dbHelpers } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Receipt } from "@/components/receipt";
import {
  Printer,
  ArrowLeftRight,
  Delete,
  Search,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
} from "lucide-react";
import { showSuccessToast } from "@/lib/toast-utils";
import { OrderStatus } from "@pos/shared-types";
import { useCart, ExchangedItem } from "@/contexts/cart-context";
import { format } from "date-fns";

function formatPaymentMethod(method?: string) {
  if (!method) return "";
  return method
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getOrderPaymentMethods(
  order: LocalOrder,
  paymentsByOrder: Map<string, LocalPayment[]>,
) {
  const methods = (paymentsByOrder.get(order.posLocalId) ?? [])
    .map((payment) => formatPaymentMethod(payment.method))
    .filter(Boolean);
  if (methods.length === 0) return "N/A";
  return [...new Set(methods)].join(" + ");
}

function getItemsBought(order: LocalOrder) {
  return (order.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function getOrderTimestamp(order: LocalOrder) {
  return new Date(order.localCreatedAt).getTime();
}

export default function OrdersPage() {
  const router = useRouter();
  const orders = useTodaysOrders();
  const todaysPayments = useTodaysPayments();
  const { startExchange } = useCart();

  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showExchangeDialog, setShowExchangeDialog] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Set<number>>(
    new Set(),
  );
  const payments = usePaymentsByOrder(selectedOrder?.posLocalId || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [timeSort, setTimeSort] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, LocalPayment[]>();
    todaysPayments?.forEach((payment) => {
      const existing = map.get(payment.orderId) ?? [];
      existing.push(payment);
      map.set(payment.orderId, existing);
    });
    return map;
  }, [todaysPayments]);

  // Find the exchange order created for the selected order (local lookup)
  const exchangeChildOrder = useMemo(() => {
    if (!selectedOrder || !orders) return null;
    return orders.find((o) => o.exchangeRef === selectedOrder.orderNumber) ?? null;
  }, [selectedOrder, orders]);

  // Find the original order for an exchange order (local lookup)
  const exchangeParentOrder = useMemo(() => {
    if (!selectedOrder?.exchangeRef || !orders) return null;
    return orders.find((o) => o.orderNumber === selectedOrder.exchangeRef) ?? null;
  }, [selectedOrder, orders]);

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

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order) => {
      const query = searchQuery.toLowerCase();
      const paymentMethods = getOrderPaymentMethods(order, paymentsByOrder);
      const matchesSearch =
        !query ||
        order.orderNumber?.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        paymentMethods.toLowerCase().includes(query);

      const matchesPayment =
        paymentFilter === "ALL" ||
        (paymentsByOrder.get(order.posLocalId) ?? []).some(
          (payment) => payment.method === paymentFilter,
        );

      const matchesStatus =
        statusFilter === "ALL" || order.status === statusFilter;

      return matchesSearch && matchesPayment && matchesStatus;
    });
  }, [orders, searchQuery, paymentFilter, statusFilter, paymentsByOrder]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const diff = getOrderTimestamp(a) - getOrderTimestamp(b);
      return timeSort === "asc" ? diff : -diff;
    });
  }, [filteredOrders, timeSort]);

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = sortedOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, paymentFilter, statusFilter, timeSort]);

  // ── Exchange helpers ──────────────────────────────────────────────────────

  const canExchange = (order: LocalOrder | null) => {
    if (!order) return false;
    if (order.status !== OrderStatus.COMPLETED) return false;
    // Prevent re-exchange if an exchange order already exists for this order
    if (exchangeChildOrder) return false;
    return true;
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
      selectedReturnItems.has(idx),
    );

    const exchangedItems: ExchangedItem[] = items.map((item) => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    }));

    startExchange({
      credit: returnCredit,
      orderRef: selectedOrder.orderNumber,
      serverId: selectedOrder.serverId ?? null,
      posLocalId: selectedOrder.posLocalId ?? null,
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
        <h1 className="text-xl font-semibold">Today&apos;s Transactions</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Today&apos;s Transactions</CardTitle>
                <CardDescription>
                  Search, filter, and review completed sales for this terminal
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by customer name, order ID, or payment..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Payments</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="DIGITAL_WALLET">Digital Wallet</SelectItem>
                    <SelectItem value="STORE_CREDIT">Store Credit</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="EXCHANGE">Exchange</SelectItem>
                    <SelectItem value="VOID">Voided</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-auto">
                {!orders ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground">
                      Loading transactions...
                    </div>
                  </div>
                ) : sortedOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                    <div className="text-muted-foreground">
                      {searchQuery ||
                      paymentFilter !== "ALL" ||
                      statusFilter !== "ALL"
                        ? "No transactions match your search"
                        : "No transactions yet today"}
                    </div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Mode of Payment</TableHead>
                        <TableHead>Items Bought</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setTimeSort((current) =>
                                current === "asc" ? "desc" : "asc",
                              )
                            }
                            className="-ml-3 h-8"
                          >
                            Time
                            {timeSort === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : (
                              <ArrowDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((order) => {
                        const isVoided = order.status === OrderStatus.VOID;
                        const isExchange = order.status === OrderStatus.EXCHANGE;
                        return (
                          <TableRow
                            key={order.posLocalId}
                            onClick={() => setSelectedOrder(order)}
                            className="cursor-pointer"
                          >
                            <TableCell className="font-medium">
                              {order.customerName || "Walk-in"}
                            </TableCell>
                            <TableCell>
                              {getOrderPaymentMethods(order, paymentsByOrder)}
                            </TableCell>
                            <TableCell>{getItemsBought(order)}</TableCell>
                            <TableCell
                              className={`font-semibold ${
                                isVoided
                                  ? "line-through text-gray-400"
                                  : isExchange
                                    ? "text-orange-700"
                                    : ""
                              }`}
                            >
                              {formatCurrency(order.totalAmount)}
                            </TableCell>
                            <TableCell>
                              {format(new Date(order.localCreatedAt), "h:mm a")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, sortedOrders.length)} of{" "}
                    {sortedOrders.length} results
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={
                              currentPage === pageNum ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Transaction Details Dialog ── */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] sm:!max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedOrder && formatDateTime(selectedOrder.localCreatedAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Transaction ID</p>
                  <p className="font-medium font-mono text-sm">
                    {selectedOrder.orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge
                      className={
                        selectedOrder.status === "COMPLETED"
                          ? "bg-green-600 hover:bg-green-700"
                          : selectedOrder.status === "EXCHANGE"
                            ? "bg-orange-500 hover:bg-orange-600"
                            : selectedOrder.status === "PENDING"
                              ? "bg-yellow-600 hover:bg-yellow-700"
                              : selectedOrder.status === "VOID"
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-gray-600 hover:bg-gray-700"
                      }
                    >
                      {selectedOrder.status === "VOID"
                        ? "✗ VOIDED"
                        : selectedOrder.status === "EXCHANGE"
                          ? "⇄ EXCHANGE"
                          : selectedOrder.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        selectedOrder.syncStatus === "synced"
                          ? "border-green-200 text-green-700"
                          : selectedOrder.syncStatus === "pending"
                            ? "border-yellow-200 text-yellow-700"
                            : selectedOrder.syncStatus === "error"
                              ? "border-red-200 text-red-700"
                              : "border-blue-200 text-blue-700"
                      }
                    >
                      {selectedOrder.syncStatus === "synced"
                        ? "✓ Synced"
                        : selectedOrder.syncStatus === "pending"
                          ? "⏳ Pending"
                          : selectedOrder.syncStatus === "error"
                            ? "✗ Error"
                            : "⟳ Syncing"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">
                    {selectedOrder.customerName || "Walk-in"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Items Bought</p>
                  <p className="font-medium">{getItemsBought(selectedOrder)}</p>
                </div>
              </div>

              {/* Exchange reference badge — this IS an exchange order */}
              {selectedOrder.exchangeRef && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
                  <ArrowLeftRight className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-800">
                      Exchange of <strong>{selectedOrder.exchangeRef}</strong>
                    </p>
                    {exchangeParentOrder && (
                      <button
                        className="mt-1 text-xs text-orange-700 underline hover:text-orange-900"
                        onClick={() => setSelectedOrder(exchangeParentOrder)}
                      >
                        View original transaction →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Exchanged badge — this order was already exchanged */}
              {exchangeChildOrder && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
                  <ArrowLeftRight className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-800">
                      This order has been exchanged
                    </p>
                    <button
                      className="mt-1 text-xs text-orange-700 underline hover:text-orange-900"
                      onClick={() => setSelectedOrder(exchangeChildOrder)}
                    >
                      View exchange transaction ({exchangeChildOrder.orderNumber}) →
                    </button>
                  </div>
                </div>
              )}

              {(selectedOrder.customerName || selectedOrder.customerAddress) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Customer Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedOrder.customerName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedOrder.customerName}</p>
                      </div>
                    )}
                    {selectedOrder.customerAddress && (
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium">
                          {selectedOrder.customerAddress}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {payments && payments.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Payment Information</h4>
                  <div className="space-y-3">
                    {payments.map((payment, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Method</p>
                          <p className="font-medium">
                            {formatPaymentMethod(payment.method)}
                          </p>
                        </div>
                        {payment.reference && (
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Reference
                            </p>
                            <p className="font-medium">{payment.reference}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                {(() => {
                  const returnedItems =
                    selectedOrder.returnedItems?.length
                      ? selectedOrder.returnedItems
                      : exchangeChildOrder?.returnedItems;
                  if (!returnedItems?.length) return null;
                  return (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-3 text-orange-800">
                        Returned Items ({returnedItems.length}{" "}
                        {returnedItems.length === 1 ? "line" : "lines"})
                      </h4>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Quantity</TableHead>
                              <TableHead className="text-right">Unit Price</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returnedItems.map((item, index) => (
                              <TableRow key={`returned-${item.productId}-${index}`}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {item.name || "Returned item"}
                                    </p>
                                    {item.sku && item.sku !== "MANUAL" && (
                                      <p className="text-xs text-muted-foreground">
                                        SKU: {item.sku}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(item.unitPrice ?? 0)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(
                                    item.total ??
                                      (item.quantity ?? 0) * (item.unitPrice ?? 0),
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()}
                <h4 className="font-semibold mb-3">
                  {selectedOrder.exchangeRef ? "Replacement Items" : "Items Bought"}{" "}
                  ({selectedOrder.items?.length || 0} lines,{" "}
                  {getItemsBought(selectedOrder)} qty)
                </h4>
                <div className="rounded-lg border overflow-hidden">
                  <div className="max-h-[420px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items?.map((item, index) => (
                          <TableRow key={`${item.productId}-${index}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.sku && item.sku !== "MANUAL" && (
                                  <p className="text-xs text-muted-foreground">
                                    SKU: {item.sku}
                                  </p>
                                )}
                                {item.sku === "MANUAL" && (
                                  <p className="text-xs text-muted-foreground">
                                    Manual item
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(selectedOrder.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">
                    {formatCurrency(selectedOrder.taxAmount)}
                  </span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Exchange Credit Applied</span>
                    <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
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
            <DialogTitle className="text-center">
              Supervisor Authorization
            </DialogTitle>
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
                    <div className="font-medium text-gray-900 truncate">
                      {item.name}
                    </div>
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
              <span className="text-sm font-medium text-gray-700">
                Return Credit
              </span>
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
            <DialogDescription>
              Print receipt for this transaction
            </DialogDescription>
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
