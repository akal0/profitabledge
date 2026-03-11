"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  ArrowLeft,
  LayoutDashboard,
  ListOrdered,
  BarChart3,
  BookOpen,
} from "lucide-react";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const backtestNavSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/backtest", icon: LayoutDashboard },
      { title: "Sessions", href: "/backtest/sessions", icon: ListOrdered },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", href: "/backtest/analytics", icon: BarChart3 },
      { title: "Journal", href: "/backtest/journal", icon: BookOpen },
    ],
  },
];

export function BacktestSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="p-4 pt-3 pb-1 h-[3.725rem]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground group-data-[collapsible=icon]:px-2"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="font-semibold text-foreground group-data-[collapsible=icon]:hidden">
            Backtesting
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-2 overflow-y-auto">
        {backtestNavSections.map((section) => (
          <SidebarGroup key={section.label} className="p-0 mb-3 group-data-[collapsible=icon]:mb-0">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 h-auto py-0 mb-1.5">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== "/backtest" && pathname.startsWith(item.href));

                  return (
                    <SidebarMenuItem key={item.href} className="px-0">
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          "flex items-center gap-3 px-2 py-1.5 cursor-pointer",
                          isActive && "bg-sidebar-accent"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon
                            className={cn(
                              "size-[18px] shrink-0",
                              isActive ? "stroke-foreground" : "stroke-[#8b8b97]"
                            )}
                          />
                          <span
                            className={cn(
                              "text-[13px] min-w-max",
                              isActive ? "text-foreground font-medium" : "text-[#8b8b97]"
                            )}
                          >
                            {item.title}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
