"use client";

import { useState } from "react";
import { Loader2, FlaskConical, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";

type NewSessionDialogProps<TTimeframe extends string> = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sessionName: string;
  setSessionName: (value: string) => void;
  sessionDescription: string;
  setSessionDescription: (value: string) => void;
  symbol: string;
  setSymbol: (value: string) => void;
  timeframe: TTimeframe;
  setTimeframe: (value: TTimeframe) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  initialBalance: number;
  setInitialBalance: (value: number) => void;
  riskPercent: number;
  setRiskPercent: (value: number) => void;
  onCreate: () => Promise<void>;
  symbols: readonly string[];
  timeframes: readonly { value: TTimeframe; label: string }[];
};

export function NewSessionDialog<TTimeframe extends string>({
  open,
  onOpenChange,
  sessionName,
  setSessionName,
  sessionDescription,
  setSessionDescription,
  symbol,
  setSymbol,
  timeframe,
  setTimeframe,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  initialBalance,
  setInitialBalance,
  riskPercent,
  setRiskPercent,
  onCreate,
  symbols,
  timeframes,
}: NewSessionDialogProps<TTimeframe>) {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreate();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-xl"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <FlaskConical className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">New Backtest Session</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Build the scenario first: instrument, date range, risk model, and the Edge you want to train.</p>
            </div>
            <DialogClose asChild>
              <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator />

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            <div>
              <Label className="text-xs text-white/80">Session Name</Label>
              <Input
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                placeholder="London reversal drill"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-white/80">Session Brief</Label>
              <Textarea
                value={sessionDescription}
                onChange={(event) => setSessionDescription(event.target.value)}
                placeholder="What are you practicing, what is disallowed, and how will you score yourself?"
                className="mt-1 min-h-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/80">Symbol</Label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {symbols.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-white/80">Timeframe</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeframes.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/80">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-white/80">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/80">Initial Balance ($)</Label>
                <Input
                  type="number"
                  value={initialBalance}
                  onChange={(event) => setInitialBalance(Number(event.target.value))}
                  className="mt-1"
                  min={100}
                />
              </div>
              <div>
                <Label className="text-xs text-white/80">Risk per Trade (%)</Label>
                <Input
                  type="number"
                  value={riskPercent}
                  onChange={(event) => setRiskPercent(Number(event.target.value))}
                  className="mt-1"
                  min={0.1}
                  max={10}
                  step={0.1}
                />
              </div>
            </div>
          </div>

          <Separator />
          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3">
            <Button
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
            >
              {isCreating && <Loader2 className="size-3.5 animate-spin" />}
              Create Workspace
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
