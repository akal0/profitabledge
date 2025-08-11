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
import { Icon } from "@/components/icons/Icon";
import { Separator } from "./ui/separator";
import Link from "next/link";
import { Button, buttonVariants } from "./ui/button";
import { VariantButton } from "./ui/buttons/variant-button";

import Lightning from "../../public/icons/lightning.svg";
import { AddAccountSheet } from "./dashboard/sidebar/add-account-sheet";
import { trpcClient } from "@/utils/trpc";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: "dashboard",
      isActive: true,
    },
    {
      title: "Edgebot",
      url: "#",
      icon: "edgebot",
    },
    {
      title: "Calendar",
      url: "#",
      icon: "calendar",
    },
    {
      title: "Journal",
      url: "#",
      icon: "journal",
    },
    {
      title: "Reports",
      url: "#",
      icon: "reports",
    },
    {
      title: "Account Stats",
      url: "#",
      icon: "account",
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
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        {accounts.length > 0 ? (
          <AccountSwitcher accounts={accounts} defaultAccount={accounts[0]} />
        ) : (
          <div className="p-2">
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

      <div className="px-2 my-2">
        <Separator className="" />
      </div>

      <SidebarContent className="p-2 flex flex-col gap-2">
        {data.navMain.map((item, idx) => (
          <Link
            href="#"
            key={item.title}
            className={cn(
              `group px-2 py-2.5 flex items-center gap-2 hover:bg-[#f2f2f2] rounded-sm transition-all duration-75 border border-black/0 group`,
              item.isActive &&
                " bg-[#efefef] border flex gap-3 hover:bg-[#e8e8e8] transition-all duration-250"
            )}
            onMouseEnter={() => setHoveredItem(item.title)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <Icon
              icon={item.icon}
              isActive={item.isActive}
              isHovered={hoveredItem === item.title && !item.isActive}
              size={16}
            />

            <p
              className={cn(
                `text-xs text-secondary font-medium transition-all duration-500`,
                hoveredItem === item.title && "text-black/60",
                item.isActive === true && "font-semibold text-black"
              )}
            >
              {item.title}
            </p>
          </Link>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex gap-1.5 items-center justify-center py-2 px-4 w-full bg-[#f2f2f2] rounded-[6px]">
          <Icon
            icon="clock"
            size={12}
            inactiveFillColor="#f2f2f2"
            inactiveStrokeColor="#8B8B97"
          />

          <p className="text-secondary text-xs font-semibold">
            {" "}
            Free trial expires in 7 days{" "}
          </p>
        </div>

        <Link
          href="/"
          className={cn(
            buttonVariants,
            "rounded-md border border-indigo-400/20 border-b-indigo-600/70 border-t-indigo-400/70 bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-3 font-medium leading-none text-white antialiased shadow-md ring-1 ring-indigo-600 transition-all duration-500 hover:brightness-110 flex items-center justify-center gap-2"
          )}
        >
          <Lightning className="drop-shadow-[0_2px_1px_rgba(0,0,0,0.3)] size-3 text-white" />

          <span className="text-shadow-2xs text-[14px] font-semibold">
            Upgrade to Pro
          </span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
