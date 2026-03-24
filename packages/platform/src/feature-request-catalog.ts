export type FeatureRequestSubfeature = {
  id: string;
  label: string;
  routePrefixes?: readonly string[];
};

export type FeatureRequestFeature = {
  id: string;
  label: string;
  routePrefixes?: readonly string[];
  subfeatures?: readonly FeatureRequestSubfeature[];
};

export type FeatureRequestArea = {
  id: string;
  label: string;
  features?: readonly FeatureRequestFeature[];
};

export type FeatureRequestSelection = {
  areaId: string;
  featureId: string | null;
  subfeatureId: string | null;
};

export const FEATURE_REQUEST_CATALOG: readonly FeatureRequestArea[] = [
  {
    id: "analysis",
    label: "Analysis",
    features: [
      {
        id: "dashboard",
        label: "Dashboard",
        routePrefixes: ["/dashboard"],
        subfeatures: [
          { id: "overview-widgets", label: "Overview widgets" },
          { id: "chart-widgets", label: "Chart widgets" },
          { id: "calendar", label: "Calendar" },
          { id: "insights", label: "Insights panel" },
          { id: "economic-calendar", label: "Economic calendar" },
        ],
      },
      {
        id: "trades",
        label: "Trades",
        routePrefixes: ["/dashboard/trades"],
        subfeatures: [
          { id: "data-table", label: "Trades data table" },
          { id: "filters-views", label: "Filters and saved views" },
          { id: "bulk-actions", label: "Bulk actions and floating bar" },
          { id: "trade-details", label: "Trade details" },
        ],
      },
      {
        id: "journal",
        label: "Journal",
        routePrefixes: ["/dashboard/journal"],
        subfeatures: [
          { id: "entries", label: "Entries list" },
          { id: "editor", label: "Journal editor" },
          { id: "insights", label: "Insights tab" },
        ],
      },
      {
        id: "goals",
        label: "Goals",
        routePrefixes: ["/dashboard/goals"],
      },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    features: [
      {
        id: "trading-accounts",
        label: "Trading accounts",
        routePrefixes: ["/dashboard/accounts"],
        subfeatures: [
          { id: "account-list", label: "Account list" },
          { id: "add-import-account", label: "Add or import account" },
          { id: "account-selector", label: "Account selector" },
        ],
      },
      {
        id: "prop-tracker",
        label: "Prop tracker",
        routePrefixes: ["/dashboard/prop-tracker"],
        subfeatures: [
          {
            id: "overview",
            label: "Overview",
            routePrefixes: ["/dashboard/prop-tracker"],
          },
          {
            id: "account-detail",
            label: "Account detail",
            routePrefixes: ["/dashboard/prop-tracker/"],
          },
          {
            id: "simulator",
            label: "Simulator",
            routePrefixes: ["/dashboard/prop-tracker/simulator"],
          },
        ],
      },
    ],
  },
  {
    id: "community",
    label: "Community",
    features: [
      { id: "feed", label: "Feed", routePrefixes: ["/dashboard/feed"] },
      {
        id: "leaderboard",
        label: "Leaderboard",
        routePrefixes: ["/dashboard/leaderboard"],
      },
      {
        id: "achievements",
        label: "Achievements",
        routePrefixes: ["/dashboard/achievements"],
      },
      {
        id: "news",
        label: "News",
        routePrefixes: ["/dashboard/calendar", "/dashboard/news"],
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    features: [
      {
        id: "ai-assistant",
        label: "AI Assistant",
        routePrefixes: ["/assistant", "/dashboard/assistant"],
      },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    features: [
      {
        id: "growth-overview",
        label: "Growth overview",
        routePrefixes: ["/dashboard/growth"],
      },
      {
        id: "referrals",
        label: "Referrals",
        routePrefixes: ["/dashboard/referrals"],
      },
      {
        id: "affiliate",
        label: "Affiliate",
        routePrefixes: ["/dashboard/affiliate"],
      },
      {
        id: "growth-admin",
        label: "Growth admin",
        routePrefixes: ["/dashboard/growth-admin", "/dashboard/beta-access"],
        subfeatures: [
          { id: "beta-codes", label: "Beta codes" },
          { id: "waitlist", label: "Waitlist" },
          { id: "affiliate-ops", label: "Affiliate operations" },
          { id: "payouts", label: "Payouts" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    features: [
      {
        id: "settings-overview",
        label: "Settings overview",
        routePrefixes: ["/dashboard/settings"],
      },
      {
        id: "profile",
        label: "Profile",
        routePrefixes: ["/dashboard/settings/profile"],
      },
      {
        id: "notifications",
        label: "Notifications",
        routePrefixes: ["/dashboard/settings/notifications"],
      },
      {
        id: "connections",
        label: "Connections",
        routePrefixes: ["/dashboard/settings/connections"],
        subfeatures: [
          { id: "available-platforms", label: "Available platforms" },
          { id: "active-connections", label: "Active connections" },
          { id: "terminal-worker", label: "Terminal worker status" },
        ],
      },
      {
        id: "ai-keys",
        label: "AI keys and usage",
        routePrefixes: ["/dashboard/settings/ai"],
        subfeatures: [
          { id: "provider-keys", label: "Provider keys" },
          { id: "usage-analytics", label: "Usage analytics" },
        ],
      },
      {
        id: "billing",
        label: "Billing",
        routePrefixes: ["/dashboard/settings/billing"],
      },
      {
        id: "affiliate-payment-methods",
        label: "Affiliate payout methods",
        routePrefixes: ["/dashboard/settings/billing/payment-methods"],
      },
      {
        id: "support",
        label: "Support",
        routePrefixes: ["/dashboard/settings/support"],
        subfeatures: [
          { id: "diagnostics", label: "Diagnostics" },
          { id: "feedback", label: "Feedback and support" },
        ],
      },
      {
        id: "api",
        label: "API",
        routePrefixes: ["/dashboard/settings/api"],
      },
      {
        id: "ea-setup",
        label: "EA setup",
        routePrefixes: ["/dashboard/settings/ea-setup"],
      },
      {
        id: "alerts",
        label: "Alerts",
        routePrefixes: ["/dashboard/settings/alerts"],
      },
      {
        id: "broker",
        label: "Broker preferences",
        routePrefixes: ["/dashboard/settings/broker"],
      },
      {
        id: "compliance",
        label: "Compliance",
        routePrefixes: ["/dashboard/settings/compliance"],
      },
      {
        id: "metrics",
        label: "Metrics",
        routePrefixes: ["/dashboard/settings/metrics"],
      },
      {
        id: "risk",
        label: "Risk",
        routePrefixes: ["/dashboard/settings/risk"],
      },
      {
        id: "rules",
        label: "Rules",
        routePrefixes: ["/dashboard/settings/rules"],
      },
      {
        id: "tags",
        label: "Tags",
        routePrefixes: ["/dashboard/settings/tags"],
        subfeatures: [
          { id: "session-tags", label: "Session tags" },
          { id: "model-tags", label: "Model tags" },
        ],
      },
      {
        id: "social",
        label: "Social",
        routePrefixes: ["/dashboard/settings/social"],
      },
      {
        id: "timezone",
        label: "Timezone",
        routePrefixes: ["/dashboard/settings/timezone"],
      },
      {
        id: "sessions",
        label: "Sessions",
        routePrefixes: ["/dashboard/settings/sessions"],
      },
    ],
  },
  {
    id: "access",
    label: "Access and onboarding",
    features: [
      { id: "beta-gate", label: "Private beta gate", routePrefixes: ["/"] },
      { id: "login", label: "Login", routePrefixes: ["/login"] },
      { id: "sign-up", label: "Sign up", routePrefixes: ["/sign-up"] },
      {
        id: "onboarding",
        label: "Onboarding",
        routePrefixes: ["/onboarding"],
      },
    ],
  },
  {
    id: "public",
    label: "Public and sharing",
    features: [
      {
        id: "public-profile",
        label: "Public profile",
        routePrefixes: ["/profile/"],
      },
      {
        id: "shared-pages",
        label: "Shared analytics page",
        routePrefixes: ["/share/"],
      },
      {
        id: "verified-pages",
        label: "Verified page",
        routePrefixes: ["/verified/"],
      },
    ],
  },
  {
    id: "new-feature",
    label: "Completely new feature",
  },
];

const DEFAULT_SELECTION: FeatureRequestSelection = {
  areaId: "analysis",
  featureId: "dashboard",
  subfeatureId: null,
};

function normalizePath(pagePath: string | null | undefined) {
  if (!pagePath) return "";
  return pagePath.split("?")[0]?.split("#")[0] ?? "";
}

function pathMatches(pagePath: string, prefix: string) {
  if (prefix.endsWith("/")) {
    return pagePath.startsWith(prefix);
  }

  return pagePath === prefix || pagePath.startsWith(`${prefix}/`);
}

export function getFeatureRequestAreaById(areaId: string | null | undefined) {
  if (!areaId) return null;
  return FEATURE_REQUEST_CATALOG.find((area) => area.id === areaId) ?? null;
}

export function getFeatureRequestFeatureById(
  areaId: string | null | undefined,
  featureId: string | null | undefined
) {
  if (!areaId || !featureId) return null;

  const area = getFeatureRequestAreaById(areaId);
  return area?.features?.find((feature) => feature.id === featureId) ?? null;
}

export function getFeatureRequestSubfeatureById(
  areaId: string | null | undefined,
  featureId: string | null | undefined,
  subfeatureId: string | null | undefined
) {
  if (!areaId || !featureId || !subfeatureId) return null;

  const feature = getFeatureRequestFeatureById(areaId, featureId);
  return (
    feature?.subfeatures?.find((subfeature) => subfeature.id === subfeatureId) ??
    null
  );
}

export function getDefaultFeatureRequestSelection(
  pagePath?: string | null
): FeatureRequestSelection {
  return matchFeatureRequestSelectionFromPath(pagePath) ?? DEFAULT_SELECTION;
}

export function matchFeatureRequestSelectionFromPath(
  pagePath?: string | null
): FeatureRequestSelection | null {
  const normalizedPath = normalizePath(pagePath);

  if (!normalizedPath) {
    return null;
  }

  let bestMatch:
    | (FeatureRequestSelection & {
        prefixLength: number;
      })
    | null = null;

  for (const area of FEATURE_REQUEST_CATALOG) {
    for (const feature of area.features ?? []) {
      for (const prefix of feature.routePrefixes ?? []) {
        if (pathMatches(normalizedPath, prefix)) {
          if (!bestMatch || prefix.length > bestMatch.prefixLength) {
            bestMatch = {
              areaId: area.id,
              featureId: feature.id,
              subfeatureId: null,
              prefixLength: prefix.length,
            };
          }
        }
      }

      for (const subfeature of feature.subfeatures ?? []) {
        for (const prefix of subfeature.routePrefixes ?? []) {
          if (pathMatches(normalizedPath, prefix)) {
            if (!bestMatch || prefix.length > bestMatch.prefixLength) {
              bestMatch = {
                areaId: area.id,
                featureId: feature.id,
                subfeatureId: subfeature.id,
                prefixLength: prefix.length,
              };
            }
          }
        }
      }
    }
  }

  return bestMatch
    ? {
        areaId: bestMatch.areaId,
        featureId: bestMatch.featureId,
        subfeatureId: bestMatch.subfeatureId,
      }
    : null;
}

export function isValidFeatureRequestSelection(selection: FeatureRequestSelection) {
  const area = getFeatureRequestAreaById(selection.areaId);

  if (!area) {
    return false;
  }

  if (selection.areaId === "new-feature") {
    return selection.featureId === null && selection.subfeatureId === null;
  }

  const feature = getFeatureRequestFeatureById(selection.areaId, selection.featureId);

  if (!feature) {
    return false;
  }

  if (!selection.subfeatureId) {
    return true;
  }

  return getFeatureRequestSubfeatureById(
    selection.areaId,
    selection.featureId,
    selection.subfeatureId
  ) !== null;
}

export function getFeatureRequestSelectionLabels(selection: FeatureRequestSelection) {
  const area = getFeatureRequestAreaById(selection.areaId);
  const feature = getFeatureRequestFeatureById(selection.areaId, selection.featureId);
  const subfeature = getFeatureRequestSubfeatureById(
    selection.areaId,
    selection.featureId,
    selection.subfeatureId
  );

  return {
    areaLabel: area?.label ?? null,
    featureLabel: feature?.label ?? null,
    subfeatureLabel: subfeature?.label ?? null,
  };
}

export function getFeatureRequestSelectionLabel(selection: FeatureRequestSelection) {
  const labels = getFeatureRequestSelectionLabels(selection);

  return [labels.areaLabel, labels.featureLabel, labels.subfeatureLabel]
    .filter((value): value is string => Boolean(value))
    .join(" > ");
}
