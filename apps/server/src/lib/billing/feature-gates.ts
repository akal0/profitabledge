import { BILLING_PLAN_TIER, type BillingPlanKey } from "./config";

export const BILLING_PAYWALL_PATTERNS = [
  "blur_overlay",
  "lock_icon",
  "usage_meter",
  "teaser_preview",
  "soft_nudge",
  "hard_gate",
] as const;

export type BillingPaywallPattern = (typeof BILLING_PAYWALL_PATTERNS)[number];

export type BillingPlanLimitKey =
  | "accounts"
  | "importedTradesPerMonth"
  | "dashboardWidgets"
  | "liveSyncSlots"
  | "journalStorageMb"
  | "shareablePerformanceLinks"
  | "customAlertRules"
  | "journalTemplates"
  | "apiReadKeys"
  | "apiWriteKeys"
  | "reportsPerMonth"
  | "propAccounts"
  | "aiCredits";

export type BillingFeatureKey =
  | "multi-account"
  | "live-sync"
  | "historical-backfill"
  | "prop-tracker"
  | "custom-prop-firms"
  | "monte-carlo"
  | "ai-assistant"
  | "ai-trade-insights"
  | "journal-ai"
  | "advanced-analytics"
  | "advanced-execution-metrics"
  | "advanced-filters"
  | "reports"
  | "exports"
  | "shareable-performance-links"
  | "custom-alerts"
  | "priority-sync"
  | "api-read"
  | "api-write"
  | "community-feed";

type PlanLimitValue = number | "unlimited";

export const BILLING_PLAN_LIMITS: Record<
  BillingPlanKey,
  Record<BillingPlanLimitKey, PlanLimitValue>
> = {
  student: {
    accounts: 1,
    importedTradesPerMonth: 300,
    dashboardWidgets: 6,
    liveSyncSlots: 0,
    journalStorageMb: 250,
    shareablePerformanceLinks: 0,
    customAlertRules: 0,
    journalTemplates: 0,
    apiReadKeys: 0,
    apiWriteKeys: 0,
    reportsPerMonth: 0,
    propAccounts: 0,
    aiCredits: 30,
  },
  professional: {
    accounts: 5,
    importedTradesPerMonth: "unlimited",
    dashboardWidgets: 16,
    liveSyncSlots: 1,
    journalStorageMb: 5_000,
    shareablePerformanceLinks: 3,
    customAlertRules: 5,
    journalTemplates: 10,
    apiReadKeys: 0,
    apiWriteKeys: 0,
    reportsPerMonth: 20,
    propAccounts: 3,
    aiCredits: 300,
  },
  institutional: {
    accounts: "unlimited",
    importedTradesPerMonth: "unlimited",
    dashboardWidgets: 16,
    liveSyncSlots: 5,
    journalStorageMb: 25_000,
    shareablePerformanceLinks: "unlimited",
    customAlertRules: 25,
    journalTemplates: "unlimited",
    apiReadKeys: 1,
    apiWriteKeys: 1,
    reportsPerMonth: "unlimited",
    propAccounts: "unlimited",
    aiCredits: 1_500,
  },
};

export type BillingFeatureGateDefinition = {
  key: BillingFeatureKey;
  label: string;
  category: string;
  requiredPlanKey: BillingPlanKey;
  paywallPattern: BillingPaywallPattern;
  upgradeCta: string;
  summary: string;
};

export const BILLING_FEATURE_GATES: Record<
  BillingFeatureKey,
  BillingFeatureGateDefinition
