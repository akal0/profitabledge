"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Plus,
  Sparkles,
} from "lucide-react";

import type { MediaFile } from "@/components/media/media-dropzone";
import { ManualTradeCapturePreview } from "@/components/trades/manual-workspace/manual-trade-capture-preview";
import { TradeDateTimeField } from "@/components/trades/trade-date-time-field";
import { QuickTradeEntryNotesMedia } from "@/components/trades/quick-trade-entry-notes-media";
import {
  TRADE_ACTION_BUTTON_CLASS,
  TRADE_ACTION_BUTTON_PRIMARY_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
} from "@/components/trades/trade-identifier-pill";
import { persistQuickTradeEntryArtifacts } from "@/components/trades/quick-trade-entry-artifacts";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import type { JournalBlock } from "@/components/journal/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  formatSizingNumber,
  getEstimatedPipSize,
  mergeManualTradeSizingPreferences,
  resolveManualTradeSizing,
  type ManualTradeSizingPreferences,
} from "@/lib/manual-trade-sizing";
import {
  COMMON_SYMBOLS,
  MANUAL_MARKET_OPTIONS,
  buildMarketSizingProfile,
  createDefaultTradeWindow,
  createRoundedNow,
  formatAssetClassLabel,
  formatHoldDuration,
  formatMarketTypeLabel,
  formatVolumeInputValue,
  getSymbolPlaceholder,
  inferMarketTypeFromSymbol,
  numberToInputValue,
  parseNumberInput,
  parsePositiveNumberInput,
  type ManualTradeMarketType,
} from "@/lib/manual-workspace/manual-trade-entry-shared";
import {
  parseManualTradeCapture,
  parseManualTradeCaptureBulk,
} from "@/lib/manual-workspace/manual-trade-capture";
import type {
  ManualTradeCaptureParseResult,
  ManualTradeCaptureResult,
} from "@/lib/manual-workspace/manual-trade-capture-types";
import { formatCurrencyValue } from "@/lib/trade-formatting";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trpcClient, trpcOptions } from "@/utils/trpc";

interface QuickTradeEntryProps {
  accountId: string;
  onTradeCreated?: (trade: {
    id: string;
    symbol: string;
    profit: number;
  }) => void;
  trigger?: React.ReactNode;
}

type NamedTradeTag = {
  name: string;
  color: string;
};

type WorkspaceTab = "single" | "capture" | "bulk" | "open";
type EntryMode = "closed" | "open";

type ManualOpenTradeRow = {
  id: string;
  ticket: string | null;
  symbol: string | null;
  tradeType: "long" | "short";
  volume: number;
  openPrice: number;
  currentPrice: number | null;
  profit: number;
  commission: number;
  swap: number;
  openTime: string | null;
  sl: number | null;
  tp: number | null;
  sessionTag: string | null;
  comment: string | null;
  modelTag: string | null;
  customTags: string[];
};

function SuggestionChips({
  suggestions,
  activeValue,
  onSelect,
}: {
  suggestions: string[];
  activeValue: string;
  onSelect: (value: string) => void;
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {suggestions.map((suggestion) => {
        const isActive =
          suggestion.trim().toLowerCase() === activeValue.trim().toLowerCase();

        return (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelect(suggestion)}
            className={cn(
              TRADE_IDENTIFIER_PILL_CLASS,
              isActive
                ? TRADE_IDENTIFIER_TONES.info
                : TRADE_IDENTIFIER_TONES.neutral,
              "min-h-6 cursor-pointer px-2 py-0.5 text-[10px]"
            )}
          >
            {suggestion}
          </button>
        );
      })}
    </div>
  );
}

function journalBlocksFromPlainText(text: string): JournalBlock[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  return [
    {
      id: crypto.randomUUID(),
      type: "paragraph",
      content: trimmed,
    },
  ];
}

function extractCaptureRows(
  result: ManualTradeCaptureParseResult | null
): ManualTradeCaptureResult[] {
  if (!result) return [];
  return result.kind === "bulk" ? result.rows : [result];
}

