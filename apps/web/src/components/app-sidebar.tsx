"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import AccountSwitcher, {
  type Account,
} from "./dashboard/sidebar/account-selector";
import type { NewAccount } from "./dashboard/sidebar/add-account-sheet";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardIcon from "@/public/icons/navigation/dashboard.svg";
import CalendarIcon from "@/public/icons/navigation/calendar.svg";
import JournalIcon from "@/public/icons/navigation/journal.svg";
import { AddAccountSheet } from "./dashboard/sidebar/add-account-sheet";
import { trpcClient } from "@/utils/trpc";
import {
  Settings,
  Sparkles,
  Copy,
  Target,
  Trophy,
  Building2,
  Award,
  Newspaper,
  BarChart3,
  Rss,
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Users,
} from "lucide-react";

import NavUser from "./nav-user";
import { useAccountStore } from "@/stores/account";
import type { Me } from "@/types/user";

type NavIcon = React.ComponentType<{ className?: string }>;
type NavItem = {
  title: string;
  url: string;
  icon: NavIcon;
  isActive?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Trading",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: DashboardIcon },
      { title: "Trades", url: "/dashboard/trades", icon: CalendarIcon },
      { title: "Accounts", url: "/dashboard/accounts", icon: Building2 },
      { title: "Goals", url: "/dashboard/goals", icon: Target },
    ],
  },
  {
    label: "Analysis",
    items: [
      { title: "Journal", url: "/dashboard/journal", icon: JournalIcon },
      { title: "Psychology", url: "/dashboard/psychology", icon: TrendingUp },
      { title: "Backtest", url: "/backtest", icon: BarChart3 },
      { title: "Prop Tracker", url: "/dashboard/prop-tracker", icon: Trophy },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Feed", url: "/dashboard/feed", icon: Rss },
      { title: "Leaderboard", url: "/dashboard/leaderboard", icon: Award },
      { title: "Achievements", url: "/dashboard/achievements", icon: Trophy },
      { title: "News", url: "/dashboard/news", icon: Newspaper },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "Trade Copier", url: "/dashboard/copier", icon: Copy },
      { title: "AI Assistant", url: "/assistant", icon: Sparkles },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ],
  },
];

function brokerToImage(broker: string): string {
  switch (broker) {
    case "ftmo":
      return "/brokers/FTMO.png";
    case "myforexfunds":
      return "/brokers/FTMO.png";
    case "fundingpips":
      return "/FTMO.png";
    default:
      return "/brokers/FTMO.png";
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await trpcClient.accounts.list.query();
        if (!mounted) return;
        const mapped: Account[] = rows.map(
          (r: { id: string; name: string; broker: string }) => ({
            id: r.id,
            name: r.name,
            image: brokerToImage(r.broker),
          })
        );
        setAccounts(mapped);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await trpcClient.users.me.query();
        setMe(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const pathname = usePathname();

  const sections = useMemo(
    () =>
      navSections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          const isActive =
            item.url === "/dashboard"
              ? pathname === item.url
              : item.url === "/dashboard/settings"
              ? pathname === "/dashboard/settings" ||
                pathname?.startsWith("/dashboard/settings/")
              : pathname?.startsWith(item.url);
          return { ...item, isActive };
        }),
      })),
    [pathname]
  );

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="h-[3.725rem] p-4 pb-1 pt-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-2.5">
        {accounts.length > 0 ? (
          <AccountSwitcher accounts={accounts} defaultAccount={accounts[0]} />
        ) : (
          <div className="pt-1">
            <AddAccountSheet
              onAccountCreated={(a: NewAccount) =>
                setAccounts((prev) => [
                  ...prev,
                  { id: a.id, name: a.name, image: a.image } as Account,
                ])
              }
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-4 py-2 overflow-y-auto">
        {sections.map((section) => (
          <div
            key={section.label}
            className="mb-3 group-data-[collapsible=icon]:mb-0"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 mb-1.5 group-data-[collapsible=icon]:hidden">
              {section.label}
            </p>

            {section.items.map((item) => (
              <Link
                href={item.url}
                key={item.title}
                className={cn(
                  "group/navlink flex items-center gap-3 rounded-md transition-all duration-150 bg-transparent hover:bg-sidebar-accent dark:hover:bg-sidebar-accent h-max min-w-max cursor-pointer",
                  item.isActive &&
                    "bg-sidebar-accent text-white dark:hover:bg-sidebar-accent"
                )}
              >
                <SidebarMenuItem className="px-2 py-0.5 flex">
                  <SidebarMenuButton
                    className="flex items-center justify-center gap-3 cursor-pointer"
                    tooltip={item.title}
                  >
                    <item.icon
                      className={cn(
                        "stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white size-[18px]",
                        item.isActive &&
                          "fill-black dark:fill-transparent dark:stroke-white"
                      )}
                    />

                    <p
                      className={cn(
                        "text-[13px] text-secondary dark:text-[#8b8b97] font-normal transition-all duration-250 group-hover/navlink:!text-black dark:group-hover/navlink:!text-white min-w-max group-data-[collapsible=icon]:hidden",
                        item.isActive &&
                          "text-black dark:text-white font-medium"
                      )}
                    >
                      {item.title}
                    </p>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </Link>
            ))}
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-3">
        {me && <NavUser user={me} />}
      </SidebarFooter>
    </Sidebar>
  );
}
