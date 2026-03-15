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
  Database,
  TrendingUp,
  Key,
  Tag,
  ShieldCheck,
  Shield,
  Bell,
  Users,
  Plug,
  Cpu,
  Clock,
  Globe,
  UserPen,
  LifeBuoy,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { publicAlphaFlags } from "@/lib/alpha-flags";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const settingsNavSections: NavSection[] = [
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
      ...(publicAlphaFlags.community
        ? [{ title: "Social", href: "/dashboard/settings/social", icon: Users }]
        : []),
      { title: "Timezone", href: "/dashboard/settings/timezone", icon: Globe },
    ],
  },
  {
    label: "Trading",
    items: [
      { title: "Tags & labels", href: "/dashboard/settings/tags", icon: Tag },
      { title: "Sessions", href: "/dashboard/settings/sessions", icon: Clock },
      {
        title: "Metrics",
        href: "/dashboard/settings/metrics",
        icon: TrendingUp,
      },
      { title: "Alerts", href: "/dashboard/settings/alerts", icon: Bell },
      { title: "Risk profile", href: "/dashboard/settings/risk", icon: Shield },
      {
        title: "Compliance",
        href: "/dashboard/settings/compliance",
        icon: ShieldCheck,
      },
      { title: "Rules", href: "/dashboard/settings/rules", icon: ShieldCheck },
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
      ...(publicAlphaFlags.supportDiagnostics
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

export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="p-4 pt-3 pb-1 h-[3.725rem]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground group-data-[collapsible=icon]:px-2"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">
            Settings
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-2 overflow-y-auto">
        {settingsNavSections.map((section) => (
          <SidebarGroup
            key={section.label}
            className="p-0 mb-3 group-data-[collapsible=icon]:mb-0"
          >
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 h-auto py-0 mb-1.5">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

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
