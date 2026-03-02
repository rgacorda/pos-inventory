"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { UserRole } from "@pos/shared-types";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@pos.com");
  const [password, setPassword] = useState("super123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await apiClient.login({ email, password });

      // Only allow SUPER_ADMIN to access super admin panel
      if (response.user.role !== UserRole.SUPER_ADMIN) {
        setError("Access Denied: Only Super Admins can access this portal.");
        setIsLoading(false);
        return;
      }

      // Store user info
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(response.user));
      }

      // Redirect to dashboard (use window.location for hard redirect to trigger middleware)
      window.location.href = "/dashboard";
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
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">🔐 Super Admin Portal</h1>
                <p className="text-muted-foreground text-balance">
                  System-wide administration and management
                </p>
              </div>
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
                  placeholder="super@admin.com"
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
              </Field>
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block">
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <div className="text-6xl">🔐</div>
                <h2 className="text-2xl font-bold">Super Admin</h2>
                <p className="text-muted-foreground">
                  Manage all organizations and system-wide configurations
                </p>
                <div className="pt-4 space-y-2 text-sm text-muted-foreground">
                  <p>✓ Organization Management</p>
                  <p>✓ Subscription Management</p>
                  <p>✓ System Monitoring</p>
                  <p>✓ Global Analytics</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
