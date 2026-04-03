"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEventHandler, type ReactNode } from "react";
import { Copy, ExternalLink, Link2, Loader2, Share2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { journalActionIconButtonClassName } from "@/components/journal/action-button-styles";
import { TradeIdeaCardPreview } from "@/features/trade-ideas/components/trade-idea-card-preview";
import {
  TRADE_IDEA_EXPIRY_OPTIONS,
  TRADE_IDEA_PHASES,
  TRADE_IDEA_SESSIONS,
  TRADE_IDEA_TIMEFRAMES,
  computeRiskReward,
  getTradeIdeaPhaseLabel,
  type TradeIdeaDirection,
  type TradeIdeaPhase,
  type TradeIdeaPresentation,
} from "@/features/trade-ideas/lib/trade-idea-utils";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useUploadThing } from "@/utils/uploadthing";

type QuickTradeIdeaFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ExpiryValue = (typeof TRADE_IDEA_EXPIRY_OPTIONS)[number]["value"];

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;

function getDefaultStageFields(phase: TradeIdeaPhase) {
  if (phase === "post-trade") {
    return ["entryPrice", "stopLoss", "exitPrice", "riskReward"] as const;
  }

  return ["entryPrice", "stopLoss", "takeProfit", "riskReward"] as const;
}

function resolveSessionValue(session: string, customSession: string) {
  return session === "Custom" ? customSession.trim() : session;
}

