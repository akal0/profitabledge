"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Layers3,
  LibraryBig,
  Share2,
  Sparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type EdgeNavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const EDGE_NAV_SECTIONS: { label: string; items: EdgeNavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Edges",
        href: "/dashboard/edges",
        icon: Layers3,
      },
      {
        title: "Shared Edges",
        href: "/dashboard/edges/shared",
        icon: Share2,
      },
    ],
  },
  {
    label: "Discover",
    items: [
      {
        title: "Library",
        href: "/dashboard/edges/library",
        icon: LibraryBig,
      },
      {
        title: "Featured",
        href: "/dashboard/edges/featured",
        icon: Sparkles,
      },
    ],
  },
];

function matchesPathname(pathname: string, href: string) {
  const [hrefPath, hrefSearch] = href.split("?");
  const [currentPath, currentSearch] = pathname.split("?");

  if (hrefPath === "/dashboard/edges") {
    if (currentPath === hrefPath) {
      return true;
    }

    if (
      currentPath.startsWith("/dashboard/edges/shared") ||
      currentPath.startsWith("/dashboard/edges/library") ||
      currentPath.startsWith("/dashboard/edges/featured")
    ) {
      return false;
    }

    return currentPath.startsWith("/dashboard/edges/");
  }

  if (currentPath !== hrefPath && !currentPath.startsWith(`${hrefPath}/`)) {
    return false;
  }

  if (!hrefSearch) {
    return true;
  }

  const hrefParams = new URLSearchParams(hrefSearch);
  const currentParams = new URLSearchParams(currentSearch ?? "");

  for (const [key, value] of hrefParams.entries()) {
    if (currentParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}

export function EdgesSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const safePathname = pathname ?? "/dashboard/edges";

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="p-4 pt-3 pb-1 h-[3.725rem]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground group-data-[collapsible=icon]:px-2"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">
            Edges
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-2 overflow-y-auto">
        {EDGE_NAV_SECTIONS.map((section) => (
          <SidebarGroup
            key={section.label}
            className="p-0 mb-3 group-data-[collapsible=icon]:mb-0"
          >
            <SidebarGroupLabel className="text-[10px] text-muted-foreground/60 font-semibold px-2 h-auto py-0 mb-1.5">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const isActive = matchesPathname(safePathname, item.href);

                  return (
                    <SidebarMenuItem key={item.href} className="px-0">
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          "flex items-center gap-3 px-2 py-2 cursor-pointer",
                          isActive && "bg-sidebar-accent"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon
                            className={cn(
                              "size-4! shrink-0",
                              isActive
                                ? "stroke-foreground"
                                : "stroke-[#8b8b97]"
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs min-w-max",
                              isActive
                                ? "text-foreground font-medium"
                                : "text-[#8b8b97]"
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
