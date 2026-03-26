"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  ArrowLeft,
  Database,
  TrendingUp,
  Key,
  Shield,
  Bell,
  Plug,
  Cpu,
  Clock,
  Globe,
  UserPen,
  LifeBuoy,
  CreditCard,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { publicAlphaFlags } from "@/lib/alpha-flags";
import { trpcOptions } from "@/utils/trpc";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export function getSettingsNavSections({
  canViewSupport = false,
}: {
  canViewSupport?: boolean;
} = {}): NavSection[] {
  return [
    {
      label: "Account",
      items: [
        {
          title: "Edit profile",
          href: "/dashboard/settings/profile",
          icon: UserPen,
        },
        {
          title: "Billing",
          href: "/dashboard/settings/billing",
          icon: CreditCard,
        },
        { title: "Broker", href: "/dashboard/settings/broker", icon: Database },
        { title: "Timezone", href: "/dashboard/settings/timezone", icon: Globe },
      ],
    },
    {
      label: "Trading",
      items: [
        {
          title: "Symbol mapping",
          href: "/dashboard/settings/symbol-mapping",
          icon: Waypoints,
        },
        { title: "Sessions", href: "/dashboard/settings/sessions", icon: Clock },
        {
          title: "Metrics",
          href: "/dashboard/settings/metrics",
          icon: TrendingUp,
        },
        { title: "Alerts", href: "/dashboard/settings/alerts", icon: Bell },
        { title: "Risk profile", href: "/dashboard/settings/risk", icon: Shield },
        { title: "Rules", href: "/dashboard/settings/rules", icon: Shield },
      ],
    },
    {
      label: "Integrations",
      items: [
        ...(publicAlphaFlags.connections
          ? [
              {
                title: "Connections",
                href: "/dashboard/settings/connections",
                icon: Plug,
              },
            ]
          : []),
        ...(publicAlphaFlags.aiAssistant
          ? [{ title: "AI", href: "/dashboard/settings/ai", icon: Sparkles }]
          : []),
        { title: "EA Setup", href: "/dashboard/settings/ea-setup", icon: Cpu },
      ],
    },
    {
      label: "Developer",
      items: [
        { title: "API keys", href: "/dashboard/settings/api", icon: Key },
        {
          title: "Notifications",
          href: "/dashboard/settings/notifications",
          icon: Bell,
        },
        ...(publicAlphaFlags.supportDiagnostics && canViewSupport
          ? [
              {
                title: "Support",
                href: "/dashboard/settings/support",
                icon: LifeBuoy,
              },
            ]
          : []),
      ],
    },
  ].filter((section) => section.items.length > 0);
}

export const settingsNavSections: NavSection[] = getSettingsNavSections();

export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const safePathname = pathname ?? "/dashboard/settings";
  const { data: billingState } = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    staleTime: 60_000,
  });
  const sections = getSettingsNavSections({
    canViewSupport: billingState?.admin?.isAdmin === true,
  });

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="min-h-[3.725rem] p-4 pb-1 pt-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-2.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">
            Settings
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-2 overflow-y-auto">
        {sections.map((section) => (
          <div
            key={section.label}
            className="mb-3 group-data-[collapsible=icon]:mb-0"
          >
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
              {section.label}
            </p>
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const isActive =
                  safePathname === item.href ||
                  safePathname.startsWith(`${item.href}/`);

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
