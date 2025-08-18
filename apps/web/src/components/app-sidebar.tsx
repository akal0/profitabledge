"use client";

import React, { useEffect, useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import AccountSwitcher, {
  type Account,
} from "./dashboard/sidebar/account-selector";
import type { NewAccount } from "./dashboard/sidebar/add-account-sheet";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { buttonVariants } from "./ui/button";
import Lightning from "@/public/icons/lightning.svg";
import DashboardIcon from "@/public/icons/dashboard.svg";
import EdgebotIcon from "@/public/icons/edgebot.svg";
import CalendarIcon from "@/public/icons/calendar.svg";
import JournalIcon from "@/public/icons/journal.svg";
import ReportsIcon from "@/public/icons/reports.svg";
import AccountIcon from "@/public/icons/account.svg";
import { AddAccountSheet } from "./dashboard/sidebar/add-account-sheet";
import { trpcClient } from "@/utils/trpc";
import ClockIcon from "@/public/icons/clock.svg";

import { Separator } from "./ui/separator";

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
      title: "Edgebot",
      url: "#",
      icon: EdgebotIcon,
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
      title: "Account Stats",
      url: "#",
      icon: AccountIcon,
    },
  ],
};

function brokerToImage(broker: string): string {
  switch (broker) {
    case "ftmo":
      return "/FTMO.png";
    case "myforexfunds":
      return "/FTMO.png";
    case "fundingpips":
      return "/FTMO.png";
    default:
      return "/FTMO.png";
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

  return (
    <Sidebar className="px-0" variant="inset" {...props}>
      <SidebarHeader className="px-4">
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

      <SidebarContent className="p-2 px-4 flex flex-col gap-2 bg-sidebar dark:text-neutral-200">
        {data.navMain.map((item, idx) => (
          <Link
            href="#"
            key={item.title}
            className={cn(
              `group/navlink px-4 py-2.5 flex items-center gap-3 rounded-sm transition-all duration-100 group/navlink bg-transparent hover:bg-sidebar-accent dark:hover:bg-sidebar-accent`,
              item.isActive &&
                "shadow-sidebar-button rounded-[6px] gap-3 h-max transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:!brightness-110 hover:text-[#A0A0A6]/75 duration-250"
            )}
          >
            {/*
            <Icon
              icon={item.icon}
              isHovered={hoveredItem === item.title && !item.isActive}
              size={16}
            />
            */}

            <item.icon
              className={cn(
                "size-3.5 fill-[#8b8b97] group-hover/navlink:fill-black dark:group-hover/navlink:fill-white",
                item.isActive && "fill-black dark:fill-white"
              )}
            />

            <p
              className={cn(
                `text-xs text-secondary dark:text-neutral-300 font-semibold tracking-tight transition-all duration-250 group-hover/navlink:!text-black dark:group-hover/navlink:!text-white`,
                item.isActive && "text-black dark:text-white"
              )}
            >
              {item.title}
            </p>
          </Link>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-4">
        <div className="shadow-sidebar-button flex gap-1.5 items-center justify-center py-2 px-4 w-full bg-sidebar-accent dark:bg-sidebar-accent opacity-50 rounded-[6px] select-none">
          <ClockIcon className="size-3 fill-transparent stroke-white/50" />

          <p className="text-white/50 text-xs font-semibold">
            {" "}
            Trial expires in 4 days{" "}
          </p>
        </div>

        <Link
          href="/"
          className={cn(
            buttonVariants,
            "shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:!brightness-110 duration-250 flex py-4 items-center justify-center"
          )}
        >
          <Lightning className="drop-shadow-[0_2px_1px_rgba(0,0,0,0.3)] size-3.5 fill-white [*]:transition-none" />

          <span className="text-shadow-2xs text-[14px] font-semibold tracking-relaxed">
            Upgrade to Pro
          </span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
