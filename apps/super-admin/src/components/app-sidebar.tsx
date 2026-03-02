"use client";

import * as React from "react";
import {
  IconDashboard,
  IconBuilding,
  IconUsers,
  IconSettings,
  IconHelp,
  IconChartBar,
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
    name: "Super Admin",
    email: "super@admin.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      groupLabel: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: IconDashboard,
        },
      ],
    },
    {
      groupLabel: "Management",
      items: [
        {
          title: "Organizations",
          url: "/organizations",
          icon: IconBuilding,
        },
        {
          title: "System Users",
          url: "/users",
          icon: IconUsers,
        },
      ],
    },
    {
      groupLabel: "Analytics",
      items: [
        {
          title: "System Reports",
          url: "/reports",
          icon: IconChartBar,
        },
      ],
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

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      if (user) {
        setCurrentUser(JSON.parse(user));
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
                <IconBuilding className="!size-5" />
                <span className="text-base font-semibold">
                  Super Admin Portal
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser || data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
