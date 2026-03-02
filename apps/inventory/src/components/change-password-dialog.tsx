"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirstLogin?: boolean;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  isFirstLogin = false,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (!isFirstLogin && !currentPassword) {
      toast.error("Current password is required");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await apiClient.changePassword({
        currentPassword: isFirstLogin ? undefined : currentPassword,
        newPassword,
        confirmPassword,
      });

      toast.success(response.message || "Password changed successfully");

      // Update user in localStorage to clear mustChangePassword flag
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.mustChangePassword = false;
      localStorage.setItem("user", JSON.stringify(user));

      // Close dialog and clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);

      // Reload page to update UI state
      window.location.reload();
    } catch (error: any) {
      console.error("Failed to change password:", error);
      toast.error(
        error.response?.data?.message || "Failed to change password"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isFirstLogin ? () => {} : onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => isFirstLogin && e.preventDefault()}
        onEscapeKeyDown={(e) => isFirstLogin && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isFirstLogin ? "Change Your Password" : "Change Password"}
          </DialogTitle>
          <DialogDescription>
            {isFirstLogin
              ? "For security reasons, you must change your password before continuing."
              : "Update your password to keep your account secure."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {!isFirstLogin && (
              <Field>
                <FieldLabel htmlFor="currentPassword">
                  Current Password
                </FieldLabel>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  disabled={isSubmitting}
                  required
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                disabled={isSubmitting}
                required
                minLength={6}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmPassword">
                Confirm New Password
              </FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isSubmitting}
                required
                minLength={6}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            {!isFirstLogin && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
