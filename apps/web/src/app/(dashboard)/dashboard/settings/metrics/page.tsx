"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  mergeManualTradeSizingPreferences,
  type ManualTradeAssetClass,
  type ManualTradeSizingPreferences,
} from "@/lib/manual-trade-sizing";
import { queryClient, trpcOptions } from "@/utils/trpc";

const ASSET_CLASS_ORDER: ManualTradeAssetClass[] = [
  "forex",
  "indices",
  "metals",
  "energy",
  "crypto",
  "rates",
  "agriculture",
  "other",
];

type ManualTradeSizingFormState = Record<
  ManualTradeAssetClass,
  {
    defaultVolume: string;
    minVolume: string;
    volumeStep: string;
    contractSize: string;
    label: string;
    unitLabel: string;
  }
>;

function createManualTradeSizingFormState(
  preferences?: ManualTradeSizingPreferences | null
) {
  const resolved = mergeManualTradeSizingPreferences(preferences);

  return Object.fromEntries(
    ASSET_CLASS_ORDER.map((assetClass) => [
      assetClass,
      {
        defaultVolume: String(resolved[assetClass].defaultVolume),
        minVolume: String(resolved[assetClass].minVolume),
        volumeStep: String(resolved[assetClass].volumeStep),
        contractSize: String(resolved[assetClass].contractSize),
        label: resolved[assetClass].label,
        unitLabel: resolved[assetClass].unitLabel,
      },
    ])
  ) as ManualTradeSizingFormState;
}

