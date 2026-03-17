"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { VerticalSeparator } from "@/components/ui/separator";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trpcOptions } from "@/utils/trpc";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import {
  getConnectionBadge,
  pickPreferredAccountConnection,
  type ConnectionRow,
} from "@/features/dashboard-shell/lib/connection-status";
import { getDashboardBreadcrumbs } from "@/features/dashboard-shell/lib/breadcrumbs";
import { useAccountStore, ALL_ACCOUNTS_ID } from "@/stores/account";
import { useFloatingAssistant } from "@/stores/floating-assistant";
import { AIInsightToast } from "@/components/ai-insight-toast";
import { useCommandPalette } from "@/components/command-palette";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { useGoalDialog } from "@/stores/goal-dialog";
import { DashboardShellBootstrap } from "@/features/dashboard-shell/components/dashboard-shell-bootstrap";
import { DashboardShellSidebar } from "@/features/dashboard-shell/components/dashboard-shell-sidebar";
import { DashboardShellHeader } from "@/features/dashboard-shell/components/dashboard-shell-header";
import {
  isAccountScopedRoute,
  queryKeyIncludesAccountId,
  resolveRouteLoadingVariant,
} from "@/features/dashboard-shell/lib/route-loading";
import { useSettingsAccountScopeGuard } from "@/features/dashboard-shell/hooks/use-settings-account-scope-guard";
import { useAssistantShortcut } from "@/features/dashboard-shell/hooks/use-assistant-shortcut";
import { useAlphaPageTracking } from "@/features/platform/alpha/hooks/use-alpha-page-tracking";
import {
  accountIsEaSynced,
  accountSupportsLiveSync,
} from "@/features/accounts/lib/account-metadata";
import {
  meetsRequirement,
  type PlanKey,
} from "@/features/navigation/config/nav-sections";
import { buildLoginPath, buildOnboardingPath } from "@/lib/post-auth-paths";
import { useConfirmedSession } from "@/lib/use-confirmed-session";
import { useAccountTransitionStore } from "@/stores/account-transition";

const PLAN_REQUIRED_ROUTES: Array<{ prefix: string; plan: PlanKey }> = [
  { prefix: "/dashboard/prop-tracker", plan: "professional" },
  { prefix: "/dashboard/copier", plan: "institutional" },
  { prefix: "/assistant", plan: "professional" },
  { prefix: "/backtest", plan: "professional" },
];

