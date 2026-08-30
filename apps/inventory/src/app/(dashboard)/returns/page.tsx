"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  showSuccessToast,
  showErrorFromException,
  showWarningToast,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import {
  IconTruckReturn,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { format } from "date-fns";
import {
  ReturnItemsEditor,
  ReturnItemProduct,
  ReturnLineItem,
} from "@/components/returns/return-items-editor";

interface InventoryReturnRecord {
  id: string;
  supplier: string;
  supplierId?: string | null;
  deliveryId?: string | null;
  reason?: string | null;
  notes?: string | null;
  status: "NOT_RESOLVED" | "RESOLVED";
  returnedItems: ReturnLineItem[];
  replacementItems?: ReturnLineItem[] | null;
  returnedTotalCost: number;
  replacementTotalCost?: number | null;
  resolvedAt?: string | null;
  createdAt: string;
}

/** Read-only items table used in the return detail view (returned vs. replacement). */
function ItemsSummaryTable({
  items,
  emptyMessage,
}: {
  items: ReturnLineItem[];
  emptyMessage: string;
}) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.totalCost || 0), 0);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic border rounded-md p-3">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Total Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={`${item.productId}-${index}`}>
              <TableCell className="font-medium">
                {item.productName}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {item.productSku || "—"}
              </TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">
                ₱{Number(item.unitCost).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                ₱{Number(item.totalCost).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={4} className="text-right font-semibold">
              Total:
            </TableCell>
            <TableCell className="text-right font-semibold">
              ₱{subtotal.toFixed(2)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export default function InventoryReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<InventoryReturnRecord[]>([]);
  const [products, setProducts] = useState<ReturnItemProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnresolveDialog, setShowUnresolveDialog] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState<string>("");

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [viewingReturn, setViewingReturn] =
    useState<InventoryReturnRecord | null>(null);

  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [resolvingReturn, setResolvingReturn] =
    useState<InventoryReturnRecord | null>(null);
  const [replacementItems, setReplacementItems] = useState<ReturnLineItem[]>(
    [],
  );
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [returnsData, productsData] = await Promise.all([
        apiClient.getInventoryReturns(),
        apiClient.getProducts(),
      ]);
      setReturns(returnsData);
      setProducts(productsData);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("returns"));
    } finally {
      setLoading(false);
    }
  }

  const filteredReturns = returns.filter((r) => {
    const matchesSearch =
      r.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reason || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  function getStatusBadge(status: string) {
    return status === "RESOLVED" ? (
      <Badge variant="default">Resolved</Badge>
    ) : (
      <Badge variant="secondary">Not Resolved</Badge>
    );
  }

  function handleDelete(id: string) {
    setSelectedReturnId(id);
    setShowDeleteDialog(true);
  }

  async function confirmDelete() {
    try {
      await apiClient.deleteInventoryReturn(selectedReturnId);
      showSuccessToast(SUCCESS_MESSAGES.DELETED("Return"));
      setShowDeleteDialog(false);
      setSelectedReturnId("");
      fetchData();
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("return"));
    }
  }

  function handleUnresolve(id: string) {
    setSelectedReturnId(id);
    setShowUnresolveDialog(true);
  }

  async function confirmUnresolve() {
    try {
      await apiClient.unresolveInventoryReturn(selectedReturnId);
      showSuccessToast("Return marked as not resolved");
      setShowUnresolveDialog(false);
      setSelectedReturnId("");
      fetchData();
    } catch (error) {
      showErrorFromException(error, "Failed to unresolve return");
    }
  }

  function openDetailDialog(inventoryReturn: InventoryReturnRecord) {
    setViewingReturn(inventoryReturn);
    setIsDetailDialogOpen(true);
  }

  function closeDetailDialog() {
    setIsDetailDialogOpen(false);
    setViewingReturn(null);
  }

  function openResolveDialog(inventoryReturn: InventoryReturnRecord) {
    setResolvingReturn(inventoryReturn);
    // Default the replacement items to a copy of what was returned — the
    // user can freely change products/quantities from here if the supplier
    // sent something different.
    setReplacementItems(
      inventoryReturn.returnedItems.map((item) => ({ ...item })),
    );
    setIsResolveDialogOpen(true);
  }

  function closeResolveDialog() {
    setIsResolveDialogOpen(false);
    setResolvingReturn(null);
    setReplacementItems([]);
  }

  async function confirmResolve() {
    if (!resolvingReturn) return;
    if (replacementItems.length === 0) {
      showWarningToast("Add at least one replacement item before resolving");
      return;
    }

    try {
      setResolving(true);
      await apiClient.resolveInventoryReturn(resolvingReturn.id, {
        replacementItems,
      });
      showSuccessToast("Return marked as resolved");
      closeResolveDialog();
      fetchData();
    } catch (error) {
      showErrorFromException(error, "Failed to resolve return");
    } finally {
      setResolving(false);
    }
  }

  // Decimal columns come back from the API as strings (e.g. "123.45"), so
  // this must be coerced to a number before any arithmetic/formatting.
  const returnedTotal = Number(resolvingReturn?.returnedTotalCost || 0);
  const replacementTotal = useMemo(
    () => replacementItems.reduce((sum, i) => sum + i.totalCost, 0),
    [replacementItems],
  );
  const costDiff = Math.round((replacementTotal - returnedTotal) * 100) / 100;

  const viewingReturnedTotal = Number(viewingReturn?.returnedTotalCost || 0);
  const viewingReplacementTotal = Number(
    viewingReturn?.replacementTotalCost || 0,
  );
  const viewingCostDiff =
    Math.round((viewingReplacementTotal - viewingReturnedTotal) * 100) / 100;

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
              <CardTitle>Return Items</CardTitle>
              <CardDescription>
                Track items returned to suppliers and their resolution status
              </CardDescription>
            </div>
            <Button onClick={() => router.push("/returns/new")}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Return
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Input
              placeholder="Search by supplier or reason..."
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
                <SelectItem value="NOT_RESOLVED">Not Resolved</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
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
                  <TableHead>Reason</TableHead>
                  <TableHead>Returned Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Replacement Cost</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <IconTruckReturn className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        No returns found
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedReturns.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetailDialog(r)}
                    >
                      <TableCell className="font-medium">
                        {r.supplier}
                      </TableCell>
                      <TableCell>{r.reason || "—"}</TableCell>
                      <TableCell>
                        {r.returnedItems.length} item
                        {r.returnedItems.length === 1 ? "" : "s"}
                        <div className="text-xs text-muted-foreground">
                          ₱{Number(r.returnedTotalCost).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell>
                        {r.status === "RESOLVED" ? (
                          `₱${Number(r.replacementTotalCost || 0).toFixed(2)}`
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(r.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell
                        className="text-right space-x-1 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.status === "NOT_RESOLVED" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit"
                              onClick={() =>
                                router.push(`/returns/${r.id}/edit`)
                              }
                            >
                              <IconEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Mark as resolved"
                              onClick={() => openResolveDialog(r)}
                            >
                              <IconCheck className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Unresolve"
                            onClick={() => handleUnresolve(r.id)}
                          >
                            <IconArrowBackUp className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete"
                          onClick={() => handleDelete(r.id)}
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
            {Math.min(currentPage * itemsPerPage, filteredReturns.length)} of{" "}
            {filteredReturns.length} results
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

      {/* Return Detail Dialog */}
      <Dialog
        open={isDetailDialogOpen}
        onOpenChange={(open) => !open && closeDetailDialog()}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Return Details
              {viewingReturn && getStatusBadge(viewingReturn.status)}
            </DialogTitle>
            <DialogDescription>
              {viewingReturn && (
                <>
                  {viewingReturn.supplier} •{" "}
                  {format(new Date(viewingReturn.createdAt), "MMM d, yyyy")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {viewingReturn && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">{viewingReturn.supplier}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reason</p>
                  <p className="font-medium">{viewingReturn.reason || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {format(new Date(viewingReturn.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Resolved</p>
                  <p className="font-medium">
                    {viewingReturn.resolvedAt
                      ? format(
                          new Date(viewingReturn.resolvedAt),
                          "MMM d, yyyy",
                        )
                      : "Not yet resolved"}
                  </p>
                </div>
              </div>

              {viewingReturn.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Notes</p>
                  <p>{viewingReturn.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  What Was Returned
                </Label>
                <ItemsSummaryTable
                  items={viewingReturn.returnedItems}
                  emptyMessage="No returned items recorded."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  What Was Replaced
                </Label>
                <ItemsSummaryTable
                  items={viewingReturn.replacementItems || []}
                  emptyMessage="Not yet resolved — no replacement items recorded."
                />
              </div>

              <div
                className={`p-3 rounded border text-sm space-y-1 ${
                  viewingReturn.status !== "RESOLVED"
                    ? "bg-muted/50"
                    : viewingCostDiff === 0
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-200"
                }`}
              >
                <p>
                  Returned Total:{" "}
                  <span className="font-semibold">
                    ₱{viewingReturnedTotal.toFixed(2)}
                  </span>
                </p>
                <p>
                  Replacement Total:{" "}
                  <span className="font-semibold">
                    {viewingReturn.status === "RESOLVED"
                      ? `₱${viewingReplacementTotal.toFixed(2)}`
                      : "—"}
                  </span>
                </p>
                {viewingReturn.status === "RESOLVED" &&
                  (viewingCostDiff === 0 ? (
                    <p className="text-emerald-700 font-medium">
                      Replacement cost matches the returned items exactly.
                    </p>
                  ) : (
                    <p className="text-amber-700 font-medium">
                      {viewingCostDiff > 0
                        ? `Replacement was ₱${viewingCostDiff.toFixed(2)} more than the returned items.`
                        : `Replacement was ₱${Math.abs(viewingCostDiff).toFixed(2)} short of the returned items.`}
                    </p>
                  ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetailDialog}>
              Close
            </Button>
            {viewingReturn?.status === "NOT_RESOLVED" && (
              <Button
                onClick={() => {
                  const id = viewingReturn.id;
                  closeDetailDialog();
                  router.push(`/returns/${id}/edit`);
                }}
              >
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog
        open={isResolveDialogOpen}
        onOpenChange={(open) => !open && closeResolveDialog()}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolve Return</DialogTitle>
            <DialogDescription>
              Record the replacement items{" "}
              {resolvingReturn?.supplier
                ? `${resolvingReturn.supplier} sent back`
                : "sent back"}
              . Stock is added for these items once resolved. Defaults to the
              same items that were returned, but you can change products or
              quantities if the supplier sent something different.
            </DialogDescription>
          </DialogHeader>

          {resolvingReturn && (
            <div className="space-y-4">
              <ReturnItemsEditor
                products={products}
                items={replacementItems}
                onItemsChange={setReplacementItems}
                supplierId={resolvingReturn.supplierId || undefined}
                supplierName={resolvingReturn.supplier}
                stockEffect="add"
                itemNounSingular="replacement item"
              />

              <div
                className={`p-3 rounded border text-sm space-y-1 ${
                  costDiff === 0
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-amber-50 border-amber-200"
                }`}
              >
                <p>
                  Returned Total:{" "}
                  <span className="font-semibold">
                    ₱{returnedTotal.toFixed(2)}
                  </span>
                </p>
                <p>
                  Replacement Total:{" "}
                  <span className="font-semibold">
                    ₱{replacementTotal.toFixed(2)}
                  </span>
                </p>
                {costDiff !== 0 && (
                  <p className="text-amber-700 font-medium">
                    {costDiff > 0
                      ? `Replacement is ₱${costDiff.toFixed(2)} more than the returned items.`
                      : `Replacement is ₱${Math.abs(costDiff).toFixed(2)} short of the returned items.`}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeResolveDialog}>
              Cancel
            </Button>
            <Button onClick={confirmResolve} disabled={resolving}>
              {resolving ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unresolve Confirmation Dialog */}
      <AlertDialog
        open={showUnresolveDialog}
        onOpenChange={setShowUnresolveDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unresolve Return</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the replacement stock that was added and marks
              this return as not yet resolved again, so you can edit and
              re-resolve it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnresolve}>
              Unresolve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Return</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this return? Any stock it
              affected will be reversed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
