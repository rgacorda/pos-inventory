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
  IconReceipt,
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

interface Expense {
  id: string;
  type: "ELECTRICITY" | "INTERNET" | "WATER" | "WAGES" | "RENT" | "OTHER";
  category?: string;
  amount: number;
  expenseDate: string;
  description?: string;
  recipient?: string;
  referenceNumber?: string;
  createdAt: string;
}

const EXPENSE_TYPES = [
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "INTERNET", label: "Internet" },
  { value: "WATER", label: "Water" },
  { value: "WAGES", label: "Employee Wages" },
  { value: "RENT", label: "Rent" },
  { value: "OTHER", label: "Other" },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());

  const [formData, setFormData] = useState({
    type: "ELECTRICITY" as
      | "ELECTRICITY"
      | "INTERNET"
      | "WATER"
      | "WAGES"
      | "RENT"
      | "OTHER",
    category: "",
    amount: "",
    recipient: "",
    referenceNumber: "",
    description: "",
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    try {
      setLoading(true);
      const data = await apiClient.getExpenses();
      setExpenses(data);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await apiClient.createExpense({
        ...formData,
        expenseDate: expenseDate.toISOString(),
        amount: parseFloat(formData.amount),
      });
      toast.success("Expense created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error("Error creating expense:", error);
      toast.error("Failed to create expense");
    }
  }

  async function handleUpdate() {
    if (!selectedExpense) return;

    try {
      await apiClient.updateExpense(selectedExpense.id, {
        ...formData,
        expenseDate: expenseDate.toISOString(),
        amount: parseFloat(formData.amount),
      });
      toast.success("Expense updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error("Error updating expense:", error);
      toast.error("Failed to update expense");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      await apiClient.deleteExpense(id);
      toast.success("Expense deleted successfully");
      fetchExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  }

  function resetForm() {
    setFormData({
      type: "ELECTRICITY",
      category: "",
      amount: "",
      recipient: "",
      referenceNumber: "",
      description: "",
    });
    setExpenseDate(new Date());
    setSelectedExpense(null);
  }

  function openEditDialog(expense: Expense) {
    setSelectedExpense(expense);
    setFormData({
      type: expense.type,
      category: expense.category || "",
      amount: expense.amount.toString(),
      recipient: expense.recipient || "",
      referenceNumber: expense.referenceNumber || "",
      description: expense.description || "",
    });
    setExpenseDate(new Date(expense.expenseDate));
    setIsEditDialogOpen(true);
  }

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.referenceNumber
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || expense.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ELECTRICITY: "bg-yellow-100 text-yellow-800",
      INTERNET: "bg-blue-100 text-blue-800",
      WATER: "bg-cyan-100 text-cyan-800",
      WAGES: "bg-green-100 text-green-800",
      RENT: "bg-purple-100 text-purple-800",
      OTHER: "bg-gray-100 text-gray-800",
    };
    return colors[type] || colors.OTHER;
  };

  const getTotalExpenses = () => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
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
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground mt-1">
            Track utilities, wages, and operating expenses
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <IconPlus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Total Expenses
          </h3>
          <p className="text-2xl font-bold mt-2">
            ${getTotalExpenses().toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Total Entries
          </h3>
          <p className="text-2xl font-bold mt-2">{filteredExpenses.length}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by recipient, description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {EXPENSE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Recipient/Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <IconReceipt className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No expenses found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <Badge className={getTypeColor(expense.type)}>
                      {
                        EXPENSE_TYPES.find((t) => t.value === expense.type)
                          ?.label
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {expense.recipient || "—"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(expense.expenseDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${expense.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{expense.referenceNumber || "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(expense)}
                    >
                      <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(expense.id)}
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
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Record a new operating expense
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Expense Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient/Vendor</Label>
              <Input
                value={formData.recipient}
                onChange={(e) =>
                  setFormData({ ...formData, recipient: e.target.value })
                }
                placeholder="Employee name or vendor"
              />
            </div>
            <div className="space-y-2">
              <Label>Expense Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {format(expenseDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(date) => date && setExpenseDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Reference/Invoice Number</Label>
              <Input
                value={formData.referenceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, referenceNumber: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
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
            <Button onClick={handleCreate}>Create Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Expense Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient/Vendor</Label>
              <Input
                value={formData.recipient}
                onChange={(e) =>
                  setFormData({ ...formData, recipient: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Expense Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {format(expenseDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(date) => date && setExpenseDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Reference/Invoice Number</Label>
              <Input
                value={formData.referenceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, referenceNumber: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
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
            <Button onClick={handleUpdate}>Update Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
