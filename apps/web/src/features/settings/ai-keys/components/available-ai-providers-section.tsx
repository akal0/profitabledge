"use client";

import { Cpu, ExternalLink, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AI_PROVIDER_CATALOG } from "@/features/settings/ai-keys/lib/ai-provider-catalog";
import type { AIKeyProvider } from "@/features/settings/ai-keys/lib/ai-key-types";
import { cn } from "@/lib/utils";

export function AvailableAIProvidersSection({
  connectedProviders,
  onConnect,
}: {
  connectedProviders: Set<string>;
  onConnect: (provider: AIKeyProvider) => void;
}) {
  return (
    <>
      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <h2 className="text-sm font-semibold text-white">Available Providers</h2>
        <p className="mt-0.5 text-xs text-white/40">
          Connect the providers you want ready for personal-key AI usage.
        </p>
      </div>

      <Separator />

      {AI_PROVIDER_CATALOG.map((provider, idx) => (
        <div key={provider.id}>
          <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
            <div className="flex items-center gap-3">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${provider.accentColor}20` }}
              >
                <Cpu className="size-4" style={{ color: provider.accentColor }} />
              </div>
              <div>
                <Label className="text-sm font-medium text-white/80">
                  {provider.name}
                </Label>
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-2 px-1.5 py-0 text-[9px]",
                    provider.runtimeStatus === "live"
                      ? "border border-blue-500/20 bg-blue-500/10 text-blue-300"
                      : "border border-white/10 bg-white/5 text-white/45"
                  )}
                >
                  {provider.detail}
                </Badge>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <p className="text-xs text-white/50">{provider.description}</p>
                <p className="text-[11px] text-white/35">
                  {provider.keySourceHint}.{" "}
                  <a
                    href={provider.keySourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-white/55 transition-colors hover:text-white/80"
                  >
                    {provider.keySourceLabel}
                    <ExternalLink className="size-3" />
                  </a>
                </p>
                <p className="text-[11px] text-white/30">
                  {connectedProviders.has(provider.id)
                    ? "A saved key already exists for this provider"
                    : provider.runtimeStatus === "live"
                    ? "Saved keys are encrypted server-side and Gemini-backed requests use them automatically"
                    : "Saved keys are encrypted server-side and stored now so future provider routing can use them without reconnecting"}
                </p>
              </div>

              <Button
                onClick={() => onConnect(provider.id as AIKeyProvider)}
                className={cn(
                  "h-[32px] shrink-0 cursor-pointer px-4 text-xs transition-all duration-250 active:scale-95",
                  provider.id === "gemini"
                    ? "border border-white/5 bg-teal-600/25 text-teal-300 hover:bg-teal-600/35"
                    : provider.id === "openai"
                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                )}
              >
                {connectedProviders.has(provider.id) ? (
                  <>
                    <Sparkles className="mr-1.5 size-3" />
                    Update key
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-1.5 size-3" />
                    Connect
                  </>
                )}
              </Button>
            </div>
          </div>

          {idx < AI_PROVIDER_CATALOG.length - 1 ? <Separator /> : null}
        </div>
      ))}
    </>
  );
}
