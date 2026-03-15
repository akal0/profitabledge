"use client";

import { useRouter } from "next/navigation";

import {
  Tabs,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";

type BillingSettingsTab = "overview" | "payment-methods";

const BILLING_SETTINGS_TABS: Record<
  BillingSettingsTab,
  { label: string; href: string }
> = {
  overview: {
    label: "Overview",
    href: "/dashboard/settings/billing",
  },
  "payment-methods": {
    label: "Payment methods",
    href: "/dashboard/settings/billing/payment-methods",
  },
};

export function BillingSettingsTabs({
  activeTab,
}: {
  activeTab: BillingSettingsTab;
}) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto px-6 sm:px-8">
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          router.push(
            BILLING_SETTINGS_TABS[value as BillingSettingsTab]?.href ??
              BILLING_SETTINGS_TABS.overview.href
          )
        }
      >
        <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
          {(
            Object.entries(BILLING_SETTINGS_TABS) as Array<
              [BillingSettingsTab, (typeof BILLING_SETTINGS_TABS)[BillingSettingsTab]]
            >
          ).map(([value, tab]) => (
            <TabsTriggerUnderlined
              key={value}
              value={value}
              className="h-10 pb-0 pt-0 text-xs font-medium text-white/40 hover:text-white/75 data-[state=active]:border-white data-[state=active]:text-white"
            >
              {tab.label}
            </TabsTriggerUnderlined>
          ))}
        </TabsListUnderlined>
      </Tabs>
    </div>
  );
}
