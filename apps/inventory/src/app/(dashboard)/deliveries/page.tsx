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
} from "@tabler/icons-react";
import { format } from "date-fns";

interface DeliveryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface InventoryDelivery {
  id: string;
  supplier: string;
  deliveryDate: string;
  totalCost: number;
  items: DeliveryItem[];
  status: "PENDING" | "RECEIVED" | "CANCELLED";
  notes?: string;
  invoiceNumber?: string;
  receiptImageUrl?: string;
  createdAt: string;
}

export default function InventoryDeliveriesPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<InventoryDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
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

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this delivery?")) return;

    try {
      await apiClient.deleteInventoryDelivery(id);
      showSuccessToast(SUCCESS_MESSAGES.DELETED("Delivery"));
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
          <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-4 pt-4">
            <Input
              placeholder="Search by supplier or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">
                        {delivery.supplier}
                      </TableCell>
                      <TableCell>{delivery.invoiceNumber || "—"}</TableCell>
                      <TableCell>
                        {format(new Date(delivery.deliveryDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        ₱{Number(delivery.totalCost).toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                      <TableCell>
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
                      <TableCell className="text-right space-x-2">
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
                          onClick={() => handleDelete(delivery.id)}
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredDeliveries.length)} of{" "}
            {filteredDeliveries.length} results
          </p>
          <div className="flex items-center gap-2">
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
    </div>
  );
}
