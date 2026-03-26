"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Layers3, LibraryBig, Share2, Sparkles } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
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
      <SidebarHeader className="min-h-[3.725rem] p-4 pb-1 pt-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-2.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">
            Edges
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-2 overflow-y-auto">
        {EDGE_NAV_SECTIONS.map((section) => (
          <div
            key={section.label}
            className="mb-3 group-data-[collapsible=icon]:mb-0"
          >
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
              {section.label}
            </p>
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const isActive = matchesPathname(safePathname, item.href);

                return (
                  <SidebarMenuItem key={item.href} className="flex px-2 py-0.5">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "group/navlink flex items-center justify-start gap-3 cursor-pointer group-data-[collapsible=icon]:justify-center",
                        isActive &&
                          "bg-sidebar-accent text-white dark:hover:bg-sidebar-accent"
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon
                          className={cn(
                            "size-[18px] stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97]",
                            isActive
                              ? "fill-black dark:fill-transparent dark:stroke-white"
                              : "group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white"
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-max text-xs font-normal group-data-[collapsible=icon]:hidden",
                            isActive
                              ? "font-medium text-black dark:text-white"
                              : "text-secondary dark:text-[#8b8b97] group-hover/navlink:!text-black dark:group-hover/navlink:!text-white"
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
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
