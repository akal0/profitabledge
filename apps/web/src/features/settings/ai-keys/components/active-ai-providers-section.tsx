"use client";

import { CheckCircle2, KeyRound, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getAIProviderCatalogItem } from "@/features/settings/ai-keys/lib/ai-provider-catalog";
import type { AIKeyProvider, AIKeyRow } from "@/features/settings/ai-keys/lib/ai-key-types";
import { cn } from "@/lib/utils";

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function ActiveAIProvidersSection({
  keys,
  deletingProvider,
  onReplace,
  onDelete,
}: {
  keys: AIKeyRow[] | undefined;
  deletingProvider: AIKeyProvider | null;
  onReplace: (provider: AIKeyProvider) => void;
  onDelete: (provider: AIKeyProvider) => void;
}) {
  return (
    <>
      <div className="px-6 py-5 sm:px-8">
        <h2 className="text-sm font-semibold text-white">Connected Providers</h2>
        <p className="mt-0.5 text-xs text-white/40">
          Personal keys take priority over plan-funded Edge credits for supported AI calls.
        </p>
      </div>

      <Separator />

      {keys && keys.length > 0 ? (
        keys.map((key, idx) => {
          const providerMeta = getAIProviderCatalogItem(key.provider);
          const usageCopy =
            providerMeta?.runtimeStatus === "live"
              ? "Used automatically for Gemini-backed assistant and journal AI calls"
              : "Validated and stored now so it is ready when multi-provider routing is enabled";

          return (
            <div key={key.id}>
              <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
                <div>
                  <Label className="text-sm font-medium text-white/80">
                    {key.displayName}
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-300">
                      Connected
                    </Badge>
                    {providerMeta ? (
                      <Badge
                        className={cn(
                          "border text-[10px]",
                          providerMeta.runtimeStatus === "live"
                            ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
                            : "border-white/10 bg-white/5 text-white/45"
                        )}
                      >
                        {providerMeta.detail}
                      </Badge>
                    ) : null}
                    <span className="text-[10px] text-white/35">{key.keyPrefix}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-400" />
                      Validated {formatDateTime(key.lastValidatedAt)}
                    </span>
                    <span>Last used {formatDateTime(key.lastUsedAt)}</span>
                  </div>

                  <p className="text-xs text-white/35">{usageCopy}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => onReplace(key.provider)}
                      className={cn(
                        "h-[32px] cursor-pointer px-4 text-xs transition-all duration-250 active:scale-95",
                        key.provider === "gemini"
                          ? "border border-white/5 bg-teal-600/25 text-teal-300 hover:bg-teal-600/35"
                          : key.provider === "openai"
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          : "border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      )}
                    >
                      <KeyRound className="mr-1.5 size-3" />
                      Replace key
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => onDelete(key.provider)}
                      disabled={deletingProvider === key.provider}
                      className="h-[32px] cursor-pointer px-3 text-xs text-white/45 hover:text-rose-300"
                    >
                      <Trash2 className="mr-1.5 size-3" />
                      {deletingProvider === key.provider ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                </div>
              </div>
              {idx < keys.length - 1 ? <Separator /> : null}
            </div>
          );
        })
      ) : (
        <div className="px-6 py-8 sm:px-8">
          <div className="flex flex-col items-center text-center">
            <Sparkles className="mb-2 size-8 text-white/20" />
            <p className="text-sm text-white/40">No personal AI keys connected</p>
            <p className="mt-1 max-w-md text-xs text-white/25">
              Add your own provider keys below if you want supported AI requests to run on your own account instead of spending Edge credits.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
