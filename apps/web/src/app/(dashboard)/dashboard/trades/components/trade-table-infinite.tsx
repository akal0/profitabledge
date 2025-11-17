"use client";

import * as React from "react";
import { useInView } from "react-intersection-observer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { trpc, queryClient } from "@/utils/trpc";
import { DataTable } from "@/components/data-table/index";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { useDataTable } from "@/hooks/use-data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccountStore } from "@/stores/account";
import TradesToolbar from "./trade-table-toolbar";
import { cn } from "@/lib/utils";
import { useQueryState, useQueryStates, parseAsString } from "nuqs";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type TradeRow = {
  id: string;
  tp: number;
  sl: number;
  open: string;
  close: string;
  openText?: string | null;
  closeText?: string | null;
  symbol: string;
  tradeDirection: "long" | "short";
  volume: number;
  profit: number;
  commissions?: number | null;
  swap?: number | null;
  createdAtISO: string;
  holdSeconds: number;
  // Optional widgets that can be enabled via Columns menu
  maxRR?: number | null;
  drawdown?: number | null;
};

type DirectionType = "all" | "long" | "short";

const columns: ColumnDef<TradeRow, any>[] = [
  // Selection column
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllRowsSelected() ||
          (table.getIsSomeRowsSelected() && "indeterminate")
        }
        onCheckedChange={(val) => table.toggleAllRowsSelected(!!val)}
        aria-label="Select all"
        className="translate-y-[2px] rounded-none border-white/5 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(val) => row.toggleSelected(!!val)}
        aria-label="Select row"
        className="translate-y-[2px] rounded-none border-white/5 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 32,
  },
  { accessorKey: "symbol", header: "Symbol" },
  {
    accessorKey: "tradeDirection",
    header: "Direction",
    cell: ({ getValue }) => {
      const v = getValue<string>();
      const label = v === "long" ? "Long" : "Short";
      return (
        <span
          className={cn(
            "font-medium tracking-wide flex w-max items-center gap-1 px-3 pr-2 py-1.5",
            v === "long"
              ? "bg-teal-800/15 rounded-xs text-teal-400 "
              : "bg-red-900/15 rounded-xs  text-rose-400"
          )}
        >
          {label}

          {v === "long" ? (
            <ArrowUpRight className="size-3 stroke-3" />
          ) : (
            <ArrowDownRight className="size-3 stroke-3" />
          )}
        </span>
      );
    },
  },
  {
    accessorKey: "TP",
    header: "TP",
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      const v = trade.tp;

      if (trade.tp) {
        return <span className="text-white/80">{v.toLocaleString()}</span>;
      } else {
        return <span className="text-white/80">—</span>;
      }
    },
  },
  {
    accessorKey: "SL",
    header: "SL",
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      const v = trade.sl;

      if (trade.sl) {
        return <span className="text-white/80">{v.toLocaleString()}</span>;
      } else {
        return <span className="text-white/80">—</span>;
      }
    },
  },
  {
    accessorKey: "open",
    header: "Open",
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      if (trade.openText) {
        return (
          <p className="text-white font-medium tracking-wide">
            {trade.openText}
          </p>
        );
      }
      const d = new Date(getValue<string>());
      const day = d.getDate();
      const j = day % 10;
      const k = day % 100;
      const suf =
        j === 1 && k !== 11
          ? "st"
          : j === 2 && k !== 12
          ? "nd"
          : j === 3 && k !== 13
          ? "rd"
          : "th";
      const month = d.toLocaleString("en-GB", { month: "short" }); // e.g., Oct
      const year = d.getFullYear();
      const datePart = `${day}${suf} ${month}' ${year}`;
      const timePart = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return (
        <p className="text-white font-medium tracking-wide">
          <span className="text-white/50 font-normal"> {datePart} </span>
          {`- ${timePart}`}
        </p>
      );
    },
  },
  {
    accessorKey: "close",
    header: "Close",
    cell: ({ getValue, row }) => {
      const trade = row.original as TradeRow;
      if (trade.closeText) {
        return (
          <p className="text-white font-medium tracking-wide">
            {trade.closeText}
          </p>
        );
      }
      const d = new Date(getValue<string>());
      const day = d.getDate();
      const j = day % 10;
      const k = day % 100;
      const suf =
        j === 1 && k !== 11
          ? "st"
          : j === 2 && k !== 12
          ? "nd"
          : j === 3 && k !== 13
          ? "rd"
          : "th";
      const month = d.toLocaleString("en-GB", { month: "short" });
      const year = d.getFullYear();
      const datePart = `${day}${suf} ${month}' ${year}`;
      const timePart = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return (
        <p className="text-white font-medium tracking-wide">
          <span className="text-white/50 font-normal"> {datePart} </span>
          {`- ${timePart}`}
        </p>
      );
    },
  },
  {
    accessorKey: "holdSeconds",
    header: "Hold time",
    cell: ({ getValue }) => {
      const totalSec = Number(getValue<number>() || 0);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      const parts = [
        hours > 0 ? `${hours}h` : null,
        minutes > 0 ? `${minutes}m` : null,
        `${seconds}s`,
      ].filter(Boolean);
      return <span className="text-white/80">{parts.join(" ")}</span>;
    },
  },
  {
    accessorKey: "volume",
    header: "Volume",
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      return (
        <span className="text-white font-medium tracking-wide">
          {v.toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "profit",
    header: "P/L",
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      const neg = v < 0;
      const abs = Math.abs(v);
      const formatted = Number.isInteger(abs)
        ? abs.toLocaleString()
        : abs.toFixed(2);
      return (
        <span
          className={
            neg
              ? "bg-red-900/15 rounded-xs px-4 py-1.5 text-rose-400 font-medium tracking-wide"
              : "bg-teal-800/15 rounded-xs text-teal-400 px-4 py-1.5 font-medium tracking-wide"
          }
        >
          {(neg ? "-" : "") + "$" + formatted}
        </span>
      );
    },
  },
  {
    accessorKey: "commissions",
    header: "Commissions",
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      const neg = v < 0;
      return (
        <span
          className={
            neg
              ? "bg-red-900/15 rounded-xs px-4 py-1.5 text-rose-400 font-medium tracking-wide"
              : "bg-neutral-800/25 rounded-xs px-4 py-1.5 text-white/40 font-medium tracking-wide"
          }
        >
          {(neg ? "-" : "") + "$" + Math.abs(v).toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "swap",
    header: "Swap",
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      const neg = v < 0;
      return (
        <span
          className={
            neg
              ? "bg-red-900/15 rounded-xs px-4 py-1.5 text-rose-400 font-medium tracking-wide"
              : v === 0
              ? "bg-neutral-800/25 rounded-xs px-4 py-1.5 text-white/40 font-medium tracking-wide"
              : "bg-teal-800/15 rounded-xs text-teal-400 px-4 py-1.5 font-medium tracking-wide"
          }
        >
          {(neg ? "-" : "") + "$" + Math.abs(v).toLocaleString()}
        </span>
      );
    },
  },
  // Additional optional widget columns (hidden by default)
  {
    accessorKey: "maxRR",
    header: "Max R/R",
    cell: ({ getValue }) => {
      const v = getValue<number | null | undefined>();
      if (v == null) return <span className="text-white/40">—</span>;
      // const abs = Math.abs(v);
      // const formatted = Number.isInteger(abs)
      //   ? abs.toLocaleString()
      //   : abs.toFixed(2);
      // return <span className="text-white/70">{formatted}</span>;
    },
  },

  {
    accessorKey: "drawdown",
    header: "Max drawdown",
    cell: ({ row }) => {
      const trade = row.original as TradeRow;
      const debug =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("duka") === "1";
      const opts = trpc.trades.drawdownForTrade.queryOptions({
        id: trade.id,
        debug,
      });
      const q = useQuery({
        ...opts,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      });
      const [reveal, setReveal] = React.useState(false);
      React.useEffect(() => {
        if (q.isSuccess) {
          const handle = setTimeout(() => setReveal(true), row.index * 250);
          return () => clearTimeout(handle);
        } else {
          setReveal(false);
        }
      }, [q.isSuccess, row.index]);
      if (q.isLoading)
        return (
          <Skeleton className="h-5 w-[120px] bg-sidebar-accent rounded-none" />
        );
      if (!reveal)
        return (
          <Skeleton className="h-5 w-[120px] bg-sidebar-accent rounded-none" />
        );
      const d = q.data as
        | {
            id: string;
            adversePips: number | null;
            pctToSL: number | null;
            hit: "SL" | "CLOSE" | "NONE" | "BE";
          }
        | null
        | undefined;
      if (!d) return <span className="text-white/40">—</span>;
      if ((d as any).note === "NO_SL") {
        return (
          <span className="bg-neutral-800/25 rounded-xs px-4 py-1.5 text-white/60 text-xs font-medium tracking-wide">
            No SL
          </span>
        );
      }
      if (d.hit === "BE") {
        return (
          <span className="rounded-xs px-4 py-1.5  text-xs font-medium tracking-wide bg-sidebar-accent text-white/50">
            SL moved
          </span>
        );
      }
      if (d.adversePips == null)
        return <span className="text-white/40">—</span>;
      const pips = d.adversePips;
      const usd = (d as any).adverseUsd as number | undefined;
      const pct = d.pctToSL;
      let ddParam = "percent";
      if (typeof window !== "undefined") {
        try {
          const sp = new URLSearchParams(window.location.search);
          ddParam = sp.get("dd") || "percent";
        } catch {}
      }
      const isPercentMode = ddParam === "percent";
      const isUsdMode = ddParam === "usd";
      const formatCompact = (n: number) => {
        const rounded = Math.round(n * 100) / 100;
        return Number.isInteger(rounded)
          ? String(Math.trunc(rounded))
          : String(rounded);
      };
      const pctDisplay = pct != null ? pct : 0;
      let label: string;
      if (isPercentMode) label = `${Math.round(pctDisplay)}%`;
      else if (isUsdMode)
        label = usd != null ? `$${Number(usd).toLocaleString()}` : "$0";
      else label = `${formatCompact(pips)} pips`;
      // Determine chip style based on percent-to-SL bucket
      const pctValue = Math.max(0, Math.min(100, Number(pctDisplay)));
      let chipClass = "";
      if (pctValue === 0) {
        chipClass = "bg-sidebar-accent text-white/50";
      } else if (pctValue < 25) {
        chipClass = "bg-teal-900/25 text-teal-300";
      } else if (pctValue < 50) {
        chipClass = "bg-yellow-300/25 text-yellow-300";
      } else if (pctValue < 75) {
        chipClass = "bg-yellow-400/25 text-yellow-300";
      } else if (pctValue < 99) {
        chipClass = "bg-amber-900/25 text-amber-500";
      } else {
        chipClass = "bg-red-900/25 text-rose-400";
      }
      return (
        <span
          className={cn(
            "px-4 py-1.5 rounded-xs text-xs font-medium tracking-wide",
            chipClass
          )}
        >
          {label}
        </span>
      );
    },
  },
];

export default function TradeTableInfinite() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const { ref, inView } = useInView({ rootMargin: "200px" });
  // URL-synced query params
  const [qParam, setQParam] = useQueryState("q", { defaultValue: "" });

  const [slParam, setSlParam] = useQueryState("sl", { defaultValue: "" });
  const [tpParam, setTpParam] = useQueryState("tp", { defaultValue: "" });

  const [dirParam, setDirParam] = useQueryState("dir", { defaultValue: "all" });
  const [symbolsParam, setSymbolsParam] = useQueryState("symbols", {
    defaultValue: "",
  });

  const [holdParam, setHoldParam] = useQueryState("hold", { defaultValue: "" });
  const [volParam, setVolParam] = useQueryState("vol", { defaultValue: "" });
  const [plParam, setPlParam] = useQueryState("pl", { defaultValue: "" });
  const [comParam, setComParam] = useQueryState("com", { defaultValue: "" });
  const [swapParam, setSwapParam] = useQueryState("swap", { defaultValue: "" });
  const [sortParam, setSortParam] = useQueryState("sort", {
    defaultValue: "open:desc",
  });
  const [{ oStart, oEnd }, setRangeParams] = useQueryStates(
    {
      oStart: parseAsString.withDefault(""),
      oEnd: parseAsString.withDefault(""),
    },
    { history: "push" }
  );
  // single date range filter only (open dates), close filter removed

  // Derived UI state
  const q = qParam || "";
  const tradeDirection: DirectionType =
    dirParam === "long" || dirParam === "short" || dirParam === "all"
      ? (dirParam as DirectionType)
      : "all";
  const symbols = React.useMemo(
    () => (symbolsParam ? symbolsParam.split(",").filter(Boolean) : []),
    [symbolsParam]
  );
  const start = oStart ? new Date(oStart) : undefined;
  const end = oEnd ? new Date(oEnd) : undefined;
  const parseRange = (param: string): [number, number] | undefined => {
    if (!param) return undefined;
    // Prefer colon-delimited first: lo:hi
    if (param.includes(":")) {
      const [loS, hiS] = param.split(":");
      const lo = Number(loS);
      const hi = Number(hiS);
      if (Number.isFinite(lo) && Number.isFinite(hi)) return [lo, hi];
    }
    // Fallback: signed hyphen-delimited, e.g., -100--50 or -100-50 or 10-200
    const m = param.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
    if (m) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      if (Number.isFinite(lo) && Number.isFinite(hi)) return [lo, hi];
    }
    return undefined;
  };
  const holdRange: [number, number] | undefined = React.useMemo(
    () => parseRange(holdParam),
    [holdParam]
  );
  const volRange = React.useMemo(() => parseRange(volParam), [volParam]);
  const plRange = React.useMemo(() => parseRange(plParam), [plParam]);
  const comRange = React.useMemo(() => parseRange(comParam), [comParam]);
  const swapRange = React.useMemo(() => parseRange(swapParam), [swapParam]);

  const slRange = React.useMemo(() => parseRange(slParam), [slParam]);
  const tpRange = React.useMemo(() => parseRange(tpParam), [tpParam]);

  // Per-account bounds for picker presets (earliest open .. latest open)
  const boundsOpts = trpc.accounts.opensBounds.queryOptions({
    accountId: accountId || "",
  });
  const { data: bounds } = useQuery({
    ...boundsOpts,
    enabled: Boolean(accountId),
  });
  const minBound = bounds?.minISO ? new Date(bounds.minISO) : undefined;
  const maxBound = bounds?.maxISO ? new Date(bounds.maxISO) : undefined;

  // All symbols for account
  const symbolsOpts = trpc.trades.listSymbols.queryOptions({
    accountId: accountId || "",
  });
  const { data: allSymbols } = useQuery({
    ...symbolsOpts,
    enabled: Boolean(accountId),
  });
  const statsOpts = trpc.accounts.stats.queryOptions({
    accountId: accountId || "",
  });
  const { data: acctStats } = useQuery({
    ...statsOpts,
    enabled: Boolean(accountId),
  });

  const infiniteOpts = trpc.trades.listInfinite.infiniteQueryOptions(
    {
      accountId: accountId || "",
      limit: 50,
      q: q || undefined,
      tradeDirection:
        tradeDirection === "all"
          ? undefined
          : (tradeDirection as "long" | "short"),
      symbols: symbols.length ? symbols : undefined,
      // Always fetch all; client filters by open date to avoid createdAt mismatch
      startISO: undefined,
      endISO: undefined,
    },
    { getNextPageParam: (last: any) => last?.nextCursor }
  );

  // No need to manually remove queries; query key already changes when server-side filters change

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({ ...infiniteOpts, enabled: Boolean(accountId) });

  // Load more only when sentinel in view

  const rows = React.useMemo<TradeRow[]>(() => {
    const pages = (data as any)?.pages as
      | Array<{ items: TradeRow[] }>
      | undefined;
    if (!pages) return [];
    return pages.flatMap((p) => p.items);
  }, [data]);

  const [ddMode, setDdMode] = useQueryState("dd", { defaultValue: "percent" });
  const [dukaDebug, setDukaDebug] = useQueryState("duka", {
    defaultValue: "0",
  });

  const displayRows = React.useMemo<TradeRow[]>(() => {
    let filtered = rows;
    if (start && end) {
      const startMs = new Date(start).setHours(0, 0, 0, 0);
      const endMs = new Date(end).setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => {
        const t = Date.parse(r.open);
        const c = Date.parse(r.close);
        // include rows whose open OR close falls within the window
        return (
          (!Number.isNaN(t) && t >= startMs && t <= endMs) ||
          (!Number.isNaN(c) && c >= startMs && c <= endMs)
        );
      });
    }
    if (holdRange) {
      const [lo, hi] = holdRange;
      filtered = filtered.filter(
        (r) => r.holdSeconds >= lo && r.holdSeconds <= hi
      );
    }
    if (volRange) {
      const [lo, hi] = volRange;
      filtered = filtered.filter((r) => r.volume >= lo && r.volume <= hi);
    }
    if (plRange) {
      const [lo, hi] = plRange;
      filtered = filtered.filter((r) => r.profit >= lo && r.profit <= hi);
    }
    if (comRange) {
      const [lo, hi] = comRange;
      filtered = filtered.filter(
        (r) =>
          Number(r.commissions || 0) >= lo && Number(r.commissions || 0) <= hi
      );
    }
    if (swapRange) {
      const [lo, hi] = swapRange;
      filtered = filtered.filter(
        (r) => Number(r.swap || 0) >= lo && Number(r.swap || 0) <= hi
      );
    }
    return filtered;
  }, [
    rows,
    start?.getTime(),
    end?.getTime(),
    holdRange?.[0],
    holdRange?.[1],
    volRange?.[0],
    volRange?.[1],
    plRange?.[0],
    plRange?.[1],
    comRange?.[0],
    comRange?.[1],
    swapRange?.[0],
    swapRange?.[1],
  ]);

  // Filter rows for histogram/preview counts based on all current filters except hold time
  const rowsForHoldPreview = React.useMemo<TradeRow[]>(() => {
    let filtered = rows;
    if (start && end) {
      const startMs = new Date(start).setHours(0, 0, 0, 0);
      const endMs = new Date(end).setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => {
        const t = Date.parse(r.open);
        const c = Date.parse(r.close);
        return (
          (!Number.isNaN(t) && t >= startMs && t <= endMs) ||
          (!Number.isNaN(c) && c >= startMs && c <= endMs)
        );
      });
    }
    // direction
    if (tradeDirection !== "all") {
      filtered = filtered.filter((r) => r.tradeDirection === tradeDirection);
    }
    // symbols
    if (symbols.length) {
      const set = new Set(symbols);
      filtered = filtered.filter((r) => set.has(r.symbol));
    }
    // q (symbol search)
    if (q) {
      const needle = q.toLowerCase();
      filtered = filtered.filter((r) =>
        r.symbol.toLowerCase().includes(needle)
      );
    }
    return filtered;
  }, [rows, start?.getTime(), end?.getTime(), tradeDirection, symbols, q]);

  const buildPreview = (exclude: "hold" | "vol" | "pl" | "com" | "swap") => {
    return rowsForHoldPreview.filter((r) => {
      let ok = true;
      if (exclude !== "hold" && holdRange) {
        const [lo, hi] = holdRange;
        ok = ok && r.holdSeconds >= lo && r.holdSeconds <= hi;
      }
      if (exclude !== "vol" && volRange) {
        const [lo, hi] = volRange;
        ok = ok && r.volume >= lo && r.volume <= hi;
      }
      if (exclude !== "pl" && plRange) {
        const [lo, hi] = plRange;
        ok = ok && r.profit >= lo && r.profit <= hi;
      }
      if (exclude !== "com" && comRange) {
        const [lo, hi] = comRange;
        ok =
          ok &&
          Number(r.commissions || 0) >= lo &&
          Number(r.commissions || 0) <= hi;
      }
      if (exclude !== "swap" && swapRange) {
        const [lo, hi] = swapRange;
        ok = ok && Number(r.swap || 0) >= lo && Number(r.swap || 0) <= hi;
      }
      return ok;
    });
  };

  // Filter rows for symbols preview based on all current filters EXCEPT symbol
  const rowsForSymbolPreview = React.useMemo<TradeRow[]>(() => {
    let filtered = rows;
    if (start && end) {
      const startMs = new Date(start).setHours(0, 0, 0, 0);
      const endMs = new Date(end).setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => {
        const t = Date.parse(r.open);
        const c = Date.parse(r.close);
        return (
          (!Number.isNaN(t) && t >= startMs && t <= endMs) ||
          (!Number.isNaN(c) && c >= startMs && c <= endMs)
        );
      });
    }
    // direction
    if (tradeDirection !== "all") {
      filtered = filtered.filter((r) => r.tradeDirection === tradeDirection);
    }
    // q (symbol search)
    if (q) {
      const needle = q.toLowerCase();
      filtered = filtered.filter((r) =>
        r.symbol.toLowerCase().includes(needle)
      );
    }
    // numeric filters
    if (holdRange) {
      const [lo, hi] = holdRange;
      filtered = filtered.filter(
        (r) => r.holdSeconds >= lo && r.holdSeconds <= hi
      );
    }
    if (volRange) {
      const [lo, hi] = volRange;
      filtered = filtered.filter((r) => r.volume >= lo && r.volume <= hi);
    }
    if (plRange) {
      const [lo, hi] = plRange;
      filtered = filtered.filter((r) => r.profit >= lo && r.profit <= hi);
    }
    if (comRange) {
      const [lo, hi] = comRange;
      filtered = filtered.filter(
        (r) =>
          Number(r.commissions || 0) >= lo && Number(r.commissions || 0) <= hi
      );
    }
    if (swapRange) {
      const [lo, hi] = swapRange;
      filtered = filtered.filter(
        (r) => Number(r.swap || 0) >= lo && Number(r.swap || 0) <= hi
      );
    }
    // IMPORTANT: do NOT apply symbol filter here
    return filtered;
  }, [
    rows,
    start?.getTime(),
    end?.getTime(),
    tradeDirection,
    q,
    holdRange?.[0],
    holdRange?.[1],
    volRange?.[0],
    volRange?.[1],
    plRange?.[0],
    plRange?.[1],
    comRange?.[0],
    comRange?.[1],
    swapRange?.[0],
    swapRange?.[1],
  ]);

  const symbolCounts = React.useMemo(() => {
    const rec: Record<string, number> = {};
    for (const r of rowsForSymbolPreview) {
      rec[r.symbol] = (rec[r.symbol] || 0) + 1;
    }
    return rec;
  }, [rowsForSymbolPreview]);
  const symbolTotal = rowsForSymbolPreview.length;

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { table, sorting, setSorting } = useDataTable<TradeRow>({
    data: displayRows,
    columns,
    tableId: "trades",
    initialVisibility: { maxRR: false, drawdown: false },
  });

  const [openSheet, setOpenSheet] = React.useState(false);
  const [selectedTrade, setSelectedTrade] = React.useState<TradeRow | null>(
    null
  );
  const handleRowClick = React.useCallback((row: TradeRow) => {
    setSelectedTrade(row);
    setOpenSheet(true);
  }, []);

  const formatSheetDate = React.useCallback((iso: string) => {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day} ${month}' ${year}`;
  }, []);
  const isSameCalendarDate = React.useCallback((aIso: string, bIso: string) => {
    const a = new Date(aIso);
    const b = new Date(bIso);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }, []);

  // Apply URL sort to table (guard to avoid loops)
  React.useEffect(() => {
    const desired: { id: string; desc: boolean }[] = (sortParam || "open:desc")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [id, dir] = p.split(":");
        if (!id) return null as any;
        return { id, desc: dir === "desc" };
      })
      .filter(Boolean) as { id: string; desc: boolean }[];
    setSorting(desired as any);
  }, [sortParam, setSorting]);

  // Note: URL is updated by toolbar events; no sorting->URL effect to avoid loops

  // Listen for toolbar apply-sort events
  React.useEffect(() => {
    function onApplySort(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (!detail) return;
      const [id, dir] = String(detail).split(":");
      if (!id) return;
      setSorting([{ id, desc: dir === "desc" }] as any);
      setSortParam(detail || null);
    }
    function onClearSort() {
      setSorting([{ id: "open", desc: true }] as any);
      setSortParam("open:desc");
    }
    globalThis.addEventListener("apply-sort", onApplySort as any);
    globalThis.addEventListener("clear-sort", onClearSort as any);
    return () => {
      globalThis.removeEventListener("apply-sort", onApplySort as any);
      globalThis.removeEventListener("clear-sort", onClearSort as any);
    };
  }, [setSorting, setSortParam]);

  console.log(displayRows);

  return (
    <div className="w-full">
      <TradesToolbar
        q={q}
        table={table}
        tableId="trades"
        onQChange={(val) => setQParam(val || null)}
        tradeDirection={tradeDirection}
        onDirectionChange={(d) => setDirParam(d)}
        symbols={symbols}
        onSymbolsChange={(arr) =>
          setSymbolsParam(arr.length ? arr.join(",") : null)
        }
        symbolCounts={symbolCounts}
        symbolTotal={symbolTotal}
        sortValue={sortParam || ""}
        start={start}
        end={end}
        minBound={minBound}
        maxBound={maxBound}
        allSymbols={allSymbols || []}
        holdMin={holdRange?.[0]}
        holdMax={holdRange?.[1]}
        holdHistogram={rowsForHoldPreview.map((r) => r.holdSeconds)}
        onHoldCommit={(lo, hi) =>
          setHoldParam(`${Math.floor(lo)}-${Math.floor(hi)}`)
        }
        onHoldClear={() => setHoldParam(null)}
        volumeMin={volRange?.[0]}
        volumeMax={volRange?.[1]}
        volumeHistogram={buildPreview("vol").map((r) => r.volume)}
        onVolumeCommit={(lo, hi) =>
          setVolParam(`${Math.floor(lo)}-${Math.floor(hi)}`)
        }
        onVolumeClear={() => setVolParam(null)}
        profitMin={plRange?.[0]}
        profitMax={plRange?.[1]}
        profitHistogram={buildPreview("pl").map((r) => r.profit)}
        onProfitCommit={(lo, hi) =>
          setPlParam(`${Math.floor(lo)}-${Math.floor(hi)}`)
        }
        onProfitClear={() => setPlParam(null)}
        commissionsMin={comRange?.[0]}
        commissionsMax={comRange?.[1]}
        commissionsHistogram={buildPreview("com").map((r) =>
          Number(r.commissions || 0)
        )}
        onCommissionsCommit={(lo, hi) =>
          setComParam(`${Math.floor(lo)}-${Math.floor(hi)}`)
        }
        onCommissionsClear={() => setComParam(null)}
        swapMin={swapRange?.[0]}
        swapMax={swapRange?.[1]}
        swapHistogram={buildPreview("swap").map((r) => Number(r.swap || 0))}
        onSwapCommit={(lo, hi) =>
          setSwapParam(`${Math.floor(lo)}-${Math.floor(hi)}`)
        }
        onSwapClear={() => setSwapParam(null)}
        ddMode={ddMode as any as "pips" | "percent" | "usd"}
        onDdModeChange={(m) => setDdMode(m)}
        dukaDebug={dukaDebug === "1"}
        onDukaDebugChange={(enabled) => setDukaDebug(enabled ? "1" : "0")}
        onRangeChange={(s, e) => {
          if (!s || !e) {
            setRangeParams({ oStart: null, oEnd: null });
          } else {
            const toYMD = (d: Date) => d.toISOString().slice(0, 10);
            const ns = toYMD(s);
            const ne = toYMD(e);
            const updates: { oStart?: string | null; oEnd?: string | null } =
              {};
            if (ns !== (oStart || "")) updates.oStart = ns;
            if (ne !== (oEnd || "")) updates.oEnd = ne;
            if (Object.keys(updates).length) setRangeParams(updates);
          }
        }}
      />

      <DataTable
        key={
          (accountId || "") +
          "|" +
          tradeDirection +
          "|" +
          (q || "") +
          "|" +
          (symbols.slice().sort().join(",") || "") +
          "|" +
          (start ? start.toISOString() : "") +
          "|" +
          (end ? end.toISOString() : "") +
          "|" +
          (holdParam || "") +
          "|" +
          (volParam || "") +
          "|" +
          (plParam || "") +
          "|" +
          (comParam || "") +
          "|" +
          (swapParam || "")
        }
        table={table}
        onRowClick={handleRowClick}
      />

      <div ref={ref} className="py-6 text-center text-xs text-white/40">
        {isFetchingNextPage
          ? "Loading more..."
          : hasNextPage
          ? "Scroll to load more"
          : "You've reached the end of all trades for this account."}
      </div>

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="right">
          <SheetHeader className="px-6 pb-2">
            {selectedTrade ? (
              <div className="flex justify-between w-full">
                <div className="flex flex-col items-start gap-2">
                  <SheetTitle className="font-semibold text-xs tracking-wide">
                    {selectedTrade ? selectedTrade.symbol : ""}
                  </SheetTitle>
                  {(() => {
                    const initial = Number(acctStats?.initialBalance || 0);
                    const profit = Number(selectedTrade?.profit || 0);
                    const pct = initial > 0 ? (profit / initial) * 100 : null;
                    if (pct == null) return null;
                    const abs = Math.abs(pct);
                    const pctText = Number.isInteger(abs)
                      ? Math.round(abs).toString()
                      : abs.toFixed(2);
                    const pos = pct >= 0;
                    return (
                      <span
                        className={
                          pos
                            ? "bg-teal-800/15 text-teal-400 rounded-xs px-3 py-1 text-[10px] font-medium tracking-wide"
                            : "bg-red-900/15 text-rose-400 rounded-xs px-3 py-1 text-[10px] font-medium tracking-wide"
                        }
                      >
                        {(pos ? "+" : "-") + pctText}%
                      </span>
                    );
                  })()}
                </div>

                <div className="flex flex-col gap-2 text-xs w-full items-end">
                  <div className="flex items-center gap-2 text-white/40 font-medium">
                    {(() => {
                      const same = isSameCalendarDate(
                        selectedTrade.open,
                        selectedTrade.close
                      );
                      return same ? (
                        <span>{formatSheetDate(selectedTrade.open)}</span>
                      ) : (
                        <>
                          <span>{formatSheetDate(selectedTrade.open)}</span>
                          <span>-</span>
                          <span>{formatSheetDate(selectedTrade.close)}</span>
                        </>
                      );
                    })()}
                  </div>

                  <span className="font-medium tracking-wide">
                    {(() => {
                      const s = Number(selectedTrade.holdSeconds || 0);
                      const h = Math.floor(s / 3600);
                      const m = Math.floor((s % 3600) / 60);
                      const sec = s % 60;
                      return [h ? `${h}h` : null, m ? `${m}m` : null, `${sec}s`]
                        .filter(Boolean)
                        .join(" ");
                    })()}
                  </span>
                </div>
              </div>
            ) : null}
          </SheetHeader>

          <Separator />

          {selectedTrade ? (
            <div className="px-6 py-2 text-sm grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-2.5 col-span-2">
                <span className="text-white/50 text-xs">
                  {selectedTrade.profit < 0 ? "Profit gained" : "Loss incurred"}
                </span>
                <span
                  className={cn(
                    "capitalize w-max px-4 py-2 rounded-xs text-xs font-medium tracking-wide flex items-center gap-1",
                    selectedTrade.profit < 0
                      ? "bg-teal-800/15 text-teal-400"
                      : "bg-red-900/15 text-rose-400"
                  )}
                >
                  {(selectedTrade.profit < 0 ? "-" : "") +
                    "$" +
                    Math.abs(selectedTrade.profit).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 col-span-2">
                <span className="text-white/50 text-xs">Direction</span>
                <span
                  className={cn(
                    "capitalize w-max px-4 py-2 rounded-xs text-xs font-medium tracking-wide flex items-center gap-1",
                    selectedTrade.tradeDirection === "long"
                      ? "bg-teal-800/15 text-teal-400 "
                      : "bg-red-900/15 text-rose-400 "
                  )}
                >
                  {selectedTrade.tradeDirection}

                  {selectedTrade.tradeDirection === "long" ? (
                    <ArrowUpRight className="size-3 stroke-3" />
                  ) : (
                    <ArrowDownRight className="size-3 stroke-3" />
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/50">Volume</span>
                <span>{selectedTrade.volume.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/50">Commissions</span>
                <span
                  className={
                    Number(selectedTrade.commissions || 0) < 0
                      ? "text-rose-400"
                      : "text-white/70"
                  }
                >
                  {(Number(selectedTrade.commissions || 0) < 0 ? "-" : "") +
                    "$" +
                    Math.abs(
                      Number(selectedTrade.commissions || 0)
                    ).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/50">Swap</span>
                <span
                  className={
                    Number(selectedTrade.swap || 0) < 0
                      ? "text-rose-400"
                      : Number(selectedTrade.swap || 0) > 0
                      ? "text-teal-400"
                      : "text-white/70"
                  }
                >
                  {(Number(selectedTrade.swap || 0) < 0 ? "-" : "") +
                    "$" +
                    Math.abs(Number(selectedTrade.swap || 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Hold time</span>
                <span>
                  {(() => {
                    const s = Number(selectedTrade.holdSeconds || 0);
                    const h = Math.floor(s / 3600);
                    const m = Math.floor((s % 3600) / 60);
                    const sec = s % 60;
                    return [h ? `${h}h` : null, m ? `${m}m` : null, `${sec}s`]
                      .filter(Boolean)
                      .join(" ");
                  })()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Created</span>
                <span>
                  {new Date(selectedTrade.createdAtISO).toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
