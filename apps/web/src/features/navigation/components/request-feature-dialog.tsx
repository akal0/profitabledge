"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FEATURE_REQUEST_CATALOG,
  getDefaultFeatureRequestSelection,
  getFeatureRequestAreaById,
  getFeatureRequestFeatureById,
  getFeatureRequestSelectionLabel,
  type FeatureRequestSelection,
} from "@profitabledge/platform";
import { LifeBuoy, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
import { trpcOptions } from "@/utils/trpc";

const WHOLE_FEATURE_VALUE = "__whole_feature__";

function buildInitialSelection(pagePath: string): FeatureRequestSelection {
  return getDefaultFeatureRequestSelection(pagePath);
}

function deriveSummaryFromDetails(details: string) {
  const normalized = details.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const sentence = normalized.match(/.+?[.!?](?:\s|$)/)?.[0]?.trim();
  const candidate = sentence || normalized;

  return candidate.slice(0, 160).trim();
}

export function RequestFeatureDialog({
  open,
  onOpenChange,
  pagePath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagePath: string;
}) {
  const defaultSelection = useMemo(
    () => buildInitialSelection(pagePath),
    [pagePath]
  );
  const [selection, setSelection] =
    useState<FeatureRequestSelection>(defaultSelection);
  const [proposedFeatureName, setProposedFeatureName] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");

  const submitFeatureRequest = useMutation(
    trpcOptions.operations.submitFeatureRequest.mutationOptions()
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelection(defaultSelection);
    setProposedFeatureName("");
    setSummary("");
    setDetails("");
  }, [defaultSelection, open]);

  const selectedArea = useMemo(
    () =>
      getFeatureRequestAreaById(selection.areaId) ?? FEATURE_REQUEST_CATALOG[0],
    [selection.areaId]
  );
  const selectedFeature = useMemo(
    () => getFeatureRequestFeatureById(selection.areaId, selection.featureId),
    [selection.areaId, selection.featureId]
  );
  const featureOptions = selectedArea?.features ?? [];
  const subfeatureOptions = selectedFeature?.subfeatures ?? [];
  const selectionLabel =
    selection.areaId === "new-feature"
      ? [selectedArea?.label ?? "Completely new feature", proposedFeatureName.trim()]
          .filter(Boolean)
          .join(" > ")
      : getFeatureRequestSelectionLabel(selection);
  const effectiveSummary = useMemo(
    () => summary.trim() || deriveSummaryFromDetails(details),
    [details, summary]
  );

  const hasRequiredText = useMemo(
    () =>
      effectiveSummary.length >= 4 &&
      details.trim().length >= 10,
    [details, effectiveSummary]
  );

  const setArea = (areaId: string) => {
    const area = getFeatureRequestAreaById(areaId);

    setSelection({
      areaId,
      featureId: areaId === "new-feature" ? null : area?.features?.[0]?.id ?? null,
      subfeatureId: null,
    });
  };

  const setFeature = (featureId: string) => {
    setSelection((current) => ({
      ...current,
      featureId,
      subfeatureId: null,
    }));
  };

  const setSubfeature = (subfeatureId: string) => {
    setSelection((current) => ({
      ...current,
      subfeatureId:
        subfeatureId === WHOLE_FEATURE_VALUE ? null : subfeatureId,
    }));
  };

  const handleSubmit = async () => {
    if (!hasRequiredText) {
      toast.error("Add a short summary and a bit more detail before sending it.");
      return;
    }

    try {
      const result = await submitFeatureRequest.mutateAsync({
        areaId: selection.areaId,
        featureId: selection.featureId,
        subfeatureId: selection.subfeatureId,
        proposedFeatureName: proposedFeatureName.trim() || null,
        subject: effectiveSummary,
        message: details.trim(),
        pagePath,
      });

      if (result.deliveryStatus === "created") {
        toast.success("Feature request submitted.");
      } else if (result.deliveryStatus === "stored_only") {
        toast.success(
          "Feature request saved internally. GitHub forwarding isn’t configured yet."
        );
      } else {
        toast.error(
          "Feature request was saved internally, but GitHub forwarding failed."
        );
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit feature request"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-2xl"
      >
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          <div className="sticky top-0 z-10 flex items-start gap-3 bg-sidebar-accent/80 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <LifeBuoy className="h-3.5 w-3.5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-medium text-white">
                Request a feature
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-white/40">
                Requests are sent privately to the Profitabledge team, stored
                internally, and can also be forwarded straight into the private
                GitHub repo.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator />

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-white/60">Area</Label>
                <Select value={selection.areaId} onValueChange={setArea}>
                  <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {FEATURE_REQUEST_CATALOG.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selection.areaId === "new-feature" ? (
                <div className="space-y-2">
                  <Label className="text-xs text-white/60">
                    New feature name (optional)
                  </Label>
                  <Input
                    value={proposedFeatureName}
                    onChange={(event) =>
                      setProposedFeatureName(event.target.value)
                    }
                    placeholder="Name the feature you want added"
                    className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs text-white/60">Feature</Label>
                  <Select
                    value={selection.featureId ?? undefined}
                    onValueChange={setFeature}
                  >
                    <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                      <SelectValue placeholder="Choose a feature" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {featureOptions.map((feature) => (
                        <SelectItem key={feature.id} value={feature.id}>
                          {feature.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {subfeatureOptions.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs text-white/60">Sub-area</Label>
                <Select
                  value={selection.subfeatureId ?? WHOLE_FEATURE_VALUE}
                  onValueChange={setSubfeature}
                >
                  <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value={WHOLE_FEATURE_VALUE}>
                      Whole {selectedFeature?.label ?? "feature"}
                    </SelectItem>
                    {subfeatureOptions.map((subfeature) => (
                      <SelectItem key={subfeature.id} value={subfeature.id}>
                        {subfeature.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-xs text-white/60">
                What do you want added or changed? (optional)
              </Label>
              <Input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Short summary of the request, or leave blank and we’ll derive it from the details"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/60">Details</Label>
              <Textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Explain the problem, what should improve, and how you expect it to work."
                className="min-h-32 border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-white/40">
                  Current page: <span className="text-white/65">{pagePath}</span>
                </p>
              </div>

              <div className="rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-white/40">
                  Selected feature:{" "}
                  <span className="text-white/65">
                    {selectionLabel || "Choose an area"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-white/40">
              Requests are private. Members do not get sent to GitHub or the
              repo issue list.
            </p>

            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  className="cursor-pointer justify-center rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110"
                >
                  Cancel
                </Button>
              </DialogClose>

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitFeatureRequest.isPending}
                className="cursor-pointer justify-center gap-2 rounded-sm border border-white/5 bg-white px-3 py-2 text-xs text-black transition-all duration-250 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="size-3.5" />
                {submitFeatureRequest.isPending
                  ? "Submitting..."
                  : "Submit request"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
