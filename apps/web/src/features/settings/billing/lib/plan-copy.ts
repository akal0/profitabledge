export type BillingPlanCopySource = {
  accountAllowanceLabel: string;
  includedAiCredits: number;
  includedLiveSyncSlots: number;
  includesPropTracker: boolean;
};

export function formatLiveSyncSlots(slots: number) {
  if (slots <= 0) return "None";
  return `${slots} slot${slots === 1 ? "" : "s"}`;
}

export function getPlanFeatureLines(plan: BillingPlanCopySource) {
  const accountLine =
    plan.accountAllowanceLabel === "Unlimited"
      ? {
          prefix: "",
          accent: "Unlimited accounts",
          suffix: "",
        }
      : plan.accountAllowanceLabel === "Up to 5"
      ? {
          prefix: "Up to ",
          accent: "5 accounts",
          suffix: "",
        }
      : {
          prefix: "",
          accent: "1 manual or CSV account",
          suffix: "",
        };

  return [
    {
      key: "accounts",
      ...accountLine,
      tone: "positive" as const,
      accentTone: "card" as const,
    },
    {
      key: "credits",
      prefix: plan.includedAiCredits > 0 ? "Allowance of " : "",
      accent:
        plan.includedAiCredits > 0
          ? `${new Intl.NumberFormat("en-US").format(
              plan.includedAiCredits
            )} edge credits / mo`
          : "",
      suffix: plan.includedAiCredits > 0 ? "" : "No edge credits included",
      tone:
        plan.includedAiCredits > 0 ? ("positive" as const) : ("muted" as const),
      accentTone:
        plan.includedAiCredits > 0 ? ("card" as const) : ("default" as const),
    },
    {
      key: "live-sync",
      prefix: "",
      accent: "",
      suffix:
        plan.includedLiveSyncSlots > 0
          ? `${formatLiveSyncSlots(plan.includedLiveSyncSlots)} included`
          : "No live sync slots included",
      tone:
        plan.includedLiveSyncSlots > 0
          ? ("positive" as const)
          : ("muted" as const),
      accentTone: "default" as const,
    },
    {
      key: "prop-tracker",
      prefix: "",
      accent: "",
      suffix: plan.includesPropTracker
        ? "Prop tracker included"
        : "Prop tracker not included",
      tone: plan.includesPropTracker
        ? ("positive" as const)
        : ("muted" as const),
      accentTone: "default" as const,
    },
  ];
}
