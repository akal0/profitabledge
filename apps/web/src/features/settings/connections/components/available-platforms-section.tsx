"use client";

import { AlertCircle, ExternalLink, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ConnectionProviderDefinition } from "@/features/settings/connections/lib/connection-types";
import { cn } from "@/lib/utils";

export function AvailablePlatformsSection({
  providers,
  onProviderClick,
  mt5IngestionEnabled,
}: {
  providers: ConnectionProviderDefinition[];
  onProviderClick: (provider: ConnectionProviderDefinition) => void;
  mt5IngestionEnabled: boolean;
}) {
  const getStatusLabel = (provider: ConnectionProviderDefinition) => {
    if (provider.status === "coming_soon") return "Coming soon";
    if (provider.status === "not_applicable") return "Use broker";
    return "Alpha";
  };

  return (
    <>
      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <h2 className="text-sm font-semibold text-white">
          Supported platforms
        </h2>
        <p className="mt-0.5 text-xs text-white/40">
          Connect a platform that is enabled for the current alpha.
        </p>
      </div>

      <Separator />

      {providers.map((provider, idx) => (
        <div key={provider.id}>
          <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
            <div className="flex items-center gap-3">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${provider.color}20` }}
              >
                <Globe className="size-4" style={{ color: provider.color }} />
              </div>
              <div>
                <Label className="text-sm font-medium text-white/80">
                  {provider.name}
                </Label>
                <Badge
                  variant="secondary"
                  className="px-2 py-0.5 bg-sidebar-accent ring ring-white/5 text-[9px]"
                >
                  {getStatusLabel(provider)}
                </Badge>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <p className="text-xs text-white/50">{provider.description}</p>
                {provider.betaNote ? (
                  <p className="text-[11px] text-amber-200/80">
                    {provider.betaNote}
                  </p>
                ) : null}
                {provider.note ? (
                  <p className="text-[11px] text-sky-200/80">{provider.note}</p>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {provider.firms.map((firm) => (
                    <span
                      key={firm}
                      className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40"
                    >
                      {firm}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => onProviderClick(provider)}
                disabled={provider.status === "not_applicable"}
                className={cn(
                  "h-[32px] shrink-0 cursor-pointer px-4 text-xs transition-all duration-250 active:scale-95",
                  provider.status === "coming_soon"
                    ? "ring ring-white/10 bg-white/5 text-white/45 hover:bg-white/5"
                    : provider.status === "not_applicable"
                      ? "ring ring-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/10"
                    : "ring ring-teal-500/50 bg-teal-600/25 text-teal-300 hover:bg-teal-600/35"
                )}
              >
                {provider.status !== "coming_soon" &&
                provider.authType === "oauth" ? (
                  <ExternalLink className=" size-3" />
                ) : null}
                {provider.status === "coming_soon"
                  ? "Coming soon"
                  : provider.status === "not_applicable"
                    ? "Use broker"
                    : "Connect"}
              </Button>
            </div>
          </div>

          {idx < providers.length - 1 ? <Separator /> : null}
        </div>
      ))}

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="flex gap-3 rounded-md border border-blue-500/20 bg-blue-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
          <div>
            <p className="mb-1 text-sm font-medium text-blue-300">
              EA bridge recommended
            </p>
            <p className="text-xs text-white/50">
              {mt5IngestionEnabled
                ? "For MT5/MT4, use the EA bridge (Settings → EA Setup) for 70+ advanced metrics that API sync cannot capture."
                : "For this Vercel-only beta, keep MT5 on the EA bridge path (Settings → EA Setup). Hosted MT5 terminal sync is held back until the worker stack is enabled."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
