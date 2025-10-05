"use client";

import React, { useEffect, useState } from "react";

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
import { buttonVariants } from "./ui/button";
import Lightning from "@/public/icons/lightning.svg";
import DashboardIcon from "@/public/icons/navigation/dashboard.svg";
import CalendarIcon from "@/public/icons/navigation/calendar.svg";
import JournalIcon from "@/public/icons/navigation/journal.svg";
import ReportsIcon from "@/public/icons/navigation/reports.svg";
import AccountIcon from "@/public/icons/navigation/account.svg";
import { AddAccountSheet } from "./dashboard/sidebar/add-account-sheet";
import { trpcClient } from "@/utils/trpc";
import ClockIcon from "@/public/icons/clock.svg";

import { Separator } from "./ui/separator";
import NavUser from "./nav-user";
import { useAccountStore } from "@/stores/account";
import type { Me } from "@/types/user";
import Image from "next/image";

type NavIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type NavItem = {
  title: string;
  url: string;
  icon: NavIcon;
  isActive?: boolean;
};

const data: { navMain: NavItem[] } = {
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: DashboardIcon,
      isActive: true,
    },
    {
      title: "Calendar",
      url: "#",
      icon: CalendarIcon,
    },
    {
      title: "Journal",
      url: "#",
      icon: JournalIcon,
    },
    {
      title: "Reports",
      url: "#",
      icon: ReportsIcon,
    },
    {
      title: "Account",
      url: "#",
      icon: AccountIcon,
    },
  ],
};

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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await trpcClient.accounts.list.query();
        if (!mounted) return;
        const mapped: Account[] = rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          image: brokerToImage(r.broker),
        }));
        setAccounts(mapped);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getInfo = async () => {
    const me = await trpcClient.users.me.query();

    return me;
  };

  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      const data = await getInfo();
      setMe(data);
      console.log(data);
    })();
  }, []);

  const accountId = useAccountStore((s) => s.selectedAccountId);

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="p-4 pt-3 pb-1 h-[3.725rem]">
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

      <div className="my-2">
        <Separator />
      </div>

      <SidebarContent className="px-4 py-2">
        {data.navMain.map((item, idx) => (
          <Link
            href="#"
            key={item.title}
            className={cn(
              `group/navlink flex items-center gap-3 rounded-xs transition-all duration-150 group/navlink bg-transparent hover:bg-sidebar-accent dark:hover:bg-sidebar-accent h-max min-w-max cursor-pointer`,
              item.isActive &&
                "transition-all active:scale-95 bg-sidebar-accent text-white text-xs dark:hover:bg-sidebar-accent dark:hover:!brightness-120 hover:text-[#A0A0A6]/75 border-[0.5px] border-white/0"
            )}
          >
            <SidebarMenuItem key={item.title} className={cn(`px-2 py-1 flex`)}>
              <SidebarMenuButton
                className="flex items-center justify-center gap-3 cursor-pointer"
                // tooltip={item.title}
              >
                <item.icon
                  className={cn(
                    "stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white",
                    item.isActive &&
                      "fill-black dark:fill-transparent dark:stroke-white"
                  )}
                />

                <p
                  className={cn(
                    `text-[13px] text-secondary dark:text-[#8b8b97] font-normal transition-all duration-250 group-hover/navlink:!text-black dark:group-hover/navlink:!text-white min-w-max group-data-[collapsible=icon]:hidden`,
                    item.isActive && "text-black dark:text-white font-medium"
                  )}
                >
                  {item.title}
                </p>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </Link>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {me && (
          <div className="w-full h-full relative">
            <NavUser user={me} />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
