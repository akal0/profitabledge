"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { GrowthOverview } from "@/features/growth/components/growth-overview";
import { trpcOptions } from "@/utils/trpc";

export default function GrowthPage() {
  const router = useRouter();
  const billingStateQuery = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    staleTime: 60_000,
  });
  const isAdmin = billingStateQuery.data?.admin?.isAdmin === true;

  useEffect(() => {
    if (billingStateQuery.isLoading || isAdmin) {
      return;
    }

    router.replace("/dashboard/referrals");
  }, [billingStateQuery.isLoading, isAdmin, router]);

  if (billingStateQuery.isLoading) {
    return <RouteLoadingFallback route="growth" className="min-h-[calc(100vh-10rem)]" />;
  }

  if (!isAdmin) {
    return null;
  }

  return <GrowthOverview />;
}
