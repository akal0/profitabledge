"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EdgePanel } from "@/components/edges/edge-page-primitives";
import {
  MediaDropzone,
  type MediaFile,
} from "@/components/media/media-dropzone";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import { TradeDateTimeField } from "@/components/trades/trade-date-time-field";
import {
  TRADE_ACTION_BUTTON_CLASS,
  TRADE_ACTION_BUTTON_PRIMARY_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
  getTradeDirectionTone,
  getTradeOutcomeTone,
} from "@/components/trades/trade-identifier-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import {
  formatSizingNumber,
  getEstimatedPipSize,
  inferManualTradeAssetClass,
  mergeManualTradeSizingPreferences,
  resolveManualTradeSizing,
  type ManualTradeAssetClass,
  type ManualTradeSizingPreferences,
  type ManualTradeSizingProfile,
} from "@/lib/manual-trade-sizing";
import { formatCurrencyValue, formatNumberValue } from "@/lib/trade-formatting";
import { cn } from "@/lib/utils";
import { trpc, trpcOptions } from "@/utils/trpc";

type NamedTradeTag = {
  name: string;
  color: string;
};

type MissedTradeRow = {
  id: string;
  accountId?: string | null;
  symbol?: string | null;
  tradeType?: string | null;
  volume?: number | null;
  openPrice?: number | null;
  closePrice?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  customTags?: string[] | null;
  setupTime?: string | Date | null;
  closeTime?: string | Date | null;
  sl?: number | null;
  tp?: number | null;
  reasonMissed?: string | null;
  notes?: string | null;
  estimatedOutcome?: string | null;
  estimatedProfit?: number | null;
  estimatedRR?: number | null;
  estimatedPnl?: number | null;
  commissions?: number | null;
  swap?: number | null;
  mediaUrls?: string[] | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type ManualTradeMarketType =
  | "auto"
  | "forex"
  | "indices"
  | "commodities"
  | "crypto"
  | "futures";

type MissedTradeDraft = {
  accountId: string | null;
  manualMarketType: ManualTradeMarketType;
  symbol: string;
  tradeType: "long" | "short";
  volume: string;
  openPrice: string;
  closePrice: string;
  openTime: Date;
  closeTime: Date;
  sl: string;
  tp: string;
  estimatedProfit: string;
  commissions: string;
  swap: string;
  sessionTag: string;
  modelTag: string;
  customTags: string[];
  reasonMissed: string;
  notes: string;
  estimatedOutcome: string;
  mediaUrls: string[];
  autoCalculateProfit: boolean;
};

const COMMON_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "XAUUSD",
  "XAGUSD",
  "US30",
  "NAS100",
  "SPX500",
  "BTCUSD",
  "ETHUSD",
];

const MANUAL_FUTURES_SYMBOL_PATTERN =
  /^([A-Z0-9]{1,5})([FGHJKMNQUVXZ])(\d{1,4})$/;

const MANUAL_MARKET_OPTIONS: Array<{
  value: ManualTradeMarketType;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "forex", label: "Forex" },
  { value: "indices", label: "Indices" },
  { value: "commodities", label: "Commodities" },
  { value: "crypto", label: "Crypto" },
  { value: "futures", label: "Futures" },
];

const MISSED_TRADE_OUTCOME_OPTIONS = [
  { value: "Win", label: "Winner" },
  { value: "PW", label: "Partial win" },
  { value: "BE", label: "Breakeven" },
  { value: "Loss", label: "Loser" },
] as const;

function formatMarketTypeLabel(value: ManualTradeMarketType) {
  switch (value) {
    case "auto":
      return "Auto";
    case "forex":
      return "Forex";
    case "indices":
      return "Indices";
    case "commodities":
      return "Commodities";
    case "crypto":
      return "Crypto";
    case "futures":
      return "Futures";
    default:
      return "Auto";
  }
}

function inferMarketTypeFromSymbol(symbol: string): ManualTradeMarketType {
  const normalized = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) {
    return "auto";
  }

  if (MANUAL_FUTURES_SYMBOL_PATTERN.test(normalized)) {
    return "futures";
  }

  switch (inferManualTradeAssetClass(symbol)) {
    case "forex":
      return "forex";
    case "crypto":
      return "crypto";
    case "indices":
      return "indices";
    case "metals":
    case "energy":
      return "commodities";
    case "rates":
    case "agriculture":
      return "futures";
    default:
      return "auto";
  }
}

function buildMarketSizingProfile(
  marketType: ManualTradeMarketType,
  profiles: Record<ManualTradeAssetClass, ManualTradeSizingProfile>
) {
  switch (marketType) {
    case "forex":
      return { assetClass: "forex" as const, profile: profiles.forex };
    case "indices":
      return { assetClass: "indices" as const, profile: profiles.indices };
    case "commodities":
      return {
        assetClass: "metals" as const,
        profile: {
          ...profiles.metals,
          label: "Commodities",
          unitLabel: "lots",
          quickSizes: profiles.metals.quickSizes,
        },
      };
    case "crypto":
      return { assetClass: "crypto" as const, profile: profiles.crypto };
    case "futures":
      return {
        assetClass: "other" as const,
        profile: {
          label: "Futures",
          unitLabel: "contracts",
          defaultVolume: 1,
          minVolume: 1,
          volumeStep: 1,
          contractSize: 1,
          quickSizes: [1, 2, 3, 5],
        },
      };
    case "auto":
    default:
      return { assetClass: "forex" as const, profile: profiles.forex };
  }
}

