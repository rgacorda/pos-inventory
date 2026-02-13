"use client";

import * as React from "react";
import {
  IconChartBar,
  IconDashboard,
  IconPackage,
  IconReport,
  IconSettings,
  IconShoppingCart,
  IconUsers,
  IconHelp,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: IconDashboard,
    },
    {
      title: "Products",
      url: "/products",
      icon: IconPackage,
    },
    {
      title: "Orders",
      url: "/orders",
      icon: IconShoppingCart,
    },
    {
      title: "Users",
      url: "/users",
      icon: IconUsers,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: IconChartBar,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [organizationName, setOrganizationName] = React.useState<string>("");

  React.useEffect(() => {
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

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/">
                <IconReport className="!size-5" />
                <span className="text-base font-semibold">
                  {organizationName || "Inventory"}
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser || data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
