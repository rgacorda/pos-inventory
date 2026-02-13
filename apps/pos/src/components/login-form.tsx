"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient, syncService } from "@/lib/api-client";
import { UserRole } from "@pos/shared-types";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("cashier@demo-store.com");
  const [password, setPassword] = useState("cashier123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await apiClient.login({ email, password });

      // Block SUPER_ADMIN from accessing POS
      if (response.user.role === UserRole.SUPER_ADMIN) {
        setError(
          "Super Admins cannot access the POS system. Please use the Admin Portal.",
        );
        setIsLoading(false);
        return;
      }

      // Validate organization (all non-super-admin users must have an organization)
      if (!response.user.organizationId) {
        setError(
          "User is not associated with any organization. Please contact support.",
        );
        setIsLoading(false);
        return;
      }

      // Store user info
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(response.user));
        localStorage.setItem("organizationId", response.user.organizationId);
        if (response.user.organizationName) {
          localStorage.setItem(
            "organizationName",
            response.user.organizationName,
          );
        }
      }

      // Start auto-sync
      syncService.startAutoSync(60000);

      // Redirect to home (use window.location for hard redirect to trigger middleware)
      window.location.href = "/";
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(
        err.response?.data?.message ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🏪 AR-POS</CardTitle>
          <CardDescription>Convenience Store Point of Sale</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="cashier@demo-store.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
                <FieldDescription className="text-center text-xs text-gray-500 mt-2">
                  Default: cashier@demo-store.com / cashier123
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
