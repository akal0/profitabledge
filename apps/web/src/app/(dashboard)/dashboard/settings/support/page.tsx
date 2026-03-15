"use client";

import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, Mail, RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { SupportDiagnosticsPanels } from "@/features/settings/support/components/support-diagnostics-panels";
import { SupportFeedbackForm } from "@/features/settings/support/components/support-feedback-form";
import { SupportFlagGrid } from "@/features/settings/support/components/support-flag-grid";
import { SupportRecentEvents } from "@/features/settings/support/components/support-recent-events";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { trpcOptions } from "@/utils/trpc";

export default function SupportSettingsPage() {
  const pathname = usePathname();
  const supportEnabled = isPublicAlphaFeatureEnabled("supportDiagnostics");

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...trpcOptions.operations.getSupportSnapshot.queryOptions(),
    enabled: supportEnabled,
    staleTime: 30_000,
  });

  if (!supportEnabled) {
    return (
      <AlphaFeatureLocked
        feature="supportDiagnostics"
        title="Support diagnostics are held back in this alpha"
      />
    );
  }

  return (
    <main className="space-y-4 p-6 py-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-sidebar/70 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Badge className="mb-3 border-white/15 bg-white/5 text-white/70">
            Alpha support
          </Badge>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-white/5 text-white">
              <LifeBuoy className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Support and diagnostics</h1>
              <p className="mt-1 text-sm text-white/55">
                One place for alpha flags, sync diagnostics, milestone tracking, and feedback history.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {data?.supportEmail ? (
            <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              <a href={`mailto:${data.supportEmail}`}>
                <Mail className="size-4" />
                {data.supportEmail}
              </a>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-6 text-sm text-white/55">
          Loading support snapshot…
        </div>
      ) : (
        <>
          <SupportFlagGrid flags={data.flags} />
          <SupportDiagnosticsPanels snapshot={data} />
          <SupportFeedbackForm
            pagePath={pathname || "/dashboard/settings/support"}
            onSubmitted={async () => refetch()}
          />
          <SupportRecentEvents snapshot={data} />
        </>
      )}
    </main>
  );
}