export function QuickTradeIdeaForm({ open, onOpenChange }: QuickTradeIdeaFormProps) {
  const utils = trpc.useUtils() as any;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<TradeIdeaDirection>("long");
  const [tradePhase, setTradePhase] = useState<TradeIdeaPhase>("pre-trade");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [riskReward, setRiskReward] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [strategyName, setStrategyName] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [session, setSession] = useState("");
  const [customSession, setCustomSession] = useState("");
  const [chartImageUrl, setChartImageUrl] = useState("");
  const [chartImageFile, setChartImageFile] = useState<File | null>(null);
  const [chartImagePreviewUrl, setChartImagePreviewUrl] = useState<string | null>(null);
  const [showUsername, setShowUsername] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showRR, setShowRR] = useState(true);
  const [expiry, setExpiry] = useState<ExpiryValue>("never");
  const [shareResult, setShareResult] = useState<null | {
    shareUrl: string;
    sharePath: string;
  }>(null);

  const {
    startUpload: startChartUpload,
    isUploading: isUploadingChartImage,
  } = useUploadThing((routeRegistry) => routeRegistry.imageUploader);

  const createMutation = trpc.tradeIdeas.createDirect.useMutation({
    onSuccess: async (result) => {
      await utils.tradeIdeas.listMine.invalidate();
      setShareResult({
        sharePath: result.sharePath,
        shareUrl:
          typeof window === "undefined"
            ? result.shareUrl
            : `${window.location.origin}${result.shareUrl}`,
      });
      toast.success("Trade share link created");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create trade share link");
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setSymbol("");
    setDirection("long");
    setTradePhase("pre-trade");
    setEntryPrice("");
    setStopLoss("");
    setTakeProfit("");
    setExitPrice("");
    setRiskReward("");
    setTitle("");
    setDescription("");
    setStrategyName("");
    setTimeframe("");
    setSession("");
    setCustomSession("");
    setChartImageUrl("");
    setChartImageFile(null);
    setChartImagePreviewUrl(null);
    setShowUsername(true);
    setShowPrices(true);
    setShowRR(true);
    setExpiry("never");
    setShareResult(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (chartImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(chartImagePreviewUrl);
      }
    };
  }, [chartImagePreviewUrl]);

  useEffect(() => {
    const nextRiskReward = computeRiskReward({
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
    });

    if (nextRiskReward && tradePhase !== "post-trade") {
      setRiskReward(nextRiskReward);
    }
  }, [direction, entryPrice, stopLoss, takeProfit, tradePhase]);

  const selectedExpiry = useMemo(
    () => TRADE_IDEA_EXPIRY_OPTIONS.find((option) => option.value === expiry),
    [expiry]
  );
  const resolvedSession = resolveSessionValue(session, customSession);
  const fieldKeys = getDefaultStageFields(tradePhase);

  const previewIdea = useMemo<TradeIdeaPresentation | null>(() => {
    if (!symbol.trim()) {
      return null;
    }

    return {
      symbol: symbol.trim().toUpperCase(),
      direction,
      tradePhase,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      riskReward,
      title,
      description,
      strategyName,
      timeframe: timeframe || null,
      session: resolvedSession || null,
      chartImageUrl: chartImagePreviewUrl || chartImageUrl || null,
      showUsername,
      showPrices,
      showRR,
    };
  }, [
    chartImagePreviewUrl,
    chartImageUrl,
    description,
    direction,
    entryPrice,
    exitPrice,
    resolvedSession,
    riskReward,
    showPrices,
    showRR,
    showUsername,
    stopLoss,
    strategyName,
    symbol,
    takeProfit,
    timeframe,
    title,
    tradePhase,
  ]);

  const handleChartImageChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for the trade preview.");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("Preview image must be 8MB or smaller.");
      return;
    }

    if (chartImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(chartImagePreviewUrl);
    }

    setChartImageFile(file);
    setChartImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveUploadedImage = () => {
    if (chartImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(chartImagePreviewUrl);
    }
    setChartImageFile(null);
    setChartImagePreviewUrl(null);
    setChartImageUrl("");
  };

  const uploadChartImageIfNeeded = async () => {
    if (!chartImageFile) {
      return chartImageUrl.trim();
    }

    const uploadResult = await startChartUpload([chartImageFile]);
    const uploadedUrl = uploadResult?.[0]?.ufsUrl ?? uploadResult?.[0]?.url ?? "";
    if (!uploadedUrl) {
      throw new Error("Failed to upload the trade image.");
    }

    setChartImageUrl(uploadedUrl);
    setChartImageFile(null);
    return uploadedUrl;
  };

  const handleCopy = async () => {
    if (!shareResult?.shareUrl) return;
    await navigator.clipboard.writeText(shareResult.shareUrl);
    toast.success("Link copied");
  };

  const handleCreate = async () => {
    if (!symbol.trim()) {
      toast.error("Add a symbol before sharing.");
      return;
    }

    let resolvedChartImageUrl = chartImageUrl.trim();

    try {
      resolvedChartImageUrl = await uploadChartImageIfNeeded();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload the trade image."
      );
      return;
    }

    if (!resolvedChartImageUrl) {
      toast.error("Upload a chart image or paste a chart image URL before sharing.");
      return;
    }

    await createMutation.mutateAsync({
      symbol: symbol.trim().toUpperCase(),
      direction,
      tradePhase,
      entryPrice: entryPrice.trim() || undefined,
      stopLoss: stopLoss.trim() || undefined,
      takeProfit:
        tradePhase === "post-trade" ? undefined : takeProfit.trim() || undefined,
      exitPrice:
        tradePhase === "post-trade" ? exitPrice.trim() || undefined : undefined,
      riskReward: riskReward.trim() || undefined,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      strategyName: strategyName.trim() || undefined,
      timeframe: timeframe || undefined,
      session: resolvedSession || undefined,
      chartImageUrl: resolvedChartImageUrl,
      showUsername,
      showPrices,
      showRR,
      expiresInHours: selectedExpiry?.hours,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-label="Share trade without journal"
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-6xl"
      >
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          <div className="sticky top-0 z-10 flex items-start gap-3 bg-sidebar-accent/80 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Share2 className="size-3.5 text-teal-300" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-medium text-white">
                Share trade without journal
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-white/40">
                Build a public trade page from scratch with a share-ready preview image.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button type="button" className={cn(journalActionIconButtonClassName, "ml-auto size-8")}>
                <X className="size-3.5" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          <Separator />

          <Tabs defaultValue="setup" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="px-5 py-4">
              <TabsList className="h-auto gap-2 rounded-sm border border-white/8 bg-sidebar/70 p-1">
                <TabsTrigger
                  value="setup"
                  className="rounded-sm px-3 py-1.5 text-xs text-white/60 data-[state=active]:bg-sidebar-accent data-[state=active]:text-white"
                >
                  Setup
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="rounded-sm px-3 py-1.5 text-xs text-white/60 data-[state=active]:bg-sidebar-accent data-[state=active]:text-white"
                >
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <Separator />

            <TabsContent value="setup" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-5 px-5 py-5">
              <section className="space-y-4 rounded-sm border border-white/8 bg-sidebar/60 px-4 py-4">
                <div className="text-sm font-medium text-white">Trade setup</div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Stage">
                    <Select
                      value={tradePhase}
                      onValueChange={(value) => setTradePhase(value as TradeIdeaPhase)}
                    >
                      <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-sidebar text-white">
                        {TRADE_IDEA_PHASES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Direction">
                    <Select
                      value={direction}
                      onValueChange={(value) => setDirection(value as TradeIdeaDirection)}
                    >
                      <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-sidebar text-white">
                        <SelectItem value="long">Long</SelectItem>
                        <SelectItem value="short">Short</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Symbol">
                  <Input
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                    placeholder="EURUSD"
                    className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  {fieldKeys.map((fieldKey) => (
                    <TradeNumberField
                      key={fieldKey}
                      fieldKey={fieldKey}
                      value={
                        fieldKey === "entryPrice"
                          ? entryPrice
                          : fieldKey === "stopLoss"
                            ? stopLoss
                            : fieldKey === "takeProfit"
                              ? takeProfit
                              : fieldKey === "exitPrice"
                                ? exitPrice
                                : riskReward
                      }
                      onChange={(value) => {
                        if (fieldKey === "entryPrice") setEntryPrice(value);
                        if (fieldKey === "stopLoss") setStopLoss(value);
                        if (fieldKey === "takeProfit") setTakeProfit(value);
                        if (fieldKey === "exitPrice") setExitPrice(value);
                        if (fieldKey === "riskReward") setRiskReward(value);
                      }}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-4 rounded-sm border border-white/8 bg-sidebar/60 px-4 py-4">
                <div className="text-sm font-medium text-white">Card details</div>
                <Field label="Title">
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                  />
                </Field>

                <Field label="Description">
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                    className="min-h-28 border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                  />
                </Field>

                <Field label="Strategy">
                  <Input
                    value={strategyName}
                    onChange={(event) => setStrategyName(event.target.value)}
                    placeholder="e.g. ICT OTE"
                    className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Timeframe">
                    <Select value={timeframe || undefined} onValueChange={setTimeframe}>
                      <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-sidebar text-white">
                        {TRADE_IDEA_TIMEFRAMES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Session">
                    <Select value={session || undefined} onValueChange={setSession}>
                      <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-sidebar text-white">
                        {TRADE_IDEA_SESSIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {session === "Custom" ? (
                  <Field label="Custom session label">
                    <Input
                      value={customSession}
                      onChange={(event) => setCustomSession(event.target.value)}
                      placeholder="e.g. London open"
                      className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                    />
                  </Field>
                ) : null}

                <Field label="Expiry">
                  <Select value={expiry} onValueChange={(value) => setExpiry(value as ExpiryValue)}>
                    <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-sidebar text-white">
                      {TRADE_IDEA_EXPIRY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </section>

              <section className="space-y-4 rounded-sm border border-white/8 bg-sidebar/60 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">Preview image</div>
                    <p className="mt-1 text-xs leading-relaxed text-white/40">
                      This image is used for the public card preview.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleChartImageChange}
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 rounded-sm border border-white/5 bg-sidebar px-3 text-xs text-white/75 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                  >
                    <Upload className="mr-2 size-3.5" />
                    Upload image
                  </Button>
                </div>

                <Field label="Chart image URL">
                  <Input
                    value={chartImageUrl}
                    onChange={(event) => setChartImageUrl(event.target.value)}
                    placeholder="https://..."
                    className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                  />
                </Field>

                {chartImagePreviewUrl || chartImageUrl ? (
                  <div className="space-y-3 rounded-sm border border-white/8 bg-black/20 p-3">
                    <div className="overflow-hidden rounded-sm border border-white/8 bg-[#0c1018]">
                      <img
                        src={chartImagePreviewUrl || chartImageUrl}
                        alt="Trade preview"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                    {chartImageFile ? (
                      <div className="flex items-center justify-between gap-3 text-xs text-white/45">
                        <div className="truncate">{chartImageFile.name}</div>
                        <Button
                          type="button"
                          onClick={handleRemoveUploadedImage}
                          className="h-7 rounded-sm border border-white/5 bg-sidebar px-2.5 text-xs text-white/70 hover:bg-sidebar-accent hover:text-white"
                        >
                          <X className="mr-1 size-3.5" />
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="space-y-3 rounded-sm border border-white/8 bg-sidebar/60 px-4 py-4">
                <ToggleRow
                  label="Show username"
                  description="Display your handle in the card and page metadata."
                  checked={showUsername}
                  onCheckedChange={setShowUsername}
                />
                <ToggleRow
                  label="Show prices"
                  description="Hide entry, stop, target, and exit levels from the preview."
                  checked={showPrices}
                  onCheckedChange={setShowPrices}
                />
              </section>

              {shareResult ? (
                <section className="space-y-3 rounded-sm border border-teal-500/20 bg-teal-500/8 px-4 py-4">
                  <div className="text-sm font-medium text-teal-100">Share ready</div>
                  <Input
                    readOnly
                    value={shareResult.shareUrl}
                    className="border-teal-500/20 bg-black/20 text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={handleCopy} tone="light">
                      <Copy className="size-3.5" />
                      Copy link
                    </ActionButton>
                    <ActionButton
                      onClick={() => window.open(shareResult.sharePath, "_blank", "noopener,noreferrer")}
                      tone="muted"
                    >
                      <ExternalLink className="size-3.5" />
                      Open
                    </ActionButton>
                  </div>
                </section>
              ) : null}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              <div className="px-5 py-5">
                <div className="flex flex-col gap-4">
                <div>
                  <div className="text-sm font-medium text-white">Preview</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/40">
                    {getTradeIdeaPhaseLabel(tradePhase)} preview with your selected stage, prices, and image.
                  </p>
                </div>

                {previewIdea ? (
                  <TradeIdeaCardPreview idea={previewIdea} />
                ) : (
                  <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Add a symbol to generate the preview card.
                  </div>
                )}
              </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-white/40">
              The image you upload here becomes the public preview image for the share.
            </p>

            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  className="cursor-pointer justify-center rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110"
                >
                  Cancel
                </Button>
              </DialogClose>

              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createMutation.isPending || isUploadingChartImage}
                className="cursor-pointer justify-center gap-2 rounded-sm border border-white/5 bg-white px-3 py-2 text-xs text-black transition-all duration-250 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {createMutation.isPending || isUploadingChartImage ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Creating link...
                  </>
                ) : (
                  <>
                    <Link2 className="size-3.5" />
                    Create share link
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-white/60">{label}</Label>
      {children}
    </div>
  );
}

function TradeNumberField({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: ReturnType<typeof getDefaultStageFields>[number];
  value: string;
  onChange: (value: string) => void;
}) {
  const labels: Record<ReturnType<typeof getDefaultStageFields>[number], string> = {
    entryPrice: "Entry price",
    stopLoss: "Stop loss",
    takeProfit: "Take profit",
    exitPrice: "Exit price",
    riskReward: "Risk to reward",
  };

  return (
    <Field label={labels[fieldKey]}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={fieldKey === "riskReward" ? "1:3" : "1.0842"}
        className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
      />
    </Field>
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
    <div className="flex items-start justify-between gap-4 rounded-sm border border-white/8 bg-black/20 px-3 py-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs leading-5 text-white/42">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  tone: "light" | "muted";
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 gap-2 rounded-sm border px-3 text-xs transition-all duration-250",
        tone === "light"
          ? "border-white/5 bg-white text-black hover:bg-white/90"
          : "border-white/5 bg-sidebar text-white/75 hover:bg-sidebar-accent hover:text-white"
      )}
    >
      {children}
    </Button>
  );
}
