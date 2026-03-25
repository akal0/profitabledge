"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  type ConnectionBadge,
  type ConnectionRow,
} from "@/features/dashboard-shell/lib/connection-status";
import {
  getDashboardBreadcrumbs,
  type DashboardBreadcrumbs,
} from "@/features/dashboard-shell/lib/breadcrumbs";
import { useAccountStore, ALL_ACCOUNTS_ID } from "@/stores/account";
import { useFloatingAssistant } from "@/stores/floating-assistant";
import { AIInsightToast } from "@/components/ai-insight-toast";
import { useCommandPalette } from "@/components/command-palette";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { useGoalDialog } from "@/stores/goal-dialog";
import { DashboardShellBootstrap } from "@/features/dashboard-shell/components/dashboard-shell-bootstrap";
import { DashboardShellSidebar } from "@/features/dashboard-shell/components/dashboard-shell-sidebar";
import { DashboardShellHeader } from "@/features/dashboard-shell/components/dashboard-shell-header";
import { useMt5LiveLeaseHeartbeat } from "@/features/settings/connections/lib/mt5-live-lease";
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
  isDemoWorkspaceAccount,
} from "@/features/accounts/lib/account-metadata";
import {
  meetsRequirement,
  type PlanKey,
} from "@/features/navigation/config/nav-sections";
import { isHeldBackDashboardRoute } from "@/features/navigation/lib/held-back-routes";
import { buildLoginPath, buildOnboardingPath } from "@/lib/post-auth-paths";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { useConfirmedSession } from "@/lib/use-confirmed-session";
import { useAccountTransitionStore } from "@/stores/account-transition";
import { OnbordaProvider, useOnborda } from "onborda";
import { DashboardTour } from "@/features/onboarding-tour/dashboard-tour";
import {
  DASHBOARD_TOURS,
  TOUR_ID,
  ADD_ACCOUNT_SHEET_FIRST_STEP,
  ADD_ACCOUNT_SHEET_LAST_STEP,
} from "@/features/onboarding-tour/tour-steps";
import { TourCard } from "@/features/onboarding-tour/tour-card";
import { StableOnborda } from "@/features/onboarding-tour/stable-onborda";
import { useTourStore } from "@/features/onboarding-tour/tour-store";

const SPOTLIGHT_TRANSITION =
  "top 0.2s ease-out, left 0.2s ease-out, right 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out, bottom 0.2s ease-out";

