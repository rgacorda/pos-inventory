"use client";

import { useEffect, useState } from "react";
import { ChangePasswordDialog } from "./change-password-dialog";

export function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // Check if user must change password on mount
    const checkPasswordChange = () => {
      if (typeof window !== "undefined") {
        const user = localStorage.getItem("user");
        if (user) {
          const userData = JSON.parse(user);
          if (userData.mustChangePassword === true) {
            setMustChangePassword(true);
            setIsDialogOpen(true);
          }
        }
      }
    };

    checkPasswordChange();
  }, []);

  return (
    <>
      {children}
      <ChangePasswordDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        isFirstLogin={mustChangePassword}
      />
    </>
  );
}
