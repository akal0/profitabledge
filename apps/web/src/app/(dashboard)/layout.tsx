"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app-sidebar";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { BacktestSidebar } from "@/components/backtest-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { VerticalSeparator, Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  SearchIcon,
  CheckCircle2,
  Trophy,
  Plus,
  Plug,
  PauseCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import Cmd from "@/public/graphics/cmd.svg";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";
import { trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { ALL_ACCOUNTS_ID } from "@/stores/account";
import { useFloatingAssistant } from "@/stores/floating-assistant";
import NotificationsHub from "@/components/notifications-hub";
import { AIInsightToast } from "@/components/ai-insight-toast";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { FloatingAssistant } from "@/components/ai/floating-assistant";
import { useQuery } from "@tanstack/react-query";
import { useGoalDialog } from "@/stores/goal-dialog";
import { QuickTradeEntry } from "@/components/trades/quick-trade-entry";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  type ConnectionRow = {
    accountId: string | null;
    provider: string;
    status: string;
    isPaused: boolean;
  };

  const pathname = usePathname();
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const setSelectedAccountId = useAccountStore(
    (state) => state.setSelectedAccountId
  );
  const { open: openFloatingAssistant } = useFloatingAssistant();
  const { open: openCommandPalette } = useCommandPalette();
  const isJournalRoute = pathname?.startsWith("/dashboard/journal");
  const isGoalsRoute = pathname?.startsWith("/dashboard/goals");
  const isTradesRoute = pathname?.startsWith("/dashboard/trades");
  const { setOpen: setGoalDialogOpen } = useGoalDialog();

  // Get account metrics to show verification status
  const { data: accountMetrics } = useQuery({
    ...trpcOptions.accounts.stats.queryOptions({ accountId: accountId ?? "" }),
    enabled: !!accountId,
    staleTime: 30_000,
  });

  // Get current account to check if it's a prop account
  const { data: rawAccounts } = useQuery(trpcOptions.accounts.list.queryOptions());
  const accounts = rawAccounts as Array<{ id: string; isPropAccount?: boolean }> | undefined;
  const currentAccount = accounts?.find((acc) => acc.id === accountId);
  const { data: rawConnections } = useQuery(
    trpcOptions.connections.list.queryOptions()
  );
  const connections = (rawConnections as ConnectionRow[] | undefined) ?? [];
  const currentAccountConnection =
    accountId && accountId !== ALL_ACCOUNTS_ID
      ? connections
          .filter((connection) => connection.accountId === accountId)
          .sort((a, b) => {
            const score = (connection: ConnectionRow) => {
              if (connection.isPaused) return 1;
              if (connection.status === "active") return 4;
              if (connection.status === "pending") return 3;
              if (connection.status === "error") return 0;
              return 2;
            };
            return score(b) - score(a);
          })[0] ?? null
      : null;

  const normalizeConnectionStatus = (status: string) => {
    switch (status) {
      case "active":
      case "success":
      case "running":
      case "idle":
        return "active";
      case "pending":
      case "bootstrapping":
      case "syncing":
        return "pending";
      case "error":
      case "degraded":
        return "error";
      default:
        return status;
    }
  };

  const getConnectionBadge = (connection: ConnectionRow | null) => {
    if (!connection) return null;

    const normalizedStatus = normalizeConnectionStatus(connection.status);

    const providerLabel =
      connection.provider === "mt5-terminal"
        ? "MT5"
        : connection.provider === "mt4-terminal"
        ? "MT4"
        : "Auto-sync";

    if (connection.isPaused) {
      return {
        icon: PauseCircle,
        iconClassName: "text-white/50",
        longLabel: `${providerLabel} sync paused`,
        shortLabel: "Paused",
      };
    }

    if (normalizedStatus === "active") {
      return {
        icon: Plug,
        iconClassName: "text-sky-400",
        longLabel: `${providerLabel} connected`,
        shortLabel: providerLabel,
      };
    }

    if (normalizedStatus === "pending") {
      return {
        icon: RefreshCw,
        iconClassName: "text-amber-400",
        longLabel: `${providerLabel} syncing`,
        shortLabel: "Syncing",
      };
    }

    return {
      icon: AlertTriangle,
      iconClassName: "text-orange-400",
      longLabel: `${providerLabel} connection issue`,
      shortLabel: "Issue",
    };
  };

  const connectionBadge = getConnectionBadge(currentAccountConnection);

  useEffect(() => {
    if (
      pathname?.startsWith("/dashboard/settings") &&
      accountId === ALL_ACCOUNTS_ID &&
      accounts?.[0]?.id
    ) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accountId, accounts, pathname, setSelectedAccountId]);

  // Get breadcrumb info from pathname
  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean);

    // /assistant route
    if (paths.length === 1 && paths[0] === "assistant") {
      return {
        parent: "Dashboard",
        current: "Assistant",
        parentLink: "/dashboard",
      };
    }

    if (paths.length === 1 && paths[0] === "dashboard") {
      return {
        parent: "Dashboard",
        current: "Overview",
        parentLink: "/dashboard",
      };
    }

    // For nested routes like /dashboard/settings/alerts
    if (paths.length >= 3 && paths[1] === "settings") {
      const subPage = paths[2].charAt(0).toUpperCase() + paths[2].slice(1);
      return {
        parent: "Settings",
        current: subPage,
        parentLink: "/dashboard/settings",
      };
    }

    // For /dashboard/settings
    if (paths.length === 2 && paths[1] === "settings") {
      return {
        parent: "Dashboard",
        current: "Settings",
        parentLink: "/dashboard",
      };
    }

    // For backtest sub-routes like /dashboard/backtest/sessions, /dashboard/backtest/analytics
    if (paths.length >= 3 && paths[1] === "backtest") {
      const subPage = paths[2].charAt(0).toUpperCase() + paths[2].slice(1);
      return {
        parent: "Backtesting",
        current: subPage,
        parentLink: "/dashboard/backtest",
      };
    }

    // For /dashboard/backtest (overview)
    if (paths.length === 2 && paths[1] === "backtest") {
      return {
        parent: "Dashboard",
        current: "Backtesting",
        parentLink: "/dashboard",
      };
    }

    // For nested routes like /dashboard/prop-tracker/[accountId]
    if (paths.length >= 3 && paths[1] === "prop-tracker") {
      return {
        parent: "Prop Tracker",
        current: "Account Details",
        parentLink: "/dashboard/prop-tracker",
      };
    }

    // For routes like /dashboard/trades, /dashboard/accounts, etc.
    if (paths[1]) {
      const current = paths[1].charAt(0).toUpperCase() + paths[1].slice(1);
      return { parent: "Dashboard", current, parentLink: "/dashboard" };
    }

    return {
      parent: "Dashboard",
      current: "Overview",
      parentLink: "/dashboard",
    };
  };

  const breadcrumbs = getBreadcrumbs();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const activeElement = document.activeElement;
        const isInput =
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA" ||
          activeElement?.getAttribute("contenteditable") === "true";
        if (!isInput) {
          e.preventDefault();
          openFloatingAssistant();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openFloatingAssistant]);

  return (
    <SidebarProvider defaultOpen className="min-h-[100vh] h-full relative">
      <AIInsightToast />
      {pathname?.startsWith("/dashboard/settings") ? (
        <SettingsSidebar />
      ) : pathname?.startsWith("/dashboard/backtest") && !pathname?.includes("/replay") ? (
        <BacktestSidebar />
      ) : (
        <AppSidebar />
      )}
      <VerticalSeparator />

      <SidebarInset className="bg-background dark:bg-sidebar py-2 h-full flex flex-col overflow-hidden">
        <div className="flex flex-col shrink-0">
          <header className="flex h-[3.725rem] shrink-0 items-center gap-1 bg-background dark:bg-sidebar rounded-t-[8px] px-4 sm:px-6 lg:px-8 pr-4 sm:pr-6 min-w-0 overflow-hidden">
            <SidebarTrigger className="h-9 w-9 shrink-0 border border-white/5 bg-sidebar hover:bg-sidebar-accent text-white/70 hover:text-white rounded-sm" />
            <button
              onClick={() => openCommandPalette()}
              className="flex items-center gap-2 flex-1 min-w-0 group transition-all duration-250 cursor-pointer px-2 sm:px-4"
            >
              <SearchIcon className="size-3.5 shrink-0 text-white/50 group-hover:text-white/75 transition-all duration-150" />
              <span className="text-sm text-white/50 group-hover:text-white/75 transition-all duration-150 font-medium truncate hidden sm:inline">
                Search anything or enter a command...
              </span>

              <span className="ml-auto shrink-0 hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <span className="pointer-events-none inline-flex select-none items-center gap-1 shadow-primary-button rounded-[6px] bg-sidebar-accent text-white text-[10px] h-max py-1 px-1.5">
                  <Cmd className="size-2 stroke-white fill-transparent" />
                  <span>S</span>
                </span>
              </span>
            </button>

            <CommandPalette />

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <NotificationsHub />
              <Button className="cursor-pointer flex transform items-center justify-center gap-2 py-2.5 h-9 transition-all active:scale-95 text-white text-xs hover:!brightness-110 hover:text-white duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent shadow-md whitespace-nowrap">
                {currentAccount?.isPropAccount ? (
                  <>
                    <Trophy className="size-3.5 text-yellow-400" />
                    <span className="hidden lg:inline">Verified prop firm account</span>
                    <span className="lg:hidden">Prop</span>
                  </>
                ) : accountId === ALL_ACCOUNTS_ID ? (
                  <>
                    <span className="hidden lg:inline">All accounts view</span>
                    <span className="lg:hidden">All</span>
                  </>
                ) : connectionBadge ? (
                  <>
                    <connectionBadge.icon
                      className={`size-3.5 ${connectionBadge.iconClassName}`}
                    />
                    <span className="hidden lg:inline">
                      {connectionBadge.longLabel}
                    </span>
                    <span className="lg:hidden">
                      {connectionBadge.shortLabel}
                    </span>
                  </>
                ) : (accountMetrics as any)?.isVerified ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-teal-400" />
                    <span className="hidden lg:inline">EA-synced account</span>
                    <span className="lg:hidden">EA</span>
                  </>
                ) : (
                  <>
                    <span className="hidden lg:inline">Manual account</span>
                    <span className="lg:hidden">Manual</span>
                  </>
                )}
              </Button>
            </div>
          </header>

          <Separator />

          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
            <Breadcrumb>
              <BreadcrumbList className="text-xs text-secondary dark:text-neutral-400">
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink
                    href={breadcrumbs.parentLink}
                    className="hover:text-secondary text-secondary dark:text-neutral-300 font-medium"
                  >
                    {breadcrumbs.parent}
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="hidden md:block" />

                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-secondary dark:text-neutral-200">
                    {breadcrumbs.current}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {isGoalsRoute && (
              <Button
                onClick={() => setGoalDialogOpen(true)}
                className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3"
              >
                <Plus className="size-3.5" />
                <span>New goal</span>
              </Button>
            )}

            {isTradesRoute && accountId && (
              <QuickTradeEntry
                accountId={accountId}
                trigger={
                  <Button className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3">
                    <Plus className="size-3.5" />
                    <span>Add trade</span>
                  </Button>
                }
              />
            )}
          </div>

          <Separator />
        </div>

        {/* Main content */}
        <div
          className={cn(
            "flex w-full flex-1 min-h-0 flex-col dark:bg-sidebar",
            isJournalRoute ? "overflow-hidden" : "overflow-y-auto gap-4 pb-12"
          )}
        >
          {children}
        </div>
      </SidebarInset>

      <FloatingAssistant />
    </SidebarProvider>
  );
}
