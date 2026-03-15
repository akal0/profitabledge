"use client";

import { format } from "date-fns";
import {
  BookmarkPlus,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SYMBOLS,
  TIMEFRAMES,
  dashboardActionButtonClass,
  type BacktestTimeframe,
  type ContextDockSlot,
  type LayoutPreset,
  type ReplayCheckpoint,
} from "@/features/backtest/replay/lib/replay-domain";
import { getTimeframeCompactLabel } from "@/features/backtest/replay/lib/replay-utils";

type ReplayHeaderContextSnapshot = {
  timeframe: BacktestTimeframe;
  label: string;
  bias: string;
  deltaPct: number;
};

type ReplayHeaderProps = {
  onBack: () => void;
  symbol: string;
  onSymbolChange: (value: string) => void;
  timeframe: BacktestTimeframe;
  onTimeframeChange: (value: BacktestTimeframe) => void;
  goToDateTime: string;
  onGoToDateTimeChange: (value: string) => void;
  onJumpToDateTime: () => void;
  onAddCheckpoint: () => void;
  canAddCheckpoint: boolean;
  checkpoints: ReplayCheckpoint[];
  selectedCheckpointId?: string;
  onJumpToCheckpoint: (value: string) => void;
  layoutPreset: LayoutPreset;
  onLayoutPresetChange: (value: LayoutPreset) => void;
  contextTimeframeSummary: string;
  activeContextTimeframes: BacktestTimeframe[];
  onToggleContextTimeframe: (value: BacktestTimeframe, checked: boolean) => void;
  onResetContextTimeframes: () => void;
  onUndockAllContextPanes: () => void;
  hasDockedContextPanes: boolean;
  showDrawingRail: boolean;
  onShowDrawingRailChange: (value: boolean) => void;
  showFavoriteToolsBar: boolean;
  onShowFavoriteToolsBarChange: (value: boolean) => void;
  onCenterFavoriteToolsBar: () => void;
  isFavoriteToolsBarCentered: boolean;
  showBottomPanel: boolean;
  onToggleBottomPanel: () => void;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  onSaveSession: () => void;
  isSaving: boolean;
  sessionId: string | null;
  onCompleteSession: () => void;
  isCompleting: boolean;
  sessionName: string;
  onSessionNameChange: (value: string) => void;
  symbolDisplayName: string;
  timeframeCompactLabel: string;
  currentBias: string;
  contextSnapshots: ReplayHeaderContextSnapshot[];
  headerProgressPercentLabel: string;
  headerProgress: number;
  currentTimeUnix: number;
  hasCurrentCandle: boolean;
};

