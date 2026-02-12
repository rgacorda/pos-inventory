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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { UserRole } from "@pos/shared-types";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@demo-store.com");
  const [password, setPassword] = useState("admin123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await apiClient.login({ email, password });

      // Block SUPER_ADMIN and CASHIER from accessing inventory system
      if (response.user.role === UserRole.SUPER_ADMIN) {
        setError(
          "Super Admins cannot access the Inventory System. Please use the Admin Portal.",
        );
        setIsLoading(false);
        return;
      }

      if (response.user.role === UserRole.CASHIER) {
        setError(
          "Cashiers cannot access the Inventory System. Please use the POS app.",
        );
        setIsLoading(false);
        return;
      }

      // Validate organization (all users must have an organization)
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

      // Redirect to dashboard
      router.push("/");
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
      <Card className="border-gray-200">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-gray-900">
            🏪 Inventory Management
          </CardTitle>
          <CardDescription className="text-gray-600">
            For ADMIN and MANAGER roles only
          </CardDescription>
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
                  placeholder="admin@example.com"
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
                <Button
                  type="submit"
                  className="w-full bg-gray-900 hover:bg-gray-800"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
