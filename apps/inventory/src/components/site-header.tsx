"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const routeTitles: { [key: string]: string } = {
  "/": "Dashboard",
  "/products": "Products",
  "/users": "Users",
  "/orders": "Orders",
  "/reports": "Reports",
  "/deliveries": "Deliveries",
  "/expenses": "Expenses",
  "/financials": "Financials",
  "/organization": "Organization",
  "/terminals": "Terminals",
};

export function SiteHeader() {
  const pathname = usePathname();
  const title = routeTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
      </div>
    </header>
  );
}
