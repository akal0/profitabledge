"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  CheckCircle2,
  FlaskConical,
  Plug,
  Plus,
} from "lucide-react";
import Image from "next/image";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { AddAccountSheet, type NewAccount } from "./add-account-sheet";
import { Button } from "@/components/ui/button";
import {
  accountIsEaSynced,
  isDemoWorkspaceAccount,
} from "@/features/accounts/lib/account-metadata";
import {
  ALL_ACCOUNTS_ID,
  isAllAccountsScope,
  useAccountStore,
} from "@/stores/account";
import { useAccountTransitionStore } from "@/stores/account-transition";
import { useEffect, useState } from "react";
import { useOnborda } from "onborda";
import {
  TOUR_ID,
  ADD_ACCOUNT_SHEET_FIRST_STEP,
  ADD_ACCOUNT_SHEET_LAST_STEP,
  SHEET_OPTION_BY_STEP,
} from "@/features/onboarding-tour/tour-steps";
import { useTourStore } from "@/features/onboarding-tour/tour-store";
import { trpcOptions } from "@/utils/trpc";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  pickPreferredAccountConnection,
  type ConnectionRow,
} from "@/features/dashboard-shell/lib/connection-status";

export type Account = {
  id: string;
  name: string;
  image: string;
  broker?: string | null;
  brokerType?: string | null;
  brokerServer?: string | null;
  accountNumber?: string | number | null;
  isVerified?: number | boolean | null;
  verificationLevel?: string | null;
  lastSyncedAt?: string | Date | null;
  lastImportedAt?: string | Date | null;
};

