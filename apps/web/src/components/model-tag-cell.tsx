"use client";

import * as React from "react";
import Color from "color";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lightbulb, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  ColorPicker,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/ui/color-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  getTradeIdentifierColorStyle,
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";
import {
  getTradeTagColorButtonStyle,
  getTradeTagColorSwatchStyle,
  tradeTagEditorStyles,
} from "@/components/trades/trade-tag-editor-styles";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

type EdgeRuleStatus = "followed" | "broken" | "not_reviewed" | "not_applicable";

type EdgeOption = {
  id: string;
  name: string;
  color: string | null;
};

type ModelTagOption = {
  id?: string;
  name: string;
  color: string;
};

type EdgeRuleSection = {
  id: string;
  title: string;
  rules: Array<{
    id: string;
    title: string;
    description?: string | null;
    currentStatus?: string | null;
  }>;
};

interface ModelTagCellProps {
  tradeId: string;
  accountId?: string | null;
  edgeId?: string | null;
  edgeName?: string | null;
  edgeColor?: string | null;
  modelTag: string | null | undefined;
  modelTagColor: string | null | undefined;
  outcome?: "Win" | "Loss" | "BE" | "PW";
  allModelTags?: ModelTagOption[];
  isLive?: boolean;
}

const DEFAULT_EDGE_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
] as const;

