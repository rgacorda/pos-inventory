"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconBuilding,
  IconSearch,
  IconRefresh,
} from "@tabler/icons-react";
import { Organization, SubscriptionStatus } from "@pos/shared-types";
import { toast } from "sonner";

interface OrganizationFormData {
  name: string;
  slug: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website: string;
  taxId: string;
  // Admin user fields
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

const initialFormData: OrganizationFormData = {
  name: "",
  slug: "",
  description: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  website: "",
  taxId: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<
    Organization[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form states
  const [formData, setFormData] =
    useState<OrganizationFormData>(initialFormData);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    // Filter organizations based on search query
    if (searchQuery.trim() === "") {
      setFilteredOrganizations(organizations);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredOrganizations(
        organizations.filter(
          (org) =>
            org.name.toLowerCase().includes(query) ||
            org.slug.toLowerCase().includes(query) ||
            org.email?.toLowerCase().includes(query) ||
            org.city?.toLowerCase().includes(query),
        ),
      );
    }
  }, [searchQuery, organizations]);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getOrganizations();
      setOrganizations(data);
      setFilteredOrganizations(data);
    } catch (error: any) {
      console.error("Failed to fetch organizations:", error);
      toast.error("Failed to load organizations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!formData.name || !formData.slug || !formData.email) {
        toast.error("Name, slug, and email are required");
        return;
      }

      // Validate admin fields
      if (!formData.adminName || !formData.adminEmail) {
        toast.error("Admin name and email are required");
        return;
      }

      await apiClient.createOrganization(formData);
      toast.success(
        "Organization and admin user created successfully! Credentials have been logged to console.",
      );
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      fetchOrganizations();
    } catch (error: any) {
      console.error("Failed to create organization:", error);
      toast.error(
        error.response?.data?.message || "Failed to create organization",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrganization = async () => {
    if (!editingOrg) return;

    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!formData.name || !formData.slug || !formData.email) {
        toast.error("Name, slug, and email are required");
        return;
      }

      await apiClient.updateOrganization(editingOrg.id, formData);
      toast.success("Organization updated successfully");
      setIsEditDialogOpen(false);
      setEditingOrg(null);
      setFormData(initialFormData);
      fetchOrganizations();
    } catch (error: any) {
      console.error("Failed to update organization:", error);
      toast.error(
        error.response?.data?.message || "Failed to update organization",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!deletingOrg) return;

    try {
      setIsSubmitting(true);
      await apiClient.deleteOrganization(deletingOrg.id);
      toast.success("Organization deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeletingOrg(null);
      fetchOrganizations();
    } catch (error: any) {
      console.error("Failed to delete organization:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete organization",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    setFormData(initialFormData);
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      description: org.description || "",
      email: org.email || "",
      phone: org.phone || "",
      address: org.address || "",
      city: org.city || "",
      state: org.state || "",
      country: org.country || "",
      postalCode: org.postalCode || "",
      website: org.website || "",
      taxId: org.taxId || "",
      // Admin fields not used in edit mode
      adminName: "",
      adminEmail: "",
      adminPassword: "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (org: Organization) => {
    setDeletingOrg(org);
    setIsDeleteDialogOpen(true);
  };

  const getStatusBadge = (org: Organization) => {
    if (!org.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (!org.subscription) {
      return <Badge variant="secondary">No Subscription</Badge>;
    }

    const status = org.subscription.status;
    switch (status) {
      case SubscriptionStatus.ACTIVE:
        return <Badge variant="default">Active</Badge>;
      case SubscriptionStatus.TRIAL:
        return <Badge variant="outline">Trial</Badge>;
      case SubscriptionStatus.PAST_DUE:
        return <Badge variant="destructive">Past Due</Badge>;
      case SubscriptionStatus.CANCELLED:
        return <Badge variant="secondary">Cancelled</Badge>;
      case SubscriptionStatus.EXPIRED:
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">
            Manage all organizations and their subscriptions
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <IconPlus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={fetchOrganizations}>
          <IconRefresh className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <IconBuilding className="mx-auto h-12 w-12 text-muted-foreground animate-pulse" />
              <p className="mt-4 text-sm text-muted-foreground">
                Loading organizations...
              </p>
            </div>
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <IconBuilding className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                {searchQuery
                  ? "No organizations found matching your search"
                  : "No organizations found. Create your first organization to get started."}
              </p>
              {!searchQuery && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <IconPlus className="mr-2 h-4 w-4" />
                  Create Organization
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>
                    <code className="text-xs px-2 py-1 bg-muted rounded">
                      {org.slug}
                    </code>
                  </TableCell>
                  <TableCell>{org.email || "—"}</TableCell>
                  <TableCell>
                    {org.city && org.state
                      ? `${org.city}, ${org.state}`
                      : org.city || org.state || "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(org)}</TableCell>
                  <TableCell>
                    {org.subscription ? (
                      <Badge variant="outline">
                        {org.subscription.plan}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(org.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(org)}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(org)}
                      >
                        <IconTrash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Add a new organization to the system
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="name">
                  Organization Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    // Auto-generate slug from name
                    if (!formData.slug) {
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                      });
                    }
                  }}
                  placeholder="Acme Corporation"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="slug">
                  Slug <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="acme-corporation"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the organization"
                rows={3}
                disabled={isSubmitting}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="contact@acme.com"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+1 (555) 123-4567"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="address">Address</FieldLabel>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Main St"
                disabled={isSubmitting}
              />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="city">City</FieldLabel>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="San Francisco"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="state">State</FieldLabel>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  placeholder="CA"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="postalCode">Postal Code</FieldLabel>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) =>
                    setFormData({ ...formData, postalCode: e.target.value })
                  }
                  placeholder="94102"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="country">Country</FieldLabel>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  placeholder="United States"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="website">Website</FieldLabel>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://acme.com"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="taxId">Tax ID</FieldLabel>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) =>
                  setFormData({ ...formData, taxId: e.target.value })
                }
                placeholder="12-3456789"
                disabled={isSubmitting}
              />
            </Field>

            {/* Admin User Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-4">
                Admin User Details
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create the primary administrator account for this organization.
                A temporary password will be generated if not provided.
              </p>

              <div className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="adminName">
                    Admin Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="adminName"
                    value={formData.adminName}
                    onChange={(e) =>
                      setFormData({ ...formData, adminName: e.target.value })
                    }
                    placeholder="John Doe"
                    disabled={isSubmitting}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="adminEmail">
                    Admin Email <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, adminEmail: e.target.value })
                    }
                    placeholder="admin@acme.com"
                    disabled={isSubmitting}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="adminPassword">
                    Temporary Password (Optional)
                  </FieldLabel>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={formData.adminPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        adminPassword: e.target.value,
                      })
                    }
                    placeholder="Leave empty to auto-generate"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If not provided, a secure random password will be generated
                    and shown in the console logs.
                  </p>
                </Field>
              </div>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateOrganization} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization information
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="edit-name">
                  Organization Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Acme Corporation"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-slug">
                  Slug <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="edit-slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="acme-corporation"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="edit-description">Description</FieldLabel>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the organization"
                rows={3}
                disabled={isSubmitting}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="edit-email">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="contact@acme.com"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-phone">Phone</FieldLabel>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+1 (555) 123-4567"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="edit-address">Address</FieldLabel>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Main St"
                disabled={isSubmitting}
              />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="edit-city">City</FieldLabel>
                <Input
                  id="edit-city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="San Francisco"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-state">State</FieldLabel>
                <Input
                  id="edit-state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  placeholder="CA"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-postalCode">Postal Code</FieldLabel>
                <Input
                  id="edit-postalCode"
                  value={formData.postalCode}
                  onChange={(e) =>
                    setFormData({ ...formData, postalCode: e.target.value })
                  }
                  placeholder="94102"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="edit-country">Country</FieldLabel>
                <Input
                  id="edit-country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  placeholder="United States"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-website">Website</FieldLabel>
                <Input
                  id="edit-website"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://acme.com"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="edit-taxId">Tax ID</FieldLabel>
              <Input
                id="edit-taxId"
                value={formData.taxId}
                onChange={(e) =>
                  setFormData({ ...formData, taxId: e.target.value })
                }
                placeholder="12-3456789"
                disabled={isSubmitting}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateOrganization} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the organization{" "}
              <strong>{deletingOrg?.name}</strong> and all associated data. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrganization}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : "Delete Organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
