"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { UserRole } from "@pos/shared-types";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = apiClient.getAccessToken();
    const userStr = localStorage.getItem("user");

    // If not on login page and no token, redirect to login
    if (!token && pathname !== "/login") {
      router.push("/login");
      return;
    }

    // If has token, validate user data
    if (token && pathname !== "/login") {
      try {
        const user = userStr ? JSON.parse(userStr) : null;

        // Block SUPER_ADMIN and CASHIER from accessing inventory system
        if (
          user?.role === UserRole.SUPER_ADMIN ||
          user?.role === UserRole.CASHIER
        ) {
          console.error("Unauthorized role for inventory system");
          apiClient.logout();
          router.push("/login");
          return;
        }

        // Validate organization
        if (user && !user.organizationId) {
          console.error("User has no organization");
          apiClient.logout();
          router.push("/login");
          return;
        }
      } catch (error) {
        console.error("Invalid user data:", error);
        apiClient.logout();
        router.push("/login");
      }
    }
  }, [pathname, router]);

  return <>{children}</>;
}