export function ReplayHeader({
  onBack,
  symbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  goToDateTime,
  onGoToDateTimeChange,
  onJumpToDateTime,
  onAddCheckpoint,
  canAddCheckpoint,
  checkpoints,
  selectedCheckpointId,
  onJumpToCheckpoint,
  layoutPreset,
  onLayoutPresetChange,
  contextTimeframeSummary,
  activeContextTimeframes,
  onToggleContextTimeframe,
  onResetContextTimeframes,
  onUndockAllContextPanes,
  hasDockedContextPanes,
  showDrawingRail,
  onShowDrawingRailChange,
  showFavoriteToolsBar,
  onShowFavoriteToolsBarChange,
  onCenterFavoriteToolsBar,
  isFavoriteToolsBarCentered,
  showBottomPanel,
  onToggleBottomPanel,
  showRightPanel,
  onToggleRightPanel,
  onSaveSession,
  isSaving,
  sessionId,
  onCompleteSession,
  isCompleting,
  sessionName,
  onSessionNameChange,
  symbolDisplayName,
  timeframeCompactLabel,
  currentBias,
  contextSnapshots,
  headerProgressPercentLabel,
  headerProgress,
  currentTimeUnix,
  hasCurrentCandle,
}: ReplayHeaderProps) {
  return (
    <div className="border-b border-white/5 bg-sidebar pl-20 backdrop-blur-sm sm:pl-24">
      <div className="flex h-14 items-center gap-3 px-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-white/65 hover:bg-sidebar-accent"
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <Select value={symbol} onValueChange={onSymbolChange}>
          <SelectTrigger className="h-9 w-[132px] rounded-full border-white/5 bg-sidebar-accent text-sm font-semibold text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-white/10" />

        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onTimeframeChange(option.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition",
                timeframe === option.value
                  ? "bg-teal-400 text-slate-950"
                  : "text-white/60 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              {getTimeframeCompactLabel(option.value)}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-white/10" />

        <div className="ml-auto flex items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-xl border border-white/5 bg-sidebar-accent px-3">
            <CalendarClock className="size-4 text-white/35" />
            <Input
              type="datetime-local"
              value={goToDateTime}
              onChange={(event) => onGoToDateTimeChange(event.target.value)}
              className="h-7 w-[190px] border-none bg-transparent px-0 text-xs text-white/75 shadow-none"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-white/60 hover:bg-sidebar hover:text-white"
              onClick={onJumpToDateTime}
            >
              Go
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className={dashboardActionButtonClass}
            onClick={onAddCheckpoint}
            disabled={!canAddCheckpoint}
          >
            <BookmarkPlus className="mr-1.5 size-3.5" />
            Checkpoint
          </Button>

          {checkpoints.length ? (
            <Select value={selectedCheckpointId} onValueChange={onJumpToCheckpoint}>
              <SelectTrigger className="h-9 w-[168px] rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent">
                <SelectValue placeholder="Checkpoints" />
              </SelectTrigger>
              <SelectContent>
                {checkpoints
                  .slice()
                  .sort((a, b) => b.timeUnix - a.timeUnix)
                  .map((checkpoint) => (
                    <SelectItem key={checkpoint.id} value={checkpoint.id}>
                      {checkpoint.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={layoutPreset}
            onValueChange={(value) => onLayoutPresetChange(value as LayoutPreset)}
          >
            <SelectTrigger className="h-9 w-[148px] rounded-sm border-white/5 bg-sidebar text-xs text-white/75 shadow-md ring ring-white/5 hover:bg-sidebar-accent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="execution">Execution</SelectItem>
              <SelectItem value="chart-only">Chart Only</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="coach">Coach</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={dashboardActionButtonClass}>
                {contextTimeframeSummary}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-white/5 bg-sidebar text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
            >
              <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-white/45">
                Context frames
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              {TIMEFRAMES.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={activeContextTimeframes.includes(option.value)}
                  disabled={option.value === timeframe}
                  onCheckedChange={(checked) =>
                    onToggleContextTimeframe(option.value, Boolean(checked))
                  }
                  className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                onClick={onResetContextTimeframes}
                className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
              >
                Reset context
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onUndockAllContextPanes}
                disabled={!hasDockedContextPanes}
                className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white data-[disabled]:opacity-40"
              >
                Undock all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={dashboardActionButtonClass}>
                Chart UI
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 border-white/5 bg-sidebar text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
            >
              <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-white/45">
                Chart surfaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuCheckboxItem
                checked={showDrawingRail}
                onCheckedChange={(checked) => onShowDrawingRailChange(Boolean(checked))}
                className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
              >
                Drawing rail
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showFavoriteToolsBar}
                onCheckedChange={(checked) => onShowFavoriteToolsBarChange(Boolean(checked))}
                className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
              >
                Favorites bar
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                onClick={onCenterFavoriteToolsBar}
                disabled={isFavoriteToolsBarCentered}
                className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white data-[disabled]:opacity-40"
              >
                Center favorites bar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className={dashboardActionButtonClass}
            onClick={onToggleBottomPanel}
          >
            {showBottomPanel ? "Hide Dock" : "Show Dock"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={dashboardActionButtonClass}
            onClick={onToggleRightPanel}
          >
            {showRightPanel ? "Hide Ticket" : "Show Ticket"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={dashboardActionButtonClass}
            onClick={onSaveSession}
            disabled={isSaving || !sessionId}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            className={dashboardActionButtonClass}
            onClick={onCompleteSession}
            disabled={!sessionId || isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 size-3.5" />
            )}
            Complete
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/5 px-4 py-2 text-xs text-white/45">
        <Input
          value={sessionName}
          onChange={(event) => onSessionNameChange(event.target.value)}
          className="h-8 max-w-xs border-none bg-transparent px-0 text-sm font-semibold text-white shadow-none"
        />
        <span>{symbolDisplayName}</span>
        <span>·</span>
        <span>{timeframeCompactLabel}</span>
        <span>·</span>
        <span>{currentBias}</span>
        {contextSnapshots.length ? (
          <>
            <span>·</span>
            <div className="flex items-center gap-2">
              {contextSnapshots.map((snapshot) => (
                <span
                  key={snapshot.timeframe}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border border-white/5 bg-sidebar-accent px-2 py-1 text-[11px]",
                    snapshot.bias === "Bull" ? "text-teal-300" : "text-rose-300"
                  )}
                >
                  <span className="text-white/45">{snapshot.label}</span>
                  <span>{snapshot.bias}</span>
                  <span className="text-white/55">
                    {snapshot.deltaPct >= 0 ? "+" : ""}
                    {snapshot.deltaPct.toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          </>
        ) : null}
        <div className="ml-auto flex min-w-[320px] flex-1 items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-white/35">
              <span>Replay completion</span>
              <span className="text-white/55">{headerProgressPercentLabel}</span>
            </div>
            <Progress
              value={headerProgress}
              className="h-2 bg-white/10 [&_[data-slot=progress-indicator]]:bg-teal-400"
              aria-label={`Replay completion ${headerProgressPercentLabel}`}
            />
          </div>
          <span className="whitespace-nowrap text-white/65">
            {hasCurrentCandle
              ? format(new Date(currentTimeUnix * 1000), "MMM d, yyyy HH:mm")
              : "No data loaded"}
          </span>
        </div>
      </div>
    </div>
  );
}
