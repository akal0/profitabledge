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

  function handleSelect(idx: number) {
    setSelectedIndex(idx);
    setSelectedAccountId(items[idx]?.id);
  }

  function handleAccountCreated(account: NewAccount) {
    setItems((prev) => [...prev, account]);
    // Defer to effect to avoid cross-component update during render
    pendingSelectRef.current = account.id;
  }

  if (items.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="px-4 bg-sidebar-accent border cursor-default"
          >
            <span className="text-xs font-semibold text-secondary">
              No accounts added yet
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex flex-col gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="shadow-sidebar-button cursor-pointer rounded-[6px] gap-3 h-max transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:!brightness-110 hover:text-[#A0A0A6]/75 duration-250 px-4 py-3"
              >
                <div className="size-3 relative">
                  <Image
                    src={items[selectedIndex]?.image}
                    alt="broker"
                    fill
                    className="rounded"
                  />
                </div>

                <div className="flex flex-col leading-none">
                  <span className="text-xs font-semibold">
                    {items[selectedIndex]?.name}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto stroke-[0.5px]" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) border border-black/10 dark:border-white/5 font-semibold bg-[#1D1D20]"
              align="start"
            >
              {items.map((account, idx) => (
                <DropdownMenuItem
                  className={`text-xs ${idx === selectedIndex && "font-bold"}`}
                  key={account.id}
                  onSelect={() => handleSelect(idx)}
                >
                  <div className="size-3 relative">
                    <Image
                      src={account.image}
                      alt="broker"
                      fill
                      className="rounded"
                    />
                  </div>
                  {account.name}{" "}
                  {idx === selectedIndex && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}

              {/* Separator */}

              <div className="flex flex-col mx-2 my-2">
                <div className="w-full h-[2px] bg-[#161618] border-b border-[#222225]" />
              </div>

              <div className="p-1">
                <AddAccountSheet onAccountCreated={handleAccountCreated} />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default AccountSwitcher;
