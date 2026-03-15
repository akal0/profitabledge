"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getAIProviderCatalogItem } from "@/features/settings/ai-keys/lib/ai-provider-catalog";
import type { AIKeyProvider } from "@/features/settings/ai-keys/lib/ai-key-types";

function getProviderCopy(provider: AIKeyProvider) {
  const providerMeta = getAIProviderCatalogItem(provider);

  switch (provider) {
    case "gemini":
      return {
        title: "Google Gemini",
        placeholder: "AIza...",
        helper:
          "Profitabledge validates the key before saving it. Once connected, Gemini-backed AI requests stop spending your Edge credits.",
        sourceUrl: providerMeta?.keySourceUrl ?? null,
        sourceLabel: providerMeta?.keySourceLabel ?? null,
      };
    case "openai":
      return {
        title: "OpenAI",
        placeholder: "sk-...",
        helper:
          "Profitabledge validates the key before saving it. The connector is ready immediately, and OpenAI-backed runtime routing can be enabled without reconnecting later.",
        sourceUrl: providerMeta?.keySourceUrl ?? null,
        sourceLabel: providerMeta?.keySourceLabel ?? null,
      };
    case "anthropic":
      return {
        title: "Anthropic",
        placeholder: "sk-ant-...",
        helper:
          "Profitabledge validates the key before saving it. The connector is ready immediately, and Anthropic-backed runtime routing can be enabled without reconnecting later.",
        sourceUrl: providerMeta?.keySourceUrl ?? null,
        sourceLabel: providerMeta?.keySourceLabel ?? null,
      };
    default:
      return {
        title: provider,
        placeholder: "Enter API key",
        helper: "Paste the API key for this provider",
        sourceUrl: null,
        sourceLabel: null,
      };
  }
}

export function AIProviderKeyDialog({
  provider,
  open,
  isPending,
  existingKeyPrefix,
  onOpenChange,
  onSubmit,
}: {
  provider: AIKeyProvider | null;
  open: boolean;
  isPending: boolean;
  existingKeyPrefix?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (apiKey: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!open) {
      setApiKey("");
      setReveal(false);
    }
  }, [open]);

  if (!provider) {
    return null;
  }

  const copy = getProviderCopy(provider);
  const isUpdating = Boolean(existingKeyPrefix);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-lg"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Sparkles className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">
                {isUpdating ? `Update ${copy.title} key` : `Connect ${copy.title}`}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                {copy.helper}
              </p>
              {copy.sourceUrl && copy.sourceLabel ? (
                <a
                  href={copy.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-[11px] font-medium text-white/45 transition-colors hover:text-white/70"
                >
                  Get a key from {copy.sourceLabel}
                </a>
              ) : null}
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>

          <Separator />

          <div className="space-y-4 px-5 py-4">
            {existingKeyPrefix ? (
              <div className="rounded-sm border border-white/5 bg-sidebar/70 px-3 py-2 text-xs text-white/45">
                Current key prefix: <span className="text-white/70">{existingKeyPrefix}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label className="text-white/80">API key</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={reveal ? "text" : "password"}
                  placeholder={copy.placeholder}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="bg-sidebar-accent border-white/5 text-white"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReveal((current) => !current)}
                  className="h-10 cursor-pointer border border-white/5 bg-sidebar-accent px-3 text-white/60 hover:bg-sidebar hover:text-white"
                >
                  {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-white/35">
                The raw key is encrypted before it is stored and is never shown again in the UI.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-end gap-2 px-5 py-3">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onSubmit(apiKey)}
              disabled={isPending || apiKey.trim().length < 10}
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
            >
              <KeyRound className="size-3.5" />
              {isPending
                ? "Saving..."
                : isUpdating
                ? "Update key"
                : "Connect key"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
