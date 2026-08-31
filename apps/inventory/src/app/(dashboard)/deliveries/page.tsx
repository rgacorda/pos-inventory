"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  showSuccessToast,
  showErrorFromException,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import {
  IconPackage,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react";
import { format } from "date-fns";

interface DeliveryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  isFree?: boolean;
  updateProductCost?: boolean;
  packInfo?: {
    type: "PACK" | "HALF_PACK";
    packs: number;
    unitsPerPack: number;
  };
}

interface InventoryDelivery {
  id: string;
  supplier: string;
  supplierId?: string | null;
  deliveryDate: string;
  totalCost: number;
  discountAmount?: number;
  items: DeliveryItem[];
  status: "PENDING" | "RECEIVED" | "CANCELLED";
  notes?: string;
  invoiceNumber?: string;
  receiptImageUrl?: string;
  createdAt: string;
}

function formatItemQuantity(item: DeliveryItem) {
  if (item.packInfo) {
    const packLabel = item.packInfo.type === "HALF_PACK" ? "half-pack" : "pack";
    const packCount = item.packInfo.packs;
    return `${packCount} ${packLabel}${packCount === 1 ? "" : "s"} (${item.quantity} units)`;
  }
  return `${item.quantity} unit${item.quantity === 1 ? "" : "s"}`;
}

