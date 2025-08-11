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
            className="px-3 bg-white border cursor-default"
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
                className="px-3 flex gap-3 cursor-pointer bg-white border hover:bg-white focus:bg-white"
              >
                <div className="size-4 relative">
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
                <ChevronsUpDown className="ml-auto stroke-1" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width)"
              align="start"
            >
              {items.map((account, idx) => (
                <DropdownMenuItem
                  className={`text-xs ${
                    idx === selectedIndex && "font-semibold"
                  }`}
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

              <DropdownMenuSeparator />

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
