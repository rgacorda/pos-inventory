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
  IconSettings,
  IconPlayerPlay,
  IconClock,
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

  // Loyalty settings
  const [loyaltyExpiryDays, setLoyaltyExpiryDays] = useState<number | null>(null);
  const [loyaltySettingsLoading, setLoyaltySettingsLoading] = useState(true);
  const [expiryInput, setExpiryInput] = useState<string>("");
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [expiryRunning, setExpiryRunning] = useState(false);

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

  const loadLoyaltySettings = async () => {
    try {
      setLoyaltySettingsLoading(true);
      const data = await apiClient.getLoyaltySettings();
      setLoyaltyExpiryDays(data.loyaltyExpiryDays ?? null);
      setExpiryInput(data.loyaltyExpiryDays != null ? String(data.loyaltyExpiryDays) : "");
    } catch {
      // non-critical
    } finally {
      setLoyaltySettingsLoading(false);
    }
  };

  const handleSaveLoyaltySettings = async () => {
    setLoyaltySaving(true);
    try {
      const days = expiryInput.trim() === "" ? null : parseInt(expiryInput, 10);
      if (days !== null && (isNaN(days) || days < 1)) {
        showErrorFromException(new Error("Enter a valid number of days (minimum 1) or leave blank for no expiry."), "");
        return;
      }
      await apiClient.updateLoyaltySettings(days);
      setLoyaltyExpiryDays(days);
      showSuccessToast("Loyalty settings saved");
    } catch (err) {
      showErrorFromException(err, "Failed to save loyalty settings");
    } finally {
      setLoyaltySaving(false);
    }
  };

  const handleRunExpiryNow = async () => {
    setExpiryRunning(true);
    try {
      const result = await apiClient.runPointsExpiryNow();
      showSuccessToast(`Expiry run complete — ${result.pointsExpired} pts expired across ${result.processed} transactions`);
      loadCustomers();
    } catch (err) {
      showErrorFromException(err, "Expiry run failed");
    } finally {
      setExpiryRunning(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadLoyaltySettings();
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

      {/* Loyalty Settings Card */}
      <Card className="border-yellow-200 bg-yellow-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconSettings className="h-4 w-4 text-yellow-600" />
            Loyalty Settings
          </CardTitle>
          <CardDescription>
            Configure how long earned points remain valid. Expired points are automatically deducted each night.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loyaltySettingsLoading ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              {/* Expiry input */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <IconClock className="h-4 w-4 text-yellow-600" />
                  Points expire after
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={expiryInput}
                    onChange={(e) => setExpiryInput(e.target.value)}
                    placeholder="e.g. 365"
                    className="w-32 h-9"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                  {expiryInput.trim() === "" && (
                    <span className="text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                      Never expires
                    </span>
                  )}
                  {expiryInput.trim() !== "" && !isNaN(parseInt(expiryInput)) && (
                    <span className="text-xs text-yellow-800 font-medium bg-yellow-100 px-2 py-0.5 rounded-full">
                      {parseInt(expiryInput)} days after earning
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to disable expiry.
                  {loyaltyExpiryDays != null && (
                    <> Currently set to <strong>{loyaltyExpiryDays} days</strong>.</>
                  )}
                  {loyaltyExpiryDays == null && (
                    <> Currently <strong>no expiry</strong>.</>
                  )}
                </p>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSaveLoyaltySettings}
                disabled={loyaltySaving}
                className="bg-yellow-500 hover:bg-yellow-600 text-white h-9"
              >
                {loyaltySaving ? "Saving..." : "Save Settings"}
              </Button>

              {/* Manual expiry run */}
              <Button
                variant="outline"
                onClick={handleRunExpiryNow}
                disabled={expiryRunning}
                className="h-9 border-orange-300 text-orange-700 hover:bg-orange-50"
                title="Immediately process all overdue point expirations for your organization"
              >
                <IconPlayerPlay className="h-4 w-4 mr-1.5" />
                {expiryRunning ? "Running..." : "Run Expiry Now"}
              </Button>
            </div>
          )}
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
    </div>
  );
}
