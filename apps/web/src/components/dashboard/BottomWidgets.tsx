"use client";

import * as React from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { WidgetType } from "./TopWidgets";
import { Skeleton } from "@/components/ui/skeleton";

// Local card wrapper and default cards (simple placeholders)
function BWCard({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
      <div className="flex w-full justify-between items-center px-5 py-4">
        <h2 className="text-xs font-semibold">
          <span className="px-0">{title}</span>
        </h2>
      </div>
      <div className="bg-white dark:bg-sidebar-accent transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-center items-center h-full w-full">
        {children ?? (
          <div className="text-xs text-secondary">Configure this card</div>
        )}
      </div>
    </div>
  );
}

const LocalAccountBalanceCard: React.FC<{ accountId?: string }> = () => (
  <BWCard title="Account balance" />
);
const LocalWinRateCard: React.FC<{ accountId?: string }> = () => (
  <BWCard title="Win rate" />
);
const LocalWinStreakCard: React.FC<{ accountId?: string }> = () => (
  <BWCard title="Win streak" />
);
const LocalProfitFactorCard: React.FC<{ accountId?: string }> = () => (
  <BWCard title="Profit factor" />
);

type WidgetComponent = React.ComponentType<{ accountId?: string }>;

type BottomWidgetsProps = {
  enabledWidgets: WidgetType[];
  accountId?: string;
  // Optional registry to swap in any custom components (e.g., from TopWidgets)
  registry?: Partial<Record<WidgetType, WidgetComponent>>;
};

const defaultRegistry: Record<WidgetType, WidgetComponent> = {
  "account-balance": LocalAccountBalanceCard,
  "win-rate": LocalWinRateCard,
  "win-streak": LocalWinStreakCard,
  "profit-factor": LocalProfitFactorCard,
};

const LS_PREFIX = "react-resizable-panels:layout:";
const IDS = {
  v: "bottomwidgets:root:v1",
  top: "bottomwidgets:top:v1",
  bottom: "bottomwidgets:bottom:v1",
} as const;

function readCookie(name: string): number[] | undefined {
  if (typeof document === "undefined") return undefined;
  const key = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(key)) {
      try {
        const parsed = JSON.parse(decodeURIComponent(part.slice(key.length)));
        if (
          Array.isArray(parsed) &&
          parsed.every((n) => typeof n === "number")
        ) {
          return parsed as number[];
        }
      } catch {}
    }
  }
  return undefined;
}

