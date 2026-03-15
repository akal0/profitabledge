"use client";

import { PremiumAssistant } from "@/components/ai/premium-assistant";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { trpcClient } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import type { Me } from "@/types/user";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";

function AssistantPageContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams?.get("accountId") || undefined;
  const sourcePath = searchParams?.get("sourcePath") || undefined;
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const [me, setMe] = useState<Me | null>(null);

  const activeAccountId = accountId || selectedAccountId;

  useEffect(() => {
    (async () => {
      const data = await trpcClient.users.me.query();
      setMe(data);
    })();
  }, []);

  return (
    <PremiumAssistant
      accountId={activeAccountId}
      userImage={me?.image}
      userName={me?.name}
      className="h-[calc(100vh-12rem)]"
      contextPathOverride={sourcePath}
    />
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
        <div className="flex items-center justify-center h-[calc(100vh-12rem)] bg-sidebar">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      }
    >
      <AssistantPageContent />
    </Suspense>
  );
}
