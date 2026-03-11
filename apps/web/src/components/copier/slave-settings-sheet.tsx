"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface SlaveData {
  id: string;
  isActive: boolean | null;
  lotMode: string | null;
  fixedLot?: string | null;
  lotMultiplier: string | null;
  riskPercent: string | null;
  maxLotSize?: string | null;
  maxDailyLoss?: string | null;
  maxTradesPerDay?: number | null;
  maxDrawdownPercent?: string | null;
  slMode?: string | null;
  slFixedPips?: string | null;
  slMultiplier?: string | null;
  tpMode?: string | null;
  tpFixedPips?: string | null;
  tpMultiplier?: string | null;
  symbolWhitelist?: string[] | null;
  symbolBlacklist?: string[] | null;
  maxSlippagePips?: string | null;
  copySlTpModifications?: boolean | null;
  reverseTrades?: boolean | null;
  totalCopiedTrades: number | null;
  totalProfit: string | null;
  lastCopyAt: Date | string | null;
  account: {
    id: string;
    name: string;
    broker: string;
    accountNumber: string | null;
    isVerified: boolean;
  };
}

interface SlaveSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slave: SlaveData;
  onUpdated: () => void;
}

interface SlaveStatsResponse {
  stats: {
    totalSignals: number;
    executedSignals: number;
    failedSignals: number;
    rejectedSignals: number;
    totalProfit: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    avgSlippage: number;
  };
  recentSignals: Array<{
    id: string;
    masterTicket: string;
    slaveTicket: string | null;
    signalType: string | null;
    status: string | null;
    symbol: string;
    tradeType: string;
    masterVolume: string;
    slaveVolume: string | null;
    openPrice: string | null;
    sl: string | null;
    tp: string | null;
    executedAt: Date | string | null;
    executedPrice: string | null;
    slippagePips: string | null;
    profit: string | null;
    errorMessage: string | null;
    rejectionReason: string | null;
    createdAt: Date | string;
  }>;
}

type LotMode = "fixed" | "multiplier" | "balance_ratio" | "risk_percent";
type SlTpMode = "copy" | "fixed_pips" | "adjusted";

const panelClass = "rounded-sm border border-white/5 bg-sidebar-accent";
const tabsListClass = "grid w-full grid-cols-2 rounded-sm bg-sidebar-accent p-[3px]";
const tabsTriggerClass =
  "rounded-sm text-xs text-white/45 data-[state=active]:bg-sidebar data-[state=active]:text-white data-[state=active]:shadow-none";
const selectTriggerClass = "border-white/5 rounded-sm bg-transparent text-white/60";
const selectContentClass = "rounded-sm border border-white/5 bg-sidebar-accent";
const secondaryButtonClass =
  "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white/60 hover:text-white text-xs duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5";
const primaryButtonClass =
  "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-xs duration-250 rounded-sm px-5 border border-teal-400/20 bg-teal-400/12 text-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-teal-400/20 hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none";

