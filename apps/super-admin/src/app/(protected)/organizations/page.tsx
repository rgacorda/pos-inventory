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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconBuilding,
  IconSearch,
  IconRefresh,
  IconCreditCard,
  IconUser,
  IconBox,
  IconDevices,
} from "@tabler/icons-react";
import { Organization, SubscriptionStatus, SubscriptionPlan } from "@pos/shared-types";
import { 
  showSuccessToast, 
  showErrorFromException, 
  showErrorToast, 
  SUCCESS_MESSAGES, 
  ERROR_MESSAGES 
} from "@/lib/toast-utils";

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
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);

  // Form states
  const [formData, setFormData] =
    useState<OrganizationFormData>(initialFormData);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscription form state
  const [subscriptionOrg, setSubscriptionOrg] = useState<Organization | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(SubscriptionPlan.FREE);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(SubscriptionStatus.ACTIVE);
  const [periodEndDate, setPeriodEndDate] = useState<string>("");

  // Details drawer state
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgStats, setOrgStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

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
      showErrorFromException(error, ERROR_MESSAGES.LOAD_FAILED("organizations"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!formData.name || !formData.email) {
        showErrorToast("Name and email are required");
        return;
      }

      // Validate admin fields
      if (!formData.adminName || !formData.adminEmail) {
        showErrorToast("Admin name and email are required");
        return;
      }

      await apiClient.createOrganization(formData);
      showSuccessToast(
        "Organization and admin user created successfully! Credentials have been logged to console."
      );
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      fetchOrganizations();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.CREATE_FAILED("organization"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrganization = async () => {
    if (!editingOrg) return;

    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!formData.name || !formData.email) {
        showErrorToast("Name and email are required");
        return;
      }

      await apiClient.updateOrganization(editingOrg.id, formData);
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Organization"));
      setIsEditDialogOpen(false);
      setEditingOrg(null);
      setFormData(initialFormData);
      fetchOrganizations();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("organization"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!deletingOrg) return;

    try {
      setIsSubmitting(true);
      await apiClient.deleteOrganization(deletingOrg.id);
      showSuccessToast(SUCCESS_MESSAGES.DELETED("Organization"));
      setIsDeleteDialogOpen(false);
      setDeletingOrg(null);
      fetchOrganizations();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.DELETE_FAILED("organization"));
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

  const openSubscriptionDialog = (org: Organization) => {
    setSubscriptionOrg(org);
    if (org.subscription) {
      setSubscriptionPlan(org.subscription.plan as SubscriptionPlan);
      setSubscriptionStatus(org.subscription.status);
      // Format date to YYYY-MM-DD for input
      const endDate = org.subscription.currentPeriodEnd 
        ? new Date(org.subscription.currentPeriodEnd).toISOString().split('T')[0]
        : '';
      setPeriodEndDate(endDate);
    } else {
      setSubscriptionPlan(SubscriptionPlan.FREE);
      setSubscriptionStatus(SubscriptionStatus.ACTIVE);
      const defaultEndDate = new Date();
      defaultEndDate.setDate(defaultEndDate.getDate() + 30);
      setPeriodEndDate(defaultEndDate.toISOString().split('T')[0]);
    }
    setIsSubscriptionDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!subscriptionOrg) return;

    try {
      setIsSubmitting(true);
      await apiClient.updateSubscription(subscriptionOrg.id, {
        plan: subscriptionPlan,
        status: subscriptionStatus,
        periodEndDate: periodEndDate,
      });
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Subscription"));
      setIsSubscriptionDialogOpen(false);
      setSubscriptionOrg(null);
      fetchOrganizations();
    } catch (error: any) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("subscription"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckExpiredSubscriptions = async () => {
    try {
      setIsLoading(true);
      await apiClient.checkExpiredSubscriptions();
      showSuccessToast("Expiration check completed");
      fetchOrganizations();
    } catch (error: any) {
      showErrorFromException(error, "Failed to check expired subscriptions");
    } finally {
      setIsLoading(false);
    }
  };

  const openDetailsDrawer = async (org: Organization) => {
    setSelectedOrg(org);
    setIsDetailsDrawerOpen(true);
    setIsLoadingStats(true);
    
    try {
      const stats = await apiClient.getOrganizationStats(org.id);
      setOrgStats(stats);
    } catch (error: any) {
      showErrorFromException(error, "Failed to load organization details");
    } finally {
      setIsLoadingStats(false);
    }
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleCheckExpiredSubscriptions}
            disabled={isLoading}
          >
            <IconRefresh className="mr-2 h-4 w-4" />
            Check Expired
          </Button>
          <Button onClick={openCreateDialog}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        </div>
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
                <TableRow 
                  key={org.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetailsDrawer(org)}
                >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          openSubscriptionDialog(org);
                        }}
                        title="Manage Subscription"
                      >
                        <IconCreditCard className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(org);
                        }}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog(org);
                        }}
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
                    const newName = e.target.value;
                    // Auto-generate slug from name if slug hasn't been manually edited
                    const autoSlug = newName
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "");
                    
                    setFormData({ 
                      ...formData, 
                      name: newName,
                      // Only auto-update slug if it matches the previous auto-generated value
                      slug: formData.slug === formData.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                        ? autoSlug
                        : formData.slug
                    });
                  }}
                  placeholder="Acme Corporation"
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="slug">
                  Slug <span className="text-muted-foreground">(Optional)</span>
                </FieldLabel>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="Auto-generated from name"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-generate from organization name
                </p>
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
                  Slug <span className="text-muted-foreground">(Optional)</span>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-generate from organization name
                </p>
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

      {/* Subscription Management Dialog */}
      <Dialog
        open={isSubscriptionDialogOpen}
        onOpenChange={setIsSubscriptionDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Update the subscription plan and status for{" "}
              <strong>{subscriptionOrg?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="subscription-plan">Plan</FieldLabel>
              <Select
                value={subscriptionPlan}
                onValueChange={(value) => setSubscriptionPlan(value as SubscriptionPlan)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="subscription-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SubscriptionPlan.FREE}>
                    Free (2 users, 1 terminal)
                  </SelectItem>
                  <SelectItem value={SubscriptionPlan.BASIC}>
                    Basic (5 users, 2 terminals)
                  </SelectItem>
                  <SelectItem value={SubscriptionPlan.PROFESSIONAL}>
                    Professional (20 users, 10 terminals)
                  </SelectItem>
                  <SelectItem value={SubscriptionPlan.ENTERPRISE}>
                    Enterprise (Unlimited)
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="subscription-status">Status</FieldLabel>
              <Select
                value={subscriptionStatus}
                onValueChange={(value) => setSubscriptionStatus(value as SubscriptionStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="subscription-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SubscriptionStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={SubscriptionStatus.TRIAL}>Trial</SelectItem>
                  <SelectItem value={SubscriptionStatus.PAST_DUE}>Past Due</SelectItem>
                  <SelectItem value={SubscriptionStatus.CANCELLED}>Cancelled</SelectItem>
                  <SelectItem value={SubscriptionStatus.EXPIRED}>Expired</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="period-end-date">Period End Date</FieldLabel>
              <Input
                id="period-end-date"
                type="date"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSubscriptionDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateSubscription} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organization Details Drawer */}
      <Sheet open={isDetailsDrawerOpen} onOpenChange={setIsDetailsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <IconBuilding className="h-5 w-5" />
              {selectedOrg?.name}
            </SheetTitle>
            <SheetDescription>
              Organization details and statistics
            </SheetDescription>
          </SheetHeader>

          {isLoadingStats ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : orgStats ? (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 px-6 py-6">{/* Stats Overview */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <IconUser className="h-4 w-4" />
                    <span className="text-sm font-medium">Users</span>
                  </div>
                  <div className="text-2xl font-bold">{orgStats.stats.userCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedOrg?.subscription?.limits?.maxUsers === -1 
                      ? "Unlimited" 
                      : `of ${selectedOrg?.subscription?.limits?.maxUsers || 0} max`}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <IconDevices className="h-4 w-4" />
                    <span className="text-sm font-medium">Terminals</span>
                  </div>
                  <div className="text-2xl font-bold">{orgStats.stats.terminalCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedOrg?.subscription?.limits?.maxTerminals === -1 
                      ? "Unlimited" 
                      : `of ${selectedOrg?.subscription?.limits?.maxTerminals || 0} max`}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <IconBox className="h-4 w-4" />
                    <span className="text-sm font-medium">Products</span>
                  </div>
                  <div className="text-2xl font-bold">{orgStats.stats.productCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Total items
                  </div>
                </div>
              </div>

              {/* Users List */}
              <div>
                <h3 className="text-lg font-semibold mb-3">User Accounts</h3>
                <div className="space-y-2">
                  {orgStats.users && orgStats.users.length > 0 ? (
                    orgStats.users.map((user: any) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{user.role}</Badge>
                          {user.isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found
                    </div>
                  )}
                </div>
              </div>

              {/* Organization Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Organization Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Slug</span>
                    <span className="font-medium">{selectedOrg?.slug}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{selectedOrg?.email || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">
                      {selectedOrg?.city && selectedOrg?.state
                        ? `${selectedOrg.city}, ${selectedOrg.state}`
                        : selectedOrg?.city || selectedOrg?.state || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">
                      {selectedOrg?.subscription?.plan || "No subscription"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Status</span>
                    <span>{selectedOrg && getStatusBadge(selectedOrg)}</span>
                  </div>
                </div>
              </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
