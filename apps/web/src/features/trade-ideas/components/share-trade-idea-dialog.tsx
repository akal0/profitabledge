"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, ImageIcon, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TradeIdeaCardPreview } from "@/features/trade-ideas/components/trade-idea-card-preview";
import {
  TRADE_IDEA_EXPIRY_OPTIONS,
  TRADE_IDEA_SESSIONS,
  TRADE_IDEA_TIMEFRAMES,
  type TradeIdeaPresentation,
} from "@/features/trade-ideas/lib/trade-idea-utils";
import { trpc } from "@/utils/trpc";

type ShareTradeIdeaDialogProps = {
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ExpiryValue = (typeof TRADE_IDEA_EXPIRY_OPTIONS)[number]["value"];

export function ShareTradeIdeaDialog({
  entryId,
  open,
  onOpenChange,
}: ShareTradeIdeaDialogProps) {
  const utils = trpc.useUtils() as any;
  const draftQuery = trpc.tradeIdeas.getJournalDraft.useQuery(
    { journalEntryId: entryId },
    { enabled: open }
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [session, setSession] = useState("");
  const [customSession, setCustomSession] = useState("");
  const [chartImageUrl, setChartImageUrl] = useState("");
  const [showUsername, setShowUsername] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showRR, setShowRR] = useState(true);
  const [expiry, setExpiry] = useState<ExpiryValue>("never");
  const [shareResult, setShareResult] = useState<null | {
    shareUrl: string;
    sharePath: string;
  }>(null);

  const createMutation = trpc.tradeIdeas.createFromJournal.useMutation({
    onSuccess: async (result) => {
      await utils.tradeIdeas.listMine.invalidate();
      setShareResult({
        sharePath: result.sharePath,
        shareUrl: typeof window === "undefined"
          ? result.shareUrl
          : `${window.location.origin}${result.shareUrl}`,
      });
      toast.success("Trade idea link created");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create trade idea link");
    },
  });

  useEffect(() => {
    if (!open || !draftQuery.data) {
      return;
    }

    setTitle(draftQuery.data.title || "");
    setDescription(draftQuery.data.description || "");
    setTimeframe("");
    setSession("");
    setCustomSession("");
    setChartImageUrl(draftQuery.data.chartImageUrl || "");
    setShowUsername(true);
    setShowPrices(true);
    setShowRR(true);
    setExpiry("never");
    setShareResult(null);
  }, [draftQuery.data, open]);

  const selectedExpiry = useMemo(
    () => TRADE_IDEA_EXPIRY_OPTIONS.find((option) => option.value === expiry),
    [expiry]
  );

  const resolvedSession = session === "Custom" ? customSession.trim() : session;
  const previewIdea = useMemo<TradeIdeaPresentation | null>(() => {
    if (!draftQuery.data?.symbol || !draftQuery.data?.direction) {
      return null;
    }

    return {
      symbol: draftQuery.data.symbol,
      direction: draftQuery.data.direction,
      entryPrice: draftQuery.data.entryPrice,
      stopLoss: draftQuery.data.stopLoss,
      takeProfit: draftQuery.data.takeProfit,
      riskReward: draftQuery.data.riskReward,
      title,
      description,
      strategyName: draftQuery.data.strategyName,
      timeframe: timeframe || null,
      session: resolvedSession || null,
      chartImageUrl: chartImageUrl || null,
      chartImageWidth: draftQuery.data.chartImageWidth,
      chartImageHeight: draftQuery.data.chartImageHeight,
      showUsername,
      showPrices,
      showRR,
      authorDisplayName: draftQuery.data.authorDisplayName,
      authorUsername: draftQuery.data.authorUsername,
      authorAvatarUrl: draftQuery.data.authorAvatarUrl,
      authorBannerUrl: draftQuery.data.authorBannerUrl,
      authorProfileEffects: draftQuery.data.authorProfileEffects,
    };
  }, [
    chartImageUrl,
    description,
    draftQuery.data,
    resolvedSession,
    showPrices,
    showRR,
    showUsername,
    timeframe,
    title,
  ]);

  const handleCopy = async () => {
    if (!shareResult?.shareUrl) return;
    await navigator.clipboard.writeText(shareResult.shareUrl);
    toast.success("Link copied");
  };

  const handleCreate = async () => {
    const input = {
      journalEntryId: entryId,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      timeframe: timeframe || undefined,
      session: resolvedSession || undefined,
      chartImageUrl: chartImageUrl.trim() || undefined,
      showUsername,
      showPrices,
      showRR,
      expiresInHours: selectedExpiry?.hours,
    };

    await createMutation.mutateAsync(input);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label="Share trade idea"
        className="border-white/10 bg-[#090b11] text-white shadow-2xl sm:max-w-[1120px]"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-tight text-white">
            Share as Trade Idea
          </DialogTitle>
          <DialogDescription className="text-white/55">
            Generate a public trade setup page with a rich preview image for Discord, Telegram, and X.
          </DialogDescription>
        </DialogHeader>

        {draftQuery.isLoading ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-10 text-center text-sm text-white/45">
            Preparing your trade idea preview...
          </div>
        ) : draftQuery.error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {draftQuery.error.message}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="space-y-5">
              <section className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/42">
                  <ImageIcon className="size-3.5" />
                  Trade snapshot
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <ReadOnlyField label="Symbol" value={draftQuery.data?.symbol || "Missing"} />
                  <ReadOnlyField
                    label="Direction"
                    value={draftQuery.data?.direction || "Missing"}
                  />
                  <ReadOnlyField
                    label="Entry"
                    value={draftQuery.data?.entryPrice || "-"}
                  />
                  <ReadOnlyField
                    label="Stop loss"
                    value={draftQuery.data?.stopLoss || "-"}
                  />
                  <ReadOnlyField
                    label="Take profit"
                    value={draftQuery.data?.takeProfit || "-"}
                  />
                  <ReadOnlyField
                    label="R:R"
                    value={draftQuery.data?.riskReward || "-"}
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                    Title
                  </Label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/24"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                    Description
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                    className="min-h-[120px] border-white/10 bg-white/[0.04] text-white placeholder:text-white/24"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                      Timeframe
                    </Label>
                    <Select value={timeframe || undefined} onValueChange={setTimeframe}>
                      <SelectTrigger className="w-full border-white/10 bg-white/[0.04] text-white">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#10131b] text-white">
                        {TRADE_IDEA_TIMEFRAMES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                      Session
                    </Label>
                    <Select value={session || undefined} onValueChange={setSession}>
                      <SelectTrigger className="w-full border-white/10 bg-white/[0.04] text-white">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#10131b] text-white">
                        {TRADE_IDEA_SESSIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {session === "Custom" ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                      Custom session label
                    </Label>
                    <Input
                      value={customSession}
                      onChange={(event) => setCustomSession(event.target.value)}
                      placeholder="e.g. London Open"
                      className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/24"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                    Chart image URL
                  </Label>
                  <Input
                    value={chartImageUrl}
                    onChange={(event) => setChartImageUrl(event.target.value)}
                    placeholder="https://..."
                    className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/24"
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                  <ToggleRow
                    label="Show username"
                    description="Display your handle in the embed card and page metadata."
                    checked={showUsername}
                    onCheckedChange={setShowUsername}
                  />
                  <ToggleRow
                    label="Show prices"
                    description="Hide exact entry, stop, and target levels from the preview."
                    checked={showPrices}
                    onCheckedChange={setShowPrices}
                  />
                  <ToggleRow
                    label="Show R:R"
                    description="Display the planned risk-to-reward ratio on the card."
                    checked={showRR}
                    onCheckedChange={setShowRR}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                    Expiry
                  </Label>
                  <Select value={expiry} onValueChange={(value) => setExpiry(value as ExpiryValue)}>
                    <SelectTrigger className="w-full border-white/10 bg-white/[0.04] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#10131b] text-white">
                      {TRADE_IDEA_EXPIRY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleCreate}
                    disabled={
                      createMutation.isPending ||
                      !draftQuery.data?.symbol ||
                      !draftQuery.data?.direction ||
                      !chartImageUrl.trim()
                    }
                    className="h-10 rounded-sm bg-teal-500 text-black hover:bg-teal-400"
                  >
                    <Link2 className="mr-2 size-4" />
                    Create share link
                  </Button>
                </div>

                {shareResult ? (
                  <div className="space-y-3 rounded-2xl border border-teal-500/20 bg-teal-500/8 p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-teal-200/70">
                      Share ready
                    </div>
                    <Input
                      readOnly
                      value={shareResult.shareUrl}
                      className="border-teal-500/20 bg-black/20 text-white"
                    />
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleCopy}
                        className="h-9 rounded-sm bg-white text-black hover:bg-white/90"
                      >
                        <Copy className="mr-2 size-4" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => window.open(shareResult.sharePath, "_blank", "noopener,noreferrer")}
                        className="h-9 rounded-sm border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                      >
                        <ExternalLink className="mr-2 size-4" />
                        Open
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/42">
                <Share2 className="size-3.5" />
                Preview
              </div>
              {previewIdea ? (
                <TradeIdeaCardPreview idea={previewIdea} />
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                  This entry still needs a symbol and direction before it can be shared.
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/34">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs leading-5 text-white/42">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
