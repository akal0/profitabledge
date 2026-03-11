"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpcOptions, queryClient } from "@/utils/trpc";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function MetricsSettingsPage() {
  const { data: advancedPrefs, refetch: refetchAdvancedPrefs } = useQuery(
    trpcOptions.users.getAdvancedMetricsPreferences.queryOptions()
  );

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

  return (
    <div className="flex flex-col w-full">
      {/* Disable Sample Size Gating */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-white/80 font-medium">
              Sample Size Gating
            </Label>
            <Badge
              variant="secondary"
              className="bg-amber-900/30 text-amber-400 border-amber-500/30 text-xs"
            >
              Advanced
            </Badge>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            Disable to show all metrics immediately.
          </p>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <p className="text-xs text-white/50">
              By default, advanced metrics require minimum sample sizes (30-200 trades) for
              statistical reliability. Enable this to show all metrics immediately and hide
              the progress banner.
            </p>
            <div className="text-xs text-white/40 space-y-0.5">
              <p>Basic metrics: Always available</p>
              <p>Intermediate metrics: 30 trades required</p>
              <p>Advanced metrics: 100 trades required</p>
              <p>Statistical metrics: 200 trades required</p>
            </div>
            <p className="text-xs text-amber-400/70">
              Warning: Metrics with small sample sizes may not be statistically meaningful.
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

      {/* Alpha Weighting (Future) */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5 opacity-60">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-white/80 font-medium">
              Alpha Weighting
            </Label>
            <Badge variant="secondary" className="text-xs">
              Coming Soon
            </Badge>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
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