function TourBackdropBlur() {
  const { isOnbordaVisible, currentStep, currentTour } = useOnborda();
  const requestedAddAccountSheetOpen = useTourStore(
    (s) => s.requestedAddAccountSheetOpen
  );
  const guidedSheetTransitionActive = useTourStore(
    (s) => s.guidedSheetTransitionActive
  );
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const isDashboardTourActive = isOnbordaVisible && currentTour === TOUR_ID;
  const isSheetStep =
    isDashboardTourActive &&
    currentStep >= ADD_ACCOUNT_SHEET_FIRST_STEP &&
    currentStep <= ADD_ACCOUNT_SHEET_LAST_STEP;
  const isSidebarTourStep =
    isDashboardTourActive && currentStep > ADD_ACCOUNT_SHEET_LAST_STEP;
  const isSheetPhase =
    isSheetStep || requestedAddAccountSheetOpen || guidedSheetTransitionActive;
  const isSheetAnimationLock = isSheetStep || guidedSheetTransitionActive;

  useEffect(() => {
    document.body.classList.toggle("tour-active", isDashboardTourActive);
    document.body.classList.toggle("tour-sheet-step", isSheetPhase);
    document.body.classList.toggle(
      "tour-sheet-active-step",
      isSheetAnimationLock
    );
    return () => {
      document.body.classList.remove("tour-active");
      document.body.classList.remove("tour-sheet-step");
      document.body.classList.remove("tour-sheet-active-step");
    };
  }, [isDashboardTourActive, isSheetAnimationLock, isSheetPhase]);

  useLayoutEffect(() => {
    if (!isDashboardTourActive || isSheetPhase) {
      setSpotlightRect(null);
      return;
    }

    const tour = DASHBOARD_TOURS.find((t) => t.tour === TOUR_ID);
    const stepDef = tour?.steps[currentStep];

    // All other steps: use the step's selector
    if (!stepDef?.selector) {
      setSpotlightRect(null);
      return;
    }

    const update = () => {
      const element = document.querySelector<HTMLElement>(stepDef.selector);
      if (!element) {
        if (!isSidebarTourStep) {
          setSpotlightRect(null);
        }
        return;
      }

      setSpotlightRect(element.getBoundingClientRect());
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [currentStep, isDashboardTourActive, isSheetPhase, isSidebarTourStep]);

  if (!isDashboardTourActive || typeof document === "undefined") return null;

  const base: React.CSSProperties = {
    position: "fixed",
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",
    backgroundColor: "rgba(5, 5, 7, 0.28)",
    pointerEvents: "none",
    transition: isSidebarTourStep ? "none" : SPOTLIGHT_TRANSITION,
  };

  if (isSheetPhase) {
    return createPortal(
      <div
        style={{
          ...base,
          inset: 0,
          zIndex: 849,
          pointerEvents: "auto",
        }}
      />,
      document.body
    );
  }

  if (isSidebarTourStep && spotlightRect) {
    return null;
  }

  if (!spotlightRect) {
    return createPortal(
      <div style={{ ...base, inset: 0, zIndex: 849 }} />,
      document.body
    );
  }

  const pad = 10;
  const { left, top, right, bottom } = spotlightRect;
  const mh = bottom - top + 2 * pad;

  return createPortal(
    <>
      <div
        style={{
          ...base,
          zIndex: 849,
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(0, top - pad),
        }}
      />
      <div
        style={{
          ...base,
          zIndex: 849,
          top: bottom + pad,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      <div
        style={{
          ...base,
          zIndex: 849,
          top: top - pad,
          left: 0,
          width: Math.max(0, left - pad),
          height: mh,
        }}
      />
      <div
        style={{
          ...base,
          zIndex: 849,
          top: top - pad,
          left: right + pad,
          right: 0,
          height: mh,
        }}
      />
    </>,
    document.body
  );
}

function DashboardOnbordaShell({ children }: { children: React.ReactNode }) {
  const { isOnbordaVisible, currentStep, currentTour } = useOnborda();
  const disablePointerTransition = useTourStore(
    (s) => s.disablePointerTransition
  );
  const requestedAddAccountSheetOpen = useTourStore(
    (s) => s.requestedAddAccountSheetOpen
  );
  const guidedSheetTransitionActive = useTourStore(
    (s) => s.guidedSheetTransitionActive
  );
  const isSheetStep =
    isOnbordaVisible &&
    currentTour === TOUR_ID &&
    currentStep >= ADD_ACCOUNT_SHEET_FIRST_STEP &&
    currentStep <= ADD_ACCOUNT_SHEET_LAST_STEP;
  const isSidebarTourStep =
    isOnbordaVisible &&
    currentTour === TOUR_ID &&
    currentStep > ADD_ACCOUNT_SHEET_LAST_STEP;
  const suppressOverlayForSheet = isSheetStep || guidedSheetTransitionActive;

  const allowInteraction =
    isOnbordaVisible && currentTour === TOUR_ID && suppressOverlayForSheet;

  return (
    <StableOnborda
      steps={DASHBOARD_TOURS}
      interact={allowInteraction}
      suppressOverlay={suppressOverlayForSheet}
      shadowRgb="0,0,0"
      shadowOpacity="0.7"
      cardComponent={TourCard}
      cardTransition={
        disablePointerTransition || isSheetStep || isSidebarTourStep
          ? { duration: 0, ease: "linear" }
          : { duration: 0.2, ease: "easeOut" }
      }
    >
      {children}
    </StableOnborda>
  );
}

function DashboardTourChrome() {
  const { isOnbordaVisible, currentTour } = useOnborda();
  const isStartingDashboardTour = useTourStore(
    (s) => s.isStartingDashboardTour
  );
  const isDashboardTourActive =
    isStartingDashboardTour || (isOnbordaVisible && currentTour === TOUR_ID);

  if (isDashboardTourActive) {
    return null;
  }

  return (
    <>
      <DashboardShellBootstrap />
      <AIInsightToast />
    </>
  );
}

function DashboardMainStage({
  children,
  isJournalRoute,
  isAccountsRoute,
  routeLoadingVariant,
  showAccountTransitionFallback,
  shouldHoldAccountScopedContent,
}: {
  children: React.ReactNode;
  isJournalRoute: boolean;
  isAccountsRoute: boolean;
  routeLoadingVariant: ReturnType<typeof resolveRouteLoadingVariant>;
  showAccountTransitionFallback: boolean;
  shouldHoldAccountScopedContent: boolean;
}) {
  const { isOnbordaVisible, currentTour } = useOnborda();
  const isStartingDashboardTour = useTourStore(
    (s) => s.isStartingDashboardTour
  );
  const isDashboardTourActive =
    isStartingDashboardTour || (isOnbordaVisible && currentTour === TOUR_ID);

  return (
    <div
      className={cn(
        "relative flex w-full flex-1 min-h-0 flex-col dark:bg-sidebar",
        isJournalRoute || isAccountsRoute
          ? "overflow-hidden"
          : "overflow-y-auto gap-4 pb-12"
      )}
    >
      {isDashboardTourActive ? (
        <RouteLoadingFallback
          route="dashboard"
          message="Preparing your onboarding workspace..."
          className="min-h-0 bg-background dark:bg-sidebar"
          animated={false}
        />
      ) : (
        <>
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              showAccountTransitionFallback && "pointer-events-none opacity-0"
            )}
          >
            {shouldHoldAccountScopedContent ? (
              <RouteLoadingFallback
                route={routeLoadingVariant}
                className="min-h-0 bg-background dark:bg-sidebar"
              />
            ) : (
              children
            )}
          </div>

          {showAccountTransitionFallback ? (
            <div className="absolute inset-0 z-10 flex">
              <RouteLoadingFallback
                route={routeLoadingVariant}
                className="min-h-0 bg-background dark:bg-sidebar"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function DashboardContentStage({
  children,
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
  routeLoadingVariant,
  showAccountTransitionFallback,
  shouldHoldAccountScopedContent,
  isJournalRoute,
}: {
  children: React.ReactNode;
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
  routeLoadingVariant: ReturnType<typeof resolveRouteLoadingVariant>;
  showAccountTransitionFallback: boolean;
  shouldHoldAccountScopedContent: boolean;
  isJournalRoute: boolean;
}) {
  const { isOnbordaVisible, currentTour } = useOnborda();
  const isStartingDashboardTour = useTourStore(
    (s) => s.isStartingDashboardTour
  );
  const isDashboardTourActive =
    isStartingDashboardTour || (isOnbordaVisible && currentTour === TOUR_ID);

  if (isDashboardTourActive) {
    return (
      <SidebarInset className="bg-background dark:bg-sidebar py-2 h-full flex flex-col overflow-hidden min-h-screen">
        <RouteLoadingFallback
          route="dashboard"
          message="Preparing your onboarding workspace..."
          className="min-h-0 flex-1 bg-background dark:bg-sidebar"
          animated={false}
        />
      </SidebarInset>
    );
  }

  return (
    <SidebarInset className="bg-background dark:bg-sidebar py-2 h-full flex flex-col overflow-hidden min-h-screen">
      <DashboardShellHeader
        breadcrumbs={breadcrumbs}
        accountId={accountId}
        currentAccountName={currentAccountName}
        currentAccountBroker={currentAccountBroker}
        currentAccountIsProp={currentAccountIsProp}
        currentAccountIsDemo={currentAccountIsDemo}
        currentAccountIsEaSynced={currentAccountIsEaSynced}
        currentAccountSupportsLiveSync={currentAccountSupportsLiveSync}
        currentAccountLastImportedAt={currentAccountLastImportedAt}
        connectionBadge={connectionBadge}
        isAccountsRoute={Boolean(isAccountsRoute)}
        isGoalsRoute={Boolean(isGoalsRoute)}
        isPropTrackerRoute={Boolean(isPropTrackerRoute)}
        isTradesRoute={Boolean(isTradesRoute)}
        onOpenCommandPalette={onOpenCommandPalette}
        onOpenGoalDialog={onOpenGoalDialog}
      />

      <DashboardMainStage
        isJournalRoute={Boolean(isJournalRoute)}
        isAccountsRoute={Boolean(isAccountsRoute)}
        routeLoadingVariant={routeLoadingVariant}
        showAccountTransitionFallback={showAccountTransitionFallback}
        shouldHoldAccountScopedContent={shouldHoldAccountScopedContent}
      >
        {children}
      </DashboardMainStage>
    </SidebarInset>
  );
}

const PLAN_REQUIRED_ROUTES: Array<{ prefix: string; plan: PlanKey }> = [
  { prefix: "/dashboard/prop-tracker", plan: "professional" },
  { prefix: "/assistant", plan: "professional" },
];

const MT5_LIVE_LEASE_SLOTS: Record<PlanKey, number> = {
  student: 0,
  professional: 1,
  institutional: 5,
};

function DashboardGateFallback({
  route,
  message,
}: {
  route: React.ComponentProps<typeof RouteLoadingFallback>["route"];
  message: string;
}) {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-background dark:bg-sidebar">
      <RouteLoadingFallback
        route={route}
        message={message}
        className="min-h-screen w-screen bg-background dark:bg-sidebar"
      />
    </div>
  );
}

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasMounted, setHasMounted] = useState(false);
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

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
  const activePlanKey = (billingState?.billing?.activePlanKey ??
    null) as PlanKey | null;
  const mt5LiveLeaseLimit = activePlanKey
    ? MT5_LIVE_LEASE_SLOTS[activePlanKey]
    : 0;
  const connectionsEnabled = isPublicAlphaFeatureEnabled("connections");
  const mt5IngestionEnabled = isPublicAlphaFeatureEnabled("mt5Ingestion");
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
    hasScopedAccountSelection && !hasFetchedAccounts && accounts.length === 0;
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

  const mt5LeaseConnections =
    (rawConnections as
      | Array<{
          id?: string | null;
          accountId?: string | null;
          provider: string;
          isPaused: boolean;
        }>
      | undefined) ?? [];
  const connections = (rawConnections as ConnectionRow[] | undefined) ?? [];
  const currentAccountConnection =
    resolvedAccountId && resolvedAccountId !== ALL_ACCOUNTS_ID
      ? pickPreferredAccountConnection(connections, resolvedAccountId)
      : null;
  const preferredMt5LeaseConnectionId =
    resolvedAccountId && resolvedAccountId !== ALL_ACCOUNTS_ID
      ? mt5LeaseConnections.find(
          (connection) =>
            connection.accountId === resolvedAccountId &&
            connection.provider === "mt5-terminal" &&
            !connection.isPaused &&
            Boolean(connection.id)
        )?.id
      : undefined;
  useMt5LiveLeaseHeartbeat({
    connections: mt5LeaseConnections,
    enabled:
      canLoadDashboardShellData && connectionsEnabled && mt5IngestionEnabled,
    maxConnectionCount: mt5LiveLeaseLimit,
    preferredConnectionIds: preferredMt5LeaseConnectionId
      ? [preferredMt5LeaseConnectionId]
      : undefined,
    route: safePathname,
  });
  const pathSegments = safePathname.split("/").filter(Boolean);
  const rawEdgeDetailId =
    pathSegments[0] === "dashboard" && pathSegments[1] === "edges"
      ? pathSegments[2] === "my"
        ? pathSegments[3] ?? null
        : pathSegments[2] ?? null
      : null;
  const edgeDetailId =
    rawEdgeDetailId &&
    !["shared", "library", "featured", "my"].includes(rawEdgeDetailId)
      ? rawEdgeDetailId
      : null;
  const edgeDetailQuery = useQuery({
    ...trpcOptions.edges.getDetail.queryOptions({
      edgeId: edgeDetailId ?? "",
    }),
    enabled: canLoadDashboardShellData && Boolean(edgeDetailId),
    retry: false,
  });
  const edgeDetailName =
    (
      edgeDetailQuery.data as
        | {
            edge?: {
              name?: string | null;
            } | null;
          }
        | undefined
    )?.edge?.name ?? null;

  const connectionBadge = getConnectionBadge(currentAccountConnection);
  const currentAccountIsDemo = currentAccount
    ? isDemoWorkspaceAccount(currentAccount)
    : false;
  const baseBreadcrumbs = getDashboardBreadcrumbs(safePathname);
  const breadcrumbs =
    edgeDetailId && baseBreadcrumbs.items.length > 0
      ? {
          items: baseBreadcrumbs.items.map((item, index) =>
            index === baseBreadcrumbs.items.length - 1
              ? {
                  ...item,
                  label: edgeDetailName ?? "Edge detail",
                }
              : item
          ),
        }
      : baseBreadcrumbs;
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
  const hasBlockedCommunityAccess = isHeldBackDashboardRoute(safePathname);

  const hasBlockedPlanAccess = Boolean(
    activePlanKey &&
      safePathname &&
      PLAN_REQUIRED_ROUTES.some(
        (r) =>
          safePathname.startsWith(r.prefix) &&
          !meetsRequirement(activePlanKey, r.plan)
      )
  );

  useAlphaPageTracking(
    "dashboard",
    hasConfirmedSession && !isRecoveringSession
  );
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

  if (!hasMounted) {
    return (
      <DashboardGateFallback
        route="dashboard"
        message="Loading your workspace and plan access..."
      />
    );
  }

  if (isSessionPending || isRecoveringSession) {
    return (
      <DashboardGateFallback
        route="login"
        message="Restoring your session and reopening the workspace..."
      />
    );
  }

  if (!hasConfirmedSession) {
    return (
      <DashboardGateFallback
        route="login"
        message="Session unavailable. Returning you to login..."
      />
    );
  }

  if (isSessionReady && !hasFetchedBillingState) {
    return (
      <DashboardGateFallback
        route="dashboard"
        message="Loading your workspace and plan access..."
      />
    );
  }

  if (hasIncompleteOnboarding) {
    return (
      <DashboardGateFallback
        route="onboarding"
        message="Redirecting you back to onboarding..."
      />
    );
  }

  if (
    hasBlockedCommunityAccess ||
    hasBlockedAdminAccess ||
    hasBlockedAffiliateAccess ||
    hasBlockedPlanAccess
  ) {
    return (
      <DashboardGateFallback
        route="dashboard"
        message="Opening the closest available workspace for this account..."
      />
    );
  }

  return (
    <OnbordaProvider>
      <DashboardOnbordaShell>
        <SidebarProvider defaultOpen className="min-h-[100vh] h-full relative">
          <DashboardTour />
          <TourBackdropBlur />
          <DashboardTourChrome />
          <DashboardShellSidebar pathname={safePathname} />
          <VerticalSeparator />

          <DashboardContentStage
            breadcrumbs={breadcrumbs}
            accountId={resolvedAccountId}
            currentAccountName={currentAccount?.name}
            currentAccountBroker={currentAccount?.broker}
            currentAccountIsProp={currentAccount?.isPropAccount}
            currentAccountIsDemo={currentAccountIsDemo}
            currentAccountIsEaSynced={
              !currentAccountIsDemo && accountIsEaSynced(currentAccount)
            }
            currentAccountSupportsLiveSync={
              !currentAccountIsDemo && accountSupportsLiveSync(currentAccount)
            }
            currentAccountLastImportedAt={currentAccount?.lastImportedAt}
            connectionBadge={connectionBadge}
            isAccountsRoute={Boolean(isAccountsRoute)}
            isGoalsRoute={Boolean(isGoalsRoute)}
            isPropTrackerRoute={Boolean(isPropTrackerRoute)}
            isTradesRoute={Boolean(isTradesRoute)}
            onOpenCommandPalette={openCommandPalette}
            onOpenGoalDialog={() => setGoalDialogOpen(true)}
            routeLoadingVariant={routeLoadingVariant}
            showAccountTransitionFallback={showAccountTransitionFallback}
            shouldHoldAccountScopedContent={shouldHoldAccountScopedContent}
            isJournalRoute={Boolean(isJournalRoute)}
          >
            {children}
          </DashboardContentStage>
        </SidebarProvider>
      </DashboardOnbordaShell>
    </OnbordaProvider>
  );
}
