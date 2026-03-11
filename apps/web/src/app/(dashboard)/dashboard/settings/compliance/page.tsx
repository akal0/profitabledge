"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAccountStore } from "@/stores/account";
import { trpcOptions, queryClient } from "@/utils/trpc";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";

type ComplianceRules = {
  requireSL?: boolean;
  requireTP?: boolean;
  requireSessionTag?: boolean;
  requireModelTag?: boolean;
  maxEntrySpreadPips?: number;
  maxEntrySlippagePips?: number;
  maxExitSlippagePips?: number;
  maxPlannedRiskPips?: number;
  minPlannedRR?: number;
  maxPlannedRR?: number;
  maxDrawdownPct?: number;
  disallowScaleIn?: boolean;
  disallowScaleOut?: boolean;
  disallowPartials?: boolean;
  minHoldSeconds?: number;
  maxHoldSeconds?: number;
};

const parseNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const cleanRules = (rules: ComplianceRules) =>
  Object.fromEntries(
    Object.entries(rules).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

export default function ComplianceSettingsPage() {
  const { selectedAccountId } = useAccountStore();

  const { data: compliancePrefs } = useQuery({
    ...trpcOptions.users.getCompliancePreferences.queryOptions({
      accountId: selectedAccountId || "",
    }),
    enabled: Boolean(selectedAccountId),
  });

  const [rules, setRules] = React.useState<ComplianceRules>({});

  React.useEffect(() => {
    setRules((compliancePrefs?.rules as ComplianceRules) || {});
  }, [compliancePrefs?.rules, selectedAccountId]);

  const updateCompliancePrefs = useMutation({
    ...trpcOptions.users.updateCompliancePreferences.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      toast.success("Compliance audits updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update compliance audits");
    },
  });

  const updateRule = <K extends keyof ComplianceRules>(
    key: K,
    value: ComplianceRules[K]
  ) => {
    setRules((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }
    await updateCompliancePrefs.mutateAsync({
      accountId: selectedAccountId,
      rules: cleanRules(rules),
    });
  };

  return (
    <div className="flex flex-col w-full">
      {/* Required Fields heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Required Fields</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Mark trades as non-compliant when missing these fields.
        </p>
      </div>

      <Separator />

      {/* Require SL */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Require stop loss</Label>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={rules.requireSL ?? false}
            onCheckedChange={(val) => updateRule("requireSL", val)}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Require TP */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Require take profit</Label>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={rules.requireTP ?? false}
            onCheckedChange={(val) => updateRule("requireTP", val)}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Require Session Tag */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Require session tag</Label>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={rules.requireSessionTag ?? false}
            onCheckedChange={(val) => updateRule("requireSessionTag", val)}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Require Model Tag */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Require model tag</Label>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={rules.requireModelTag ?? false}
            onCheckedChange={(val) => updateRule("requireModelTag", val)}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Risk Thresholds heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Risk Thresholds</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Flag trades that exceed these limits.
        </p>
      </div>

      <Separator />

      {/* Max Planned Risk */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Max planned risk (pips)</Label>
        </div>
        <Input
          value={rules.maxPlannedRiskPips ?? ""}
          onChange={(e) => updateRule("maxPlannedRiskPips", parseNumber(e.target.value))}
          placeholder="e.g. 20"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Max Drawdown */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Max drawdown (% of risk)</Label>
        </div>
        <Input
          value={rules.maxDrawdownPct ?? ""}
          onChange={(e) => updateRule("maxDrawdownPct", parseNumber(e.target.value))}
          placeholder="e.g. 75"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Min Planned R:R */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Min planned R:R</Label>
        </div>
        <Input
          value={rules.minPlannedRR ?? ""}
          onChange={(e) => updateRule("minPlannedRR", parseNumber(e.target.value))}
          placeholder="e.g. 1.5"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Max Planned R:R */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Max planned R:R</Label>
        </div>
        <Input
          value={rules.maxPlannedRR ?? ""}
          onChange={(e) => updateRule("maxPlannedRR", parseNumber(e.target.value))}
          placeholder="e.g. 5"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Execution Quality heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Execution Quality</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Spread, slippage, and hold time thresholds.
        </p>
      </div>

      <Separator />

      {/* Max Entry Spread */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Max entry spread (pips)</Label>
        </div>
        <Input
          value={rules.maxEntrySpreadPips ?? ""}
          onChange={(e) => updateRule("maxEntrySpreadPips", parseNumber(e.target.value))}
          placeholder="e.g. 1.2"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Max Entry Slippage */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Max entry slippage (pips)</Label>
        </div>
        <Input
          value={rules.maxEntrySlippagePips ?? ""}
          onChange={(e) => updateRule("maxEntrySlippagePips", parseNumber(e.target.value))}
          placeholder="e.g. 0.8"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Max Exit Slippage */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Max exit slippage (pips)</Label>
        </div>
        <Input
          value={rules.maxExitSlippagePips ?? ""}
          onChange={(e) => updateRule("maxExitSlippagePips", parseNumber(e.target.value))}
          placeholder="e.g. 1.0"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Min Hold Time */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Min hold time (seconds)</Label>
        </div>
        <Input
          value={rules.minHoldSeconds ?? ""}
          onChange={(e) => updateRule("minHoldSeconds", parseNumber(e.target.value))}
          placeholder="e.g. 60"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Max Hold Time */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Max hold time (seconds)</Label>
        </div>
        <Input
          value={rules.maxHoldSeconds ?? ""}
          onChange={(e) => updateRule("maxHoldSeconds", parseNumber(e.target.value))}
          placeholder="e.g. 14400"
          className="bg-sidebar-accent border-white/5 text-white w-40"
        />
      </div>

      <Separator />

      {/* Position Management heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Position Management</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Restrict certain trade management actions.
        </p>
      </div>

      <Separator />

      {/* Disallow Scale-Ins */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Disallow scale-ins</Label>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={rules.disallowScaleIn ?? false}
            onCheckedChange={(val) => updateRule("disallowScaleIn", val)}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Disallow Scale-Outs */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Disallow scale-outs</Label>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={rules.disallowScaleOut ?? false}
            onCheckedChange={(val) => updateRule("disallowScaleOut", val)}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Disallow Partial Closes */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Disallow partial closes</Label>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={rules.disallowPartials ?? false}
            onCheckedChange={(val) => updateRule("disallowPartials", val)}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Save */}
      <div className="flex justify-end px-6 sm:px-8 py-6">
        <Button
          onClick={handleSave}
          disabled={updateCompliancePrefs.isPending}
          className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
        >
          {updateCompliancePrefs.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
