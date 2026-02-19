"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  IconPackage,
  IconPlus,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  createdAt: string;
}

export default function InventoryDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<InventoryDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] =
    useState<InventoryDelivery | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());

  const [formData, setFormData] = useState({
    supplier: "",
    invoiceNumber: "",
    totalCost: "",
    status: "RECEIVED" as "PENDING" | "RECEIVED" | "CANCELLED",
    notes: "",
  });

  useEffect(() => {
    fetchDeliveries();
  }, []);

  async function fetchDeliveries() {
    try {
      setLoading(true);
      const data = await apiClient.getInventoryDeliveries();
      setDeliveries(data);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await apiClient.createInventoryDelivery({
        ...formData,
        deliveryDate: deliveryDate.toISOString(),
        totalCost: parseFloat(formData.totalCost),
        items: [], // Can be expanded later to include line items
      });
      toast.success("Delivery created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      fetchDeliveries();
    } catch (error) {
      console.error("Error creating delivery:", error);
      toast.error("Failed to create delivery");
    }
  }

  async function handleUpdate() {
    if (!selectedDelivery) return;

    try {
      await apiClient.updateInventoryDelivery(selectedDelivery.id, {
        ...formData,
        deliveryDate: deliveryDate.toISOString(),
        totalCost: parseFloat(formData.totalCost),
      });
      toast.success("Delivery updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      fetchDeliveries();
    } catch (error) {
      console.error("Error updating delivery:", error);
      toast.error("Failed to update delivery");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this delivery?")) return;

    try {
      await apiClient.deleteInventoryDelivery(id);
      toast.success("Delivery deleted successfully");
      fetchDeliveries();
    } catch (error) {
      console.error("Error deleting delivery:", error);
      toast.error("Failed to delete delivery");
    }
  }

  function resetForm() {
    setFormData({
      supplier: "",
      invoiceNumber: "",
      totalCost: "",
      status: "RECEIVED",
      notes: "",
    });
    setDeliveryDate(new Date());
    setSelectedDelivery(null);
  }

  function openEditDialog(delivery: InventoryDelivery) {
    setSelectedDelivery(delivery);
    setFormData({
      supplier: delivery.supplier,
      invoiceNumber: delivery.invoiceNumber || "",
      totalCost: delivery.totalCost.toString(),
      status: delivery.status,
      notes: delivery.notes || "",
    });
    setDeliveryDate(new Date(delivery.deliveryDate));
    setIsEditDialogOpen(true);
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      delivery.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || delivery.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Deliveries</h1>
          <p className="text-muted-foreground mt-1">
            Track your inventory purchases and deliveries
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <IconPlus className="mr-2 h-4 w-4" />
          Add Delivery
        </Button>
      </div>

      <div className="flex gap-4">
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeliveries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <IconPackage className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No deliveries found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredDeliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">
                    {delivery.supplier}
                  </TableCell>
                  <TableCell>{delivery.invoiceNumber || "—"}</TableCell>
                  <TableCell>
                    {format(new Date(delivery.deliveryDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>${delivery.totalCost.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(delivery)}
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

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Delivery</DialogTitle>
            <DialogDescription>
              Record a new inventory delivery or purchase
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
                placeholder="Supplier name"
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoiceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceNumber: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {format(deliveryDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={(date) => date && setDeliveryDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Total Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.totalCost}
                onChange={(e) =>
                  setFormData({ ...formData, totalCost: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Delivery</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Delivery</DialogTitle>
            <DialogDescription>Update delivery information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoiceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceNumber: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {format(deliveryDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={(date) => date && setDeliveryDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Total Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.totalCost}
                onChange={(e) =>
                  setFormData({ ...formData, totalCost: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update Delivery</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