const HELD_BACK_COMMUNITY_ROUTE_PREFIXES = [
  "/dashboard/feed",
  "/dashboard/leaderboard",
  "/dashboard/achievements",
  "/dashboard/settings/social",
] as const;

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    isSessionPending,
    hasConfirmedSession,
    hasAttemptedSessionRecovery,
    isRecoveringSession,
  } = useConfirmedSession();
  const pathname = usePathname();
  const safePathname = pathname ?? "/dashboard";
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentDashboardPath = useMemo(() => {
    const query = searchParams?.toString() ?? "";
    return query ? `${safePathname}?${query}` : safePathname;
  }, [safePathname, searchParams]);
  const isSessionReady = !isSessionPending && hasConfirmedSession;

  useEffect(() => {
    if (isSessionPending || isRecoveringSession) {
      return;
    }

    if (!hasConfirmedSession && hasAttemptedSessionRecovery) {
      router.replace(buildLoginPath(currentDashboardPath));
    }
  }, [
    currentDashboardPath,
    hasAttemptedSessionRecovery,
    hasConfirmedSession,
    isRecoveringSession,
    isSessionPending,
    router,
  ]);

  const accountId = useAccountStore((state) => state.selectedAccountId);
  const setSelectedAccountId = useAccountStore(
    (state) => state.setSelectedAccountId
  );
  const { open: openFloatingAssistant } = useFloatingAssistant();
  const { open: openCommandPalette } = useCommandPalette();
  const pendingAccountId = useAccountTransitionStore(
    (state) => state.pendingAccountId
  );
  const transitionStartedAt = useAccountTransitionStore(
    (state) => state.startedAt
  );
  const completeAccountTransition = useAccountTransitionStore(
    (state) => state.completeAccountTransition
  );
  const isJournalRoute = pathname?.startsWith("/dashboard/journal");
  const isAccountsRoute = pathname === "/dashboard/accounts";
  const isGoalsRoute = pathname?.startsWith("/dashboard/goals");
  const isPropTrackerRoute = pathname === "/dashboard/prop-tracker";
  const isTradesRoute = pathname?.startsWith("/dashboard/trades");
  const { setOpen: setGoalDialogOpen } = useGoalDialog();
  const observedPendingFetchRef = useRef<string | null>(null);
  const routeLoadingVariant = useMemo(
    () => resolveRouteLoadingVariant(safePathname),
    [safePathname]
  );
  const routeIsAccountScoped = useMemo(
    () => isAccountScopedRoute(safePathname),
    [safePathname]
  );
  const pendingAccountFetchCount = useIsFetching({
    predicate: (query) =>
      routeIsAccountScoped &&
      queryKeyIncludesAccountId(query.queryKey, pendingAccountId),
  });

  const billingStateQuery = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    enabled: isSessionReady,
  });

  const billingState = billingStateQuery.data;
  const hasFetchedBillingState = billingStateQuery.isFetched;
  const hasIncompleteOnboarding = Boolean(
    billingState && !billingState.onboarding.isComplete
  );
  const canLoadDashboardShellData =
    isSessionReady && hasFetchedBillingState && !hasIncompleteOnboarding;

  const { accounts, isFetched: hasFetchedAccounts } = useAccountCatalog({
    enabled: canLoadDashboardShellData,
  });

  const hasAccounts = accounts.length > 0;
  const hasScopedAccountSelection =
    Boolean(accountId) && accountId !== ALL_ACCOUNTS_ID;
  const isSelectedAccountValid =
    accountId === ALL_ACCOUNTS_ID ||
    (Boolean(accountId) &&
      accounts.some((account) => account.id === accountId));
  const shouldWaitForAccountValidation =
    hasScopedAccountSelection && !hasFetchedAccounts;
  const shouldHoldAccountScopedContent =
    shouldWaitForAccountValidation ||
    (hasScopedAccountSelection &&
      hasFetchedAccounts &&
      !isSelectedAccountValid);

  const resolvedAccountId =
    !shouldHoldAccountScopedContent && isSelectedAccountValid
      ? accountId
      : undefined;

  const currentAccount = accounts.find(
    (account) => account.id === resolvedAccountId
  );

  useEffect(() => {
    if (!hasFetchedAccounts) return;

    if (!hasAccounts) {
      if (hasScopedAccountSelection) setSelectedAccountId(undefined);
      return;
    }

    if (!accountId) {
      setSelectedAccountId(accounts[0].id);
      return;
    }

    if (accountId === ALL_ACCOUNTS_ID) return;

    if (!accounts.some((account) => account.id === accountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [
    accountId,
    accounts,
    hasAccounts,
    hasFetchedAccounts,
    hasScopedAccountSelection,
    setSelectedAccountId,
  ]);

  const { data: rawConnections } = useQuery({
    ...trpcOptions.connections.list.queryOptions(),
    enabled: canLoadDashboardShellData,
  });

  const connections = (rawConnections as ConnectionRow[] | undefined) ?? [];
  const currentAccountConnection =
    resolvedAccountId && resolvedAccountId !== ALL_ACCOUNTS_ID
      ? pickPreferredAccountConnection(connections, resolvedAccountId)
      : null;

  const connectionBadge = getConnectionBadge(currentAccountConnection);
  const breadcrumbs = getDashboardBreadcrumbs(safePathname);
  const hasAdminAccess = billingState?.admin?.isAdmin === true;
  const hasAffiliateAccess = Boolean(
    billingState?.affiliate?.isAffiliate || billingState?.admin?.isAdmin
  );

  const hasBlockedAffiliateAccess = Boolean(
    pathname?.startsWith("/dashboard/affiliate") && !hasAffiliateAccess
  );

  const hasBlockedAdminAccess = Boolean(
    (pathname?.startsWith("/dashboard/beta-access") ||
      pathname?.startsWith("/dashboard/growth-admin")) &&
      !hasAdminAccess
  );
  const hasBlockedCommunityAccess = HELD_BACK_COMMUNITY_ROUTE_PREFIXES.some(
    (prefix) => safePathname.startsWith(prefix)
  );

  const activePlanKey = (billingState?.billing?.activePlanKey ??
    null) as PlanKey | null;
  const hasBlockedPlanAccess = Boolean(
    activePlanKey &&
      safePathname &&
      PLAN_REQUIRED_ROUTES.some(
        (r) =>
          safePathname.startsWith(r.prefix) &&
          !meetsRequirement(activePlanKey, r.plan)
      )
  );

  useAlphaPageTracking("dashboard", hasConfirmedSession && !isRecoveringSession);
  useSettingsAccountScopeGuard({
    pathname: safePathname,
    accountId: resolvedAccountId,
    firstAccountId: accounts[0]?.id,
    setSelectedAccountId,
  });
  useAssistantShortcut(openFloatingAssistant);

  useEffect(() => {
    if (hasIncompleteOnboarding) {
      router.replace(buildOnboardingPath(currentDashboardPath));
    } else if (hasBlockedCommunityAccess) {
      router.replace(
        safePathname.startsWith("/dashboard/settings/")
          ? "/dashboard/settings/profile"
          : "/dashboard"
      );
    } else if (hasBlockedAdminAccess) {
      router.replace("/dashboard/growth");
    } else if (hasBlockedAffiliateAccess) {
      router.replace("/dashboard/referrals");
    } else if (hasBlockedPlanAccess) {
      router.replace("/dashboard/settings/billing");
    }
  }, [
    currentDashboardPath,
    hasIncompleteOnboarding,
    hasBlockedCommunityAccess,
    hasBlockedAdminAccess,
    hasBlockedAffiliateAccess,
    hasBlockedPlanAccess,
    router,
    safePathname,
  ]);

  useEffect(() => {
    if (!pendingAccountId) {
      observedPendingFetchRef.current = null;
      return;
    }

    if (!routeIsAccountScoped) {
      completeAccountTransition();
      return;
    }

    if (pendingAccountFetchCount > 0) {
      observedPendingFetchRef.current = pendingAccountId;
      return;
    }

    if (accountId !== pendingAccountId) {
      return;
    }

    if (observedPendingFetchRef.current === pendingAccountId) {
      completeAccountTransition();
      return;
    }

    const timeout = window.setTimeout(() => {
      const { pendingAccountId: activePendingAccountId } =
        useAccountTransitionStore.getState();

      if (activePendingAccountId === pendingAccountId) {
        useAccountTransitionStore.getState().completeAccountTransition();
      }
    }, Math.max(180 - (Date.now() - (transitionStartedAt ?? Date.now())), 0));

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    accountId,
    completeAccountTransition,
    pendingAccountFetchCount,
    pendingAccountId,
    routeIsAccountScoped,
    transitionStartedAt,
  ]);

  const showAccountTransitionFallback =
    routeIsAccountScoped && Boolean(pendingAccountId);

  if (
    isSessionPending ||
    isRecoveringSession ||
    !hasConfirmedSession ||
    (isSessionReady && !hasFetchedBillingState) ||
    hasIncompleteOnboarding ||
    hasBlockedCommunityAccess ||
    hasBlockedAdminAccess ||
    hasBlockedAffiliateAccess ||
    hasBlockedPlanAccess
  ) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen className="min-h-[100vh] h-full relative">
      <DashboardShellBootstrap />
      <AIInsightToast />
      <DashboardShellSidebar pathname={safePathname} />
      <VerticalSeparator />

      <SidebarInset className="bg-background dark:bg-sidebar py-2 h-full flex flex-col overflow-hidden">
        <DashboardShellHeader
          breadcrumbs={breadcrumbs}
          accountId={resolvedAccountId}
          currentAccountName={currentAccount?.name}
          currentAccountBroker={currentAccount?.broker}
          currentAccountIsProp={currentAccount?.isPropAccount}
          currentAccountIsDemo={currentAccount?.broker === "Profitabledge"}
          currentAccountIsEaSynced={accountIsEaSynced(currentAccount)}
          currentAccountSupportsLiveSync={accountSupportsLiveSync(
            currentAccount
          )}
          currentAccountLastImportedAt={currentAccount?.lastImportedAt}
          connectionBadge={connectionBadge}
          isAccountsRoute={Boolean(isAccountsRoute)}
          isGoalsRoute={Boolean(isGoalsRoute)}
          isPropTrackerRoute={Boolean(isPropTrackerRoute)}
          isTradesRoute={Boolean(isTradesRoute)}
          onOpenCommandPalette={openCommandPalette}
          onOpenGoalDialog={() => setGoalDialogOpen(true)}
        />

        <div
          className={cn(
            "relative flex w-full flex-1 min-h-0 flex-col dark:bg-sidebar",
            isJournalRoute ? "overflow-hidden" : "overflow-y-auto gap-4 pb-12"
          )}
        >
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              showAccountTransitionFallback && "pointer-events-none opacity-0"
            )}
          >
            {shouldHoldAccountScopedContent ? null : children}
          </div>

          {showAccountTransitionFallback ? (
            <div className="absolute inset-0 z-10 flex">
              <RouteLoadingFallback
                route={routeLoadingVariant}
                className="min-h-0 bg-background dark:bg-sidebar"
              />
            </div>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