function DeliveryItemsTable({ items }: { items: DeliveryItem[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Line Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(items || []).length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground py-6"
              >
                No items on this delivery
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => (
              <TableRow key={`${item.productId}-${index}`}>
                <TableCell className="font-medium">
                  {item.productName}
                  {item.isFree && (
                    <Badge variant="secondary" className="ml-2">
                      Free
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatItemQuantity(item)}
                </TableCell>
                <TableCell className="text-right">
                  ₱{Number(item.unitCost || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ₱{Number(item.totalCost || 0).toFixed(2)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DeliveryMeta({ delivery }: { delivery: InventoryDelivery }) {
  return (
    <div className="shrink-0 space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Supplier</p>
          <p className="font-medium">{delivery.supplier}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Delivery Date</p>
          <p className="font-medium">
            {format(new Date(delivery.deliveryDate), "MMM d, yyyy")}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Invoice #</p>
          <p className="font-medium">{delivery.invoiceNumber || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total Cost</p>
          <p className="font-medium">₱{Number(delivery.totalCost).toFixed(2)}</p>
        </div>
      </div>
      {delivery.notes && (
        <p className="text-sm text-muted-foreground">{delivery.notes}</p>
      )}
    </div>
  );
}

export default function InventoryDeliveriesPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<InventoryDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>("");
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [receivingDelivery, setReceivingDelivery] = useState<InventoryDelivery | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [viewingDelivery, setViewingDelivery] = useState<InventoryDelivery | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchDeliveries();
  }, []);

  async function fetchDeliveries() {
    try {
      setLoading(true);
      const data = await apiClient.getInventoryDeliveries();
      setDeliveries(data);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("deliveries"));
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteDelivery(id: string) {
    setSelectedDeliveryId(id);
    setShowDeleteDialog(true);
  }

  function openReceiveDialog(delivery: InventoryDelivery) {
    setReceivingDelivery(delivery);
    setIsReceiveDialogOpen(true);
  }

  function closeReceiveDialog() {
    setIsReceiveDialogOpen(false);
    setReceivingDelivery(null);
  }

  function openDetailDialog(delivery: InventoryDelivery) {
    setViewingDelivery(delivery);
    setIsDetailDialogOpen(true);
  }

  function closeDetailDialog() {
    setIsDetailDialogOpen(false);
    setViewingDelivery(null);
  }

  async function confirmReceive() {
    if (!receivingDelivery) return;

    try {
      setReceiving(true);
      await apiClient.updateInventoryDelivery(receivingDelivery.id, {
        status: "RECEIVED",
      });
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Delivery"));
      closeReceiveDialog();
      fetchDeliveries();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("delivery"));
    } finally {
      setReceiving(false);
    }
  }

  async function confirmDelete() {
    try {
      await apiClient.deleteInventoryDelivery(selectedDeliveryId);
      showSuccessToast(SUCCESS_MESSAGES.DELETED("Delivery"));
      setShowDeleteDialog(false);
      setSelectedDeliveryId("");
      fetchDeliveries();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("delivery"));
    }
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      delivery.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || delivery.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const paginatedDeliveries = filteredDeliveries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      RECEIVED: "default",
      PENDING: "secondary",
      CANCELLED: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Inventory Deliveries</CardTitle>
              <CardDescription>
                Track your inventory purchases and deliveries
              </CardDescription>
            </div>
            <Button onClick={() => router.push("/deliveries/new")}>
              <IconPlus className="mr-2 h-4 w-4" />
              Add Delivery
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Input
              placeholder="Search by supplier or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <IconPackage className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        No deliveries found
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDeliveries.map((delivery) => (
                    <TableRow
                      key={delivery.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetailDialog(delivery)}
                    >
                      <TableCell className="font-medium">
                        {delivery.supplier}
                      </TableCell>
                      <TableCell>{delivery.invoiceNumber || "—"}</TableCell>
                      <TableCell>
                        {format(new Date(delivery.deliveryDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        ₱{Number(delivery.totalCost).toFixed(2)}
                        {Number(delivery.discountAmount) > 0 && (
                          <div className="text-xs text-muted-foreground">
                            -₱{Number(delivery.discountAmount).toFixed(2)} discount
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {delivery.receiptImageUrl ? (
                          <a
                            href={
                              (process.env.NEXT_PUBLIC_API_URL ||
                                "http://localhost:3000") +
                              delivery.receiptImageUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {delivery.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Mark as received"
                            onClick={() => openReceiveDialog(delivery)}
                          >
                            <IconCheck className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/deliveries/${delivery.id}/edit`)}
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDelivery(delivery.id)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredDeliveries.length)} of{" "}
            {filteredDeliveries.length} results
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
                    variant={currentPage === pageNum ? "default" : "outline"}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delivery Items Dialog */}
      <Dialog
        open={isDetailDialogOpen}
        onOpenChange={(open) => !open && closeDetailDialog()}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] !overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              Delivery Items
              {viewingDelivery && getStatusBadge(viewingDelivery.status)}
            </DialogTitle>
            <DialogDescription>
              {viewingDelivery
                ? `${viewingDelivery.supplier} · ${(viewingDelivery.items || []).length} item${(viewingDelivery.items || []).length === 1 ? "" : "s"}`
                : "Items included in this delivery"}
            </DialogDescription>
          </DialogHeader>

          {viewingDelivery && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <DeliveryMeta delivery={viewingDelivery} />
              <DeliveryItemsTable items={viewingDelivery.items || []} />
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={closeDetailDialog}>
              Close
            </Button>
            {viewingDelivery?.status === "PENDING" && (
              <Button
                onClick={() => {
                  const delivery = viewingDelivery;
                  if (!delivery) return;
                  closeDetailDialog();
                  openReceiveDialog(delivery);
                }}
              >
                Mark as Received
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Confirmation Dialog */}
      <Dialog
        open={isReceiveDialogOpen}
        onOpenChange={(open) => !open && closeReceiveDialog()}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] !overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Mark Delivery as Received</DialogTitle>
            <DialogDescription>
              Confirm the items below. Receiving this delivery will add these
              quantities to product stock.
            </DialogDescription>
          </DialogHeader>

          {receivingDelivery && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <DeliveryMeta delivery={receivingDelivery} />
              <DeliveryItemsTable items={receivingDelivery.items || []} />
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={closeReceiveDialog} disabled={receiving}>
              Cancel
            </Button>
            <Button onClick={confirmReceive} disabled={receiving}>
              {receiving ? "Updating..." : "Confirm Received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this delivery? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
