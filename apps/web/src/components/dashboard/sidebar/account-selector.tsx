"use client";

import * as React from "react";
import { Check, ChevronsUpDown, CheckCircle2 } from "lucide-react";
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
import { useEffect, useState } from "react";
import { trpcClient } from "@/utils/trpc";
import { formatDistanceToNow } from "date-fns";

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
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountStore((s) => s.setSelectedAccountId);
  const pendingSelectRef = React.useRef<string | undefined>(undefined);
  const [accountMetrics, setAccountMetrics] = useState<Record<string, any>>({});
  const hasInitialized = React.useRef(false);

  // Sync items when accounts prop changes
  React.useEffect(() => {
    setItems(accounts);
  }, [accounts]);

  // Initialize selection once when items are available
  // CRITICAL: Only depend on `items`, not on `selectedAccountId` or `setSelectedAccountId`
  // This prevents the effect from re-running when Zustand hydrates
  React.useEffect(() => {
    if (hasInitialized.current || !items.length) return;
    hasInitialized.current = true;

    // Read persisted value directly from localStorage
    let persistedId: string | undefined;
    try {
      const stored = localStorage.getItem('profitabledge-account-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        persistedId = parsed?.state?.selectedAccountId;
      }
    } catch (e) {
      console.error('Failed to read persisted account:', e);
    }

    const currentStoreValue = useAccountStore.getState().selectedAccountId;

    // If persisted account exists and is valid, ensure it's set in the store
    if (persistedId && items.find((a) => a.id === persistedId)) {
      useAccountStore.getState().setSelectedAccountId(persistedId);
    } else if (!currentStoreValue) {
      // Only set to first if there's no value at all
      useAccountStore.getState().setSelectedAccountId(items[0]?.id);
    }
  }, [items]); // ONLY depend on items

  // Calculate selectedIndex from selectedAccountId
  const selectedIndex = React.useMemo(() => {
    if (!selectedAccountId || !items.length) return 0;
    const idx = items.findIndex((a) => a.id === selectedAccountId);
    return idx >= 0 ? idx : 0;
  }, [selectedAccountId, items]);

  // After adding a new account, defer global selection to post-render
  React.useEffect(() => {
    const id = pendingSelectRef.current;
    if (!id) return;
    pendingSelectRef.current = undefined;
    setSelectedAccountId(id);
  }, [items, setSelectedAccountId]);

  // Fetch live metrics for all accounts
  React.useEffect(() => {
    const fetchMetrics = async () => {
      const metrics: Record<string, any> = {};
      for (const account of items) {
        try {
          const data = await trpcClient.accounts.liveMetrics.query({
            accountId: account.id,
          });
          metrics[account.id] = data;
        } catch {
          // Account doesn't have live metrics (manual account)
        }
      }
      setAccountMetrics(metrics);
    };

    if (items.length > 0) {
      fetchMetrics();
    }
  }, [items]);

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
    setSelectedAccountId(items[idx]?.id);
  }

  function handleAccountCreated(account: NewAccount) {
    setItems((prev) => [...prev, account]);
    // Defer to effect to avoid cross-component update during render
    pendingSelectRef.current = account.id;
  }

  // Don't render until we have items and a selected account
  if (!items.length || !selectedAccountId) {
    return null;
  }

  return (
    <SidebarMenu className="h-full w-full">
      <SidebarMenuItem className="h-full w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="cursor-pointer rounded-xs transition-all active:scale-95 bg-sidebar-accent text-xs hover:!brightness-110 duration-150 min-w-max min-h-max !w-full !h-full flex items-center justify-center">
              <div className="size-4 relative shrink-0">
                <Image
                  src={items[selectedIndex].image}
                  alt="broker"
                  fill
                  className="object-cover"
                />
              </div>

              {/* <p className="text-xs font-semibold min-w-max group-data-[collapsible=icon]:hidden">
                {items[selectedIndex].name}
              </p> */}

              {/* <ChevronsUpDown className="ml-auto stroke-[0.5px] group-data-[collapsible=icon]:hidden" /> */}
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) border-[0.5px] pt-2 border-black/10 dark:border-white/5 font-semibold bg-[#1D1D20] rounded-xs min-w-64"
            align="start"
          >
            <div className="flex flex-col px-1">
              {items.map((account, idx) => {
                const metrics = accountMetrics[account.id];
                const isVerified = metrics?.isVerified ?? false;
                const lastSyncedAt = metrics?.lastSyncedAt;
                const lastSyncedText = lastSyncedAt
                  ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
                  : null;

                return (
                  <DropdownMenuItem
                    className={`flex flex-col items-start gap-1 py-2.5 text-xs ${
                      idx === selectedIndex && "font-bold"
                    }`}
                    key={account.id}
                    onSelect={() => handleSelect(idx)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="size-4 relative">
                        <Image src={account.image} alt="broker" fill className="" />
                      </div>
                      <span className="flex-1">{account.name}</span>
                      {isVerified && (
                        <CheckCircle2 className="size-3.5 text-teal-400" />
                      )}
                      {idx === selectedIndex && <Check className="size-4" />}
                    </div>
                    {lastSyncedText && (
                      <div className="text-[10px] text-white/40 ml-7">
                        Synced {lastSyncedText}
                      </div>
                    )}
                  </DropdownMenuItem>
                );
              })}
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