function writeCookie(name: string, sizes: number[]) {
  if (typeof document === "undefined") return;
  const val = encodeURIComponent(JSON.stringify(sizes));
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${name}=${val}; path=/; max-age=${maxAge}`;
}

function readLS(id: string): number[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed as number[];
    }
  } catch {}
  return undefined;
}

function writeLS(id: string, sizes: number[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + id, JSON.stringify(sizes));
  } catch {}
}

export default function BottomWidgets({
  enabledWidgets,
  accountId,
  registry,
}: BottomWidgetsProps) {
  const map = React.useMemo(
    () => ({ ...defaultRegistry, ...(registry ?? {}) }),
    [registry]
  );

  const [mounted, setMounted] = React.useState(false);
  const [vSizes, setVSizes] = React.useState<[number, number]>([50, 50]);
  const [topSizes, setTopSizes] = React.useState<[number, number]>([50, 50]);
  const [bottomSizes, setBottomSizes] = React.useState<[number, number]>([
    50, 50,
  ]);

  // Ensure exactly 4 slots (fill missing with undefined)
  const slots = React.useMemo(() => {
    const list = enabledWidgets.slice(0, 4);
    while (list.length < 4) list.push(undefined as unknown as WidgetType);
    return list as (WidgetType | undefined)[];
  }, [enabledWidgets]);

  const renderSlot = (slot: WidgetType | undefined, key: string) => {
    if (!slot) {
      return (
        <div
          key={key}
          className="bg-muted/50 dark:bg-sidebar-accent rounded-md h-full w-full"
        />
      );
    }
    const Card = map[slot];
    return (
      <div key={key} className="h-full w-full">
        <Card accountId={accountId} />
      </div>
    );
  };

  // Sync cookie and localStorage before rendering resizable layout to avoid flicker
  React.useEffect(() => {
    const v = readCookie("rrp:bottomwidgets:v") ?? readLS(IDS.v) ?? [50, 50];
    const t = readCookie("rrp:bottomwidgets:top") ??
      readLS(IDS.top) ?? [50, 50];
    const b = readCookie("rrp:bottomwidgets:bottom") ??
      readLS(IDS.bottom) ?? [50, 50];

    const norm = (arr: number[]) => {
      if (arr.length !== 2) return [50, 50] as [number, number];
      const sum = arr[0] + arr[1] || 100;
      return [
        Math.max(0, (arr[0] / sum) * 100),
        Math.max(0, (arr[1] / sum) * 100),
      ] as [number, number];
    };

    const vN = norm(v);
    const tN = norm(t);
    const bN = norm(b);

    writeCookie("rrp:bottomwidgets:v", vN);
    writeLS(IDS.v, vN);
    writeCookie("rrp:bottomwidgets:top", tN);
    writeLS(IDS.top, tN);
    writeCookie("rrp:bottomwidgets:bottom", bN);
    writeLS(IDS.bottom, bN);

    setVSizes(vN);
    setTopSizes(tN);
    setBottomSizes(bN);
    setMounted(true);
  }, []);

  if (!mounted) {
    // SSR/first paint skeleton: 2x2 grid at 50/50 (no resizable, no handles)
    return (
      <div className="w-full min-h-[400px] rounded-xl overflow-hidden">
        <div className="grid grid-rows-2 gap-2">
          <div className="grid grid-cols-2 gap-2 min-h-[200px]">
            <Skeleton className="h-48 w-full rounded-md bg-muted/50 dark:bg-sidebar-accent" />
            <Skeleton className="h-48 w-full rounded-md bg-muted/50 dark:bg-sidebar-accent" />
          </div>
          <div className="grid grid-cols-2 gap-2 min-h-[200px]">
            <Skeleton className="h-48 w-full rounded-md bg-muted/50 dark:bg-sidebar-accent" />
            <Skeleton className="h-48 w-full rounded-md bg-muted/50 dark:bg-sidebar-accent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-full min-h-[400px]">
      <ResizablePanelGroup
        direction="vertical"
        className="w-full h-full rounded-xl overflow-hidden"
        autoSaveId={IDS.v}
        onLayout={(sizes) => {
          writeCookie("rrp:bottomwidgets:v", sizes);
          writeLS(IDS.v, sizes);
        }}
      >
        {/* Top row */}
        <ResizablePanel
          defaultSize={vSizes[0]}
          minSize={100}
          className="min-h-[200px] w-full"
        >
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full w-full"
            autoSaveId={IDS.top}
            onLayout={(sizes) => {
              writeCookie("rrp:bottomwidgets:top", sizes);
              writeLS(IDS.top, sizes);
            }}
          >
            <ResizablePanel
              defaultSize={topSizes[0]}
              minSize={20}
              className="min-w-[200px]"
            >
              {renderSlot(slots[0], "slot-0")}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={topSizes[1]}
              minSize={20}
              className="min-w-[200px]"
            >
              {renderSlot(slots[1], "slot-1")}
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        {/* No middle handle per request */}
        {/* Bottom row */}
        <ResizablePanel
          defaultSize={vSizes[1]}
          minSize={30}
          className="min-h-[200px]"
        >
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full w-full"
            autoSaveId={IDS.bottom}
            onLayout={(sizes) => {
              writeCookie("rrp:bottomwidgets:bottom", sizes);
              writeLS(IDS.bottom, sizes);
            }}
          >
            <ResizablePanel
              defaultSize={bottomSizes[0]}
              minSize={20}
              className="min-w-[200px]"
            >
              {renderSlot(slots[2], "slot-2")}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={bottomSizes[1]}
              minSize={20}
              className="min-w-[200px]"
            >
              {renderSlot(slots[3], "slot-3")}
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