function parsePositiveField(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseManualTradeSizingFormState(
  formState: ManualTradeSizingFormState
): ManualTradeSizingPreferences | null {
  const nextPreferences: ManualTradeSizingPreferences = {};

  for (const assetClass of ASSET_CLASS_ORDER) {
    const row = formState[assetClass];
    const defaultVolume = parsePositiveField(row.defaultVolume);
    const minVolume = parsePositiveField(row.minVolume);
    const volumeStep = parsePositiveField(row.volumeStep);
    const contractSize = parsePositiveField(row.contractSize);

    if (
      defaultVolume === null ||
      minVolume === null ||
      volumeStep === null ||
      contractSize === null ||
      defaultVolume < minVolume
    ) {
      return null;
    }

    nextPreferences[assetClass] = {
      defaultVolume,
      minVolume,
      volumeStep,
      contractSize,
    };
  }

  return nextPreferences;
}

export default function MetricsSettingsPage() {
  const { data: advancedPrefs, refetch: refetchAdvancedPrefs } = useQuery(
    trpcOptions.users.getAdvancedMetricsPreferences.queryOptions()
  );
  const [manualTradeSizingForm, setManualTradeSizingForm] =
    useState<ManualTradeSizingFormState>(() =>
      createManualTradeSizingFormState()
    );

  useEffect(() => {
    setManualTradeSizingForm(
      createManualTradeSizingFormState(advancedPrefs?.manualTradeSizing)
    );
  }, [advancedPrefs?.manualTradeSizing]);

  const updateAdvancedPrefs = useMutation({
    ...trpcOptions.users.updateAdvancedMetricsPreferences.mutationOptions(),
    onSuccess: () => {
      refetchAdvancedPrefs();
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
    },
  });

  const handleToggleSampleGating = async (enabled: boolean) => {
    try {
      await updateAdvancedPrefs.mutateAsync({
        disableSampleGating: enabled,
      });
      toast.success(
        enabled
          ? "Sample size gating disabled - all metrics visible"
          : "Sample size gating enabled - metrics require minimum samples"
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to update preferences");
    }
  };

  const parsedManualTradeSizing = useMemo(
    () => parseManualTradeSizingFormState(manualTradeSizingForm),
    [manualTradeSizingForm]
  );
  const manualTradeSizingIsValid = parsedManualTradeSizing !== null;

  const saveManualTradeSizing = async () => {
    if (!parsedManualTradeSizing) {
      toast.error(
        "Manual trade sizing values must be positive, and default volume must be at least the minimum."
      );
      return;
    }

    try {
      await updateAdvancedPrefs.mutateAsync({
        manualTradeSizing: parsedManualTradeSizing,
      });
      toast.success("Manual trade sizing updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update preferences");
    }
  };

  return (
    <div className="flex w-full flex-col">
      <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-white/80">
              Sample Size Gating
            </Label>
            <Badge
              variant="secondary"
              className="border-amber-500/30 bg-amber-900/30 text-xs text-amber-400"
            >
              Advanced
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-white/40">
            Disable to show all metrics immediately.
          </p>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <p className="text-xs text-white/50">
              By default, advanced metrics require minimum sample sizes
              (30-200 trades) for statistical reliability. Enable this to show
              all metrics immediately and hide the progress banner.
            </p>
            <div className="space-y-0.5 text-xs text-white/40">
              <p>Basic metrics: Always available</p>
              <p>Intermediate metrics: 30 trades required</p>
              <p>Advanced metrics: 100 trades required</p>
              <p>Statistical metrics: 200 trades required</p>
            </div>
            <p className="text-xs text-amber-400/70">
              Warning: Metrics with small sample sizes may not be statistically
              meaningful.
            </p>
          </div>
          <Switch
            checked={advancedPrefs?.disableSampleGating ?? false}
            onCheckedChange={handleToggleSampleGating}
            disabled={updateAdvancedPrefs.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-white/80">
              Manual Trade Sizing
            </Label>
            <Badge variant="secondary" className="text-xs">
              New
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-white/40">
            Control default lots, contracts, and contract sizes by asset class.
          </p>
        </div>

        <div className="space-y-4">
          <p className="max-w-3xl text-xs leading-5 text-white/45">
            Manual trade entry now starts from the most common market sizing by
            asset class. Adjust those defaults here if your broker uses a
            different contract size or minimum step.
          </p>

          <div className="overflow-x-auto rounded-sm border border-white/5 bg-sidebar-accent/40">
            <div className="grid min-w-[52rem] grid-cols-[10rem_repeat(4,minmax(7rem,1fr))] gap-px bg-white/5 text-[11px]">
              <div className="bg-sidebar px-3 py-2 text-white/35">Asset</div>
              <div className="bg-sidebar px-3 py-2 text-white/35">
                Default volume
              </div>
              <div className="bg-sidebar px-3 py-2 text-white/35">Min volume</div>
              <div className="bg-sidebar px-3 py-2 text-white/35">Step</div>
              <div className="bg-sidebar px-3 py-2 text-white/35">
                Contract size
              </div>

              {ASSET_CLASS_ORDER.map((assetClass) => {
                const row = manualTradeSizingForm[assetClass];

                return (
                  <div key={assetClass} className="contents">
                    <div className="bg-sidebar px-3 py-3">
                      <p className="text-sm font-medium text-white/85">
                        {row.label}
                      </p>
                      <p className="text-[11px] text-white/35">
                        Unit: {row.unitLabel}
                      </p>
                    </div>
                    <div className="bg-sidebar p-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.defaultVolume}
                        onChange={(event) =>
                          setManualTradeSizingForm((current) => ({
                            ...current,
                            [assetClass]: {
                              ...current[assetClass],
                              defaultVolume: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="bg-sidebar p-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.minVolume}
                        onChange={(event) =>
                          setManualTradeSizingForm((current) => ({
                            ...current,
                            [assetClass]: {
                              ...current[assetClass],
                              minVolume: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="bg-sidebar p-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.volumeStep}
                        onChange={(event) =>
                          setManualTradeSizingForm((current) => ({
                            ...current,
                            [assetClass]: {
                              ...current[assetClass],
                              volumeStep: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="bg-sidebar p-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.contractSize}
                        onChange={(event) =>
                          setManualTradeSizingForm((current) => ({
                            ...current,
                            [assetClass]: {
                              ...current[assetClass],
                              contractSize: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p
              className={
                manualTradeSizingIsValid
                  ? "text-xs text-white/40"
                  : "text-xs text-amber-400/80"
              }
            >
              {manualTradeSizingIsValid
                ? "These defaults apply to manual trade entry. Symbol-specific futures overrides still layer on top."
                : "Fix the invalid sizing values before saving."}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-sidebar text-white/70 hover:bg-sidebar-accent"
                onClick={() =>
                  setManualTradeSizingForm(
                    createManualTradeSizingFormState(
                      advancedPrefs?.manualTradeSizing
                    )
                  )
                }
                disabled={updateAdvancedPrefs.isPending}
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={saveManualTradeSizing}
                disabled={
                  updateAdvancedPrefs.isPending || !manualTradeSizingIsValid
                }
              >
                Save sizing
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 opacity-60 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-white/80">
              Alpha Weighting
            </Label>
            <Badge variant="secondary" className="text-xs">
              Coming Soon
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-white/40">
            Configure alpha weighting factor.
          </p>
        </div>
        <p className="text-xs text-white/40">
          Configure the alpha weighting factor for Weighted MPE calculations.
          Default: 0.30 (range: 0.20-0.40)
        </p>
      </div>
    </div>
  );
}
