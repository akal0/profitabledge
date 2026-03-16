"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STORAGE_KEY = "profitabledge-risk-profile";

interface RiskProfile {
  maxRiskPerTrade: number;
  sizingMethod: "fixed" | "risk_based" | "kelly" | "half_kelly";
  defaultLotSize: number;
  maxDailyLoss: number;
  maxDailyTrades: number;
  maxConcurrent: number;
  maxWeeklyLoss: number;
  maxMonthlyDrawdown: number;
  autoReduceAfterLosses: number;
  reductionFactor: number;
  escalation: {
    reduceAfter2: boolean;
    reduceAfter3: boolean;
    blockOnDailyLoss: boolean;
  };
}

const defaults: RiskProfile = {
  maxRiskPerTrade: 1,
  sizingMethod: "risk_based",
  defaultLotSize: 0.01,
  maxDailyLoss: 3,
  maxDailyTrades: 10,
  maxConcurrent: 3,
  maxWeeklyLoss: 5,
  maxMonthlyDrawdown: 10,
  autoReduceAfterLosses: 3,
  reductionFactor: 50,
  escalation: {
    reduceAfter2: true,
    reduceAfter3: true,
    blockOnDailyLoss: false,
  },
};

export default function RiskProfilePage() {
  const [profile, setProfile] = useState<RiskProfile>(defaults);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProfile({ ...defaults, ...JSON.parse(stored) });
      }
    } catch {}
  }, []);

  const update = <K extends keyof RiskProfile>(
    key: K,
    value: RiskProfile[K]
  ) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const updateEscalation = (
    key: keyof RiskProfile["escalation"],
    value: boolean
  ) => {
    setProfile((prev) => ({
      ...prev,
      escalation: { ...prev.escalation, [key]: value },
    }));
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    toast.success("Risk profile saved");
  };

  const reset = () => {
    setProfile(defaults);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Reset to defaults");
  };

  return (
    <div className="flex flex-col w-full">
      {/* Position Sizing heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Position Sizing</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Configure your position sizing parameters.
        </p>
      </div>

      <Separator />

      {/* Max Risk Per Trade */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Max Risk Per Trade
          </Label>
          <p className="text-xs text-white/40 mt-0.5">Percentage of account.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={profile.maxRiskPerTrade}
            onChange={(e) =>
              update("maxRiskPerTrade", parseFloat(e.target.value) || 0)
            }
            min={0.1}
            max={10}
            step={0.1}
            className="bg-sidebar-accent ring-white/5 text-white w-32"
          />
          <span className="text-xs text-white/30">%</span>
        </div>
      </div>

      <Separator />

      {/* Sizing Method */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Sizing Method
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            How positions are sized.
          </p>
        </div>
        <Select
          value={profile.sizingMethod}
          onValueChange={(v) => update("sizingMethod", v as any)}
        >
          <SelectTrigger className="bg-sidebar-accent ring-white/5 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed Lot</SelectItem>
            <SelectItem value="risk_based">Risk-Based</SelectItem>
            <SelectItem value="kelly">Kelly Criterion</SelectItem>
            <SelectItem value="half_kelly">Half-Kelly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Default Lot Size */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Default Lot Size
          </Label>
          <p className="text-xs text-white/40 mt-0.5">For fixed lot sizing.</p>
        </div>
        <Input
          type="number"
          value={profile.defaultLotSize}
          onChange={(e) =>
            update("defaultLotSize", parseFloat(e.target.value) || 0)
          }
          min={0.01}
          max={100}
          step={0.01}
          className="bg-sidebar-accent ring-white/5 text-white w-32"
        />
      </div>

      <Separator />

      {/* Daily Risk Limits heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Daily Risk Limits</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Maximum exposure limits per day.
        </p>
      </div>

      <Separator />

      {/* Max Daily Loss */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Max Daily Loss
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Stop trading after this loss.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={profile.maxDailyLoss}
            onChange={(e) =>
              update("maxDailyLoss", parseFloat(e.target.value) || 0)
            }
            min={0.5}
            max={20}
            step={0.5}
            className="bg-sidebar-accent ring-white/5 text-white w-32"
          />
          <span className="text-xs text-white/30">%</span>
        </div>
      </div>

      <Separator />

      {/* Max Daily Trades */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Max Daily Trades
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Maximum trades per day.
          </p>
        </div>
        <Input
          type="number"
          value={profile.maxDailyTrades}
          onChange={(e) =>
            update("maxDailyTrades", parseFloat(e.target.value) || 0)
          }
          min={1}
          max={100}
          className="bg-sidebar-accent ring-white/5 text-white w-32"
        />
      </div>

      <Separator />

      {/* Max Concurrent */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Max Concurrent Positions
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Open positions at once.
          </p>
        </div>
        <Input
          type="number"
          value={profile.maxConcurrent}
          onChange={(e) =>
            update("maxConcurrent", parseFloat(e.target.value) || 0)
          }
          min={1}
          max={50}
          className="bg-sidebar-accent ring-white/5 text-white w-32"
        />
      </div>

      <Separator />

      {/* Drawdown Management heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Drawdown Management
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Weekly and monthly drawdown limits.
        </p>
      </div>

      <Separator />

      {/* Max Weekly Loss */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Max Weekly Loss
          </Label>
          <p className="text-xs text-white/40 mt-0.5">Weekly loss threshold.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={profile.maxWeeklyLoss}
            onChange={(e) =>
              update("maxWeeklyLoss", parseFloat(e.target.value) || 0)
            }
            min={1}
            max={30}
            step={0.5}
            className="bg-sidebar-accent ring-white/5 text-white w-32"
          />
          <span className="text-xs text-white/30">%</span>
        </div>
      </div>

      <Separator />

      {/* Max Monthly Drawdown */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Max Monthly Drawdown
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Monthly max loss threshold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={profile.maxMonthlyDrawdown}
            onChange={(e) =>
              update("maxMonthlyDrawdown", parseFloat(e.target.value) || 0)
            }
            min={1}
            max={50}
            step={1}
            className="bg-sidebar-accent ring-white/5 text-white w-32"
          />
          <span className="text-xs text-white/30">%</span>
        </div>
      </div>

      <Separator />

      {/* Risk Escalation heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Risk Escalation Rules
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Automatic risk adjustments triggered by trading behavior.
        </p>
      </div>

      <Separator />

      {/* Escalation rules */}
      {[
        {
          key: "reduceAfter2" as const,
          label: "After 2 consecutive losses",
          desc: "Reduce position size by 30%",
          color: "text-yellow-400",
        },
        {
          key: "reduceAfter3" as const,
          label: "After 3 consecutive losses",
          desc: "Reduce position size by 50%",
          color: "text-orange-400",
        },
        {
          key: "blockOnDailyLoss" as const,
          label: "Daily loss exceeds limit",
          desc: "Block all trades for rest of day",
          color: "text-red-400",
        },
      ].map((rule, idx) => (
        <div key={rule.key}>
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className={cn("text-sm font-medium", rule.color)}>
                {rule.label}
              </Label>
              <p className="text-xs text-white/40 mt-0.5">{rule.desc}</p>
            </div>
            <div className="flex justify-end">
              <Switch
                checked={profile.escalation[rule.key]}
                onCheckedChange={(v) => updateEscalation(rule.key, v)}
                className="data-[state=checked]:bg-teal-600"
              />
            </div>
          </div>
          {idx < 2 && <Separator />}
        </div>
      ))}

      <Separator />

      {/* Save */}
      <div className="flex items-center justify-end gap-3 px-6 sm:px-8 py-6">
        <Button
          variant="ghost"
          onClick={reset}
          className="text-white/40 hover:text-white/60 text-xs"
        >
          Reset to Defaults
        </Button>
        <Button
          onClick={save}
          className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
