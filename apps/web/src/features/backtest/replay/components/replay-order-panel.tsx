"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/features/backtest/replay/components/replay-primitives";
import {
  type BacktestPendingOrder,
  type BacktestTimeframe,
  type IntrabarMode,
  type TimeInForce,
} from "@/features/backtest/replay/lib/replay-domain";
import { formatPrice, getTimeframeCompactLabel } from "@/features/backtest/replay/lib/replay-utils";
import { cn } from "@/lib/utils";

type DomLevel = {
  price: number;
  isAsk: boolean;
  isBid: boolean;
  matchingOrders: BacktestPendingOrder[];
};

type ReplayOrderPanelProps = {
  symbol: string;
  symbolDisplayName: string;
  challengeStateLabel: string;
  onClose: () => void;
  orderTicketTab: "order" | "dom";
  onOrderTicketTabChange: (value: "order" | "dom") => void;
  onOpenTrade: (direction: "long" | "short") => void;
  bidPrice: number;
  askPrice: number;
  entryMode: "market" | "limit" | "stop" | "stop-limit";
  onEntryModeChange: (value: "market" | "limit" | "stop" | "stop-limit") => void;
  chartOrderSide: "long" | "short" | null;
  onChartOrderSideChange: (value: "long" | "short" | null) => void;
  effectiveTicketPrice: string;
  onTicketPriceChange: (value: string) => void;
  ticketSecondaryPrice: string;
  onTicketSecondaryPriceChange: (value: string) => void;
  effectiveTicketUnits: string;
  ticketUnits: string;
  onTicketUnitsChange: (value: string) => void;
  showSLTP: boolean;
  onShowSLTPChange: (value: boolean) => void;
  defaultTPPips: number;
  onDefaultTPPipsChange: (value: number) => void;
  defaultSLPips: number;
  onDefaultSLPipsChange: (value: number) => void;
  intrabarMode: IntrabarMode;
  onIntrabarModeChange: (value: IntrabarMode) => void;
  barMagnifierTimeframe: BacktestTimeframe | null;
  timeInForce: TimeInForce;
  onTimeInForceChange: (value: TimeInForce) => void;
  ocoEnabled: boolean;
  onOcoEnabledChange: (value: boolean) => void;
  hideUpcomingHighImpactNews: boolean;
  onHideUpcomingHighImpactNewsChange: (value: boolean) => void;
  riskPercent: number;
  onRiskPercentChange: (value: number) => void;
  estimatedMargin: number;
  estimatedTradeValue: number;
  availableFunds: number;
  estimatedTargetAtTP: number;
  replayPendingOrders: BacktestPendingOrder[];
  onCancelPendingOrder: (orderId: string) => void;
  sessionId: string | null;
  candleCount: number;
  domLevels: DomLevel[];
};