export function SlaveSettingsSheet({
  open,
  onOpenChange,
  slave,
  onUpdated,
}: SlaveSettingsSheetProps) {
  const trpc = useTRPC() as any;
  // Lot sizing
  const [lotMode, setLotMode] = useState<LotMode>((slave.lotMode as LotMode) ?? "multiplier");
  const [fixedLot, setFixedLot] = useState(slave.fixedLot ?? "0.10");
  const [lotMultiplier, setLotMultiplier] = useState(slave.lotMultiplier ?? "1.0");
  const [riskPercent, setRiskPercent] = useState(slave.riskPercent ?? "1.0");

  // Risk management
  const [maxLotSize, setMaxLotSize] = useState(slave.maxLotSize ?? "10.0");
  const [maxDailyLoss, setMaxDailyLoss] = useState(slave.maxDailyLoss ?? "");
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(
    slave.maxTradesPerDay?.toString() ?? ""
  );
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState(
    slave.maxDrawdownPercent ?? ""
  );

  // SL/TP settings
  const [slMode, setSlMode] = useState<SlTpMode>((slave.slMode as SlTpMode) ?? "copy");
  const [slFixedPips, setSlFixedPips] = useState(slave.slFixedPips ?? "");
  const [slMultiplier, setSlMultiplier] = useState(slave.slMultiplier ?? "1.0");
  const [tpMode, setTpMode] = useState<SlTpMode>((slave.tpMode as SlTpMode) ?? "copy");
  const [tpFixedPips, setTpFixedPips] = useState(slave.tpFixedPips ?? "");
  const [tpMultiplier, setTpMultiplier] = useState(slave.tpMultiplier ?? "1.0");

  // Filters & execution
  const [symbolWhitelist, setSymbolWhitelist] = useState(
    slave.symbolWhitelist?.join(", ") ?? ""
  );
  const [symbolBlacklist, setSymbolBlacklist] = useState(
    slave.symbolBlacklist?.join(", ") ?? ""
  );
  const [maxSlippagePips, setMaxSlippagePips] = useState(slave.maxSlippagePips ?? "3.0");
  const [copySlTpModifications, setCopySlTpModifications] = useState(
    slave.copySlTpModifications ?? true
  );
  const [reverseTrades, setReverseTrades] = useState(slave.reverseTrades ?? false);

  // Update state when slave changes
  useEffect(() => {
    setLotMode((slave.lotMode as LotMode) ?? "multiplier");
    setFixedLot(slave.fixedLot ?? "0.10");
    setLotMultiplier(slave.lotMultiplier ?? "1.0");
    setRiskPercent(slave.riskPercent ?? "1.0");
    setMaxLotSize(slave.maxLotSize ?? "10.0");
    setMaxDailyLoss(slave.maxDailyLoss ?? "");
    setMaxTradesPerDay(slave.maxTradesPerDay?.toString() ?? "");
    setMaxDrawdownPercent(slave.maxDrawdownPercent ?? "");
    setSlMode((slave.slMode as SlTpMode) ?? "copy");
    setSlFixedPips(slave.slFixedPips ?? "");
    setSlMultiplier(slave.slMultiplier ?? "1.0");
    setTpMode((slave.tpMode as SlTpMode) ?? "copy");
    setTpFixedPips(slave.tpFixedPips ?? "");
    setTpMultiplier(slave.tpMultiplier ?? "1.0");
    setSymbolWhitelist(slave.symbolWhitelist?.join(", ") ?? "");
    setSymbolBlacklist(slave.symbolBlacklist?.join(", ") ?? "");
    setMaxSlippagePips(slave.maxSlippagePips ?? "3.0");
    setCopySlTpModifications(slave.copySlTpModifications ?? true);
    setReverseTrades(slave.reverseTrades ?? false);
  }, [slave]);

  const { data: stats, isLoading: statsLoading } =
    trpc.copier.getSlaveStats.useQuery(
      { slaveId: slave.id, days: 30 },
      { enabled: open }
    ) as {
      data: SlaveStatsResponse | undefined;
      isLoading: boolean;
    };

  const updateSlave = trpc.copier.updateSlave.useMutation({
    onSuccess: () => {
      onUpdated();
    },
  });

  const parseSymbolList = (str: string): string[] | undefined => {
    if (!str.trim()) return undefined;
    return str
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
  };

  const handleSave = () => {
    updateSlave.mutate({
      slaveId: slave.id,
      config: {
        lotMode,
        fixedLot: parseFloat(fixedLot) || 0.01,
        lotMultiplier: parseFloat(lotMultiplier) || 1.0,
        riskPercent: parseFloat(riskPercent) || 1.0,
        maxLotSize: parseFloat(maxLotSize) || 10.0,
        maxDailyLoss: maxDailyLoss ? parseFloat(maxDailyLoss) : undefined,
        maxTradesPerDay: maxTradesPerDay ? parseInt(maxTradesPerDay, 10) : undefined,
        maxDrawdownPercent: maxDrawdownPercent ? parseFloat(maxDrawdownPercent) : undefined,
        slMode,
        slFixedPips: slFixedPips ? parseFloat(slFixedPips) : undefined,
        slMultiplier: parseFloat(slMultiplier) || 1.0,
        tpMode,
        tpFixedPips: tpFixedPips ? parseFloat(tpFixedPips) : undefined,
        tpMultiplier: parseFloat(tpMultiplier) || 1.0,
        symbolWhitelist: parseSymbolList(symbolWhitelist),
        symbolBlacklist: parseSymbolList(symbolBlacklist),
        maxSlippagePips: parseFloat(maxSlippagePips) || 3.0,
        copySlTpModifications,
        reverseTrades,
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-sidebar border-white/5">
        <SheetHeader>
          <SheetTitle className="text-white">{slave.account.name}</SheetTitle>
          <SheetDescription className="text-white/45">
            {slave.account.broker}{" "}
            {slave.account.accountNumber && `- ${slave.account.accountNumber}`}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="settings" className="mt-6">
          <TabsList className={tabsListClass}>
            <TabsTrigger value="settings" className={tabsTriggerClass}>Settings</TabsTrigger>
            <TabsTrigger value="stats" className={tabsTriggerClass}>Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6 mt-4">
            {/* Lot Sizing */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white/80">Lot Sizing</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Mode</Label>
                  <Select value={lotMode} onValueChange={(v) => setLotMode(v as LotMode)}>
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="multiplier" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Lot Multiplier</SelectItem>
                      <SelectItem value="fixed" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Fixed Lot</SelectItem>
                      <SelectItem value="balance_ratio" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Balance Ratio</SelectItem>
                      <SelectItem value="risk_percent" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Risk Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {lotMode === "multiplier" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={lotMultiplier}
                      onChange={(e) => setLotMultiplier(e.target.value)}
                    />
                  </div>
                )}

                {lotMode === "fixed" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">Fixed Lot Size</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={fixedLot}
                      onChange={(e) => setFixedLot(e.target.value)}
                    />
                  </div>
                )}

                {lotMode === "risk_percent" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">Risk % Per Trade</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Max Lot Size</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={maxLotSize}
                    onChange={(e) => setMaxLotSize(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Risk Management */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white/80">Risk Management</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Max Daily Loss ($)</Label>
                  <Input
                    type="number"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Max Trades/Day</Label>
                  <Input
                    type="number"
                    value={maxTradesPerDay}
                    onChange={(e) => setMaxTradesPerDay(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-white/60">Max Drawdown %</Label>
                  <Input
                    type="number"
                    step="1"
                    value={maxDrawdownPercent}
                    onChange={(e) => setMaxDrawdownPercent(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* SL/TP Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white/80">Stop Loss / Take Profit</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">SL Mode</Label>
                  <Select value={slMode} onValueChange={(v) => setSlMode(v as SlTpMode)}>
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="copy" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Copy from Master</SelectItem>
                      <SelectItem value="fixed_pips" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Fixed Pips</SelectItem>
                      <SelectItem value="adjusted" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Adjust Distance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">TP Mode</Label>
                  <Select value={tpMode} onValueChange={(v) => setTpMode(v as SlTpMode)}>
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="copy" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Copy from Master</SelectItem>
                      <SelectItem value="fixed_pips" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Fixed Pips</SelectItem>
                      <SelectItem value="adjusted" className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white">Adjust Distance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {slMode === "fixed_pips" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">SL Pips</Label>
                    <Input
                      type="number"
                      value={slFixedPips}
                      onChange={(e) => setSlFixedPips(e.target.value)}
                    />
                  </div>
                )}
                {slMode === "adjusted" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">SL Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={slMultiplier}
                      onChange={(e) => setSlMultiplier(e.target.value)}
                    />
                  </div>
                )}
                {tpMode === "fixed_pips" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">TP Pips</Label>
                    <Input
                      type="number"
                      value={tpFixedPips}
                      onChange={(e) => setTpFixedPips(e.target.value)}
                    />
                  </div>
                )}
                {tpMode === "adjusted" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60">TP Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tpMultiplier}
                      onChange={(e) => setTpMultiplier(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white/80">Symbol Filters</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Whitelist (comma separated)</Label>
                  <Input
                    value={symbolWhitelist}
                    onChange={(e) => setSymbolWhitelist(e.target.value)}
                    placeholder="e.g., EURUSD, GBPUSD, USDJPY"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Blacklist (comma separated)</Label>
                  <Input
                    value={symbolBlacklist}
                    onChange={(e) => setSymbolBlacklist(e.target.value)}
                    placeholder="e.g., XAUUSD"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Execution Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white/80">Execution</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Max Slippage (pips)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={maxSlippagePips}
                    onChange={(e) => setMaxSlippagePips(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Copy SL/TP Modifications</Label>
                    <p className="text-xs text-white/50">
                      Update SL/TP when master modifies
                    </p>
                  </div>
                  <Switch
                    checked={copySlTpModifications}
                    onCheckedChange={setCopySlTpModifications}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Reverse Trades</Label>
                    <p className="text-xs text-white/50">
                      Copy as opposite direction
                    </p>
                  </div>
                  <Switch
                    checked={reverseTrades}
                    onCheckedChange={setReverseTrades}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4 mt-4">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-white/50" />
              </div>
            ) : stats ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`${panelClass} p-3`}>
                    <div className="flex items-center gap-2">
                      <Activity className="size-4 text-blue-300" />
                      <span className="text-xs text-white/50">Trades Copied</span>
                    </div>
                    <p className="text-xl font-semibold text-white mt-1">
                      {stats.stats.executedSignals}
                    </p>
                  </div>
                  <div className={`${panelClass} p-3`}>
                    <div className="flex items-center gap-2">
                      {stats.stats.totalProfit >= 0 ? (
                        <TrendingUp className="size-4 text-teal-300" />
                      ) : (
                        <TrendingDown className="size-4 text-rose-300" />
                      )}
                      <span className="text-xs text-white/50">Total P/L</span>
                    </div>
                    <p
                      className={`text-xl font-semibold mt-1 ${
                        stats.stats.totalProfit >= 0 ? "text-teal-300" : "text-rose-300"
                      }`}
                    >
                      ${stats.stats.totalProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className={`${panelClass} p-3`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Win Rate</span>
                    </div>
                    <p className="text-xl font-semibold text-white mt-1">
                      {stats.stats.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`${panelClass} p-3`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Avg Slippage</span>
                    </div>
                    <p className="text-xl font-semibold text-white mt-1">
                      {stats.stats.avgSlippage.toFixed(1)} pips
                    </p>
                  </div>
                </div>

                {/* Signal Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white/80">Signal Status (30 days)</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="border-teal-400/20 bg-teal-400/12 text-teal-200">
                      {stats.stats.executedSignals} Executed
                    </Badge>
                    <Badge variant="outline" className="border-rose-500/25 bg-rose-500/10 text-rose-300">
                      {stats.stats.failedSignals} Failed
                    </Badge>
                    <Badge variant="outline" className="border-yellow-500/20 bg-yellow-500/12 text-yellow-200">
                      {stats.stats.rejectedSignals} Rejected
                    </Badge>
                  </div>
                </div>

                {/* Recent Signals */}
                {stats.recentSignals.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white/80">Recent Signals</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.recentSignals.slice(0, 10).map((sig) => (
                        <div
                          key={sig.id}
                          className={`${panelClass} flex items-center justify-between p-2 text-xs`}
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                sig.tradeType === "buy"
                                  ? "border-teal-400/20 bg-teal-400/12 text-teal-200"
                                  : "border-rose-500/25 bg-rose-500/10 text-rose-300"
                              }
                            >
                              {sig.tradeType.toUpperCase()}
                            </Badge>
                            <span className="text-white">{sig.symbol}</span>
                            <span className="text-white/50">
                              {sig.slaveVolume} lots
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              sig.status === "executed"
                                ? "border-teal-400/20 bg-teal-400/12 text-teal-200"
                                : sig.status === "failed"
                                ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                                : sig.status === "rejected"
                                  ? "border-yellow-500/20 bg-yellow-500/12 text-yellow-200"
                                  : "border-white/5 bg-sidebar text-white/45"
                            }
                          >
                            {sig.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-white/45">
                No stats available
              </div>
            )}
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6 px-4 pb-4">
          <Button className={secondaryButtonClass} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className={primaryButtonClass} onClick={handleSave} disabled={updateSlave.isPending}>
            {updateSlave.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
