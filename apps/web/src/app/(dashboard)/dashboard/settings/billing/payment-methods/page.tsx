"use client";

import { Separator } from "@/components/ui/separator";
import { AffiliatePaymentMethodsSection } from "@/features/settings/billing/components/affiliate-payment-methods-section";

export default function BillingPaymentMethodsPage() {
  return (
    <div className="flex w-full flex-col">
      <div className="px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.04em] text-white">
            Payment methods
          </h1>
          <p className="text-base font-medium tracking-[-0.04em] text-white/40 sm:text-sm">
            Manage the payout details attached to your affiliate account
          </p>
        </div>
      </div>

      <Separator />

      <AffiliatePaymentMethodsSection />
    </div>
  );
}
