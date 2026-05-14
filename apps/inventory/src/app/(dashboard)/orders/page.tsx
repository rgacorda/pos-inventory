"use client";

import { useEffect, useState } from "react";
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
  Search,
  Filter,
  Eye,
  ShoppingCart,
  Calendar as CalendarIcon,
  XCircle,
} from "lucide-react";
import {
  showErrorFromException,
  showSuccessToast,
  showErrorToast,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/lib/toast-utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await apiClient.getOrders();
      setOrders(data);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("orders"));
    } finally {
      setLoading(false);
    }
  };

  const viewOrderDetails = (order: any) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
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
      await loadOrders();
      
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

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id?.toString().includes(searchQuery) ||
      order.terminal?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.cashier?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || order.status === statusFilter;

    const matchesDateRange =
      !dateRange?.from ||
      !dateRange?.to ||
      (() => {
        const orderDate = new Date(order.createdAt);
        const from = new Date(dateRange.from);
        const to = new Date(dateRange.to);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        return orderDate >= from && orderDate <= to;
      })();

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateRange]);

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>
                Complete list of orders from all terminals
              </CardDescription>
            </div>
            <Button variant="outline" onClick={loadOrders}>
              <Filter className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by order ID, terminal, or cashier..."
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
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                        {format(dateRange.to, "MMM dd, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM dd, yyyy")
                    )
                  ) : (
                    <span>Pick a date range</span>
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
                <SelectItem value="VOID">Voided</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading orders...</div>
              </div>
            ) : filteredOrders.length === 0 ? (
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
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.terminal?.name || "N/A"}</TableCell>
                      <TableCell>{order.cashier?.name || "N/A"}</TableCell>
                      <TableCell>{order.items?.length || 0}</TableCell>
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
                                : order.status === "VOID"
                                  ? "bg-red-600 hover:bg-red-700"
                                  : order.status === "PENDING"
                                    ? "bg-yellow-600 hover:bg-yellow-700"
                                    : "bg-gray-600 hover:bg-gray-700"
                          }
                        >
                          {order.status === "VOID" ? "✗ VOIDED" : order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(order.createdAt).toLocaleDateString()}
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
          {!loading && totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of{" "}
                {filteredOrders.length} results
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

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    className={
                      selectedOrder.status === "COMPLETED"
                        ? "mt-1 bg-green-600 hover:bg-green-700"
                        : selectedOrder.status === "SYNCED"
                          ? "mt-1 bg-blue-600 hover:bg-blue-700"
                          : selectedOrder.status === "VOID"
                            ? "mt-1 bg-red-600 hover:bg-red-700"
                            : selectedOrder.status === "PENDING"
                              ? "mt-1 bg-yellow-600 hover:bg-yellow-700"
                              : "mt-1 bg-gray-600 hover:bg-gray-700"
                    }
                  >
                    {selectedOrder.status === "VOID" ? "✗ VOIDED" : selectedOrder.status}
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
                    {selectedOrder.cashier?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

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
                <h4 className="font-semibold mb-3">Order Items</h4>
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
                      Created: {new Date(selectedOrder.createdAt).toLocaleString()}
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
