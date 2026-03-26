"use client";

import React, { useMemo, useState } from "react";
import { Bug, LifeBuoy, Lightbulb, Plus, Settings } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenu,
} from "@/components/ui/sidebar";
import AccountSwitcher, {
  type Account,
} from "@/features/accounts/components/account-selector";
import type { NewAccount } from "@/features/accounts/components/add-account-sheet";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddAccountSheet } from "@/features/accounts/components/add-account-sheet";
import { getAccountImage } from "@/features/accounts/lib/account-metadata";
import { Button } from "@/components/ui/button";
import {
  getNavSections,
  meetsRequirement,
  type PlanKey,
} from "@/features/navigation/config/nav-sections";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpcOptions } from "@/utils/trpc";
import { useOnborda } from "onborda";
import {
  TOUR_ID,
  TOUR_STEP_URLS,
  ADD_ACCOUNT_SHEET_FIRST_STEP,
  ADD_ACCOUNT_SHEET_LAST_STEP,
  SHEET_OPTION_BY_STEP,
} from "@/features/onboarding-tour/tour-steps";
import { useTourStore } from "@/features/onboarding-tour/tour-store";

import NavUser from "@/components/nav-user";
import { useQuery } from "@tanstack/react-query";
import { publicAlphaFlags } from "@/lib/alpha-flags";
import { RequestFeatureDialog } from "@/features/navigation/components/request-feature-dialog";
import { ReportBugDialog } from "@/features/navigation/components/report-bug-dialog";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [createdAccounts, setCreatedAccounts] = useState<Account[]>([]);
  const [requestFeatureOpen, setRequestFeatureOpen] = useState(false);
  const [reportBugOpen, setReportBugOpen] = useState(false);
  const [emptyStateAddAccountSheetOpen, setEmptyStateAddAccountSheetOpen] =
    useState(false);
  const requestedAddAccountSheetOpen = useTourStore(
    (s) => s.requestedAddAccountSheetOpen
  );
  const setRequestedAddAccountSheetOpen = useTourStore(
    (s) => s.setRequestedAddAccountSheetOpen
  );
  const { accounts: fetchedAccounts } = useAccountCatalog();
  const { data: me } = useQuery({
    ...trpcOptions.users.me.queryOptions(),
    staleTime: 300_000,
  });
  const { data: billingState } = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    staleTime: 60_000,
  });
  // null while loading — don't lock anything until we know the plan
  const activePlan = (billingState?.billing?.activePlanKey ??
    null) as PlanKey | null;

  function isLocked(requirement?: PlanKey): boolean {
    if (!requirement || activePlan === null) return false;
    return !meetsRequirement(activePlan, requirement);
  }
  const accounts = useMemo(() => {
    const mappedAccounts = fetchedAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      image: getAccountImage(account),
      broker: account.broker,
      brokerType: account.brokerType ?? null,
      brokerServer: account.brokerServer ?? null,
      accountNumber: account.accountNumber ?? null,
      isVerified: account.isVerified ?? null,
      verificationLevel: account.verificationLevel ?? null,
      lastSyncedAt: account.lastSyncedAt ?? null,
      lastImportedAt: account.lastImportedAt ?? null,
    }));

    if (createdAccounts.length === 0) {
      return mappedAccounts;
    }

    const mergedAccounts = new Map<string, Account>();
    for (const account of mappedAccounts) {
      mergedAccounts.set(account.id, account);
    }
    for (const account of createdAccounts) {
      mergedAccounts.set(account.id, account);
    }

    return Array.from(mergedAccounts.values());
  }, [createdAccounts, fetchedAccounts]);

  const pathname = usePathname();
  const { isOnbordaVisible, currentStep, currentTour } = useOnborda();
  const isDashboardTourActive = isOnbordaVisible && currentTour === TOUR_ID;
  const isAddAccountSheetStep =
    isDashboardTourActive &&
    currentStep >= ADD_ACCOUNT_SHEET_FIRST_STEP &&
    currentStep <= ADD_ACCOUNT_SHEET_LAST_STEP;
  const isSidebarTourStep =
    isDashboardTourActive && currentStep > ADD_ACCOUNT_SHEET_LAST_STEP;
  const isTourDrivingAddAccountSheet =
    requestedAddAccountSheetOpen || isAddAccountSheetStep;
  const shouldKeepEmptyStateSheetHost =
    isTourDrivingAddAccountSheet && fetchedAccounts.length === 0;
  const shouldShowAccountSwitcher =
    accounts.length > 0 && !shouldKeepEmptyStateSheetHost;
  const showTourAddAccountTrigger =
    shouldShowAccountSwitcher &&
    isDashboardTourActive &&
    currentStep <= ADD_ACCOUNT_SHEET_LAST_STEP;
  const highlightedTourOption = isAddAccountSheetStep
    ? SHEET_OPTION_BY_STEP[currentStep]
    : undefined;
  React.useEffect(() => {
    if (!isDashboardTourActive || currentStep > ADD_ACCOUNT_SHEET_LAST_STEP) {
      setRequestedAddAccountSheetOpen(false);
    }
  }, [currentStep, isDashboardTourActive, setRequestedAddAccountSheetOpen]);
  const tourActiveUrl = isDashboardTourActive
    ? TOUR_STEP_URLS[currentStep] ?? null
    : null;
  const canViewAffiliateDashboard = Boolean(
    billingState?.affiliate?.isAffiliate || billingState?.admin?.isAdmin
  );
  const canViewGrowthOverview = billingState?.admin?.isAdmin === true;
  const settingsActive =
    pathname === "/dashboard/settings" ||
    pathname?.startsWith("/dashboard/settings/");
  const navItemButtonClass = cn(
    "group/navlink flex items-center justify-start gap-3 group-data-[collapsible=icon]:justify-center",
    isSidebarTourStep && "transition-none"
  );
  const footerItemButtonClass = cn(
    "group/navlink flex items-center justify-start gap-3 cursor-pointer rounded-md bg-transparent hover:bg-sidebar-accent dark:hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center",
    isSidebarTourStep ? "transition-none" : "transition-all duration-150"
  );

  const sections = useMemo(() => {
    return getNavSections(
      canViewAffiliateDashboard,
      canViewGrowthOverview
    ).map((section) => ({
      ...section,
      items: section.items.map((item) => {
        const isActive =
          tourActiveUrl !== null
            ? item.url === tourActiveUrl
            : item.url === "/dashboard"
            ? pathname === item.url
            : item.url === "/dashboard/settings"
            ? pathname === "/dashboard/settings" ||
              pathname?.startsWith("/dashboard/settings/")
            : item.url === "/dashboard/growth"
            ? pathname === item.url
            : item.url === "/dashboard/growth-admin"
            ? pathname === item.url
            : pathname?.startsWith(item.url);
        return { ...item, isActive };
      }),
    }));
  }, [canViewAffiliateDashboard, canViewGrowthOverview, pathname, tourActiveUrl]);

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="min-h-[3.725rem] p-4 pb-1 pt-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-2.5">
        {shouldShowAccountSwitcher ? (
          <div className="flex w-full flex-col gap-2 pt-1">
            <AccountSwitcher accounts={accounts} />
            {showTourAddAccountTrigger ? (
              <Button
                data-onborda="add-account-trigger"
                className="ring-1 ring-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-3 transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250"
                onClick={() => {
                  setRequestedAddAccountSheetOpen(true);
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <Plus className="size-3.5" />
                  <span className="truncate">Add an account</span>
                </div>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="pt-1">
            <AddAccountSheet
              onAccountCreated={(a: NewAccount) =>
                setCreatedAccounts((prev) => [
                  ...prev.filter((account) => account.id !== a.id),
                  { id: a.id, name: a.name, image: a.image } as Account,
                ])
              }
              open={
                isTourDrivingAddAccountSheet || emptyStateAddAccountSheetOpen
              }
              onOpenChange={(open) => {
                if (!isTourDrivingAddAccountSheet) {
                  setEmptyStateAddAccountSheetOpen(open);
                }
              }}
              contentClassName={
                isTourDrivingAddAccountSheet ? "!z-[860]" : undefined
              }
              highlightedOption={highlightedTourOption}
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-4 py-2 overflow-y-auto">
        {sections.map((section) => (
          <div
            key={section.label}
            className="mb-3 group-data-[collapsible=icon]:mb-0"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 mb-1.5 group-data-[collapsible=icon]:hidden">
              {section.label}
            </p>

            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const disabledByFeature =
                  item.featureFlag !== undefined &&
                  !publicAlphaFlags[item.featureFlag];
                const locked = isLocked(item.planRequirement);
                const planLabel = item.planRequirement
                  ? item.planRequirement.charAt(0).toUpperCase() +
                    item.planRequirement.slice(1)
                  : null;

                const itemContent = (
                  <>
                    <item.icon
                      className={cn(
                        "stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] size-[18px]",
                        isSidebarTourStep
                          ? "transition-none"
                          : "transition-all duration-250",
                        locked
                          ? "opacity-35"
                          : "group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white",
                        !locked &&
                          item.isActive &&
                          "fill-black dark:fill-transparent dark:stroke-white"
                      )}
                    />
                    <p
                      className={cn(
                        "text-xs font-normal min-w-max group-data-[collapsible=icon]:hidden",
                        isSidebarTourStep
                          ? "transition-none"
                          : "transition-all duration-250",
                        locked || disabledByFeature
                          ? "text-[#8b8b97] opacity-35"
                          : "text-secondary dark:text-[#8b8b97] group-hover/navlink:!text-black dark:group-hover/navlink:!text-white",
                        !locked &&
                          !disabledByFeature &&
                          item.isActive &&
                          "text-black dark:text-white font-medium"
                      )}
                    >
                      {item.title}
                    </p>
                  </>
                );

                const onbordaId = `nav-${
                  item.url.replace(/^\//, "").replace(/\//g, "-") || "dashboard"
                }`;

                if (disabledByFeature) {
                  return (
                    <SidebarMenuItem
                      key={item.title}
                      className="px-2 py-0.5 flex"
                      data-onborda={onbordaId}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            className={cn(
                              navItemButtonClass,
                              "cursor-not-allowed"
                            )}
                          >
                            <div>{itemContent}</div>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {item.disabledTooltip ?? "Coming soon!"}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                }

                if (locked) {
                  return (
                    <SidebarMenuItem
                      key={item.title}
                      className="px-2 py-0.5 flex"
                      data-onborda={onbordaId}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            className={cn(navItemButtonClass, "cursor-pointer")}
                          >
                            <Link href="/dashboard/settings/billing">
                              {itemContent}
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          Requires {planLabel} plan
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem
                    key={item.title}
                    className="px-2 py-0.5 flex"
                    data-onborda={onbordaId}
                  >
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className={cn(
                        navItemButtonClass,
                        "cursor-pointer",
                        item.isActive &&
                          "bg-sidebar-accent text-white dark:hover:bg-sidebar-accent"
                      )}
                    >
                      <Link href={item.url}>{itemContent}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 pt-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-3">
        <div className="mb-3 flex flex-col gap-1">
          <SidebarMenuItem className="px-2 py-0.5 flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className={footerItemButtonClass}
                  tooltip="Support"
                >
                  <LifeBuoy className="size-[18px] stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white" />

                  <p className="text-xs text-secondary dark:text-[#8b8b97] font-normal transition-all duration-250 group-hover/navlink:!text-black dark:group-hover/navlink:!text-white min-w-max group-data-[collapsible=icon]:hidden">
                    Support
                  </p>
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-64 rounded-sm border border-white/5 bg-sidebar p-1"
              >
                <DropdownMenuItem
                  onSelect={() => {
                    window.setTimeout(() => setRequestFeatureOpen(true), 0);
                  }}
                  className="cursor-pointer gap-2 rounded-sm px-3 py-2 text-white/80 focus:bg-white/10 focus:text-white"
                >
                  <Lightbulb className="size-4 text-white/45" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white">
                      Request a feature
                    </span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => {
                    window.setTimeout(() => setReportBugOpen(true), 0);
                  }}
                  className="cursor-pointer gap-2 rounded-sm px-3 py-2 text-white/80 focus:bg-white/10 focus:text-white"
                >
                  <Bug className="size-4 text-white/45" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white">
                      Report a bug
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>

          <SidebarMenuItem className="px-2 py-0.5 flex">
            <SidebarMenuButton
              asChild
              className={cn(
                footerItemButtonClass,
                settingsActive &&
                  "bg-sidebar-accent text-white dark:hover:bg-sidebar-accent"
              )}
              tooltip="Settings"
            >
              <Link href="/dashboard/settings/profile">
                <Settings
                  className={cn(
                    "stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white size-[18px]",
                    settingsActive &&
                      "fill-black dark:fill-transparent dark:stroke-white"
                  )}
                />

                <p
                  className={cn(
                    "text-xs text-secondary dark:text-[#8b8b97] font-normal group-hover/navlink:!text-black dark:group-hover/navlink:!text-white min-w-max group-data-[collapsible=icon]:hidden",
                    isSidebarTourStep
                      ? "transition-none"
                      : "transition-all duration-250",
                    settingsActive && "text-black dark:text-white font-medium"
                  )}
                >
                  Settings
                </p>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </div>

        {me && <NavUser user={me} />}

        <RequestFeatureDialog
          open={requestFeatureOpen}
          onOpenChange={setRequestFeatureOpen}
          pagePath={pathname || "/dashboard"}
        />
        <ReportBugDialog
          open={reportBugOpen}
          onOpenChange={setReportBugOpen}
          pagePath={pathname || "/dashboard"}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
