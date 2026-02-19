"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    groupLabel?: string;
    items: {
      title: string;
      url: string;
      icon?: Icon;
    }[];
  }[];
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((group, groupIndex) => (
        <React.Fragment key={group.groupLabel || groupIndex}>
          <SidebarGroup className="py-0">
            <SidebarGroupContent className="flex flex-col">
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.url ||
                    (item.url !== "/" && pathname.startsWith(item.url));

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        asChild
                        className={
                          isActive
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                            : ""
                        }
                      >
                        <Link href={item.url}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {groupIndex < items.length - 1 && (
            <div className="mx-3 my-0.5 border-t" />
          )}
        </React.Fragment>
      ))}
    </>
  );
}
