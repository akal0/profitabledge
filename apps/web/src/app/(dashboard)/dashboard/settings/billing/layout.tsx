"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { BillingSettingsTabs } from "@/features/settings/billing/components/billing-settings-tabs";

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const segment = useSelectedLayoutSegment();

  return (
    <div className="flex w-full flex-col">
      <BillingSettingsTabs
        activeTab={segment === "payment-methods" ? "payment-methods" : "overview"}
      />
      <Separator />
      {children}
    </div>
  );
}
