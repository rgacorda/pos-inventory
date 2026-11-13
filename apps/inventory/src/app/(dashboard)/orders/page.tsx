"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiClient } from "@/lib/api-client";
import {
  orderToReceiptData,
  ReceiptReprint,
} from "@/components/receipt-reprint";
import {
  cachedOrganizationName,
  type ReceiptOrganization,
} from "@/lib/receipt-template";
import {
  Search,
  Filter,
  Eye,
  ShoppingCart,
  Calendar as CalendarIcon,
  XCircle,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  Printer,
} from "lucide-react";
import {
  showErrorFromException,
  showSuccessToast,
  showErrorToast,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/lib/toast-utils";
import { endOfDay, format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

function todayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: new Date(today) };
}

function getOrderDate(order: { completedAt?: string; createdAt?: string }) {
  return new Date(order.completedAt || order.createdAt || Date.now());
}

function formatPaymentMethod(method?: string) {
  if (!method) return "";
  return method
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getOrderPaymentMethods(order: any) {
  const methods = (order.payments ?? [])
    .map((payment: any) => formatPaymentMethod(payment.method))
    .filter(Boolean);
  if (methods.length === 0) return "N/A";
  return [...new Set(methods)].join(" + ");
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [organization, setOrganization] = useState<ReceiptOrganization | null>(
    null,
  );
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [timeSort, setTimeSort] = useState<"asc" | "desc">("desc");
  const itemsPerPage = 20;
  const requestSeq = useRef(0);
  const detailSeq = useRef(0);
  const hasLoaded = useRef(false);

  const loadOrders = useCallback(
    async (page: number) => {
      const seq = ++requestSeq.current;
      if (!hasLoaded.current) setLoading(true);
      else setRefreshing(true);
      try {
        const params: {
          page: number;
          limit: number;
          sort: "asc" | "desc";
          status?: string;
          startDate?: string;
          endDate?: string;
          search?: string;
        } = {
          page,
          limit: itemsPerPage,
          sort: timeSort,
        };
        if (statusFilter !== "ALL") params.status = statusFilter;
        if (dateRange?.from) {
          params.startDate = startOfDay(dateRange.from).toISOString();
          params.endDate = endOfDay(dateRange.to ?? dateRange.from).toISOString();
        }
        const query = searchQuery.trim();
        if (query) params.search = query;

        const result = await apiClient.getOrders(params);
        if (seq !== requestSeq.current) return;

        const rows = Array.isArray(result)
          ? result.slice((page - 1) * itemsPerPage, page * itemsPerPage)
          : Array.isArray(result?.data)
            ? result.data
            : [];
        const total = Array.isArray(result)
          ? result.length
          : Number(result?.total ?? 0);
        setOrders(rows);
        setTotalOrders(Number.isFinite(total) ? total : 0);
        hasLoaded.current = true;

        const pages = Math.max(
          1,
          Math.ceil((Number.isFinite(total) ? total : 0) / itemsPerPage),
        );
        if (page > pages) setCurrentPage(pages);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("orders"));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [dateRange, searchQuery, statusFilter, timeSort],
  );

  useEffect(() => {
    const cachedName = cachedOrganizationName();
    if (cachedName) setOrganization({ name: cachedName });
    apiClient
      .getMyOrganization()
      .then((org) => {
        const name = String(org?.name || "").trim() || cachedOrganizationName();
        if (!name) return;
        localStorage.setItem("organizationName", name);
        setOrganization({
          name,
          address: org.address || undefined,
          phone: org.phone || undefined,
        });
      })
      .catch(() => {
        const name = cachedOrganizationName();
        if (name) setOrganization({ name });
      });
  }, []);

  const filterKey = [
    searchQuery.trim(),
    statusFilter,
    timeSort,
    dateRange?.from ? startOfDay(dateRange.from).toISOString() : "",
    dateRange?.to ? startOfDay(dateRange.to).toISOString() : "",
  ].join("|");
  const prevFilterKey = useRef(filterKey);

  useEffect(() => {
    const filtersChanged = prevFilterKey.current !== filterKey;
    prevFilterKey.current = filterKey;
    if (filtersChanged && currentPage !== 1) {
      setCurrentPage(1);
      return;
    }
    const delay = searchQuery.trim() ? 300 : 0;
    const timer = setTimeout(() => {
      loadOrders(filtersChanged ? 1 : currentPage);
    }, delay);
    return () => clearTimeout(timer);
  }, [filterKey, currentPage, loadOrders, searchQuery]);

  const openOrder = async (orderId: string) => {
    const seq = ++detailSeq.current;
    setShowDetailsModal(true);
    setDetailLoading(true);
    try {
      const full = await apiClient.getOrder(orderId);
      if (seq !== detailSeq.current) return;
      setSelectedOrder(full);
    } catch (error) {
      if (seq !== detailSeq.current) return;
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("order"));
      setShowDetailsModal(false);
      setSelectedOrder(null);
    } finally {
      if (seq === detailSeq.current) setDetailLoading(false);
    }
  };

  const viewOrderDetails = (order: any) => {
    setSelectedOrder(null);
    openOrder(order.id);
  };

  const handleVoidOrder = async () => {
    if (!selectedOrder) return;

    setIsVoiding(true);
    try {
      await apiClient.voidOrder(selectedOrder.id);
      
      showSuccessToast("Order Voided Successfully", {
        description: "Stock has been restored for all items in this order.",
      });

      // Refresh orders list
      await loadOrders(currentPage);
      
      // Close dialogs
      setShowVoidConfirm(false);
      setShowDetailsModal(false);
      setSelectedOrder(null);
    } catch (error: any) {
      console.error("Failed to void order:", error);
      showErrorToast("Void Failed", {
        description: error.response?.data?.message || "Unable to void order. Please try again.",
      });
    } finally {
      setIsVoiding(false);
    }
  };

  const canVoidOrder = (order: any) => {
    if (!order) return false;
    // Can only void SYNCED orders (COMPLETED orders haven't reached here yet)
    // Cannot void already voided orders
    return order.status === "SYNCED" && order.status !== "VOID";
  };

  const totalPages = Math.max(1, Math.ceil(totalOrders / itemsPerPage));

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>
                Orders from all terminals
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => loadOrders(currentPage)}
              disabled={loading || refreshing}
            >
              <Filter className="mr-2 h-4 w-4" />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by customer name, order ID, terminal, or cashier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-[260px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to &&
                    format(dateRange.from, "yyyy-MM-dd") !==
                      format(dateRange.to, "yyyy-MM-dd") ? (
                      <>
                        {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                        {format(dateRange.to, "MMM dd, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM dd, yyyy")
                    )
                  ) : (
                    <span>All dates</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {dateRange && (
              <Button
                variant="ghost"
                onClick={() => setDateRange(undefined)}
                size="sm"
              >
                Clear
              </Button>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
                <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="SYNCED">Synced</SelectItem>
                <SelectItem value="EXCHANGE">Exchange</SelectItem>
                <SelectItem value="VOID">Voided</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`max-h-[600px] overflow-auto ${refreshing ? "opacity-60" : ""}`}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading orders...</div>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <div className="text-muted-foreground">No orders found</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.terminal?.name || "N/A"}</TableCell>
                      <TableCell>
                        {order.cashier?.name || order.cashierName || "N/A"}
                      </TableCell>
                      <TableCell>{order.customerName || "N/A"}</TableCell>
                      <TableCell>{getOrderPaymentMethods(order)}</TableCell>
                      <TableCell>
                        {order.itemCount ?? order.items?.length ?? 0}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₱{Number(order.totalAmount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            order.status === "COMPLETED"
                              ? "bg-green-600 hover:bg-green-700"
                              : order.status === "SYNCED"
                                ? "bg-blue-600 hover:bg-blue-700"
                                : order.status === "EXCHANGE"
                                  ? "bg-orange-500 hover:bg-orange-600"
                                  : order.status === "VOID"
                                    ? "bg-red-600 hover:bg-red-700"
                                    : order.status === "PENDING"
                                      ? "bg-yellow-600 hover:bg-yellow-700"
                                      : "bg-gray-600 hover:bg-gray-700"
                          }
                        >
                          {order.status === "VOID"
                            ? "✗ VOIDED"
                            : order.status === "EXCHANGE"
                              ? "⇄ EXCHANGE"
                              : order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getOrderDate(order).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {format(getOrderDate(order), "h:mm a")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewOrderDetails(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {/* Pagination */}
          {!loading && totalOrders > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, totalOrders)} of{" "}
                {totalOrders} results
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

      {/* Order Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Complete order information and items
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !selectedOrder ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading order...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-medium font-mono text-sm">
                    {selectedOrder.orderNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    className={
                      selectedOrder.status === "COMPLETED"
                        ? "mt-1 bg-green-600 hover:bg-green-700"
                        : selectedOrder.status === "SYNCED"
                          ? "mt-1 bg-blue-600 hover:bg-blue-700"
                          : selectedOrder.status === "EXCHANGE"
                            ? "mt-1 bg-orange-500 hover:bg-orange-600"
                            : selectedOrder.status === "VOID"
                              ? "mt-1 bg-red-600 hover:bg-red-700"
                              : selectedOrder.status === "PENDING"
                                ? "mt-1 bg-yellow-600 hover:bg-yellow-700"
                                : "mt-1 bg-gray-600 hover:bg-gray-700"
                    }
                  >
                    {selectedOrder.status === "VOID"
                      ? "✗ VOIDED"
                      : selectedOrder.status === "EXCHANGE"
                        ? "⇄ EXCHANGE"
                        : selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Terminal</p>
                  <p className="font-medium">
                    {selectedOrder.terminal?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cashier</p>
                  <p className="font-medium">
                    {selectedOrder.cashier?.name ||
                      selectedOrder.cashierName ||
                      "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {getOrderDate(selectedOrder).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Exchange Info Section */}
              {selectedOrder.exchangeRef && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
                  <ArrowLeftRight className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-800">
                      Exchange of order{" "}
                      <strong>{selectedOrder.exchangeRef}</strong>
                    </p>
                    {selectedOrder.originalOrderId && (
                      <button
                        className="mt-1 text-xs text-orange-700 underline hover:text-orange-900"
                        onClick={() => openOrder(selectedOrder.originalOrderId)}
                      >
                        View original order →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.exchangedAt && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
                  <ArrowLeftRight className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-800">
                      This order was exchanged on{" "}
                      <strong>
                        {new Date(selectedOrder.exchangedAt).toLocaleString()}
                      </strong>
                    </p>
                    {selectedOrder.exchangeChild && (
                      <button
                        className="mt-1 text-xs text-orange-700 underline hover:text-orange-900"
                        onClick={() => openOrder(selectedOrder.exchangeChild.id)}
                      >
                        View exchange order →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Customer Details Section */}
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
                        <p className="font-medium">{selectedOrder.customerAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Information Section */}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Payment Information</h4>
                  <div className="space-y-3">
                    {selectedOrder.payments.map((payment: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Method</p>
                          <p className="font-medium capitalize">
                            {payment.method.replace(/_/g, ' ').toLowerCase()}
                          </p>
                        </div>
                        {payment.reference && (
                          <div>
                            <p className="text-sm text-muted-foreground">Reference</p>
                            <p className="font-medium">{payment.reference}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                {(() => {
                  const returnedItems = selectedOrder.returnedItems?.length
                    ? selectedOrder.returnedItems
                    : (selectedOrder.exchangeChild?.returnedItems ?? []);
                  if (!returnedItems.length) return null;
                  return (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3 text-orange-800">
                        Returned Items
                      </h4>
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
                          {returnedItems.map((item: any, index: number) => (
                            <TableRow key={`returned-${item.productId}-${index}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">
                                    {item.name || "Returned item"}
                                  </p>
                                  {item.sku && (
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
                                ₱{Number(item.unitPrice || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ₱
                                {Number(
                                  item.total ??
                                    Number(item.quantity || 0) *
                                      Number(item.unitPrice || 0),
                                ).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
                <h4 className="font-semibold mb-3">
                  {selectedOrder.exchangeRef ? "Replacement Items" : "Order Items"}
                </h4>
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
                    {selectedOrder.items?.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {item.product?.name || item.name || "Unknown Item"}
                            </p>
                            {(item.product?.sku || item.sku) && (
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.product?.sku || item.sku}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          ₱{Number(item.unitPrice || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₱
                          {(
                            Number(item.quantity || 0) *
                            Number(item.unitPrice || 0)
                          ).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">
                    ₱{Number(selectedOrder.subtotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-medium">
                    ₱{Number(selectedOrder.taxAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>
                    ₱{Number(selectedOrder.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowReceiptDialog(true)}
              className="w-full sm:w-auto"
              disabled={!selectedOrder}
            >
              <Printer className="h-4 w-4 mr-2" />
              Reprint Receipt
            </Button>
            {canVoidOrder(selectedOrder) && (
              <Button
                variant="destructive"
                onClick={() => setShowVoidConfirm(true)}
                className="w-full sm:w-auto"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Void & Refund Order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="flex max-h-[min(90dvh,90vh)] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Reprint Receipt</DialogTitle>
            <DialogDescription>
              Print receipt for this order
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            {selectedOrder && (
              <ReceiptReprint
                data={orderToReceiptData(selectedOrder, organization)}
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

      {/* Void Confirmation Dialog */}
      <AlertDialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void & Refund Order?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to void this order and process a refund?</p>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  <strong>This will:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Mark the order as VOIDED</li>
                    <li><strong>Restore stock</strong> for all items in the order</li>
                    <li>Record void audit trail (who voided, when)</li>
                    <li>Keep order visible for financial records</li>
                  </ul>
                </div>
                {selectedOrder && (
                  <div className="bg-gray-50 border rounded p-3 text-sm">
                    <p className="font-medium">Order Details:</p>
                    <p className="mt-1">Order ID: <strong>{selectedOrder.orderNumber}</strong></p>
                    <p>Total Amount: <strong>₱{Number(selectedOrder.totalAmount || 0).toFixed(2)}</strong></p>
                    <p>Items: <strong>{selectedOrder.items?.length || 0}</strong></p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Created: {getOrderDate(selectedOrder).toLocaleString()}
                    </p>
                  </div>
                )}
                <p className="text-sm font-medium text-red-600">This action cannot be undone!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidOrder}
              disabled={isVoiding}
              className="bg-red-600 hover:bg-red-700"
            >
              {isVoiding ? "Voiding..." : "Yes, Void & Refund Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
