"use client";

import { Fragment } from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  SearchIcon,
  CheckCircle2,
  Trophy,
  Plus,
  FlaskConical,
} from "lucide-react";
import Cmd from "@/public/graphics/cmd.svg";
import NotificationsHub from "@/components/notifications-hub";
import { CommandPalette } from "@/components/command-palette";
import { QuickTradeEntry } from "@/components/trades/quick-trade-entry";
import { AddAccountSheet } from "@/features/accounts/components/add-account-sheet";
import { CsvAccountEnrichmentSheet } from "@/features/accounts/components/csv-account-enrichment-sheet";
import { brokerSupportsMultiCsvImport } from "@/features/accounts/lib/account-metadata";
import { ALL_ACCOUNTS_ID } from "@/stores/account";
import type { DashboardBreadcrumbs } from "@/features/dashboard-shell/lib/breadcrumbs";
import type { ConnectionBadge } from "@/features/dashboard-shell/lib/connection-status";

type DashboardShellHeaderProps = {
  breadcrumbs: DashboardBreadcrumbs;
  accountId?: string;
  currentAccountName?: string;
  currentAccountBroker?: string | null;
  currentAccountIsProp?: boolean;
  currentAccountIsDemo?: boolean;
  currentAccountIsEaSynced?: boolean;
  currentAccountSupportsLiveSync?: boolean;
  currentAccountLastImportedAt?: string | Date | null;
  connectionBadge: ConnectionBadge | null;
  isAccountsRoute: boolean;
  isGoalsRoute: boolean;
  isPropTrackerRoute: boolean;
  isTradesRoute: boolean;
  onOpenCommandPalette: () => void;
  onOpenGoalDialog: () => void;
};

export function DashboardShellHeader({
  breadcrumbs,
  accountId,
  currentAccountName,
  currentAccountBroker,
  currentAccountIsProp,
  currentAccountIsDemo,
  currentAccountIsEaSynced,
  currentAccountSupportsLiveSync,
  currentAccountLastImportedAt,
  connectionBadge,
  isAccountsRoute,
  isGoalsRoute,
  isPropTrackerRoute,
  isTradesRoute,
  onOpenCommandPalette,
  onOpenGoalDialog,
}: DashboardShellHeaderProps) {
  const canEnrichCsvImport =
    Boolean(accountId) &&
    accountId !== ALL_ACCOUNTS_ID &&
    Boolean(currentAccountName) &&
    brokerSupportsMultiCsvImport(currentAccountBroker);

  return (
    <div className="flex flex-col shrink-0">
      <header className="flex h-[3.725rem] shrink-0 items-center gap-1 bg-background dark:bg-sidebar rounded-t-[8px] px-4 sm:px-6 lg:px-8 pr-4 sm:pr-6 min-w-0 overflow-hidden">
        <SidebarTrigger className="h-9 w-9 shrink-0 ring ring-white/5 bg-sidebar hover:bg-sidebar-accent text-white/70 hover:text-white rounded-sm" />
        <button
          onClick={onOpenCommandPalette}
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
          {canEnrichCsvImport && currentAccountName && currentAccountBroker ? (
            <CsvAccountEnrichmentSheet
              accountId={accountId as string}
              accountName={currentAccountName}
              broker={currentAccountBroker}
            />
          ) : null}
          <Button className="cursor-pointer flex transform items-center justify-center gap-2 py-2.5 h-9 transition-all active:scale-95 text-white text-xs hover:!brightness-110 hover:text-white duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent shadow-md whitespace-nowrap">
            {accountId === ALL_ACCOUNTS_ID ? (
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
                <span className="lg:hidden">{connectionBadge.shortLabel}</span>
              </>
            ) : currentAccountIsDemo ? (
              <>
                <FlaskConical className="size-3.5 text-violet-400" />
                <span className="hidden lg:inline">Demo account</span>
                <span className="lg:hidden">Demo</span>
              </>
            ) : currentAccountIsEaSynced ? (
              <>
                <CheckCircle2 className="size-3.5 text-teal-400" />
                <span className="hidden lg:inline">EA-synced account</span>
                <span className="lg:hidden">EA</span>
              </>
            ) : currentAccountSupportsLiveSync ? (
              <>
                <CheckCircle2 className="size-3.5 text-teal-400" />
                <span className="hidden lg:inline">Live-synced account</span>
                <span className="lg:hidden">Live</span>
              </>
            ) : currentAccountIsProp ? (
              <>
                <Trophy className="size-3.5 text-yellow-400" />
                <span className="hidden lg:inline">Prop firm account</span>
                <span className="lg:hidden">Prop</span>
              </>
            ) : (
              <>
                <span className="hidden lg:inline">
                  {currentAccountLastImportedAt
                    ? "Imported account"
                    : "Manual account"}
                </span>
                <span className="lg:hidden">
                  {currentAccountLastImportedAt ? "Imported" : "Manual"}
                </span>
              </>
            )}
          </Button>
        </div>
      </header>

      <Separator />

      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        <Breadcrumb>
          <BreadcrumbList className="text-xs text-secondary dark:text-neutral-400">
            {breadcrumbs.items.map((item, index) => {
              const isLast = index === breadcrumbs.items.length - 1;
              const itemVisibilityClass = isLast ? "" : "hidden md:block";
              return (
                <Fragment key={`${item.label}-${index}`}>
                  <BreadcrumbItem className={itemVisibilityClass}>
                    {isLast ? (
                      <BreadcrumbPage className="font-medium text-secondary dark:text-neutral-200">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href={item.href || "#"}
                        className="hover:text-secondary text-secondary dark:text-neutral-300 font-medium"
                      >
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>

                  {!isLast ? (
                    <BreadcrumbSeparator className={itemVisibilityClass} />
                  ) : null}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        {isAccountsRoute && (
          <AddAccountSheet
            onAccountCreated={() => {}}
            trigger={
              <Button className="cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3 gap-1">
                <Plus className="size-3" />
                <span>Add account</span>
              </Button>
            }
          />
        )}

        {isPropTrackerRoute && (
          <Link href="/dashboard/accounts?tab=prop">
            <Button className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3">
              <Plus className="size-3" />
              <span>Add prop account</span>
            </Button>
          </Link>
        )}

        {isGoalsRoute && (
          <Button
            onClick={onOpenGoalDialog}
            className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3"
          >
            <Plus className="size-3" />
            <span>New goal</span>
          </Button>
        )}

        {isTradesRoute && accountId && (
          <QuickTradeEntry
            accountId={accountId}
            trigger={
              <Button className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3">
                <Plus className="size-3" />
                <span>Add trade </span>
              </Button>
            }
          />
        )}
      </div>

      <Separator />
    </div>
  );
}
