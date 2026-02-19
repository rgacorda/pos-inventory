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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { apiClient } from "@/lib/api-client";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Monitor,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

export default function TerminalsPage() {
  const [terminals, setTerminals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    terminalId: "",
    name: "",
    location: "",
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [syncingTerminals, setSyncingTerminals] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      if (user) {
        setCurrentUser(JSON.parse(user));
      }
    }
    loadTerminals();
  }, []);

  const loadTerminals = async () => {
    try {
      const data = await apiClient.getTerminals();
      setTerminals(data);
    } catch (error) {
      console.error("Failed to load terminals:", error);
      toast.error("Failed to load terminals");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      terminalId: "",
      name: "",
      location: "",
      isActive: true,
    });
  };

  const handleAddTerminal = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleEditTerminal = (terminal: any) => {
    setSelectedTerminal(terminal);
    setFormData({
      terminalId: terminal.terminalId || "",
      name: terminal.name || "",
      location: terminal.location || "",
      isActive: terminal.isActive !== false,
    });
    setShowEditDialog(true);
  };

  const handleDeleteTerminal = (terminal: any) => {
    setSelectedTerminal(terminal);
    setShowDeleteDialog(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await apiClient.createTerminal(formData);
      toast.success("Terminal added successfully");
      setShowAddDialog(false);
      resetForm();
      loadTerminals();
    } catch (error: any) {
      console.error("Failed to add terminal:", error);
      toast.error(error.response?.data?.message || "Failed to add terminal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await apiClient.updateTerminal(selectedTerminal.id, formData);
      toast.success("Terminal updated successfully");
      setShowEditDialog(false);
      setSelectedTerminal(null);
      resetForm();
      loadTerminals();
    } catch (error: any) {
      console.error("Failed to update terminal:", error);
      toast.error(error.response?.data?.message || "Failed to update terminal");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await apiClient.deleteTerminal(selectedTerminal.id);
      toast.success("Terminal deleted successfully");
      setShowDeleteDialog(false);
      setSelectedTerminal(null);
      loadTerminals();
    } catch (error: any) {
      console.error("Failed to delete terminal:", error);
      toast.error(error.response?.data?.message || "Failed to delete terminal");
    }
  };

  const handleSyncTerminal = async (terminal: any) => {
    setSyncingTerminals((prev) => new Set(prev).add(terminal.id));

    try {
      await apiClient.syncTerminal(terminal.id);
      toast.success(`Terminal "${terminal.name}" synced successfully`);
      loadTerminals();
    } catch (error: any) {
      console.error("Failed to sync terminal:", error);
      toast.error(error.response?.data?.message || "Failed to sync terminal");
    } finally {
      setSyncingTerminals((prev) => {
        const newSet = new Set(prev);
        newSet.delete(terminal.id);
        return newSet;
      });
    }
  };

  const filteredTerminals = terminals.filter(
    (terminal) =>
      terminal.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      terminal.terminalId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      terminal.location?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredTerminals.length / itemsPerPage);
  const paginatedTerminals = filteredTerminals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>POS Terminals</CardTitle>
              <CardDescription>
                Manage all point-of-sale terminals in your organization
              </CardDescription>
            </div>
            {currentUser?.role === "ADMIN" && (
              <Button onClick={handleAddTerminal}>
                <Plus className="mr-2 h-4 w-4" />
                Add Terminal
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search terminals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">
                  Loading terminals...
                </div>
              </div>
            ) : filteredTerminals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
                <div className="text-muted-foreground">No terminals found</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terminal ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Status</TableHead>
                    {currentUser?.role === "ADMIN" && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTerminals.map((terminal) => (
                    <TableRow key={terminal.id}>
                      <TableCell className="font-medium">
                        {terminal.terminalId}
                      </TableCell>
                      <TableCell>{terminal.name}</TableCell>
                      <TableCell>
                        {terminal.location ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {terminal.location}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {terminal.lastSyncAt
                          ? new Date(terminal.lastSyncAt).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            terminal.isActive
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-gray-600 hover:bg-gray-700"
                          }
                        >
                          {terminal.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {currentUser?.role === "ADMIN" && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSyncTerminal(terminal)}
                              disabled={syncingTerminals.has(terminal.id)}
                              title="Sync terminal"
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${syncingTerminals.has(terminal.id) ? "animate-spin" : ""}`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditTerminal(terminal)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTerminal(terminal)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredTerminals.length)}{" "}
                of {filteredTerminals.length} results
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

      {/* Add Terminal Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Terminal</DialogTitle>
            <DialogDescription>
              Create a new POS terminal for your organization
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="terminalId">Terminal ID *</Label>
              <Input
                id="terminalId"
                placeholder="e.g., TERM-001"
                value={formData.terminalId}
                onChange={(e) =>
                  setFormData({ ...formData, terminalId: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Main Counter"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Floor 1, Area A"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Adding..." : "Add Terminal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Terminal Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Terminal</DialogTitle>
            <DialogDescription>Update terminal information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-terminalId">Terminal ID *</Label>
              <Input
                id="edit-terminalId"
                placeholder="e.g., TERM-001"
                value={formData.terminalId}
                onChange={(e) =>
                  setFormData({ ...formData, terminalId: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Main Counter"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                placeholder="e.g., Floor 1, Area A"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="edit-isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Updating..." : "Update Terminal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Terminal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete terminal "{selectedTerminal?.name}
              "? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
