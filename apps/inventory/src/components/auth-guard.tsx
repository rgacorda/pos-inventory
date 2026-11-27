"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { UserRole } from "@pos/shared-types";

type StoredUser = { role?: string; organizationId?: string | null };

function readStoredUser(): StoredUser | null {
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? (JSON.parse(userStr) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const sendHome = (user: StoredUser | null) => {
      router.push(user?.role === UserRole.CASHIER ? "/variance" : "/");
    };

    const enforce = (user: StoredUser | null): "restore" | void => {
      const token = apiClient.getAccessToken();
      if (token) apiClient.persistAuthCookie();

      if (token && pathname === "/login") {
        if (user?.role === UserRole.SUPER_ADMIN) {
          apiClient.logout();
          return;
        }
        sendHome(user);
        return;
      }

      if (!token && pathname !== "/login") {
        router.push("/login");
        return;
      }

      if (!token || pathname === "/login") return;

      if (!user) return "restore";

      if (user.role === UserRole.SUPER_ADMIN) {
        apiClient.logout();
        router.push("/login");
        return;
      }

      if (!user.organizationId) return "restore";

      if (user.role === UserRole.CASHIER && pathname !== "/variance") {
        router.replace("/variance");
      }
    };

    if (enforce(readStoredUser()) === "restore") {
      apiClient
        .checkSession()
        .then(() => {
          if (cancelled) return;
          const user = readStoredUser();
          if (enforce(user) === "restore") {
            apiClient.logout();
            router.push("/login");
          }
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!apiClient.getAccessToken() || pathname === "/login") return;

    const check = () => {
      if (document.visibilityState === "hidden") return;
      apiClient.persistAuthCookie();
      apiClient.checkSession().catch(() => undefined);
    };
    check();
    const intervalId = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return <>{children}</>;
}