const AccountSwitcher = ({ accounts }: { accounts: Account[] }) => {
  const { isMobile, state } = useSidebar();
  const [items, setItems] = React.useState<Account[]>(accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountStore((s) => s.setSelectedAccountId);
  const beginAccountTransition = useAccountTransitionStore(
    (s) => s.beginAccountTransition
  );
  const pendingSelectRef = React.useRef<string | undefined>(undefined);
  const hasInitialized = React.useRef(false);

  const { isOnbordaVisible, currentStep, currentTour } = useOnborda();
  const isTourActive = isOnbordaVisible && currentTour === TOUR_ID;
  const requestedAddAccountSheetOpen = useTourStore(
    (s) => s.requestedAddAccountSheetOpen
  );
  const setRequestedAddAccountSheetOpen = useTourStore(
    (s) => s.setRequestedAddAccountSheetOpen
  );
  const isAddAccountSheetStep =
    isTourActive &&
    currentStep >= ADD_ACCOUNT_SHEET_FIRST_STEP &&
    currentStep <= ADD_ACCOUNT_SHEET_LAST_STEP;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false);
  const isTourDrivingAddAccountSheet =
    requestedAddAccountSheetOpen || isAddAccountSheetStep;

  useEffect(() => {
    if (!isTourActive || currentStep > ADD_ACCOUNT_SHEET_LAST_STEP) {
      setRequestedAddAccountSheetOpen(false);
    }
  }, [currentStep, isTourActive, setRequestedAddAccountSheetOpen]);

  const allAccountsItem = React.useMemo<Account>(
    () => ({
      id: ALL_ACCOUNTS_ID,
      name: "All accounts",
      image: "/brokers/pe.svg",
    }),
    []
  );
  const selectorItems = React.useMemo(
    () => [allAccountsItem, ...items],
    [allAccountsItem, items]
  );

  // Sync items when accounts prop changes
  React.useEffect(() => {
    setItems(accounts);
  }, [accounts]);

  // Pre-seed demoCreated if user already has a demo workspace
  React.useEffect(() => {
    if (accounts.some(isDemoWorkspaceAccount)) {
      useTourStore.getState().setDemoCreated(true);
    }
  }, [accounts]);

  // Initialize selection once when items are available
  // CRITICAL: Only depend on `items`, not on `selectedAccountId` or `setSelectedAccountId`
  // This prevents the effect from re-running when Zustand hydrates
  React.useEffect(() => {
    if (hasInitialized.current || !selectorItems.length) return;
    hasInitialized.current = true;

    // Read persisted value directly from localStorage
    let persistedId: string | undefined;
    try {
      const stored = localStorage.getItem("profitabledge-account-storage");
      if (stored) {
        const parsed = JSON.parse(stored);
        persistedId = parsed?.state?.selectedAccountId;
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to read persisted account:", e);
      }
    }

    const currentStoreValue = useAccountStore.getState().selectedAccountId;

    // If persisted account exists and is valid, ensure it's set in the store
    if (persistedId && selectorItems.find((a) => a.id === persistedId)) {
      useAccountStore.getState().setSelectedAccountId(persistedId);
    } else if (!currentStoreValue) {
      // Only set to first if there's no value at all
      useAccountStore.getState().setSelectedAccountId(allAccountsItem.id);
    }
  }, [selectorItems, allAccountsItem.id]); // ONLY depend on selector items

  // Calculate selectedIndex from selectedAccountId
  const selectedIndex = React.useMemo(() => {
    if (!selectedAccountId || !selectorItems.length) return 0;
    const idx = selectorItems.findIndex((a) => a.id === selectedAccountId);
    return idx >= 0 ? idx : 0;
  }, [selectedAccountId, selectorItems]);

  // After adding a new account, defer global selection to post-render
  React.useEffect(() => {
    const id = pendingSelectRef.current;
    if (!id) return;
    pendingSelectRef.current = undefined;
    setSelectedAccountId(id);
  }, [items, setSelectedAccountId]);

  const { data: aggregatedStats } = useQuery({
    ...trpcOptions.accounts.aggregatedStats.queryOptions(),
    enabled: dropdownOpen,
    staleTime: 30_000,
    refetchInterval: dropdownOpen ? 30_000 : false,
  });
  const { data: rawConnections } = useQuery({
    ...trpcOptions.connections.list.queryOptions(),
    enabled: dropdownOpen,
    staleTime: 30_000,
  });

  const accountConnections = React.useMemo(
    () => (rawConnections as ConnectionRow[] | undefined) ?? [],
    [rawConnections]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        if (!selectorItems.length) return;
        const currentIdx = selectorItems.findIndex(
          (a) => a.id === useAccountStore.getState().selectedAccountId
        );
        const nextIdx =
          currentIdx >= 0 ? (currentIdx + 1) % selectorItems.length : 0;
        const nextAccountId = selectorItems[nextIdx]?.id;
        if (!nextAccountId) return;
        useAccountTransitionStore
          .getState()
          .beginAccountTransition(nextAccountId);
        useAccountStore.getState().setSelectedAccountId(nextAccountId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectorItems]);

  function handleSelect(idx: number) {
    const nextAccountId = selectorItems[idx]?.id;
    if (!nextAccountId || nextAccountId === selectedAccountId) {
      return;
    }

    beginAccountTransition(nextAccountId);
    setSelectedAccountId(nextAccountId);
  }

  function handleAccountCreated(account: NewAccount) {
    setItems((prev) => [...prev, account]);
    // Defer to effect to avoid cross-component update during render
    pendingSelectRef.current = account.id;
  }

  // Don't render until we have items and a selected account
  if (!selectorItems.length || !selectedAccountId) {
    return null;
  }

  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarMenu className={cn("h-full w-full", isCollapsed && "items-center")}>
      <SidebarMenuItem
        className={cn("h-full w-full", isCollapsed && "flex justify-center")}
      >
        <DropdownMenu
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
        >
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              data-onborda="account-selector"
              className={cn(
                "cursor-pointer items-center gap-2 bg-sidebar-accent text-xs shadow-sm ring-1! ring-white/5 transition-all duration-150 active:scale-95 hover:!brightness-110",
                isCollapsed
                  ? "justify-center rounded-lg"
                  : "!h-full rounded-lg px-5"
              )}
            >
              <div className="size-3.5 relative shrink-0 rounded-full overflow-hidden">
                <Image
                  src={selectorItems[selectedIndex].image}
                  alt="broker"
                  fill
                  className="object-cover"
                />
              </div>

              <p className="text-[11px] font-semibold truncate group-data-[collapsible=icon]:hidden">
                {selectorItems[selectedIndex].name}
              </p>
              {!isAllAccountsScope(selectorItems[selectedIndex].id) &&
              isDemoWorkspaceAccount(selectorItems[selectedIndex]) ? (
                <span className="hidden md:inline-flex items-center rounded-sm border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-300 group-data-[collapsible=icon]:hidden ml-0.5">
                  Demo
                </span>
              ) : null}

              <ChevronsUpDown className="ml-auto size-2.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className={cn(
              "w-(--radix-dropdown-menu-trigger-width) border-[0.5px] pt-2 border-black/10 dark:border-white/5 font-semibold bg-[#1D1D20] rounded-lg min-w-64",
              isTourActive && "!z-[9500]"
            )}
            align="start"
          >
            <div className="flex flex-col px-1">
              {selectorItems.map((account, idx) => {
                const isAggregate = isAllAccountsScope(account.id);
                const lastSyncedAt = isAggregate ? null : account.lastSyncedAt;
                const lastSyncedText = lastSyncedAt
                  ? formatDistanceToNow(new Date(lastSyncedAt), {
                      addSuffix: true,
                    })
                  : null;
                const aggregateText = isAggregate
                  ? aggregatedStats
                    ? `${aggregatedStats.accounts?.length ?? items.length} accounts · ${
                        aggregatedStats.accounts?.reduce(
                          (sum, current) => sum + (current.totalTrades ?? 0),
                          0
                        ) ?? 0
                      } trades`
                    : `${items.length} accounts`
                  : null;
                const isDemoWorkspace =
                  !isAggregate && isDemoWorkspaceAccount(account);
                const hasConnection =
                  !isAggregate &&
                  Boolean(
                    pickPreferredAccountConnection(
                      accountConnections,
                      account.id
                    )
                  );
                const isEaSynced =
                  !isAggregate &&
                  !hasConnection &&
                  accountIsEaSynced({
                    isVerified: account.isVerified,
                    verificationLevel: account.verificationLevel,
                  });
                const StatusIcon = isDemoWorkspace
                  ? FlaskConical
                  : hasConnection
                  ? Plug
                  : isEaSynced
                  ? CheckCircle2
                  : null;
                const statusIconClassName = isDemoWorkspace
                  ? "text-violet-400"
                  : hasConnection
                  ? "text-sky-400"
                  : "text-teal-400";

                return (
                  <DropdownMenuItem
                    className={`flex flex-col items-start gap-1 py-2.5 text-xs cursor-pointer ${
                      idx === selectedIndex && "font-bold"
                    }`}
                    key={account.id}
                    onSelect={() => handleSelect(idx)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="size-3 relative">
                        <Image
                          src={account.image}
                          alt="broker"
                          fill
                          className=""
                        />
                      </div>
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <span className="truncate">{account.name}</span>
                      </div>
                      {StatusIcon ? (
                        <StatusIcon
                          className={cn(
                            "size-3.5 shrink-0",
                            statusIconClassName
                          )}
                        />
                      ) : null}
                      {idx === selectedIndex && <Check className="size-4" />}
                    </div>
                    {aggregateText && (
                      <div className="text-[10px] text-white/40 ml-7">
                        {aggregateText}
                      </div>
                    )}
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
              <Button
                className="ring-1 ring-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-3 transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250"
                onClick={() => {
                  setDropdownOpen(false);
                  setAddAccountSheetOpen(true);
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <Plus className="size-3.5" />
                  <span className="truncate">Add an account</span>
                </div>
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <AddAccountSheet
        noTrigger
        onAccountCreated={handleAccountCreated}
        open={isTourDrivingAddAccountSheet || addAccountSheetOpen}
        onOpenChange={(open) => {
          if (!isTourDrivingAddAccountSheet) {
            setAddAccountSheetOpen(open);
          }
        }}
        contentClassName={
          isTourDrivingAddAccountSheet ? "!z-[860]" : undefined
        }
        highlightedOption={
          isAddAccountSheetStep ? SHEET_OPTION_BY_STEP[currentStep] : undefined
        }
      />
    </SidebarMenu>
  );
};

export default AccountSwitcher;