function getSymbolPlaceholder(marketType: ManualTradeMarketType) {
  switch (marketType) {
    case "forex":
      return "Enter symbol (e.g. EURUSD)";
    case "indices":
      return "Enter symbol (e.g. NAS100)";
    case "commodities":
      return "Enter symbol (e.g. XAUUSD)";
    case "crypto":
      return "Enter symbol (e.g. BTCUSD)";
    case "futures":
      return "Enter contract (e.g. NQM26)";
    case "auto":
    default:
      return "Enter symbol (e.g. EURUSD)";
  }
}

function createRoundedNow() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

function createDefaultTradeWindow() {
  const closeTime = createRoundedNow();
  const openTime = new Date(closeTime);
  openTime.setHours(openTime.getHours() - 1);
  return { openTime, closeTime };
}

function parseNumberInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveNumberInput(value: string) {
  const parsed = parseNumberInput(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function formatHoldDuration(openTime: Date, closeTime: Date) {
  const diffMs = Math.max(0, closeTime.getTime() - openTime.getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

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

function formatVolumeInputValue(value: number) {
  return Number.isFinite(value) ? value.toString() : "";
}

function formatAssetClassLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function numberToInputValue(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "" : String(value);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Unscheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTradeOutcome(outcome: string | null | undefined) {
  if (!outcome) return "Unclassified";

  switch (outcome) {
    case "Win":
      return "Winner";
    case "PW":
      return "Partial win";
    case "Loss":
      return "Loser";
    case "BE":
      return "Breakeven";
    default:
      return outcome
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return formatCurrencyValue(value, {
    showPlus: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatR(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return formatNumberValue(value, {
    showPlus: false,
    maximumFractionDigits: 5,
  });
}

function inferMediaKind(url: string) {
  if (
    url.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(url)
  ) {
    return "image";
  }

  if (
    url.startsWith("data:video/") ||
    /\.(mp4|mov|webm|m4v)$/i.test(url)
  ) {
    return "video";
  }

  return "file";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read file"));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

function SavedMediaGrid({
  mediaUrls,
  onRemove,
}: {
  mediaUrls: string[];
  onRemove?: (index: number) => void;
}) {
  if (mediaUrls.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {mediaUrls.map((url, index) => {
        const mediaKind = inferMediaKind(url);

        return (
          <div
            key={`${url.slice(0, 24)}-${index}`}
            className={cn(TRADE_SURFACE_CARD_CLASS, "group relative")}
          >
            {mediaKind === "image" ? (
              <img
                src={url}
                alt={`Missed trade attachment ${index + 1}`}
                className="aspect-video w-full object-cover"
              />
            ) : mediaKind === "video" ? (
              <video
                src={url}
                controls
                className="aspect-video w-full bg-black object-cover"
              />
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex aspect-video items-center justify-center p-4 text-center text-xs text-white/68 hover:text-white"
              >
                Open attachment
              </a>
            )}

            {onRemove ? (
              <button
                type="button"
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  TRADE_IDENTIFIER_TONES.negative,
                  "absolute right-2 top-2 min-h-6 px-2 py-0.5"
                )}
                onClick={() => onRemove(index)}
              >
                Remove
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function createEmptyDraft(defaultAccountId?: string | null): MissedTradeDraft {
  const defaults = createDefaultTradeWindow();

  return {
    accountId: defaultAccountId ?? null,
    manualMarketType: "auto",
    symbol: "",
    tradeType: "long",
    volume: formatVolumeInputValue(0.1),
    openPrice: "",
    closePrice: "",
    openTime: defaults.openTime,
    closeTime: defaults.closeTime,
    sl: "",
    tp: "",
    estimatedProfit: "",
    commissions: "",
    swap: "",
    sessionTag: "",
    modelTag: "",
    customTags: [],
    reasonMissed: "",
    notes: "",
    estimatedOutcome: "",
    mediaUrls: [],
    autoCalculateProfit: true,
  };
}

function createDraftFromTrade(trade: MissedTradeRow): MissedTradeDraft {
  const openTime = trade.setupTime ? new Date(trade.setupTime) : createRoundedNow();
  const closeTime = trade.closeTime ? new Date(trade.closeTime) : createRoundedNow();

  return {
    accountId: trade.accountId ?? null,
    manualMarketType: trade.symbol
      ? inferMarketTypeFromSymbol(trade.symbol)
      : "auto",
    symbol: trade.symbol ?? "",
    tradeType: trade.tradeType === "short" ? "short" : "long",
    volume: numberToInputValue(trade.volume),
    openPrice: numberToInputValue(trade.openPrice),
    closePrice: numberToInputValue(trade.closePrice),
    openTime,
    closeTime,
    sl: numberToInputValue(trade.sl),
    tp: numberToInputValue(trade.tp),
    estimatedProfit: numberToInputValue(trade.estimatedProfit),
    commissions: numberToInputValue(trade.commissions),
    swap: numberToInputValue(trade.swap),
    sessionTag: trade.sessionTag ?? "",
    modelTag: trade.modelTag ?? "",
    customTags: trade.customTags ?? [],
    reasonMissed: trade.reasonMissed ?? "",
    notes: trade.notes ?? "",
    estimatedOutcome: trade.estimatedOutcome ?? "",
    mediaUrls: trade.mediaUrls ?? [],
    autoCalculateProfit: trade.closePrice != null,
  };
}

export function EdgeMissedTradesSection({
  edgeId,
  edgeName,
  canEdit,
  missedTrades,
  onChanged,
}: {
  edgeId: string;
  edgeName: string;
  canEdit: boolean;
  missedTrades: MissedTradeRow[];
  onChanged: () => Promise<void> | void;
}) {
  const { accounts } = useAccountCatalog({ enabled: canEdit });
  const createMissedTrade = trpc.edges.createMissedTrade.useMutation();
  const updateMissedTrade = trpc.edges.updateMissedTrade.useMutation();
  const deleteMissedTrade = trpc.edges.deleteMissedTrade.useMutation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const defaultAccountId = accounts.length === 1 ? accounts[0]?.id ?? null : null;
  const [draft, setDraft] = useState<MissedTradeDraft>(() =>
    createEmptyDraft(defaultAccountId)
  );
  const [pendingMediaFiles, setPendingMediaFiles] = useState<MediaFile[]>([]);
  const previousSizingDefaultRef = useRef<string | null>(null);

  const selectedAccountId = draft.accountId ?? "";
  const recentSymbolsQuery = useQuery({
    ...trpcOptions.trades.listSymbols.queryOptions({ accountId: selectedAccountId }),
    enabled: sheetOpen && Boolean(selectedAccountId),
    staleTime: 30_000,
  });
  const sessionTagsQuery = useQuery({
    ...trpcOptions.trades.listSessionTags.queryOptions({
      accountId: selectedAccountId,
    }),
    enabled: sheetOpen && Boolean(selectedAccountId),
    staleTime: 30_000,
  });
  const modelTagsQuery = useQuery({
    ...trpcOptions.trades.listModelTags.queryOptions({ accountId: selectedAccountId }),
    enabled: sheetOpen && Boolean(selectedAccountId),
    staleTime: 30_000,
  });
  const customTagsQuery = useQuery({
    ...trpcOptions.trades.listCustomTags.queryOptions({
      accountId: selectedAccountId,
    }),
    enabled: sheetOpen && Boolean(selectedAccountId),
    staleTime: 30_000,
  });
  const advancedPrefsQuery = useQuery({
    ...trpcOptions.users.getAdvancedMetricsPreferences.queryOptions(),
    enabled: sheetOpen,
    staleTime: 30_000,
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
  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );
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
    () => buildMarketSizingProfile(draft.manualMarketType, mergedSizingProfiles),
    [draft.manualMarketType, mergedSizingProfiles]
  );
  const effectiveSymbol = draft.symbol.trim().toUpperCase();
  const symbolSizing = useMemo(
    () =>
      effectiveSymbol
        ? resolveManualTradeSizing(effectiveSymbol, manualTradeSizing)
        : null,
    [effectiveSymbol, manualTradeSizing]
  );
  const symbolNeedsResolution = Boolean(
    effectiveSymbol &&
      draft.manualMarketType === "auto" &&
      symbolSizing &&
      symbolSizing.assetClass === "other"
  );
  const resolvedSizing = useMemo(() => {
    if (!symbolSizing) {
      return marketSizing;
    }

    if (
      draft.manualMarketType !== "auto" &&
      symbolSizing.assetClass === "other"
    ) {
      return marketSizing;
    }

    return symbolSizing;
  }, [draft.manualMarketType, marketSizing, symbolSizing]);
  const sizingContextLabel = useMemo(() => {
    if (resolvedSizing === marketSizing) {
      return draft.manualMarketType === "auto"
        ? "Forex"
        : formatMarketTypeLabel(draft.manualMarketType);
    }

    return formatAssetClassLabel(resolvedSizing.assetClass);
  }, [draft.manualMarketType, marketSizing, resolvedSizing]);
  const volumeHint = useMemo(() => {
    if (symbolNeedsResolution) {
      return "Pick a market type so contract sizing and pip math are calculated correctly for this symbol.";
    }

    if (!effectiveSymbol && draft.manualMarketType === "futures") {
      return "Choose a contract symbol to apply the exact contract size.";
    }

    if (!effectiveSymbol && draft.manualMarketType === "commodities") {
      return "Choose a spot symbol to refine the contract size for metals or energy.";
    }

    return null;
  }, [draft.manualMarketType, effectiveSymbol, symbolNeedsResolution]);
  const volumeQuickSizes = useMemo(
    () =>
      resolvedSizing.profile.quickSizes.map((size) =>
        formatVolumeInputValue(size)
      ),
    [resolvedSizing.profile.quickSizes]
  );
  const symbolSuggestions = useMemo(() => {
    const ordered = [
      ...COMMON_SYMBOLS,
      ...recentSymbols,
      ...missedTrades
        .map((trade) => trade.symbol?.trim().toUpperCase())
        .filter(Boolean),
    ] as string[];
    const seen = new Set<string>();
    const result: string[] = [];

    for (const raw of ordered) {
      const nextValue = raw.trim().toUpperCase();
      if (!nextValue || seen.has(nextValue)) continue;
      seen.add(nextValue);

      if (
        draft.manualMarketType !== "auto" &&
        inferMarketTypeFromSymbol(nextValue) !== draft.manualMarketType
      ) {
        continue;
      }

      result.push(nextValue);
    }

    return result.slice(0, 10);
  }, [draft.manualMarketType, missedTrades, recentSymbols]);

  useEffect(() => {
    const nextDefault = formatVolumeInputValue(
      resolvedSizing.profile.defaultVolume
    );

    setDraft((current) => {
      const trimmed = current.volume.trim();
      if (!trimmed) {
        previousSizingDefaultRef.current = nextDefault;
        return { ...current, volume: nextDefault };
      }

      const previousDefault = previousSizingDefaultRef.current;
      const numericValue = Number(trimmed);
      const belowMinimum =
        Number.isFinite(numericValue) &&
        numericValue < resolvedSizing.profile.minVolume;

      if (trimmed === previousDefault || belowMinimum) {
        previousSizingDefaultRef.current = nextDefault;
        return { ...current, volume: nextDefault };
      }

      previousSizingDefaultRef.current = nextDefault;
      return current;
    });
  }, [resolvedSizing.profile.defaultVolume, resolvedSizing.profile.minVolume]);

  const parsedVolume = useMemo(
    () => parsePositiveNumberInput(draft.volume),
    [draft.volume]
  );
  const parsedOpenPrice = useMemo(
    () => parsePositiveNumberInput(draft.openPrice),
    [draft.openPrice]
  );
  const parsedClosePrice = useMemo(
    () => parsePositiveNumberInput(draft.closePrice),
    [draft.closePrice]
  );
  const parsedSl = useMemo(() => parseNumberInput(draft.sl), [draft.sl]);
  const parsedTp = useMemo(() => parseNumberInput(draft.tp), [draft.tp]);
  const parsedEstimatedProfit = useMemo(
    () => parseNumberInput(draft.estimatedProfit),
    [draft.estimatedProfit]
  );
  const parsedCommission = useMemo(
    () => parseNumberInput(draft.commissions),
    [draft.commissions]
  );
  const parsedSwap = useMemo(() => parseNumberInput(draft.swap), [draft.swap]);
  const timeOrderValid = draft.closeTime.getTime() > draft.openTime.getTime();

  const autoEstimatedProfit = useMemo(() => {
    if (!draft.autoCalculateProfit) return null;
    if (!effectiveSymbol || !parsedOpenPrice || !parsedVolume) {
      return null;
    }
    if (symbolNeedsResolution) {
      return null;
    }
    if (!parsedClosePrice) {
      return null;
    }

    const priceDiff =
      draft.tradeType === "long"
        ? parsedClosePrice - parsedOpenPrice
        : parsedOpenPrice - parsedClosePrice;

    return priceDiff * parsedVolume * resolvedSizing.profile.contractSize;
  }, [
    draft.autoCalculateProfit,
    draft.tradeType,
    effectiveSymbol,
    parsedClosePrice,
    parsedOpenPrice,
    parsedVolume,
    resolvedSizing.profile.contractSize,
    symbolNeedsResolution,
  ]);

  const effectiveProfit = draft.autoCalculateProfit
    ? autoEstimatedProfit
    : parsedEstimatedProfit;
  const estimatedPips = useMemo(() => {
    if (!effectiveSymbol || !parsedOpenPrice || !parsedClosePrice) {
      return null;
    }
    if (symbolNeedsResolution) {
      return null;
    }

    const priceDiff =
      draft.tradeType === "long"
        ? parsedClosePrice - parsedOpenPrice
        : parsedOpenPrice - parsedClosePrice;

    return priceDiff / getEstimatedPipSize(effectiveSymbol);
  }, [
    draft.tradeType,
    effectiveSymbol,
    parsedClosePrice,
    parsedOpenPrice,
    symbolNeedsResolution,
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
  const invalidMediaCount = pendingMediaFiles.filter((file) => file.error).length;
  const isSubmitting =
    createMissedTrade.isPending || updateMissedTrade.isPending;
  const isDeleting = deleteMissedTrade.isPending;

  const validationMessage = useMemo(() => {
    if (!effectiveSymbol) {
      return "Enter the market you missed.";
    }

    if (symbolNeedsResolution) {
      return "Pick a market type before calculating this missed trade.";
    }

    if (!parsedVolume) {
      return "Enter a valid trade size.";
    }

    if (!parsedOpenPrice) {
      return "Enter the entry price.";
    }

    if (!timeOrderValid) {
      return "Close time must be after open time.";
    }

    if (draft.autoCalculateProfit && !parsedClosePrice) {
      return "Enter an exit price or turn auto-calculate off.";
    }

    if (!draft.autoCalculateProfit && parsedEstimatedProfit === null) {
      return "Enter the trade P&L or turn auto-calculate back on.";
    }

    return null;
  }, [
    draft.autoCalculateProfit,
    effectiveSymbol,
    parsedClosePrice,
    parsedEstimatedProfit,
    parsedOpenPrice,
    parsedVolume,
    symbolNeedsResolution,
    timeOrderValid,
  ]);

  function resetComposer() {
    setEditingTradeId(null);
    setDraft(createEmptyDraft(defaultAccountId));
    setPendingMediaFiles([]);
  }

  function handleResetDraft() {
    if (editingTradeId) {
      const editingTrade = missedTrades.find((trade) => trade.id === editingTradeId);
      if (editingTrade) {
        setDraft(createDraftFromTrade(editingTrade));
        setPendingMediaFiles([]);
        return;
      }
    }

    setDraft(createEmptyDraft(defaultAccountId));
    setPendingMediaFiles([]);
  }

  function handleSheetChange(nextOpen: boolean) {
    setSheetOpen(nextOpen);
    if (!nextOpen && !isSubmitting) {
      resetComposer();
    }
  }

  function openCreateComposer() {
    setEditingTradeId(null);
    setDraft(createEmptyDraft(defaultAccountId));
    setPendingMediaFiles([]);
    setSheetOpen(true);
  }

  function openEditComposer(trade: MissedTradeRow) {
    setEditingTradeId(trade.id);
    setDraft(createDraftFromTrade(trade));
    setPendingMediaFiles([]);
    setSheetOpen(true);
  }

  async function handleSubmit() {
    if (validationMessage || !effectiveSymbol || !parsedVolume || !parsedOpenPrice) {
      toast.error(validationMessage || "Fix the missing trade details first.");
      return;
    }

    try {
      const uploadedMediaUrls = await Promise.all(
        pendingMediaFiles
          .filter((file) => !file.error)
          .map((file) => readFileAsDataUrl(file.file))
      );

      const payload = {
        edgeId,
        accountId: draft.accountId,
        symbol: effectiveSymbol,
        tradeType: draft.tradeType,
        volume: parsedVolume,
        openPrice: parsedOpenPrice,
        closePrice: parsedClosePrice,
        sessionTag: draft.sessionTag.trim() || null,
        modelTag: draft.modelTag.trim() || null,
        customTags: draft.customTags,
        setupTime: draft.openTime.toISOString(),
        closeTime: draft.closeTime.toISOString(),
        sl: parsedSl,
        tp: parsedTp,
        reasonMissed: draft.reasonMissed.trim() || null,
        notes: draft.notes.trim() || null,
        estimatedOutcome: draft.estimatedOutcome || null,
        estimatedProfit: effectiveProfit,
        estimatedRR: plannedRR,
        estimatedPnl: netPreview,
        commissions: parsedCommission,
        swap: parsedSwap,
        mediaUrls: [...draft.mediaUrls, ...uploadedMediaUrls],
      };

      if (editingTradeId) {
        await updateMissedTrade.mutateAsync({
          missedTradeId: editingTradeId,
          ...payload,
        });
      } else {
        await createMissedTrade.mutateAsync(payload);
      }

      await onChanged();

      if (invalidMediaCount > 0) {
        toast.warning(
          `${invalidMediaCount} attachment${
            invalidMediaCount === 1 ? "" : "s"
          } could not be added.`
        );
      }

      toast.success(
        editingTradeId ? "Missed trade updated." : "Missed trade added."
      );
      setSheetOpen(false);
      resetComposer();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save missed trade");
    }
  }

  async function handleDelete(missedTradeId: string) {
    if (!window.confirm("Delete this missed trade?")) {
      return;
    }

    try {
      await deleteMissedTrade.mutateAsync({ edgeId, missedTradeId });
      await onChanged();
      toast.success("Missed trade deleted.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete missed trade");
    }
  }

  return (
    <>
      <EdgePanel
        icon={Clock3}
        title="Missed trades"
        description="Log full missed executions with the same context you would use for a manual trade, then review what the setup would actually have paid."
        bodyClassName="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs leading-5 text-white/46">
            Missed trades are tracked separately from executed trades, but they
            now carry the same execution context: size, prices, timing, costs,
            tags, and evidence.
          </p>
          {canEdit ? (
            <Button
              type="button"
              className={cn(TRADE_ACTION_BUTTON_PRIMARY_CLASS, "gap-2")}
              onClick={openCreateComposer}
            >
              <Plus className="size-3.5" />
              Add missed trade
            </Button>
          ) : null}
        </div>

        {missedTrades.length > 0 ? (
          <div className="overflow-hidden rounded-md ring ring-white/8">
            <div className="overflow-x-auto">
              <table className="min-w-[1560px] w-full text-left text-xs text-white/72">
                <thead className="bg-white/[0.04] text-white/42">
                  <tr>
                    <th className="px-3 py-3 font-medium">Symbol</th>
                    <th className="px-3 py-3 font-medium">Direction</th>
                    <th className="px-3 py-3 font-medium">Outcome</th>
                    <th className="px-3 py-3 font-medium">Session</th>
                    <th className="px-3 py-3 font-medium">Edge</th>
                    <th className="px-3 py-3 font-medium">Open</th>
                    <th className="px-3 py-3 font-medium">Close</th>
                    <th className="px-3 py-3 font-medium">Hold</th>
                    <th className="px-3 py-3 font-medium">Volume</th>
                    <th className="px-3 py-3 font-medium">Open price</th>
                    <th className="px-3 py-3 font-medium">Close price</th>
                    <th className="px-3 py-3 font-medium">Notes</th>
                    <th className="px-3 py-3 font-medium">Gross P&amp;L</th>
                    <th className="px-3 py-3 font-medium">Net P&amp;L</th>
                    <th className="px-3 py-3 font-medium">Estimated R</th>
                    <th className="px-3 py-3 font-medium">Costs</th>
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 bg-black/20">
                  {missedTrades.map((tradeRow) => {
                    const openTime =
                      tradeRow.setupTime != null
                        ? new Date(tradeRow.setupTime)
                        : null;
                    const closeTime =
                      tradeRow.closeTime != null
                        ? new Date(tradeRow.closeTime)
                        : null;
                    const notesSummary = [
                      tradeRow.reasonMissed?.trim(),
                      tradeRow.notes?.trim(),
                    ]
                      .filter(Boolean)
                      .join("\n");

                    return (
                      <tr key={tradeRow.id} className="align-top">
                        <td className="px-3 py-3 font-semibold text-white">
                          <div className="space-y-1">
                            <div>{tradeRow.symbol || "Unspecified market"}</div>
                            {tradeRow.accountId ? (
                              <div className="text-[11px] text-white/42">
                                {accountNameById.get(tradeRow.accountId) ??
                                  "Linked account"}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              TRADE_IDENTIFIER_PILL_CLASS,
                              tradeRow.tradeType
                                ? getTradeDirectionTone(tradeRow.tradeType)
                                : TRADE_IDENTIFIER_TONES.neutral,
                              "min-h-6 px-2 py-0.5 capitalize"
                            )}
                          >
                            {tradeRow.tradeType || "Missed"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {tradeRow.estimatedOutcome ? (
                            <span
                              className={cn(
                                TRADE_IDENTIFIER_PILL_CLASS,
                                getTradeOutcomeTone(tradeRow.estimatedOutcome),
                                "min-h-6 px-2 py-0.5"
                              )}
                            >
                              {formatTradeOutcome(tradeRow.estimatedOutcome)}
                            </span>
                          ) : (
                            <span className="text-white/36">Unclassified</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {tradeRow.sessionTag || "—"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="font-medium text-white/82">
                              {edgeName}
                            </div>
                            {tradeRow.modelTag ? (
                              <div className="text-[11px] text-white/42">
                                {tradeRow.modelTag}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatDate(tradeRow.setupTime)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {tradeRow.closeTime
                            ? formatDate(tradeRow.closeTime)
                            : "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {openTime && closeTime
                            ? formatHoldDuration(openTime, closeTime)
                            : "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {tradeRow.volume != null
                            ? formatSizingNumber(tradeRow.volume)
                            : "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatPrice(tradeRow.openPrice)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatPrice(tradeRow.closePrice)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="max-w-[22rem] whitespace-pre-wrap text-[11px] leading-5 text-white/56">
                            {notesSummary || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(tradeRow.estimatedProfit)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(tradeRow.estimatedPnl)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatR(tradeRow.estimatedRR)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatMoney(
                            (tradeRow.commissions ?? 0) + (tradeRow.swap ?? 0)
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {canEdit ? (
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                className={cn(
                                  TRADE_ACTION_BUTTON_CLASS,
                                  "h-8 gap-2"
                                )}
                                onClick={() => openEditComposer(tradeRow)}
                                disabled={isSubmitting || isDeleting}
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                className={cn(
                                  TRADE_ACTION_BUTTON_CLASS,
                                  TRADE_IDENTIFIER_TONES.negative,
                                  "h-8 gap-2 hover:bg-rose-400/16"
                                )}
                                onClick={() => void handleDelete(tradeRow.id)}
                                disabled={isSubmitting || isDeleting}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </Button>
                            </div>
                          ) : (
                            <span className="text-white/36">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg ring ring-white/8 bg-black/20 px-4 py-5 text-xs text-white/48">
            No missed trades logged for this Edge yet.
          </div>
        )}
      </EdgePanel>

      <Sheet open={sheetOpen} onOpenChange={handleSheetChange}>
        <SheetContent className="w-full overflow-y-auto rounded-md p-0 sm:max-w-2xl">
          <div className="px-6 py-5 pb-0">
            <SheetHeader className="p-0">
              <SheetTitle className="text-base font-semibold text-white">
                {editingTradeId ? "Edit missed trade" : "Add missed trade"}
              </SheetTitle>
              <SheetDescription className="text-xs text-white/40">
                Capture the missed trade with the same execution detail as a
                manual trade, then keep the process note beside it.
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
              {accounts.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">
                    Linked account (optional)
                  </Label>
                  <Select
                    value={draft.accountId ?? "__none"}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        accountId: value === "__none" ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No linked account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No linked account</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

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
                        draft.manualMarketType === option.value
                          ? TRADE_IDENTIFIER_TONES.info
                          : "text-white/45 hover:text-white/70"
                      )}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          manualMarketType: option.value,
                        }))
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">Symbol</Label>
                <Input
                  placeholder={getSymbolPlaceholder(draft.manualMarketType)}
                  value={draft.symbol}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      symbol: event.target.value.toUpperCase(),
                    }))
                  }
                />
                <SuggestionChips
                  suggestions={symbolSuggestions}
                  activeValue={draft.symbol}
                  onSelect={(value) =>
                    setDraft((current) => ({ ...current, symbol: value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">Direction</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                      draft.tradeType === "long"
                        ? TRADE_IDENTIFIER_TONES.positive
                        : "text-white/40 opacity-50"
                    )}
                    onClick={() =>
                      setDraft((current) => ({ ...current, tradeType: "long" }))
                    }
                  >
                    Long
                    <ArrowUpRight className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                      draft.tradeType === "short"
                        ? TRADE_IDENTIFIER_TONES.negative
                        : "text-white/40 opacity-50"
                    )}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        tradeType: "short",
                      }))
                    }
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
                    value={draft.volume}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        volume: event.target.value,
                      }))
                    }
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
                    activeValue={draft.volume}
                    onSelect={(value) =>
                      setDraft((current) => ({ ...current, volume: value }))
                    }
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
                    {formatHoldDuration(draft.openTime, draft.closeTime)}
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
                    value={draft.openPrice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        openPrice: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">Close price</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    placeholder="1.08750"
                    value={draft.closePrice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        closePrice: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TradeDateTimeField
                  label="Open time"
                  value={draft.openTime}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      openTime: nextValue,
                    }))
                  }
                  triggerClassName={cn(
                    TRADE_ACTION_BUTTON_CLASS,
                    "h-9 w-full justify-start px-3 text-left text-white/85"
                  )}
                />
                <TradeDateTimeField
                  label="Close time"
                  value={draft.closeTime}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      closeTime: nextValue,
                    }))
                  }
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
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      closeTime: createRoundedNow(),
                    }))
                  }
                >
                  Set close to now
                </Button>
                <Button
                  type="button"
                  className={cn(TRADE_ACTION_BUTTON_CLASS, "h-8")}
                  onClick={() =>
                    setDraft((current) => {
                      const nextOpenTime = new Date(current.closeTime);
                      nextOpenTime.setHours(nextOpenTime.getHours() - 1);
                      return { ...current, openTime: nextOpenTime };
                    })
                  }
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
                    value={draft.sl}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sl: event.target.value }))
                    }
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
                    value={draft.tp}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, tp: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
                  <p className="text-xs text-white/40">Estimated pips</p>
                  <p className="text-sm font-medium text-white/80">
                    {estimatedPips === null
                      ? "—"
                      : `${estimatedPips > 0 ? "+" : ""}${estimatedPips.toFixed(1)}`}
                  </p>
                </div>
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
                  <p className="text-xs text-white/40">Planned RR</p>
                  <p className="text-sm font-medium text-white/80">
                    {plannedRR === null ? "—" : `${plannedRR.toFixed(2)}R`}
                  </p>
                </div>
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
                  <p className="text-xs text-white/40">Time check</p>
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
                      checked={draft.autoCalculateProfit}
                      onCheckedChange={(checked) => {
                        const nextChecked = checked === true;
                        if (
                          !nextChecked &&
                          autoEstimatedProfit !== null &&
                          draft.estimatedProfit.trim().length === 0
                        ) {
                          setDraft((current) => ({
                            ...current,
                            estimatedProfit: autoEstimatedProfit.toFixed(2),
                            autoCalculateProfit: nextChecked,
                          }));
                          return;
                        }

                        setDraft((current) => ({
                          ...current,
                          autoCalculateProfit: nextChecked,
                        }));
                      }}
                    />
                    Auto-calculate from price
                  </label>
                </div>

                {draft.autoCalculateProfit ? (
                  <div
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "space-y-2 p-3",
                      autoEstimatedProfit === null
                        ? "text-white/45"
                        : autoEstimatedProfit >= 0
                        ? TRADE_IDENTIFIER_TONES.positive
                        : TRADE_IDENTIFIER_TONES.negative
                    )}
                  >
                    <p className="text-xs opacity-70">Estimated P&amp;L</p>
                    <p className="text-sm font-semibold">
                      {autoEstimatedProfit === null
                        ? "Enter entry, exit, and size to calculate it."
                        : formatMoney(autoEstimatedProfit)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="125.50"
                      value={draft.estimatedProfit}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          estimatedProfit: event.target.value,
                        }))
                      }
                    />
                    {autoEstimatedProfit !== null ? (
                      <Button
                        type="button"
                        className={cn(TRADE_ACTION_BUTTON_CLASS, "h-8")}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            estimatedProfit: autoEstimatedProfit.toFixed(2),
                          }))
                        }
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
                    value={draft.commissions}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        commissions: event.target.value,
                      }))
                    }
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
                    value={draft.swap}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, swap: event.target.value }))
                    }
                  />
                  <p className="text-[11px] text-white/35">
                    Negative for cost, positive for credit.
                  </p>
                </div>
              </div>

              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-1 p-3")}>
                <p className="text-xs text-white/40">Result after costs</p>
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
                    : formatMoney(netPreview)}
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
                  value={draft.sessionTag}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sessionTag: event.target.value,
                    }))
                  }
                />
                <SuggestionChips
                  suggestions={sessionTagSuggestions
                    .map((tag) => tag.name)
                    .filter(Boolean)
                    .slice(0, 6)}
                  activeValue={draft.sessionTag}
                  onSelect={(value) =>
                    setDraft((current) => ({ ...current, sessionTag: value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Model tag (optional)
                </Label>
                <Input
                  placeholder="Liquidity Raid"
                  value={draft.modelTag}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      modelTag: event.target.value,
                    }))
                  }
                />
                <SuggestionChips
                  suggestions={modelTagSuggestions
                    .map((tag) => tag.name)
                    .filter(Boolean)
                    .slice(0, 6)}
                  activeValue={draft.modelTag}
                  onSelect={(value) =>
                    setDraft((current) => ({ ...current, modelTag: value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Trade tags (optional)
                </Label>
                <TagMultiSelect
                  value={draft.customTags}
                  suggestions={customTagSuggestions}
                  placeholder="Add one or more trade tags"
                  onChange={(nextTags) =>
                    setDraft((current) => ({
                      ...current,
                      customTags: nextTags,
                    }))
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold tracking-wide text-white/70">
                Review
              </h3>
            </div>
            <Separator />
            <div className="space-y-4 px-6 py-5">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Why was it missed?
                </Label>
                <Textarea
                  placeholder="Late to session, no alert, hesitated after first reaction..."
                  value={draft.reasonMissed}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      reasonMissed: event.target.value,
                    }))
                  }
                  className="min-h-28"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Estimated outcome
                </Label>
                <Select
                  value={draft.estimatedOutcome || "__none"}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      estimatedOutcome: value === "__none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unclassified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unclassified</SelectItem>
                    {MISSED_TRADE_OUTCOME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold tracking-wide text-white/70">
                Notes & attachments
              </h3>
            </div>
            <Separator />
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Extra notes (optional)
                </Label>
                <Textarea
                  placeholder="Context, screenshots reviewed later, what you would do differently next time..."
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-32"
                />
              </div>

              {draft.mediaUrls.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Paperclip className="size-4 text-white/45" />
                    <span className="text-xs text-white/50">
                      Saved attachments
                    </span>
                  </div>
                  <SavedMediaGrid
                    mediaUrls={draft.mediaUrls}
                    onRemove={(index) =>
                      setDraft((current) => ({
                        ...current,
                        mediaUrls: current.mediaUrls.filter(
                          (_, currentIndex) => currentIndex !== index
                        ),
                      }))
                    }
                  />
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="size-4 text-white/45" />
                  <span className="text-xs text-white/50">
                    Add screenshots for the setup you missed.
                  </span>
                </div>
                <MediaDropzone
                  files={pendingMediaFiles}
                  onFilesSelected={(files) =>
                    setPendingMediaFiles((current) => [...current, ...files])
                  }
                  onFileRemove={(id) =>
                    setPendingMediaFiles((current) =>
                      current.filter((file) => file.id !== id)
                    )
                  }
                  accept="image"
                  maxFiles={4}
                  maxSize={8 * 1024 * 1024}
                  disabled={isSubmitting}
                />
              </div>
            </div>

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
                  onClick={handleResetDraft}
                  disabled={isSubmitting}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  className={cn(
                    TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                    "h-9 gap-2 rounded-sm",
                    validationMessage && "opacity-60"
                  )}
                  onClick={() => void handleSubmit()}
                  disabled={Boolean(validationMessage) || isSubmitting}
                >
                  {isSubmitting
                    ? editingTradeId
                      ? "Saving..."
                      : "Adding..."
                    : editingTradeId
                    ? "Save changes"
                    : "Add missed trade"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
