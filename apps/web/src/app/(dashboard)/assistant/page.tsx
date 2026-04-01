"use client";

import { PremiumAssistant } from "@/components/ai/premium-assistant";
import { FeatureGate } from "@/components/feature-gate";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { useQuery } from "@tanstack/react-query";

function AssistantPageContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams?.get("accountId") || undefined;
  const sourcePath = searchParams?.get("sourcePath") || undefined;
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const { data: me } = useQuery(trpcOptions.users.me.queryOptions());

  const activeAccountId = accountId || selectedAccountId;

  return (
    <FeatureGate feature="ai-assistant" requiredPlanKey="professional">
      <div className="flex min-h-0 w-full flex-1">
        <PremiumAssistant
          accountId={activeAccountId}
          userImage={me?.image}
          userName={me?.name}
          className="h-full min-h-0 flex-1 self-stretch"
          contextPathOverride={sourcePath}
        />
      </div>
    </FeatureGate>
  );
}

export default function AssistantPage() {
  if (!isPublicAlphaFeatureEnabled("aiAssistant")) {
    return (
      <AlphaFeatureLocked
        feature="aiAssistant"
        title="Assistant is held back in this alpha"
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-sidebar">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      }
    >
      <AssistantPageContent />
    </Suspense>
  );
}
