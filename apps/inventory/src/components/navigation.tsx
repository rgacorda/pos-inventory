"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User, ChevronDown } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organizationName, setOrganizationName] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      const orgName = localStorage.getItem("organizationName");
      if (user) {
        setCurrentUser(JSON.parse(user));
      }
      if (orgName) {
        setOrganizationName(orgName);
      }
    }
  }, []);

  const handleLogout = () => {
    apiClient.logout();
    router.push("/login");
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: "📊" },
    { href: "/products", label: "Products", icon: "📦" },
    { href: "/users", label: "Users", icon: "👥" },
    { href: "/orders", label: "Orders", icon: "📋" },
    { href: "/reports", label: "Reports", icon: "📈" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold text-gray-800">
                🏪 Inventory
              </h1>
              {organizationName && (
                <p className="text-xs text-gray-500">{organizationName}</p>
              )}
            </div>
            <div className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm ${
                    pathname === item.href
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 text-gray-700 hover:bg-gray-100"
                  >
                    <User className="h-4 w-4" />
                    <div className="flex flex-col items-start text-sm">
                      <div className="font-medium">
                        {currentUser.name || currentUser.email?.split("@")[0]}
                      </div>
                      <div className="text-xs text-gray-500">
                        {currentUser.role}
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
