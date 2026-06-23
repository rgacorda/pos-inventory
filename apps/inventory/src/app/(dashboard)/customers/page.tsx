"use client";

import { useEffect, useState } from "react";
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
} from "@/lib/toast-utils";
import {
  IconStar,
  IconPlus,
  IconSearch,
  IconEdit,
  IconHistory,
  IconArrowUp,
  IconArrowDown,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
} from "@tabler/icons-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  totalPoints: number;
  totalSpent: number;
  createdAt: string;
}

interface PointTransaction {
  id: string;
  type: "EARN" | "REDEEM" | "EXPIRE";
  points: number;
  description: string;
  createdAt: string;
  expiresAt?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add / Edit dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Transactions dialog
  const [showTransactionsDialog, setShowTransactionsDialog] = useState(false);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);


  // Raffle / Reset all points
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetReason, setResetReason] = useState("Christmas Raffle Points Reset");
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCustomers();
      setCustomers(data);
    } catch (err) {
      showErrorFromException(err, "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };


  const handleResetAllPoints = async () => {
    if (!resetPassword.trim()) return;
    setResetLoading(true);
    try {
      const result = await apiClient.resetAllPoints(resetPassword, resetReason);
      showSuccessToast(
        `Points reset complete — ${result.customersReset} customers, ${result.pointsCleared} pts cleared`
      );
      setShowResetDialog(false);
      setResetPassword("");
      loadCustomers();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg === "Incorrect password") {
        showErrorFromException(new Error("Incorrect password. Please try again."), "");
      } else {
        showErrorFromException(err, "Reset failed");
      }
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const handleAddSubmit = async () => {
    if (!formName.trim() || !formPhone.trim()) return;
    setFormLoading(true);
    try {
      await apiClient.createCustomer({ name: formName.trim(), phone: formPhone.trim() });
      showSuccessToast(SUCCESS_MESSAGES.CREATED("Customer"));
      setIsAddDialogOpen(false);
      setFormName("");
      setFormPhone("");
      loadCustomers();
    } catch (err) {
      showErrorFromException(err, "Failed to create customer");
    } finally {
      setFormLoading(false);
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedCustomer || !formName.trim() || !formPhone.trim()) return;
    setFormLoading(true);
    try {
      await apiClient.updateCustomer(selectedCustomer.id, {
        name: formName.trim(),
        phone: formPhone.trim(),
      });
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Customer"));
      setIsEditDialogOpen(false);
      loadCustomers();
    } catch (err) {
      showErrorFromException(err, "Failed to update customer");
    } finally {
      setFormLoading(false);
    }
  };

  const openTransactionsDialog = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowTransactionsDialog(true);
    setTransactionsLoading(true);
    try {
      const data = await apiClient.getCustomerTransactions(customer.id);
      setTransactions(data);
    } catch (err) {
      showErrorFromException(err, "Failed to load transactions");
    } finally {
      setTransactionsLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconStar className="h-6 w-6 text-yellow-500" />
            Loyalty Customers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage customer loyalty points — 100 pts = ₱100 discount
          </p>
        </div>
        <Button
          onClick={() => {
            setFormName("");
            setFormPhone("");
            setIsAddDialogOpen(true);
          }}
          className="bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          <IconPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Members</CardDescription>
            <CardTitle className="text-3xl">{customers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Points Outstanding</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              {customers.reduce((s, c) => s + c.totalPoints, 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Lifetime Spend</CardDescription>
            <CardTitle className="text-3xl">
              ₱{customers.reduce((s, c) => s + Number(c.totalSpent), 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Loyalty Actions Card */}
      <Card className="border-yellow-200 bg-yellow-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconStar className="h-4 w-4 text-yellow-600" />
            Loyalty Actions
          </CardTitle>
          <CardDescription>
            Customers earn 1 point for every ₱500 spent. Points never expire — use the button below to clear all points after a raffle event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => { setShowResetDialog(true); setResetPassword(""); }}
            className="h-9 border-red-300 text-red-700 hover:bg-red-50"
            title="Zero out all customer points after a raffle event"
          >
            <IconAlertTriangle className="h-4 w-4 mr-1.5" />
            Reset All Points (Raffle)
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <div className="relative mt-2">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading customers...</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {searchQuery ? "No customers match your search." : "No loyalty customers yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="font-mono text-sm">{customer.phone}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 font-bold text-yellow-700">
                        <IconStar className="h-3.5 w-3.5 text-yellow-500" />
                        {customer.totalPoints.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      ₱{Number(customer.totalSpent).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(customer.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => openTransactionsDialog(customer)}
                          title="View point history"
                        >
                          <IconHistory className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => openEditDialog(customer)}
                          title="Edit customer"
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Loyalty Customer</DialogTitle>
            <DialogDescription>Register a new loyalty member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-1 block">Full Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Juan dela Cruz"
                autoFocus
              />
            </div>
            <div>
              <Label className="mb-1 block">Phone Number *</Label>
              <Input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g., 09171234567"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && formName.trim() && formPhone.trim()) handleAddSubmit();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={handleAddSubmit}
              disabled={!formName.trim() || !formPhone.trim() || formLoading}
            >
              {formLoading ? "Adding..." : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update loyalty customer details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-1 block">Full Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="mb-1 block">Phone Number *</Label>
              <Input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && formName.trim() && formPhone.trim()) handleEditSubmit();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!formName.trim() || !formPhone.trim() || formLoading}
            >
              {formLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Point Transactions Dialog */}
      <Dialog open={showTransactionsDialog} onOpenChange={setShowTransactionsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer?.name} — Point History
            </DialogTitle>
            <DialogDescription>
              Phone: {selectedCustomer?.phone} &nbsp;|&nbsp;
              <span className="text-yellow-700 font-semibold">
                {selectedCustomer?.totalPoints.toLocaleString()} pts remaining
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {transactionsLoading ? (
              <p className="text-center text-sm text-muted-foreground py-8">Loading...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No transactions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div>{formatDateTime(tx.createdAt)}</div>
                        {tx.type === "EARN" && tx.expiresAt && (
                          <div className={`text-[10px] mt-0.5 ${new Date(tx.expiresAt) < new Date() ? "text-red-500 font-medium" : "text-yellow-600"}`}>
                            {new Date(tx.expiresAt) < new Date()
                              ? `Expired ${formatDate(tx.expiresAt)}`
                              : `Expires ${formatDate(tx.expiresAt)}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{tx.description}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            tx.type === "EARN"
                              ? "text-green-700"
                              : tx.type === "EXPIRE"
                              ? "text-gray-400"
                              : "text-red-600"
                          }`}
                        >
                          {tx.type === "EARN" ? (
                            <IconArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <IconArrowDown className="h-3.5 w-3.5" />
                          )}
                          {tx.type === "EARN" ? "+" : "-"}{tx.points}
                          {tx.type === "EXPIRE" && (
                            <span className="text-[10px] font-normal ml-0.5">(expired)</span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransactionsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset All Points Dialog ─────────────────────────────────────────── */}
      <Dialog open={showResetDialog} onOpenChange={(o) => { if (!resetLoading) { setShowResetDialog(o); setResetPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <IconAlertTriangle className="h-5 w-5" />
              Reset All Customer Points
            </DialogTitle>
            <DialogDescription>
              This will <strong>permanently zero out</strong> every customer&apos;s point balance
              in your organization. Use this after a raffle event when all accumulated points
              should be cleared. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="reset-reason">Reason (optional)</Label>
              <Input
                id="reset-reason"
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="e.g. Christmas Raffle 2025"
              />
            </div>

            {/* Password confirmation */}
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">
                Your password <span className="text-red-600">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showResetPassword ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter your admin password to confirm"
                  onKeyDown={(e) => { if (e.key === "Enter" && resetPassword) handleResetAllPoints(); }}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowResetPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showResetPassword
                    ? <IconEyeOff className="h-4 w-4" />
                    : <IconEye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Required to prevent accidental resets.</p>
            </div>

            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <strong>Warning:</strong> All customer points will be set to 0. This creates an
              audit trail but cannot be reversed.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowResetDialog(false); setResetPassword(""); }}
              disabled={resetLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetAllPoints}
              disabled={!resetPassword.trim() || resetLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {resetLoading ? "Resetting..." : "Reset All Points"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
