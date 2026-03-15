"use client";

import React, { useMemo, useState } from "react";
import {
  Gift,
  LifeBuoy,
  Settings,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
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
import {
  NAV_SECTIONS,
  meetsRequirement,
  type NavSection,
  type PlanKey,
} from "@/features/navigation/config/nav-sections";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpcOptions } from "@/utils/trpc";

import NavUser from "@/components/nav-user";
import { useQuery } from "@tanstack/react-query";
import { publicAlphaFlags } from "@/lib/alpha-flags";
import { RequestFeatureDialog } from "@/features/navigation/components/request-feature-dialog";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [createdAccounts, setCreatedAccounts] = useState<Account[]>([]);
  const [requestFeatureOpen, setRequestFeatureOpen] = useState(false);
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
  const activePlan = (billingState?.billing?.activePlanKey ?? null) as PlanKey | null;

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
  const canViewAffiliateDashboard = Boolean(
    billingState?.affiliate?.isAffiliate || billingState?.admin?.isAdmin
  );
  const isAdmin = billingState?.admin?.isAdmin === true;
  const settingsActive =
    pathname === "/dashboard/settings" ||
    pathname?.startsWith("/dashboard/settings/");

  const sections = useMemo(
    () => {
      const growthItems = [
        {
          title: "Growth",
          url: "/dashboard/growth",
          icon: TrendingUp,
        },
        {
          title: "Referrals",
          url: "/dashboard/referrals",
          icon: Gift,
        },
        ...(canViewAffiliateDashboard
          ? [
              {
                title: "Affiliate",
                url: "/dashboard/affiliate",
                icon: Users,
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                title: "Growth admin",
                url: "/dashboard/growth-admin",
                icon: Shield,
              },
            ]
          : []),
      ];
      const dynamicSections: NavSection[] =
        growthItems.length > 0
          ? [
              {
                label: "Growth",
                items: growthItems,
              },
            ]
          : [];

      return [...NAV_SECTIONS, ...dynamicSections].map((section) => ({
        ...section,
        items: section.items.map((item) => {
          const isActive =
            item.url === "/dashboard"
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
    },
    [canViewAffiliateDashboard, isAdmin, pathname]
  );

  return (
    <Sidebar className="px-0 border-none" collapsible="icon" {...props}>
      <SidebarHeader className="h-[3.725rem] p-4 pb-1 pt-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-2.5">
        {accounts.length > 0 ? (
          <AccountSwitcher accounts={accounts} />
        ) : (
          <div className="pt-1">
            <AddAccountSheet
              onAccountCreated={(a: NewAccount) =>
                setCreatedAccounts((prev) => [
                  ...prev.filter((account) => account.id !== a.id),
                  { id: a.id, name: a.name, image: a.image } as Account,
                ])
              }
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

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const disabledByFeature =
                  item.featureFlag !== undefined &&
                  !publicAlphaFlags[item.featureFlag];
                const locked = isLocked(item.planRequirement);
                const planLabel = item.planRequirement
                  ? item.planRequirement.charAt(0).toUpperCase() +
                    item.planRequirement.slice(1)
                  : null;

                const inner = (
                  <SidebarMenuItem className="px-2 py-0.5 flex">
                    <SidebarMenuButton
                      className="flex items-center justify-center gap-3 cursor-pointer"
                      tooltip={locked ? undefined : item.title}
                    >
                      <item.icon
                        className={cn(
                          "stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] size-[18px]",
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
                          "text-xs font-normal transition-all duration-250 min-w-max group-data-[collapsible=icon]:hidden",
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
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );

                if (disabledByFeature) {
                  return (
                    <Tooltip key={item.title}>
                      <TooltipTrigger asChild>
                        <div className="group/navlink flex items-center gap-3 rounded-md transition-all duration-150 bg-transparent h-max min-w-max cursor-not-allowed">
                          {inner}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.disabledTooltip ?? "Coming soon!"}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (locked) {
                  return (
                    <Tooltip key={item.title}>
                      <TooltipTrigger asChild>
                        <Link
                          href="/dashboard/settings/billing"
                          className="group/navlink flex items-center gap-3 rounded-md transition-all duration-150 bg-transparent hover:bg-sidebar-accent dark:hover:bg-sidebar-accent h-max min-w-max cursor-pointer"
                        >
                          {inner}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        Requires {planLabel} plan
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Link
                    href={item.url}
                    key={item.title}
                    className={cn(
                      "group/navlink flex items-center gap-3 rounded-md transition-all duration-150 bg-transparent hover:bg-sidebar-accent dark:hover:bg-sidebar-accent h-max min-w-max cursor-pointer",
                      item.isActive &&
                        "bg-sidebar-accent text-white dark:hover:bg-sidebar-accent"
                    )}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 pt-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-3">
        <div className="mb-3 flex flex-col gap-1">
          <SidebarMenuItem className="px-2 py-0.5 flex">
            <SidebarMenuButton
              className="group/navlink flex items-center justify-start gap-3 text-left cursor-pointer"
              tooltip="Request a feature"
              onClick={() => setRequestFeatureOpen(true)}
            >
              <LifeBuoy className="size-[18px] stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white" />

              <p className="min-w-max text-xs font-normal text-secondary transition-all duration-250 group-hover/navlink:!text-black dark:text-[#8b8b97] dark:group-hover/navlink:!text-white group-data-[collapsible=icon]:hidden">
                Request a feature
              </p>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Link
            href="/dashboard/settings"
            className={cn(
              "group/navlink flex items-center gap-3 rounded-md bg-transparent transition-all duration-150 hover:bg-sidebar-accent dark:hover:bg-sidebar-accent h-max min-w-max cursor-pointer",
              settingsActive &&
                "bg-sidebar-accent text-white dark:hover:bg-sidebar-accent"
            )}
          >
            <SidebarMenuItem className="px-2 py-0.5 flex">
              <SidebarMenuButton
                className="flex items-center justify-center gap-3 cursor-pointer"
                tooltip="Settings"
              >
                <Settings
                  className={cn(
                    "stroke-[#8b8b97] stroke-2 dark:fill-transparent dark:stroke-[#8b8b97] group-hover/navlink:stroke-black dark:group-hover/navlink:stroke-white size-[18px]",
                    settingsActive &&
                      "fill-black dark:fill-transparent dark:stroke-white"
                  )}
                />

                <p
                  className={cn(
                    "text-xs text-secondary dark:text-[#8b8b97] font-normal transition-all duration-250 group-hover/navlink:!text-black dark:group-hover/navlink:!text-white min-w-max group-data-[collapsible=icon]:hidden",
                    settingsActive && "text-black dark:text-white font-medium"
                  )}
                >
                  Settings
                </p>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </Link>
        </div>

        {me && <NavUser user={me} />}

        <RequestFeatureDialog
          open={requestFeatureOpen}
          onOpenChange={setRequestFeatureOpen}
          pagePath={pathname || "/dashboard"}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
