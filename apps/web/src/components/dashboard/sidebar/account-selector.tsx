"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import Image from "next/image";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AddAccountSheet, type NewAccount } from "./add-account-sheet";
import { useAccountStore } from "@/stores/account";
import { useEffect } from "react";

export type Account = {
  id: string;
  name: string;
  image: string;
};

const AccountSwitcher = ({
  accounts,
  defaultAccount,
}: {
  accounts: Account[];
  defaultAccount?: Account;
}) => {
  const [items, setItems] = React.useState<Account[]>(accounts);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountStore((s) => s.setSelectedAccountId);
  const pendingSelectRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!items.length) return;
    // Sync local selection with global context
    const idx = items.findIndex((a) => a.id === selectedAccountId);
    if (idx >= 0) setSelectedIndex(idx);
  }, [items, selectedAccountId]);

  // After adding a new account, defer global selection to post-render
  React.useEffect(() => {
    const id = pendingSelectRef.current;
    if (!id) return;
    pendingSelectRef.current = undefined;
    const idx = items.findIndex((a) => a.id === id);
    if (idx >= 0) setSelectedIndex(idx);
    setSelectedAccountId(id);
  }, [items, setSelectedAccountId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        if (!accounts.length) return;
        const currentIdx = accounts.findIndex(
          (a) => a.id === useAccountStore.getState().selectedAccountId
        );
        const nextIdx =
          currentIdx >= 0 ? (currentIdx + 1) % accounts.length : 0;
        useAccountStore.getState().setSelectedAccountId(accounts[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accounts]);

  function handleSelect(idx: number) {
    setSelectedIndex(idx);
    setSelectedAccountId(items[idx]?.id);
  }

  function handleAccountCreated(account: NewAccount) {
    setItems((prev) => [...prev, account]);
    // Defer to effect to avoid cross-component update during render
    pendingSelectRef.current = account.id;
  }

  return (
    <SidebarMenu className="h-full w-full">
      <SidebarMenuItem className="h-full w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="cursor-pointer rounded-xs transition-all active:scale-95 bg-sidebar-accent text-xs hover:!brightness-110 duration-150 min-w-max min-h-max !w-full !h-full flex items-center justify-center">
              <div className="size-4 relative shrink-0">
                <Image
                  src={items[selectedIndex]?.image}
                  alt="broker"
                  fill
                  className="object-cover"
                />
              </div>

              {/* <p className="text-xs font-semibold min-w-max group-data-[collapsible=icon]:hidden">
                {items[selectedIndex]?.name}
              </p> */}

              {/* <ChevronsUpDown className="ml-auto stroke-[0.5px] group-data-[collapsible=icon]:hidden" /> */}
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) border-[0.5px] pt-2 border-black/10 dark:border-white/5 font-semibold bg-[#1D1D20] rounded-xs min-w-64"
            align="start"
          >
            <div className="flex flex-col px-1">
              {items.map((account, idx) => (
                <DropdownMenuItem
                  className={`flex gap-3 py-2.5 text-xs ${
                    idx === selectedIndex && "font-bold"
                  }`}
                  key={account.id}
                  onSelect={() => handleSelect(idx)}
                >
                  <div className="size-4 relative">
                    <Image src={account.image} alt="broker" fill className="" />
                  </div>
                  {account.name}{" "}
                  {idx === selectedIndex && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </div>

            {/* Separator */}

            <div className="flex flex-col mx-2 my-2">
              <div className="w-full h-[2px] bg-[#161618] border-b border-[#222225]" />
            </div>

            <div className="p-1">
              <AddAccountSheet onAccountCreated={handleAccountCreated} />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default AccountSwitcher;
