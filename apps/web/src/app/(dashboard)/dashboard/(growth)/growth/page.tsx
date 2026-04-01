"use client";

import { useQuery } from "@tanstack/react-query";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { GrowthOverview } from "@/features/growth/components/growth-overview";
import { trpcOptions } from "@/utils/trpc";

export default function GrowthPage() {
  const billingStateQuery = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    staleTime: 60_000,
  });

  if (billingStateQuery.isLoading) {
    return <RouteLoadingFallback route="growth" className="min-h-[calc(100vh-10rem)]" />;
  }

  return <GrowthOverview />;
}