export function ReplayOrderPanel({
  symbol,
  symbolDisplayName,
  challengeStateLabel,
  onClose,
  orderTicketTab,
  onOrderTicketTabChange,
  onOpenTrade,
  bidPrice,
  askPrice,
  entryMode,
  onEntryModeChange,
  chartOrderSide,
  onChartOrderSideChange,
  effectiveTicketPrice,
  onTicketPriceChange,
  ticketSecondaryPrice,
  onTicketSecondaryPriceChange,
  effectiveTicketUnits,
  ticketUnits,
  onTicketUnitsChange,
  showSLTP,
  onShowSLTPChange,
  defaultTPPips,
  onDefaultTPPipsChange,
  defaultSLPips,
  onDefaultSLPipsChange,
  intrabarMode,
  onIntrabarModeChange,
  barMagnifierTimeframe,
  timeInForce,
  onTimeInForceChange,
  ocoEnabled,
  onOcoEnabledChange,
  hideUpcomingHighImpactNews,
  onHideUpcomingHighImpactNewsChange,
  riskPercent,
  onRiskPercentChange,
  estimatedMargin,
  estimatedTradeValue,
  availableFunds,
  estimatedTargetAtTP,
  replayPendingOrders,
  onCancelPendingOrder,
  sessionId,
  candleCount,
  domLevels,
}: ReplayOrderPanelProps) {
  return (
    <aside className="flex w-[352px] shrink-0 flex-col bg-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-teal-400 text-xs font-semibold text-slate-950">
            PE
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{symbol}</p>
            <p className="text-xs text-white/45">{symbolDisplayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/5 bg-sidebar-accent text-white/65">
            {challengeStateLabel}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-white/5 px-4 py-3">
        <button
          type="button"
          onClick={() => onOrderTicketTabChange("order")}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            orderTicketTab === "order"
              ? "bg-teal-400 text-slate-950"
              : "bg-sidebar-accent text-white/55 hover:text-white"
          )}
        >
          Order
        </button>
        <button
          type="button"
          onClick={() => onOrderTicketTabChange("dom")}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            orderTicketTab === "dom"
              ? "bg-teal-400 text-slate-950"
              : "bg-sidebar-accent text-white/55 hover:text-white"
          )}
        >
          DOM
        </button>
      </div>

      {orderTicketTab === "order" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/5 bg-sidebar-accent">
            <button
              type="button"
              onClick={() => onOpenTrade("short")}
              className="border-r border-white/5 px-4 py-3 text-left transition hover:bg-rose-500/10"
            >
              <p className="text-sm font-semibold text-rose-300">Sell</p>
              <p className="mt-1 text-3xl font-semibold text-white">{formatPrice(symbol, bidPrice)}</p>
            </button>
            <button
              type="button"
              onClick={() => onOpenTrade("long")}
              className="px-4 py-3 text-right transition hover:bg-teal-500/10"
            >
              <p className="text-sm font-semibold text-teal-300">Buy</p>
              <p className="mt-1 text-3xl font-semibold text-white">{formatPrice(symbol, askPrice)}</p>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-sidebar-accent p-1">
            {(["market", "limit", "stop", "stop-limit"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onEntryModeChange(mode)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium capitalize transition",
                  entryMode === mode
                    ? "bg-teal-400 text-slate-950 shadow-sm"
                    : "text-white/55 hover:bg-sidebar hover:text-white"
                )}
              >
                {mode === "stop-limit" ? "stop-limit" : mode}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-sidebar-accent p-1">
            <button
              type="button"
              onClick={() => onChartOrderSideChange(null)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                chartOrderSide === null
                  ? "bg-teal-400 text-slate-950 shadow-sm"
                  : "text-white/55 hover:bg-sidebar hover:text-white"
              )}
            >
              Chart off
            </button>
            <button
              type="button"
              onClick={() => onChartOrderSideChange("long")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                chartOrderSide === "long"
                  ? "bg-teal-400 text-slate-950 shadow-sm"
                  : "text-white/55 hover:bg-sidebar hover:text-white"
              )}
            >
              Chart buy
            </button>
            <button
              type="button"
              onClick={() => onChartOrderSideChange("short")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                chartOrderSide === "short"
                  ? "bg-teal-400 text-slate-950 shadow-sm"
                  : "text-white/55 hover:bg-sidebar hover:text-white"
              )}
            >
              Chart sell
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <Field label={entryMode === "stop-limit" ? "Stop price" : "Price"}>
              <Input
                value={effectiveTicketPrice}
                onChange={(event) => onTicketPriceChange(event.target.value)}
                className="h-11 border-white/5 bg-sidebar-accent text-base text-white"
              />
            </Field>
            {entryMode === "stop-limit" ? (
              <Field label="Limit price">
                <Input
                  value={ticketSecondaryPrice || effectiveTicketPrice}
                  onChange={(event) => onTicketSecondaryPriceChange(event.target.value)}
                  className="h-11 border-white/5 bg-sidebar-accent text-base text-white"
                />
              </Field>
            ) : null}
            <Field label="Units">
              <Input
                value={ticketUnits || effectiveTicketUnits}
                onChange={(event) => onTicketUnitsChange(event.target.value)}
                className="h-11 border-white/5 bg-sidebar-accent text-base text-white"
              />
            </Field>
          </div>

          <div className="mt-6 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Exits</h3>
              <Switch checked={showSLTP} onCheckedChange={onShowSLTPChange} />
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Take profit, pips">
                <Input
                  type="number"
                  value={defaultTPPips}
                  onChange={(event) => onDefaultTPPipsChange(Number(event.target.value))}
                  className="h-10 border-white/5 bg-sidebar text-white"
                />
              </Field>
              <Field label="Stop loss, pips">
                <Input
                  type="number"
                  value={defaultSLPips}
                  onChange={(event) => onDefaultSLPipsChange(Number(event.target.value))}
                  className="h-10 border-white/5 bg-sidebar text-white"
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
            <h3 className="text-sm font-semibold text-white">Extra settings</h3>
            <div className="mt-4 space-y-3">
              <Field label="Intrabar model">
                <Select value={intrabarMode} onValueChange={(value) => onIntrabarModeChange(value as IntrabarMode)}>
                  <SelectTrigger className="h-10 border-white/5 bg-sidebar text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="candle-path">Candle path</SelectItem>
                    <SelectItem value="bar-magnifier">
                      Bar magnifier{barMagnifierTimeframe ? ` · ${getTimeframeCompactLabel(barMagnifierTimeframe)}` : ""}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Time in force">
                <Select value={timeInForce} onValueChange={(value) => onTimeInForceChange(value as TimeInForce)}>
                  <SelectTrigger className="h-10 border-white/5 bg-sidebar text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="gtc">GTC</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-sidebar px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-white">OCO linking</p>
                  <p className="text-xs text-white/45">Link the next queued order to the current one.</p>
                </div>
                <Switch checked={ocoEnabled} onCheckedChange={onOcoEnabledChange} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-sidebar px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-white">Blind macro news</p>
                  <p className="text-xs text-white/45">Hide future high-impact calendar events until they print.</p>
                </div>
                <Switch
                  checked={hideUpcomingHighImpactNews}
                  onCheckedChange={onHideUpcomingHighImpactNewsChange}
                />
              </div>
              <Field label="Risk %">
                <Input
                  type="number"
                  value={riskPercent}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onChange={(event) => onRiskPercentChange(Number(event.target.value))}
                  className="h-10 border-white/5 bg-sidebar text-white"
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
            <h3 className="text-sm font-semibold text-white">Order info</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/45">Margin</span>
                <span className="font-medium text-white">${estimatedMargin.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/45">Leverage</span>
                <span className="font-medium text-white">50:1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/45">Trade value</span>
                <span className="font-medium text-white">${estimatedTradeValue.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/45">Available funds</span>
                <span className="font-medium text-white">${availableFunds.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/45">Target at TP</span>
                <span className="font-medium text-teal-300">${estimatedTargetAtTP.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {replayPendingOrders.length ? (
            <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Queued orders</h3>
                <Badge variant="outline" className="border-white/5 bg-sidebar text-white/55">
                  {replayPendingOrders.length}
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {replayPendingOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-white/5 bg-sidebar px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {order.direction === "long" ? "Buy" : "Sell"} {order.orderType}
                        </p>
                        <p className="mt-0.5 text-xs text-white/45">
                          {order.units.toLocaleString()} @ {formatPrice(symbol, order.entryPrice)}
                          {order.expiresAtUnix
                            ? ` · expires ${format(new Date(order.expiresAtUnix * 1000), "MMM d HH:mm")}`
                            : " · GTC"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
                        onClick={() => onCancelPendingOrder(order.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-2">
            <Button
              className="h-14 w-full rounded-2xl bg-teal-400 text-base font-semibold text-slate-950 hover:bg-teal-300"
              onClick={() => onOpenTrade("long")}
              disabled={!sessionId || !candleCount}
            >
              {entryMode === "market" ? "Buy" : "Place buy"} {effectiveTicketUnits} {symbol} @ {effectiveTicketPrice}{" "}
              {entryMode.toUpperCase()}
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-2xl border-white/5 bg-sidebar-accent text-sm text-white/75"
              onClick={() => onOpenTrade("short")}
              disabled={!sessionId || !candleCount}
            >
              {entryMode === "market" ? "Sell market" : `Place sell ${entryMode}`}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden px-4 pb-6 pt-4">
          <div className="rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Depth ladder</p>
                <p className="mt-1 text-xs text-white/45">Click a level to stage that price in the ticket.</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Spread</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatPrice(symbol, askPrice - bidPrice)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-3 px-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
            <span>Status</span>
            <span className="justify-self-end">Price</span>
            <span className="justify-self-end">Queued</span>
          </div>

          <div className="mt-2 flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-sidebar-accent/40 p-2">
            <div className="space-y-1">
              {domLevels.map((level) => (
                <button
                  key={level.price}
                  type="button"
                  onClick={() => {
                    onTicketPriceChange(formatPrice(symbol, level.price));
                    onOrderTicketTabChange("order");
                  }}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                    level.isAsk || level.isBid
                      ? "bg-sidebar text-white"
                      : "text-white/75 hover:bg-sidebar hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {level.isAsk ? (
                      <Badge className="bg-teal-400 text-slate-950">Ask</Badge>
                    ) : level.isBid ? (
                      <Badge className="bg-rose-400 text-slate-950">Bid</Badge>
                    ) : (
                      <span className="text-white/35">Level</span>
                    )}
                  </div>
                  <span className="justify-self-end font-mono text-white">
                    {formatPrice(symbol, level.price)}
                  </span>
                  <span className="justify-self-end text-xs text-white/45">
                    {level.matchingOrders.length
                      ? `${level.matchingOrders.length} order${level.matchingOrders.length === 1 ? "" : "s"}`
                      : "-"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/5 bg-sidebar-accent/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Queued orders</h3>
              <Badge variant="outline" className="border-white/5 bg-sidebar text-white/55">
                {replayPendingOrders.length}
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {replayPendingOrders.length ? (
                replayPendingOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-white/5 bg-sidebar px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {order.direction === "long" ? "Buy" : "Sell"} {order.orderType}
                        </p>
                        <p className="mt-0.5 text-xs text-white/45">
                          {formatPrice(symbol, order.entryPrice)}
                          {order.triggerPrice ? ` · trigger ${formatPrice(symbol, order.triggerPrice)}` : ""}
                          {` · ${Math.max(0, Math.round(order.remainingUnits ?? order.units)).toLocaleString()} / ${order.units.toLocaleString()} units`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-md px-2 text-white/60 hover:bg-sidebar-accent hover:text-white"
                        onClick={() => onCancelPendingOrder(order.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/5 bg-sidebar px-3 py-4 text-sm text-white/45">
                  No queued orders on the ladder.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