export function QuickTradeEntry({
  accountId,
  onTradeCreated,
  trigger,
}: QuickTradeEntryProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("single");
  const [entryMode, setEntryMode] = useState<EntryMode>("closed");
  const [activeOpenTradeId, setActiveOpenTradeId] = useState<string | null>(
    null
  );
  const [manualMarketType, setManualMarketType] =
    useState<ManualTradeMarketType>("auto");

  const [symbol, setSymbol] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [tradeType, setTradeType] = useState<"long" | "short">("long");
  const [volume, setVolume] = useState("0.1");
  const [openPrice, setOpenPrice] = useState("");
  const [closePrice, setClosePrice] = useState("");
  const [openTime, setOpenTime] = useState(() => {
    return createDefaultTradeWindow().openTime;
  });
  const [closeTime, setCloseTime] = useState(() => {
    return createDefaultTradeWindow().closeTime;
  });
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [profit, setProfit] = useState("");
  const [commissions, setCommissions] = useState("");
  const [swap, setSwap] = useState("");
  const [sessionTag, setSessionTag] = useState("");
  const [modelTag, setModelTag] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [noteContent, setNoteContent] = useState<JournalBlock[]>([]);
  const [noteHtml, setNoteHtml] = useState("");
  const [pendingMediaFiles, setPendingMediaFiles] = useState<MediaFile[]>([]);
  const [noteEditorKey, setNoteEditorKey] = useState(0);
  const [autoCalculateProfit, setAutoCalculateProfit] = useState(true);
  const [openTradeComment, setOpenTradeComment] = useState("");
  const [captureInput, setCaptureInput] = useState("");
  const [captureResult, setCaptureResult] =
    useState<ManualTradeCaptureParseResult | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResult, setBulkResult] =
    useState<ManualTradeCaptureParseResult | null>(null);
  const previousSizingDefaultRef = useRef<string | null>(null);

  const recentSymbolsQuery = useQuery({
    ...trpcOptions.trades.listSymbols.queryOptions({ accountId }),
    enabled: open,
    staleTime: 30_000,
  });
  const sessionTagsQuery = useQuery({
    ...trpcOptions.trades.listSessionTags.queryOptions({ accountId }),
    enabled: open,
    staleTime: 30_000,
  });
  const modelTagsQuery = useQuery({
    ...trpcOptions.trades.listModelTags.queryOptions({ accountId }),
    enabled: open,
    staleTime: 30_000,
  });
  const customTagsQuery = useQuery({
    ...trpcOptions.trades.listCustomTags.queryOptions({ accountId }),
    enabled: open,
    staleTime: 30_000,
  });
  const advancedPrefsQuery = useQuery({
    ...trpcOptions.users.getAdvancedMetricsPreferences.queryOptions(),
    enabled: open,
    staleTime: 30_000,
  });
  const manualOpenTradesQuery = useQuery({
    ...trpcOptions.trades.listManualOpenTrades.queryOptions({ accountId }),
    enabled: open,
    staleTime: 10_000,
    refetchInterval: open ? 10_000 : false,
  });

  const recentSymbols = useMemo(
    () => (recentSymbolsQuery.data as string[] | undefined) ?? [],
    [recentSymbolsQuery.data]
  );
  const sessionTagSuggestions = useMemo(
    () => (sessionTagsQuery.data as NamedTradeTag[] | undefined) ?? [],
    [sessionTagsQuery.data]
  );
  const modelTagSuggestions = useMemo(
    () => (modelTagsQuery.data as NamedTradeTag[] | undefined) ?? [],
    [modelTagsQuery.data]
  );
  const customTagSuggestions = useMemo(
    () => (customTagsQuery.data as string[] | undefined) ?? [],
    [customTagsQuery.data]
  );
  const manualOpenTrades = useMemo(
    () => (manualOpenTradesQuery.data as ManualOpenTradeRow[] | undefined) ?? [],
    [manualOpenTradesQuery.data]
  );

  const symbolOptions = useMemo(() => {
    const ordered = [...COMMON_SYMBOLS, ...recentSymbols];
    const seen = new Set<string>();
    const result: string[] = [];

    for (const raw of ordered) {
      const nextValue = raw.trim().toUpperCase();
      if (!nextValue || seen.has(nextValue)) continue;
      seen.add(nextValue);
      result.push(nextValue);
    }

    return result;
  }, [recentSymbols]);
  const filteredSymbolOptions = useMemo(() => {
    const matchingOptions =
      manualMarketType === "auto"
        ? symbolOptions
        : symbolOptions.filter(
            (option) => inferMarketTypeFromSymbol(option) === manualMarketType
          );

    if (
      symbol &&
      symbol !== "custom" &&
      !matchingOptions.includes(symbol.toUpperCase())
    ) {
      return [symbol.toUpperCase(), ...matchingOptions];
    }

    return matchingOptions;
  }, [manualMarketType, symbol, symbolOptions]);

  const effectiveSymbol =
    symbol === "custom" ? customSymbol.trim().toUpperCase() : symbol;
  const manualTradeSizing = useMemo(
    () =>
      (
        advancedPrefsQuery.data as
          | { manualTradeSizing?: ManualTradeSizingPreferences }
          | undefined
      )?.manualTradeSizing ?? {},
    [advancedPrefsQuery.data]
  );
  const mergedSizingProfiles = useMemo(
    () => mergeManualTradeSizingPreferences(manualTradeSizing),
    [manualTradeSizing]
  );
  const marketSizing = useMemo(
    () => buildMarketSizingProfile(manualMarketType, mergedSizingProfiles),
    [manualMarketType, mergedSizingProfiles]
  );
  const symbolSizing = useMemo(
    () =>
      effectiveSymbol
        ? resolveManualTradeSizing(effectiveSymbol, manualTradeSizing)
        : null,
    [effectiveSymbol, manualTradeSizing]
  );
  const resolvedSizing = useMemo(() => {
    if (!symbolSizing) {
      return marketSizing;
    }

    if (
      symbol === "custom" &&
      manualMarketType !== "auto" &&
      symbolSizing.assetClass === "other"
    ) {
      return marketSizing;
    }

    return symbolSizing;
  }, [manualMarketType, marketSizing, symbol, symbolSizing]);
  const customSymbolNeedsResolution = Boolean(
    symbol === "custom" &&
      effectiveSymbol &&
      symbolSizing &&
      symbolSizing.assetClass === "other"
  );
  const sizingContextLabel = useMemo(() => {
    if (resolvedSizing === marketSizing) {
      return manualMarketType === "auto"
        ? "Forex"
        : formatMarketTypeLabel(manualMarketType);
    }

    return formatAssetClassLabel(resolvedSizing.assetClass);
  }, [manualMarketType, marketSizing, resolvedSizing]);
  const volumeHint = useMemo(() => {
    if (customSymbolNeedsResolution) {
      return manualMarketType === "auto"
        ? "Use a recognizable symbol so the exact pip and contract sizing can be calculated."
        : `${formatMarketTypeLabel(
            manualMarketType
          )} sizing is active until the custom symbol resolves to a more specific market.`;
    }

    if (!effectiveSymbol && manualMarketType === "futures") {
      return "Choose a contract symbol to apply the exact contract size.";
    }

    if (!effectiveSymbol && manualMarketType === "commodities") {
      return "Choose a spot symbol to refine the contract size for metals or energy.";
    }

    return null;
  }, [customSymbolNeedsResolution, effectiveSymbol, manualMarketType]);
  const customSymbolPlaceholder = useMemo(
    () => getSymbolPlaceholder(manualMarketType),
    [manualMarketType]
  );
  const volumeQuickSizes = useMemo(
    () =>
      resolvedSizing.profile.quickSizes.map((size) =>
        formatVolumeInputValue(size)
      ),
    [resolvedSizing.profile.quickSizes]
  );

  useEffect(() => {
    const nextDefault = formatVolumeInputValue(
      resolvedSizing.profile.defaultVolume
    );

    setVolume((current) => {
      const trimmed = current.trim();
      if (!trimmed) {
        return nextDefault;
      }

      const previousDefault = previousSizingDefaultRef.current;
      const numericValue = Number(trimmed);
      const belowMinimum =
        Number.isFinite(numericValue) &&
        numericValue < resolvedSizing.profile.minVolume;

      if (trimmed === previousDefault || belowMinimum) {
        return nextDefault;
      }

      return current;
    });

    previousSizingDefaultRef.current = nextDefault;
  }, [
    effectiveSymbol,
    resolvedSizing.profile.defaultVolume,
    resolvedSizing.profile.minVolume,
  ]);

  const parsedVolume = useMemo(
    () => parsePositiveNumberInput(volume),
    [volume]
  );
  const parsedOpenPrice = useMemo(
    () => parsePositiveNumberInput(openPrice),
    [openPrice]
  );
  const parsedClosePrice = useMemo(
    () => parsePositiveNumberInput(closePrice),
    [closePrice]
  );
  const parsedSl = useMemo(() => parseNumberInput(sl), [sl]);
  const parsedTp = useMemo(() => parseNumberInput(tp), [tp]);
  const parsedProfit = useMemo(() => parseNumberInput(profit), [profit]);
  const parsedCommission = useMemo(
    () => parseNumberInput(commissions),
    [commissions]
  );
  const parsedSwap = useMemo(() => parseNumberInput(swap), [swap]);
  const closeReferenceTime = useMemo(
    () => (entryMode === "open" ? createRoundedNow() : closeTime),
    [closeTime, entryMode]
  );
  const timeOrderValid =
    entryMode === "open"
      ? closeReferenceTime.getTime() > openTime.getTime()
      : closeTime.getTime() > openTime.getTime();

  const estimatedProfit = useMemo(() => {
    if (!autoCalculateProfit) return null;
    if (!effectiveSymbol || !parsedOpenPrice || !parsedVolume) {
      return null;
    }
    if (customSymbolNeedsResolution) {
      return null;
    }

    if (entryMode === "open" && !parsedClosePrice) {
      return 0;
    }

    if (!parsedClosePrice) {
      return null;
    }

    const priceDiff =
      tradeType === "long"
        ? parsedClosePrice - parsedOpenPrice
        : parsedOpenPrice - parsedClosePrice;

    return priceDiff * parsedVolume * resolvedSizing.profile.contractSize;
  }, [
    autoCalculateProfit,
    entryMode,
    effectiveSymbol,
    parsedClosePrice,
    customSymbolNeedsResolution,
    parsedOpenPrice,
    parsedVolume,
    resolvedSizing.profile.contractSize,
    tradeType,
  ]);

  const effectiveProfit = autoCalculateProfit ? estimatedProfit : parsedProfit;

  const estimatedPips = useMemo(() => {
    if (!effectiveSymbol || !parsedOpenPrice) {
      return null;
    }
    if (customSymbolNeedsResolution) {
      return null;
    }

    if (entryMode === "open" && !parsedClosePrice) {
      return 0;
    }

    if (!parsedClosePrice) {
      return null;
    }

    const priceDiff =
      tradeType === "long"
        ? parsedClosePrice - parsedOpenPrice
        : parsedOpenPrice - parsedClosePrice;

    return priceDiff / getEstimatedPipSize(effectiveSymbol);
  }, [
    customSymbolNeedsResolution,
    effectiveSymbol,
    entryMode,
    parsedClosePrice,
    parsedOpenPrice,
    tradeType,
  ]);

  const plannedRR = useMemo(() => {
    if (!parsedOpenPrice || parsedSl === null || parsedTp === null) {
      return null;
    }

    const risk = Math.abs(parsedOpenPrice - parsedSl);
    const target = Math.abs(parsedTp - parsedOpenPrice);

    if (!risk || !Number.isFinite(risk) || !Number.isFinite(target)) {
      return null;
    }

    return target / risk;
  }, [parsedOpenPrice, parsedSl, parsedTp]);

  const netPreview = useMemo(() => {
    if (effectiveProfit === null) {
      return null;
    }

    return effectiveProfit + (parsedCommission ?? 0) + (parsedSwap ?? 0);
  }, [effectiveProfit, parsedCommission, parsedSwap]);

  const canSubmit = useMemo(() => {
    if (entryMode === "open") {
      return Boolean(effectiveSymbol && parsedVolume && parsedOpenPrice);
    }

    return Boolean(
      effectiveSymbol &&
        parsedVolume &&
        parsedOpenPrice &&
        timeOrderValid &&
        (parsedClosePrice || effectiveProfit !== null)
    );
  }, [
    entryMode,
    effectiveProfit,
    effectiveSymbol,
    parsedClosePrice,
    parsedOpenPrice,
    parsedVolume,
    timeOrderValid,
  ]);

  const validationMessage = useMemo(() => {
    if (symbol === "custom" && !customSymbol.trim()) {
      return "Enter a custom symbol before saving the trade.";
    }

    if (!effectiveSymbol) {
      return "Select the symbol you traded.";
    }

    if (!parsedVolume) {
      return "Enter a valid trade size.";
    }

    if (!parsedOpenPrice) {
      return entryMode === "open"
        ? "Enter the live entry price."
        : "Enter the entry price.";
    }

    if (entryMode === "closed" && !parsedClosePrice && parsedProfit === null) {
      return "Enter an exit price or a trade P&L value.";
    }

    if (!timeOrderValid) {
      return entryMode === "open"
        ? "Open time must be before now."
        : "Close time must be after open time.";
    }

    if (entryMode === "closed" && !autoCalculateProfit && parsedProfit === null) {
      return "Enter the trade P&L or turn auto-calculate back on.";
    }

    return null;
  }, [
    autoCalculateProfit,
    customSymbol,
    entryMode,
    effectiveSymbol,
    parsedClosePrice,
    parsedOpenPrice,
    parsedProfit,
    parsedVolume,
    symbol,
    timeOrderValid,
  ]);

  function resetForm() {
    const defaults = createDefaultTradeWindow();

    setWorkspaceTab("single");
    setEntryMode("closed");
    setActiveOpenTradeId(null);
    setManualMarketType("auto");
    setSymbol("");
    setCustomSymbol("");
    setTradeType("long");
    setVolume(
      formatVolumeInputValue(mergeManualTradeSizingPreferences(manualTradeSizing).forex.defaultVolume)
    );
    setOpenPrice("");
    setClosePrice("");
    setOpenTime(defaults.openTime);
    setCloseTime(defaults.closeTime);
    setSl("");
    setTp("");
    setProfit("");
    setCommissions("");
    setSwap("");
    setSessionTag("");
    setModelTag("");
    setCustomTags([]);
    setNoteContent([]);
    setNoteHtml("");
    setPendingMediaFiles([]);
    setNoteEditorKey((current) => current + 1);
    setAutoCalculateProfit(true);
    setOpenTradeComment("");
    setCaptureInput("");
    setCaptureResult(null);
    setBulkInput("");
    setBulkResult(null);
    previousSizingDefaultRef.current = null;
  }

  function handleOpenChange(nextValue: boolean) {
    setOpen(nextValue);

    if (!nextValue && !submitting) {
      resetForm();
    }
  }

  const captureParseOptions = useMemo(
    () => ({
      referenceDate: new Date(),
      resolvePipSize: (nextSymbol: string) => getEstimatedPipSize(nextSymbol),
      resolveContractSize: (nextSymbol: string) =>
        resolveManualTradeSizing(nextSymbol, manualTradeSizing).profile
          .contractSize,
    }),
    [manualTradeSizing]
  );

  function invalidateWorkspaceQueries() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: [["trades"]] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-chart-trades"] }),
      queryClient.invalidateQueries({
        queryKey: trpcOptions.accounts.stats.queryOptions({ accountId })
          .queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: trpcOptions.accounts.aggregatedStats.queryOptions({})
          .queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: trpcOptions.trades.listManualOpenTrades.queryOptions({
          accountId,
        }).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: trpcOptions.accounts.liveMetrics.queryOptions({
          accountId,
        }).queryKey,
      }),
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["propFirms"] }),
    ]);
  }

  function applyCaptureResult(result: ManualTradeCaptureResult) {
    const detectedSymbol = result.fields.symbol.value?.trim().toUpperCase() || "";
    const useCustomSymbol =
      detectedSymbol.length > 0 && !symbolOptions.includes(detectedSymbol);

    setWorkspaceTab("single");
    setActiveOpenTradeId(null);
    setEntryMode(result.derived.isOpenTrade.value ? "open" : "closed");
    setManualMarketType(
      detectedSymbol ? inferMarketTypeFromSymbol(detectedSymbol) : "auto"
    );
    setSymbol(
      detectedSymbol
        ? useCustomSymbol
          ? "custom"
          : detectedSymbol
        : ""
    );
    setCustomSymbol(useCustomSymbol ? detectedSymbol : "");
    setTradeType(result.fields.direction.value === "short" ? "short" : "long");
    setVolume(numberToInputValue(result.fields.volume.value));
    setOpenPrice(numberToInputValue(result.fields.openPrice.value));
    setClosePrice(numberToInputValue(result.fields.closePrice.value));
    setSl(numberToInputValue(result.fields.stopLoss.value));
    setTp(numberToInputValue(result.fields.takeProfit.value));
    setProfit(numberToInputValue(result.fields.profit.value));
    setCommissions(numberToInputValue(result.fields.commission.value));
    setSwap(numberToInputValue(result.fields.swap.value));
    setAutoCalculateProfit(result.fields.profit.value == null);
    setOpenTime(result.fields.openTime.value ?? createDefaultTradeWindow().openTime);
    setCloseTime(result.fields.closeTime.value ?? createRoundedNow());
    setOpenTradeComment(result.fields.notes.value ?? "");
    setSessionTag("");
    setModelTag("");
    setCustomTags([]);
    const noteBlocks = journalBlocksFromPlainText(result.fields.notes.value ?? "");
    setNoteContent(noteBlocks);
    setNoteHtml(result.fields.notes.value ?? "");
    setPendingMediaFiles([]);
    setNoteEditorKey((current) => current + 1);
  }

  function loadManualOpenTrade(row: ManualOpenTradeRow) {
    const detectedSymbol = row.symbol?.trim().toUpperCase() || "";
    const useCustomSymbol =
      detectedSymbol.length > 0 && !symbolOptions.includes(detectedSymbol);

    setWorkspaceTab("single");
    setEntryMode("closed");
    setActiveOpenTradeId(row.id);
    setManualMarketType(
      detectedSymbol ? inferMarketTypeFromSymbol(detectedSymbol) : "auto"
    );
    setSymbol(
      detectedSymbol
        ? useCustomSymbol
          ? "custom"
          : detectedSymbol
        : ""
    );
    setCustomSymbol(useCustomSymbol ? detectedSymbol : "");
    setTradeType(row.tradeType === "short" ? "short" : "long");
    setVolume(numberToInputValue(row.volume));
    setOpenPrice(numberToInputValue(row.openPrice));
    setClosePrice(numberToInputValue(row.currentPrice));
    setOpenTime(row.openTime ? new Date(row.openTime) : createRoundedNow());
    setCloseTime(createRoundedNow());
    setSl(numberToInputValue(row.sl));
    setTp(numberToInputValue(row.tp));
    setProfit("");
    setCommissions(numberToInputValue(row.commission));
    setSwap(numberToInputValue(row.swap));
    setSessionTag(row.sessionTag ?? "");
    setModelTag(row.modelTag ?? "");
    setCustomTags(row.customTags ?? []);
    setOpenTradeComment(row.comment ?? "");
    setAutoCalculateProfit(true);
    setNoteContent([]);
    setNoteHtml("");
    setPendingMediaFiles([]);
    setNoteEditorKey((current) => current + 1);
  }

  async function handleCaptureParse() {
    const nextInput = captureInput.trim();
    if (!nextInput) {
      setCaptureResult(null);
      return;
    }

    const parsed = nextInput.includes("\n")
      ? parseManualTradeCaptureBulk(nextInput, captureParseOptions)
      : parseManualTradeCapture(nextInput, captureParseOptions);

    setCaptureResult(parsed);

    if (parsed.kind === "bulk") {
      toast.success(`Parsed ${parsed.rows.length} trade drafts.`);
      return;
    }

    toast.success("Capture parsed. Review and load it into the form.");
  }

  async function handleBulkParse() {
    const nextInput = bulkInput.trim();
    if (!nextInput) {
      setBulkResult(null);
      return;
    }

    const parsed = nextInput.includes("\n")
      ? parseManualTradeCaptureBulk(nextInput, captureParseOptions)
      : parseManualTradeCapture(nextInput, captureParseOptions);

    setBulkResult(parsed);
  }

  function isPresent<T>(value: T | null): value is T {
    return value !== null;
  }

  function buildClosedTradePayloadFromCapture(result: ManualTradeCaptureResult) {
    const symbolValue = result.fields.symbol.value?.trim().toUpperCase();
    const volumeValue = result.fields.volume.value;
    const openPriceValue = result.fields.openPrice.value;
    const openTimeValue = result.fields.openTime.value;
    const tradeType: "long" | "short" =
      result.fields.direction.value === "short" ? "short" : "long";

    if (!symbolValue || !volumeValue || !openPriceValue || !openTimeValue) {
      return null;
    }

    return {
      accountId,
      symbol: symbolValue,
      tradeType,
      volume: volumeValue,
      openPrice: openPriceValue,
      openTime: openTimeValue.toISOString(),
      closePrice: result.fields.closePrice.value ?? undefined,
      closeTime:
        result.fields.closeTime.value?.toISOString() ??
        createRoundedNow().toISOString(),
      sl: result.fields.stopLoss.value ?? undefined,
      tp: result.fields.takeProfit.value ?? undefined,
      profit: result.fields.profit.value ?? undefined,
      commissions: result.fields.commission.value ?? undefined,
      swap: result.fields.swap.value ?? undefined,
    };
  }

  function buildOpenTradePayloadFromCapture(result: ManualTradeCaptureResult) {
    const symbolValue = result.fields.symbol.value?.trim().toUpperCase();
    const volumeValue = result.fields.volume.value;
    const openPriceValue = result.fields.openPrice.value;
    const openTimeValue = result.fields.openTime.value;
    const tradeType: "long" | "short" =
      result.fields.direction.value === "short" ? "short" : "long";

    if (!symbolValue || !volumeValue || !openPriceValue || !openTimeValue) {
      return null;
    }

    return {
      accountId,
      symbol: symbolValue,
      tradeType,
      volume: volumeValue,
      openPrice: openPriceValue,
      openTime: openTimeValue.toISOString(),
      currentPrice: result.fields.closePrice.value ?? undefined,
      sl: result.fields.stopLoss.value ?? undefined,
      tp: result.fields.takeProfit.value ?? undefined,
      profit: result.fields.profit.value ?? undefined,
      commissions: result.fields.commission.value ?? undefined,
      swap: result.fields.swap.value ?? undefined,
      comment: result.fields.notes.value ?? undefined,
    };
  }

  async function handleBulkSubmit() {
    const rows = extractCaptureRows(bulkResult);
    if (rows.length === 0) {
      toast.error("Parse some trades first.");
      return;
    }

    const openPayloads = rows
      .filter((row) => row.derived.isOpenTrade.value)
      .map(buildOpenTradePayloadFromCapture)
      .filter(isPresent);
    const closedPayloads = rows
      .filter((row) => !row.derived.isOpenTrade.value)
      .map(buildClosedTradePayloadFromCapture)
      .filter(isPresent);

    if (openPayloads.length === 0 && closedPayloads.length === 0) {
      toast.error("No valid trades were detected in the pasted content.");
      return;
    }

    setSubmitting(true);

    try {
      const [bulkClosedResult, openResults] = await Promise.all([
        closedPayloads.length > 0
          ? trpcClient.trades.bulkCreateManualTrades.mutate({
              accountId,
              trades: closedPayloads,
            })
          : Promise.resolve(null),
        Promise.all(
          openPayloads.map((payload) =>
            trpcClient.trades.createManualOpenTrade.mutate(payload)
          )
        ),
      ]);

      await invalidateWorkspaceQueries();

      const createdClosedCount = bulkClosedResult?.createdCount ?? 0;
      const createdOpenCount = openResults.length;
      const matchedCount = bulkClosedResult?.matchedCount ?? 0;

      toast.success(
        `${createdClosedCount + createdOpenCount} manual trade${
          createdClosedCount + createdOpenCount === 1 ? "" : "s"
        } added.`
      );

      if (matchedCount > 0) {
        toast.warning(
          `${matchedCount} trade${
            matchedCount === 1 ? "" : "s"
          } look similar to existing broker/import history.`
        );
      }

      setBulkInput("");
      setBulkResult(null);
      setWorkspaceTab(createdOpenCount > 0 ? "open" : "single");
    } catch (error: any) {
      toast.error(error?.message || "Failed to create manual trades");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickCloseOpenTrade(row: ManualOpenTradeRow) {
    try {
      setSubmitting(true);
      const result = await trpcClient.trades.closeManualOpenTrade.mutate({
        openTradeId: row.id,
        closePrice: row.currentPrice ?? undefined,
      });

      await invalidateWorkspaceQueries();

      toast.success(
        `Position closed: ${result.symbol} ${formatCurrencyValue(
          result.profit,
          {
            showPlus: true,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}`
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to close open trade");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(mode: "close" | "continue") {
    if (!canSubmit || !effectiveSymbol || !parsedVolume || !parsedOpenPrice) {
      return;
    }

    setSubmitting(true);

    try {
      if (entryMode === "open") {
        const result = await trpcClient.trades.createManualOpenTrade.mutate({
          accountId,
          symbol: effectiveSymbol,
          tradeType,
          volume: parsedVolume,
          openPrice: parsedOpenPrice,
          openTime: openTime.toISOString(),
          currentPrice: parsedClosePrice ?? undefined,
          sl: parsedSl ?? undefined,
          tp: parsedTp ?? undefined,
          profit: effectiveProfit ?? undefined,
          commissions: parsedCommission ?? undefined,
          swap: parsedSwap ?? undefined,
          sessionTag: sessionTag.trim() || undefined,
          modelTag: modelTag.trim() || undefined,
          customTags,
          comment: openTradeComment.trim() || undefined,
        });

        await invalidateWorkspaceQueries();

        toast.success(
          mode === "continue"
            ? `Open position added. Ready for the next one: ${result.symbol}`
            : `Open position added: ${result.symbol}`
        );

        resetForm();
        setWorkspaceTab("open");

        if (mode === "close") {
          setOpen(false);
        }

        return;
      }

      const result = activeOpenTradeId
        ? await trpcClient.trades.closeManualOpenTrade.mutate({
            openTradeId: activeOpenTradeId,
            symbol: effectiveSymbol,
            tradeType,
            volume: parsedVolume,
            openPrice: parsedOpenPrice,
            openTime: openTime.toISOString(),
            closePrice: parsedClosePrice ?? undefined,
            closeTime: closeTime.toISOString(),
            sl: parsedSl ?? undefined,
            tp: parsedTp ?? undefined,
            profit: effectiveProfit ?? undefined,
            commissions: parsedCommission ?? undefined,
            swap: parsedSwap ?? undefined,
            sessionTag: sessionTag.trim() || undefined,
            modelTag: modelTag.trim() || undefined,
            customTags,
          })
        : await trpcClient.trades.createManualClosedTrade.mutate({
            accountId,
            symbol: effectiveSymbol,
            tradeType,
            volume: parsedVolume,
            openPrice: parsedOpenPrice,
            closePrice: parsedClosePrice ?? undefined,
            openTime: openTime.toISOString(),
            closeTime: closeTime.toISOString(),
            sl: parsedSl ?? undefined,
            tp: parsedTp ?? undefined,
            profit: effectiveProfit ?? undefined,
            commissions: parsedCommission ?? undefined,
            swap: parsedSwap ?? undefined,
            sessionTag: sessionTag.trim() || undefined,
            modelTag: modelTag.trim() || undefined,
            customTags,
          });

      const artifactResult = await persistQuickTradeEntryArtifacts({
        tradeId: result.id,
        noteContent,
        noteHtml,
        mediaFiles: pendingMediaFiles,
      });

      await invalidateWorkspaceQueries();

      toast.success(
        mode === "continue"
          ? `${activeOpenTradeId ? "Position closed" : "Trade added"}. Ready for the next one: ${result.symbol}`
          : `${activeOpenTradeId ? "Position closed" : "Trade added"}: ${
              result.symbol
            } ${formatCurrencyValue(result.profit, {
              showPlus: true,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
      );

      if (
        "reconciliationCandidates" in result &&
        result.reconciliationCandidates.length > 0
      ) {
        toast.warning(
          `${result.reconciliationCandidates.length} possible broker/import match${
            result.reconciliationCandidates.length === 1 ? "" : "es"
          } found for this manual trade.`
        );
      }

      if (artifactResult.failedMediaCount > 0) {
        toast.warning(
          `${artifactResult.failedMediaCount} attachment${
            artifactResult.failedMediaCount === 1 ? "" : "s"
          } failed to upload. The trade was still saved.`
        );
      }

      if (artifactResult.noteFailed) {
        toast.warning(
          "The trade was saved, but the note could not be attached."
        );
      }

      onTradeCreated?.({
        id: result.id,
        symbol: result.symbol || "",
        profit: result.profit,
      });

      resetForm();

      if (mode === "close") {
        setOpen(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create trade");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 ring-white/10! borer-none!"
          >
            <Plus className="size-3" />
            Add trade
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto rounded-md p-0 sm:max-w-2xl">
        <div className="px-6 py-5 pb-0">
          <SheetHeader className="p-0">
            <SheetTitle className="text-base font-semibold text-white">
              Add manual trade
            </SheetTitle>
            <SheetDescription className="text-xs text-white/40">
              Manually enter a closed trade, reuse the tags you already track,
              and update the dashboard immediately after save.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex flex-col">
          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Market, symbol & direction
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Asset type</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MANUAL_MARKET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "flex min-h-9 cursor-pointer items-center justify-center px-3 py-2 text-xs font-semibold transition-colors",
                      manualMarketType === option.value
                        ? TRADE_IDENTIFIER_TONES.info
                        : "text-white/45 hover:text-white/70"
                    )}
                    onClick={() => setManualMarketType(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-white/35">
                Pick a market first to get the right default size and the most
                common quick sizes before you lock in the symbol.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/50">Symbol</Label>
              <Select
                value={symbol}
                onValueChange={(nextValue) => {
                  setSymbol(nextValue);
                  if (nextValue !== "custom") {
                    setManualMarketType(inferMarketTypeFromSymbol(nextValue));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSymbolOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {symbol === "custom" && (
                <Input
                  placeholder={customSymbolPlaceholder}
                  value={customSymbol}
                  onChange={(event) =>
                    setCustomSymbol(event.target.value.toUpperCase())
                  }
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/50">Direction</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                    tradeType === "long"
                      ? TRADE_IDENTIFIER_TONES.positive
                      : "text-white/40 opacity-50"
                  )}
                  onClick={() => setTradeType("long")}
                >
                  Long
                  <ArrowUpRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                    tradeType === "short"
                      ? TRADE_IDENTIFIER_TONES.negative
                      : "text-white/40 opacity-50"
                  )}
                  onClick={() => setTradeType("short")}
                >
                  Short
                  <ArrowDownRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Trade details
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Volume ({resolvedSizing.profile.unitLabel})
                </Label>
                <Input
                  type="number"
                  step={resolvedSizing.profile.volumeStep}
                  min={resolvedSizing.profile.minVolume}
                  value={volume}
                  onChange={(event) => setVolume(event.target.value)}
                />
                <p className="text-[11px] leading-5 text-white/40">
                  {sizingContextLabel} default{" "}
                  {formatSizingNumber(resolvedSizing.profile.defaultVolume)}{" "}
                  {resolvedSizing.profile.unitLabel}. Min{" "}
                  {formatSizingNumber(resolvedSizing.profile.minVolume)} and
                  step {formatSizingNumber(resolvedSizing.profile.volumeStep)}.
                  {effectiveSymbol ? (
                    <>
                      {" "}
                      Contract size{" "}
                      {formatSizingNumber(resolvedSizing.profile.contractSize)}.
                    </>
                  ) : null}
                </p>
                {volumeHint ? (
                  <p className="text-[11px] leading-5 text-white/35">
                    {volumeHint}
                  </p>
                ) : null}
                <SuggestionChips
                  suggestions={volumeQuickSizes}
                  activeValue={volume}
                  onSelect={setVolume}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Hold time</Label>
                <div
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "flex h-9 items-center px-3 text-sm text-white/75"
                  )}
                >
                  {formatHoldDuration(openTime, closeTime)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Open price</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.08500"
                  value={openPrice}
                  onChange={(event) => setOpenPrice(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Close price</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.08750"
                  value={closePrice}
                  onChange={(event) => setClosePrice(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TradeDateTimeField
                label="Open time"
                value={openTime}
                onChange={setOpenTime}
                triggerClassName={cn(
                  TRADE_ACTION_BUTTON_CLASS,
                  "h-9 w-full justify-start px-3 text-left text-white/85"
                )}
              />
              <TradeDateTimeField
                label="Close time"
                value={closeTime}
                onChange={setCloseTime}
                triggerClassName={cn(
                  TRADE_ACTION_BUTTON_CLASS,
                  "h-9 w-full justify-start px-3 text-left text-white/85"
                )}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className={cn(TRADE_ACTION_BUTTON_CLASS, "h-8")}
                onClick={() => setCloseTime(createRoundedNow())}
              >
                Set close to now
              </Button>
              <Button
                type="button"
                className={cn(TRADE_ACTION_BUTTON_CLASS, "h-8")}
                onClick={() => {
                  const nextOpenTime = new Date(closeTime);
                  nextOpenTime.setHours(nextOpenTime.getHours() - 1);
                  setOpenTime(nextOpenTime);
                }}
              >
                Make open 1h earlier
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Stop loss (optional)
                </Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.08200"
                  value={sl}
                  onChange={(event) => setSl(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Take profit (optional)
                </Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.09000"
                  value={tp}
                  onChange={(event) => setTp(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  Estimated pips
                </p>
                <p className="text-sm font-medium text-white/80">
                  {estimatedPips === null
                    ? "—"
                    : `${estimatedPips > 0 ? "+" : ""}${estimatedPips.toFixed(
                        1
                      )}`}
                </p>
              </div>
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  Planned RR
                </p>
                <p className="text-sm font-medium text-white/80">
                  {plannedRR === null ? "—" : `${plannedRR.toFixed(2)}R`}
                </p>
              </div>
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  Time check
                </p>
                <p
                  className={cn(
                    "text-sm font-medium",
                    timeOrderValid ? "text-teal-300" : "text-rose-300"
                  )}
                >
                  {timeOrderValid ? "Valid" : "Close before open"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              P&L
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label className="text-xs text-white/50">Trade P&amp;L</Label>
                <label className="flex items-center gap-2 text-xs text-white/45">
                  <Checkbox
                    checked={autoCalculateProfit}
                    onCheckedChange={(checked) => {
                      const nextChecked = checked === true;
                      if (
                        !nextChecked &&
                        estimatedProfit !== null &&
                        profit.trim().length === 0
                      ) {
                        setProfit(estimatedProfit.toFixed(2));
                      }
                      setAutoCalculateProfit(nextChecked);
                    }}
                  />
                  Auto-calculate from price
                </label>
              </div>

              {autoCalculateProfit ? (
                <div
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "space-y-2 p-3",
                    estimatedProfit === null
                      ? "text-white/45"
                      : estimatedProfit >= 0
                      ? TRADE_IDENTIFIER_TONES.positive
                      : TRADE_IDENTIFIER_TONES.negative
                  )}
                >
                  <p className="text-[11px] uppercase tracking-wide opacity-70">
                    Estimated P&amp;L
                  </p>
                  <p className="text-sm font-semibold">
                    {estimatedProfit === null
                      ? "Enter entry, exit, and size to calculate it."
                      : formatCurrencyValue(estimatedProfit, {
                          showPlus: true,
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="125.50"
                    value={profit}
                    onChange={(event) => setProfit(event.target.value)}
                  />
                  {estimatedProfit !== null ? (
                    <Button
                      type="button"
                      className={cn(TRADE_ACTION_BUTTON_CLASS, "h-8")}
                      onClick={() => setProfit(estimatedProfit.toFixed(2))}
                    >
                      Use calculated value
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Commissions (optional)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="-7.00"
                  value={commissions}
                  onChange={(event) => setCommissions(event.target.value)}
                />
                <p className="text-[11px] text-white/35">
                  Enter costs as negative values.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Swap (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="-1.50"
                  value={swap}
                  onChange={(event) => setSwap(event.target.value)}
                />
                <p className="text-[11px] text-white/35">
                  Negative for cost, positive for credit.
                </p>
              </div>
            </div>

            <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
              <p className="text-[11px] uppercase tracking-wide text-white/40">
                Result after costs
              </p>
              <p
                className={cn(
                  "text-sm font-semibold",
                  netPreview === null
                    ? "text-white/45"
                    : netPreview >= 0
                    ? "text-teal-300"
                    : "text-rose-300"
                )}
              >
                {netPreview === null
                  ? "Add P&L to preview the final result."
                  : formatCurrencyValue(netPreview, {
                      showPlus: true,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </p>
            </div>
          </div>

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Tags
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">
                Session tag (optional)
              </Label>
              <Input
                placeholder="London Open"
                value={sessionTag}
                onChange={(event) => setSessionTag(event.target.value)}
              />
              <SuggestionChips
                suggestions={sessionTagSuggestions
                  .map((tag) => tag.name)
                  .filter(Boolean)
                  .slice(0, 6)}
                activeValue={sessionTag}
                onSelect={setSessionTag}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/50">
                Model tag (optional)
              </Label>
              <Input
                placeholder="Liquidity Raid"
                value={modelTag}
                onChange={(event) => setModelTag(event.target.value)}
              />
              <SuggestionChips
                suggestions={modelTagSuggestions
                  .map((tag) => tag.name)
                  .filter(Boolean)
                  .slice(0, 6)}
                activeValue={modelTag}
                onSelect={setModelTag}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/50">
                Trade tags (optional)
              </Label>
              <TagMultiSelect
                value={customTags}
                suggestions={customTagSuggestions}
                placeholder="Add one or more trade tags"
                onChange={setCustomTags}
              />
              <p className="text-[11px] text-white/35">
                Use multiple tags for ideas like A+, news, revenge, or futures.
              </p>
            </div>
          </div>

          <QuickTradeEntryNotesMedia
            noteEditorKey={noteEditorKey}
            noteContent={noteContent}
            onNoteChange={(blocks, html) => {
              setNoteContent(blocks);
              setNoteHtml(html);
            }}
            mediaFiles={pendingMediaFiles}
            onFilesSelected={(files) =>
              setPendingMediaFiles((current) => [...current, ...files])
            }
            onFileRemove={(id) =>
              setPendingMediaFiles((current) =>
                current.filter((file) => file.id !== id)
              )
            }
            disabled={submitting}
          />

          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-h-5 text-xs text-rose-300">
                {validationMessage}
              </div>
              <span
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  validationMessage
                    ? TRADE_IDENTIFIER_TONES.negative
                    : TRADE_IDENTIFIER_TONES.positive,
                  "min-h-6 px-2 py-0.5 text-[10px]"
                )}
              >
                {validationMessage ? "Needs attention" : "Ready to save"}
              </span>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 rounded-sm")}
                onClick={resetForm}
                disabled={submitting}
              >
                Clear
              </Button>
              <Button
                type="button"
                className={cn(
                  TRADE_ACTION_BUTTON_CLASS,
                  "h-9 rounded-sm",
                  !canSubmit && "opacity-60"
                )}
                onClick={() => void handleSubmit("continue")}
                disabled={!canSubmit || submitting}
              >
                {submitting ? "Adding..." : "Add & another"}
              </Button>
              <Button
                type="button"
                className={cn(
                  TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                  "h-9 gap-2 rounded-sm",
                  !canSubmit && "opacity-60"
                )}
                onClick={() => void handleSubmit("close")}
                disabled={!canSubmit || submitting}
              >
                {submitting ? "Adding..." : "Add trade"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