export function ModelTagCell({
  tradeId,
  accountId,
  edgeId,
  edgeName,
  edgeColor,
  modelTag,
  modelTagColor,
  outcome,
  allModelTags = [],
  isLive = false,
}: ModelTagCellProps) {
  const [open, setOpen] = React.useState(false);
  const [tagName, setTagName] = React.useState(edgeName ?? modelTag ?? "");
  const [selectedColor, setSelectedColor] = React.useState(
    edgeColor ?? modelTagColor ?? DEFAULT_EDGE_COLORS[0]
  );
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [ruleStatuses, setRuleStatuses] = React.useState<
    Record<string, EdgeRuleStatus>
  >({});

  const { data: assignableEdgesRaw } = useQuery({
    ...trpcOptions.edges.listAssignable.queryOptions(),
    staleTime: 60_000,
  });

  const assignableEdges = React.useMemo<EdgeOption[]>(
    () =>
      ((assignableEdgesRaw as EdgeOption[] | undefined) ?? []).map(
        (currentEdge) => ({
          id: currentEdge.id,
          name: currentEdge.name,
          color: currentEdge.color ?? DEFAULT_EDGE_COLORS[0],
        })
      ),
    [assignableEdgesRaw]
  );

  const mergedEdgeOptions = React.useMemo<EdgeOption[]>(() => {
    const deduped = new Map<string, EdgeOption>();

    for (const currentEdge of assignableEdges) {
      deduped.set(currentEdge.id, currentEdge);
    }

    for (const currentTag of allModelTags) {
      const existing = Array.from(deduped.values()).find(
        (currentEdge) =>
          currentEdge.name.trim().toLowerCase() ===
          currentTag.name.trim().toLowerCase()
      );
      if (!existing) {
        deduped.set(currentTag.id ?? currentTag.name, {
          id: currentTag.id ?? currentTag.name,
          name: currentTag.name,
          color: currentTag.color,
        });
      }
    }

    return Array.from(deduped.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [allModelTags, assignableEdges]);

  const matchedExistingEdge = React.useMemo(() => {
    const normalizedName = tagName.trim().toLowerCase();
    if (!normalizedName) return null;

    if (edgeId) {
      const exactIdMatch = mergedEdgeOptions.find(
        (currentEdge) => currentEdge.id === edgeId
      );
      if (exactIdMatch) return exactIdMatch;
    }

    return (
      mergedEdgeOptions.find(
        (currentEdge) => currentEdge.name.toLowerCase() === normalizedName
      ) ?? null
    );
  }, [edgeId, mergedEdgeOptions, tagName]);

  const selectedEdgeId = matchedExistingEdge?.id ?? edgeId ?? null;

  const { data: applicableRulesRaw } = useQuery({
    ...trpcOptions.edges.applicableRulesForTrade.queryOptions({
      edgeId: selectedEdgeId || "",
      tradeId,
    }),
    enabled: open && Boolean(selectedEdgeId),
    staleTime: 30_000,
  });

  const applicableRules = React.useMemo(
    () => (applicableRulesRaw as EdgeRuleSection[] | undefined) ?? [],
    [applicableRulesRaw]
  );

  React.useEffect(() => {
    const nextStatuses: Record<string, EdgeRuleStatus> = {};
    for (const section of applicableRules) {
      for (const rule of section.rules) {
        nextStatuses[rule.id] = (rule.currentStatus as EdgeRuleStatus) ?? "not_reviewed";
      }
    }
    setRuleStatuses(nextStatuses);
  }, [applicableRules]);

  React.useEffect(() => {
    setTagName(edgeName ?? modelTag ?? "");
    setSelectedColor(edgeColor ?? modelTagColor ?? DEFAULT_EDGE_COLORS[0]);
  }, [edgeColor, edgeName, modelTag, modelTagColor]);

  React.useEffect(() => {
    if (matchedExistingEdge?.color) {
      setSelectedColor(matchedExistingEdge.color);
    }
  }, [matchedExistingEdge]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = tagName.trim();

      if (!trimmedName) {
        return trpcClient.edges.assignTrade.mutate({
          tradeId,
          edgeId: null,
          ruleEvaluations: [],
        });
      }

      let nextEdgeId = matchedExistingEdge?.id ?? null;
      if (!nextEdgeId) {
        const createdEdge = await trpcClient.edges.create.mutate({
          name: trimmedName,
          color: selectedColor,
        });
        nextEdgeId = createdEdge.id;
      }

      const ruleEvaluations = Object.entries(ruleStatuses).map(([ruleId, status]) => ({
        ruleId,
        status,
      }));

      return trpcClient.edges.assignTrade.mutate({
        tradeId,
        edgeId: nextEdgeId,
        ruleEvaluations,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [["trades"]],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: [["edges"]],
          refetchType: "active",
        }),
        accountId
          ? queryClient.invalidateQueries({
              queryKey: trpcOptions.trades.listModelTags.queryOptions({
                accountId,
              }).queryKey,
            })
          : Promise.resolve(),
      ]);

      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Couldn’t update Edge. Please try again.");
    },
  });

  const displayedName = edgeName ?? modelTag;
  const displayedColor = edgeColor ?? modelTagColor;

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && isLive) {
          toast.error("You can't edit a live trade.");
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <SheetTrigger asChild>
        <div
          className="cursor-pointer"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {displayedName && displayedColor ? (
            <Badge
              style={getTradeIdentifierColorStyle(displayedColor)}
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                "max-w-full hover:opacity-90"
              )}
            >
              <Lightbulb size={12} />
              <span className="min-w-0 max-w-full truncate">
                {displayedName}
              </span>
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={cn(tradeTagEditorStyles.addButtonClass, "max-w-full")}
            >
              <Plus className="mb-0.5 size-3" />
              Add your Edge
            </Button>
          )}
        </div>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full overflow-y-auto rounded-md p-0 sm:max-w-xl"
      >
        <div
          className="flex min-h-0 flex-1 flex-col"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="px-6 py-5 pb-0">
            <SheetHeader className="p-0">
              <SheetTitle className="text-base font-semibold text-white">
                Trade Edge
              </SheetTitle>
              <SheetDescription className="text-xs text-white/40">
                Assign an Edge to this trade and review which rules were followed.
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
            <div className={tradeTagEditorStyles.sectionClass}>
              <div className="space-y-3">
                <Label htmlFor={`edge-name-${tradeId}`} className={tradeTagEditorStyles.labelClass}>
                  Edge
                </Label>
                <Input
                  id={`edge-name-${tradeId}`}
                  placeholder="e.g. Liquidity Raid Breakout"
                  value={tagName}
                  className={tradeTagEditorStyles.inputClass}
                  onChange={(event) => setTagName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void assignMutation.mutateAsync();
                    }
                  }}
                />
              </div>
            </div>

            {mergedEdgeOptions.length > 0 ? (
              <>
                <Separator className={tradeTagEditorStyles.separatorClass} />
                <div className={tradeTagEditorStyles.sectionClass}>
                  <Label className={tradeTagEditorStyles.labelClass}>My Edges</Label>
                  <div className="flex flex-wrap gap-2">
                    {mergedEdgeOptions.map((currentEdge) => {
                      const isActive =
                        currentEdge.name.toLowerCase() === tagName.trim().toLowerCase();

                      return (
                        <button
                          key={currentEdge.id}
                          type="button"
                          className={cn(
                            tradeTagEditorStyles.optionChipClass,
                            isActive && tradeTagEditorStyles.optionChipActiveClass
                          )}
                          onClick={() => {
                            setTagName(currentEdge.name);
                            setSelectedColor(currentEdge.color ?? DEFAULT_EDGE_COLORS[0]);
                            setShowColorPicker(false);
                          }}
                        >
                          <span
                            className={tradeTagEditorStyles.colorSwatchClass}
                            style={getTradeTagColorSwatchStyle(
                              currentEdge.color ?? DEFAULT_EDGE_COLORS[0]
                            )}
                          />
                          {currentEdge.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}

            {!matchedExistingEdge ? (
              <>
                <Separator className={tradeTagEditorStyles.separatorClass} />
                <div className={tradeTagEditorStyles.sectionClass}>
                  <Label className={tradeTagEditorStyles.labelClass}>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_EDGE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          tradeTagEditorStyles.colorButtonClass,
                          selectedColor === color
                            ? tradeTagEditorStyles.colorButtonActiveClass
                            : tradeTagEditorStyles.colorButtonInactiveClass
                        )}
                        style={getTradeTagColorButtonStyle(color, {
                          active: selectedColor === color,
                        })}
                        onClick={() => {
                          setSelectedColor(color);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      className={cn(
                        tradeTagEditorStyles.colorCustomButtonClass,
                        showColorPicker
                          ? "border-white/15 bg-sidebar-accent/80 text-white"
                          : ""
                      )}
                      onClick={() => setShowColorPicker((current) => !current)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {showColorPicker ? (
                    <div
                      className={cn(
                        "mt-4 space-y-3",
                        tradeTagEditorStyles.colorPickerPanelClass
                      )}
                    >
                      <ColorPicker
                        value={selectedColor}
                        onChange={(rgba) => {
                          const [red, green, blue] = rgba as [number, number, number];
                          setSelectedColor(Color.rgb(red, green, blue).hex());
                        }}
                      >
                        <div className="space-y-3">
                          <ColorPickerSelection className="h-32 w-full" />
                          <ColorPickerHue />
                          <div className="flex items-center gap-2">
                            <ColorPickerFormat className="flex-1" />
                            <ColorPickerOutput />
                          </div>
                        </div>
                      </ColorPicker>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {matchedExistingEdge && applicableRules.length > 0 ? (
              <>
                <Separator className={tradeTagEditorStyles.separatorClass} />
                <div className={tradeTagEditorStyles.sectionClass}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className={tradeTagEditorStyles.labelClass}>Edge rules</Label>
                      <p className="mt-1 text-xs text-white/45">
                        {isLive
                          ? "Live trades only show always-on rules."
                          : `Showing rules that match ${outcome ?? "the current"} outcome.`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {applicableRules.map((section) => (
                      <div
                        key={section.id}
                        className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                      >
                        <p className="text-sm font-medium text-white">{section.title}</p>
                        <div className="mt-3 space-y-3">
                          {section.rules.length === 0 ? (
                            <p className="text-xs text-white/40">
                              No applicable rules in this section.
                            </p>
                          ) : (
                            section.rules.map((rule) => {
                              const currentStatus =
                                ruleStatuses[rule.id] ?? "not_reviewed";

                              return (
                                <div
                                  key={rule.id}
                                  className="rounded-xl border border-white/8 bg-black/20 p-3"
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-white">
                                      {rule.title}
                                    </p>
                                    {rule.description ? (
                                      <p className="text-xs leading-5 text-white/45">
                                        {rule.description}
                                      </p>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "border-white/10 bg-transparent text-white/72 hover:bg-emerald-500/10 hover:text-emerald-100",
                                        currentStatus === "followed" &&
                                          "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                                      )}
                                      onClick={() =>
                                        setRuleStatuses((current) => ({
                                          ...current,
                                          [rule.id]:
                                            current[rule.id] === "followed"
                                              ? "not_reviewed"
                                              : "followed",
                                        }))
                                      }
                                    >
                                      <CheckCircle2 className="mr-1 size-3.5" />
                                      Followed
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "border-white/10 bg-transparent text-white/72 hover:bg-rose-500/10 hover:text-rose-100",
                                        currentStatus === "broken" &&
                                          "border-rose-400/40 bg-rose-500/10 text-rose-100"
                                      )}
                                      onClick={() =>
                                        setRuleStatuses((current) => ({
                                          ...current,
                                          [rule.id]:
                                            current[rule.id] === "broken"
                                              ? "not_reviewed"
                                              : "broken",
                                        }))
                                      }
                                    >
                                      <XCircle className="mr-1 size-3.5" />
                                      Broken
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className={cn(
                                        "text-white/50 hover:bg-white/5 hover:text-white/80",
                                        currentStatus === "not_reviewed" &&
                                          "bg-white/5 text-white/80"
                                      )}
                                      onClick={() =>
                                        setRuleStatuses((current) => ({
                                          ...current,
                                          [rule.id]: "not_reviewed",
                                        }))
                                      }
                                    >
                                      Not reviewed
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            <Separator className={tradeTagEditorStyles.separatorClass} />

            <div className={tradeTagEditorStyles.footerClass}>
              {displayedName ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={assignMutation.isPending}
                  onClick={() => {
                    setTagName("");
                    setRuleStatuses({});
                    void assignMutation.mutateAsync();
                  }}
                  className={cn(
                    tradeTagEditorStyles.footerButtonClass,
                    tradeTagEditorStyles.destructiveButtonClass
                  )}
                >
                  Remove
                </Button>
              ) : null}
              <Button
                variant="default"
                size="sm"
                onClick={() => void assignMutation.mutateAsync()}
                disabled={assignMutation.isPending}
                className={cn(
                  tradeTagEditorStyles.footerButtonClass,
                  tradeTagEditorStyles.primaryButtonClass
                )}
              >
                {assignMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={assignMutation.isPending}
                onClick={() => setOpen(false)}
                className={cn(
                  tradeTagEditorStyles.footerButtonClass,
                  tradeTagEditorStyles.secondaryButtonClass
                )}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