> = {
  "multi-account": {
    key: "multi-account",
    label: "Multi-account workspace",
    category: "accounts",
    requiredPlanKey: "professional",
    paywallPattern: "usage_meter",
    upgradeCta: "Unlock more accounts ->",
    summary: "Free users can build the habit on one account; paid plans unlock portfolio-level review.",
  },
  "live-sync": {
    key: "live-sync",
    label: "Live broker sync",
    category: "connections",
    requiredPlanKey: "professional",
    paywallPattern: "usage_meter",
    upgradeCta: "Enable live sync ->",
    summary: "Real-time connectivity is a clear paid-value moment across trading tools.",
  },
  "historical-backfill": {
    key: "historical-backfill",
    label: "Historical sync backfill",
    category: "connections",
    requiredPlanKey: "professional",
    paywallPattern: "soft_nudge",
    upgradeCta: "Backfill account history ->",
    summary: "Backfilling years of trades is a heavier sync workflow best reserved for paid accounts.",
  },
  "prop-tracker": {
    key: "prop-tracker",
    label: "Prop tracker",
    category: "prop",
    requiredPlanKey: "professional",
    paywallPattern: "lock_icon",
    upgradeCta: "Track your challenge ->",
    summary: "Prop-firm tracking is a top upgrade driver for funded and challenge traders.",
  },
  "custom-prop-firms": {
    key: "custom-prop-firms",
    label: "Custom prop firms",
    category: "prop",
    requiredPlanKey: "institutional",
    paywallPattern: "hard_gate",
    upgradeCta: "Create custom rules ->",
    summary: "Custom rule frameworks are advanced enough to sit on the highest solo tier.",
  },
  "monte-carlo": {
    key: "monte-carlo",
    label: "Monte Carlo simulations",
    category: "prop",
    requiredPlanKey: "institutional",
    paywallPattern: "blur_overlay",
    upgradeCta: "Run pass simulations ->",
    summary: "Simulation and scenario tooling mirrors premium analytics packaging in the category.",
  },
  "ai-assistant": {
    key: "ai-assistant",
    label: "AI Assistant",
    category: "ai",
    requiredPlanKey: "professional",
    paywallPattern: "teaser_preview",
    upgradeCta: "Unlock AI coaching ->",
    summary: "AI is the cleanest upgrade trigger because value is easy to preview and meter.",
  },
  "ai-trade-insights": {
    key: "ai-trade-insights",
    label: "AI trade insights",
    category: "ai",
    requiredPlanKey: "professional",
    paywallPattern: "teaser_preview",
    upgradeCta: "Generate insights ->",
    summary: "AI-generated insights should feel premium but still usage-metered rather than hidden forever.",
  },
  "journal-ai": {
    key: "journal-ai",
    label: "Journal AI analysis",
    category: "journal",
    requiredPlanKey: "professional",
    paywallPattern: "teaser_preview",
    upgradeCta: "Analyze your journal ->",
    summary: "Keep core journaling free; charge for interpretation, summaries, and pattern extraction.",
  },
  "advanced-analytics": {
    key: "advanced-analytics",
    label: "Advanced analytics",
    category: "analytics",
    requiredPlanKey: "professional",
    paywallPattern: "blur_overlay",
    upgradeCta: "See the full analytics stack ->",
    summary: "Basic stats stay free, but deeper analysis is a durable reason to pay every month.",
  },
  "advanced-execution-metrics": {
    key: "advanced-execution-metrics",
    label: "Execution quality metrics",
    category: "analytics",
    requiredPlanKey: "institutional",
    paywallPattern: "blur_overlay",
    upgradeCta: "Unlock elite execution metrics ->",
    summary: "Spread, slippage, efficiency, and volatility diagnostics align with the highest-value segment.",
  },
  "advanced-filters": {
    key: "advanced-filters",
    label: "Advanced trade filters",
    category: "trades",
    requiredPlanKey: "professional",
    paywallPattern: "soft_nudge",
    upgradeCta: "Use advanced filters ->",
    summary: "Search and basic filters should stay free; segmenting by model, protocol, and edge is paid value.",
  },
  reports: {
    key: "reports",
    label: "Reports workspace",
    category: "analytics",
    requiredPlanKey: "professional",
    paywallPattern: "lock_icon",
    upgradeCta: "Open reports ->",
    summary: "Dedicated reporting pages and packaged reviews are a natural step above dashboard basics.",
  },
  exports: {
    key: "exports",
    label: "CSV and PDF exports",
    category: "reports",
    requiredPlanKey: "professional",
    paywallPattern: "hard_gate",
    upgradeCta: "Export your data ->",
    summary: "Export is a standard paid boundary across journaling and analytics SaaS.",
  },
  "shareable-performance-links": {
    key: "shareable-performance-links",
    label: "Shareable performance links",
    category: "reports",
    requiredPlanKey: "professional",
    paywallPattern: "usage_meter",
    upgradeCta: "Share verified results ->",
    summary: "Public proof and investor-style sharing create value once a trader has consistent results.",
  },
  "custom-alerts": {
    key: "custom-alerts",
    label: "Custom alerts and digests",
    category: "alerts",
    requiredPlanKey: "professional",
    paywallPattern: "soft_nudge",
    upgradeCta: "Create alert rules ->",
    summary: "Rules, digests, and alerting are habit-forming retention features worth monetizing.",
  },
  "priority-sync": {
    key: "priority-sync",
    label: "Priority sync queue",
    category: "connections",
    requiredPlanKey: "institutional",
    paywallPattern: "soft_nudge",
    upgradeCta: "Upgrade sync capacity ->",
    summary: "Highest-tier traders feel value from faster live updates and more connected accounts.",
  },
  "api-read": {
    key: "api-read",
    label: "Read-only API access",
    category: "data",
    requiredPlanKey: "institutional",
    paywallPattern: "hard_gate",
    upgradeCta: "Enable API access ->",
    summary: "API access is powerful, niche, and better suited to the highest-value cohort.",
  },
  "api-write": {
    key: "api-write",
    label: "Write API access",
    category: "data",
    requiredPlanKey: "institutional",
    paywallPattern: "hard_gate",
    upgradeCta: "Unlock automation ->",
    summary: "Write access changes platform risk and belongs on the most controlled tier.",
  },
  "community-feed": {
    key: "community-feed",
    label: "Community feed",
    category: "social",
    requiredPlanKey: "professional",
    paywallPattern: "soft_nudge",
    upgradeCta: "Join the community feed ->",
    summary: "Social layers should be discoverable for free but monetized once users want deeper participation.",
  },
};

export function canAccessBillingFeature(
  currentPlanKey: BillingPlanKey,
  featureKey: BillingFeatureKey
) {
  const gate = BILLING_FEATURE_GATES[featureKey];
  return BILLING_PLAN_TIER[currentPlanKey] >= BILLING_PLAN_TIER[gate.requiredPlanKey];
}

export function getBillingFeatureGateDefinition(featureKey: BillingFeatureKey) {
  return BILLING_FEATURE_GATES[featureKey];
}

export function getBillingPlanLimit(
  planKey: BillingPlanKey,
  limitKey: BillingPlanLimitKey
) {
  return BILLING_PLAN_LIMITS[planKey][limitKey];
}

export function formatBillingPlanLimitValue(value: PlanLimitValue) {
  return value === "unlimited" ? "Unlimited" : `${value}`;
}
