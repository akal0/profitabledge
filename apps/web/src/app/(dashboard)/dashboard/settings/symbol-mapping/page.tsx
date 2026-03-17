"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Database,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

const CARD_OUTER =
  "group flex flex-col rounded-lg border border-white/5 bg-sidebar p-1";
const CARD_INNER =
  "flex flex-1 flex-col rounded-sm bg-white ring ring-white/5 transition-all duration-250 dark:bg-sidebar-accent dark:group-hover:brightness-120";
const CARD_ALIAS_GRID = "flex max-w-full flex-wrap gap-2";
const CARD_ALIAS_CHIP =
  "inline-flex max-w-full items-center rounded-sm border border-white/8 bg-sidebar px-2 py-1 text-[11px] text-white/65";

type CustomMappingRow = {
  id: string;
  canonicalSymbol: string;
  aliases: string[];
  assetClass: string;
  updatedAt?: string | Date | null;
};

type DetectedSymbolRow = {
  rawSymbol: string;
  canonicalSymbol: string;
  assetClass: string;
  source: string;
  tradeCount: number;
};

type BaseMappingRow = {
  canonicalSymbol: string;
  assetClass: string;
  aliases: string[];
  futuresRoots: string[];
};

function formatAssetClass(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSource(value: string) {
  switch (value) {
    case "custom":
      return "Custom";
    case "base":
      return "Built-in";
    case "derived":
      return "Derived";
    default:
      return "Raw";
  }
}

function normalizeMappingValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function AliasCardGrid({ aliases }: { aliases: string[] }) {
  const normalizedAliases = Array.from(
    new Set(aliases.map(normalizeMappingValue).filter(Boolean))
  );

  return (
    <div className={CARD_ALIAS_GRID}>
      {normalizedAliases.map((alias) => (
        <span key={alias} className={CARD_ALIAS_CHIP} title={alias}>
          {alias}
        </span>
      ))}
    </div>
  );
}

function MappingCardMenu({
  onEdit,
  onDelete,
  deleteDisabled = false,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="size-8 rounded-sm border border-white/5 bg-sidebar px-0 text-white/55 hover:bg-sidebar hover:text-white"
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open mapping actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[10rem] rounded-sm border border-white/5 bg-sidebar text-white"
      >
        <DropdownMenuItem
          onSelect={() => onEdit()}
          className="cursor-pointer rounded-sm px-3 py-2 text-xs text-white/80 focus:bg-sidebar-accent focus:text-white"
        >
          <Pencil className="size-3.5 text-white/50" />
          Edit mapping
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onDelete()}
          disabled={deleteDisabled}
          className="cursor-pointer rounded-sm px-3 py-2 text-xs text-red-300 focus:bg-red-500/10 focus:text-red-200 data-[disabled]:opacity-50"
        >
          <Trash2 className="size-3.5 text-red-300" />
          Delete mapping
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function prepareMappingPayload(input: {
  canonicalSymbol: string;
  aliases: string[];
}) {
  const nextAliases = Array.from(
    new Set(input.aliases.map(normalizeMappingValue).filter(Boolean))
  );
  const nextCanonicalSymbol =
    normalizeMappingValue(input.canonicalSymbol) || nextAliases[0] || "";

  return {
    canonicalSymbol: nextCanonicalSymbol,
    aliases: nextAliases.filter((alias) => alias !== nextCanonicalSymbol),
  };
}

function getSymbolMappingErrorMessage(error: any) {
  const fieldErrors = error?.data?.zodError?.fieldErrors;
  if (fieldErrors?.canonicalSymbol?.[0]) {
    return fieldErrors.canonicalSymbol[0];
  }
  if (fieldErrors?.aliases?.[0]) {
    return fieldErrors.aliases[0];
  }

  const flattenedZod = error?.shape?.data?.zodError?.fieldErrors;
  if (flattenedZod?.canonicalSymbol?.[0]) {
    return flattenedZod.canonicalSymbol[0];
  }
  if (flattenedZod?.aliases?.[0]) {
    return flattenedZod.aliases[0];
  }

  return error?.message || "Failed to save symbol mapping";
}

async function invalidateSymbolMappingQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [["symbolMappings"]] }),
    queryClient.refetchQueries({
      queryKey: [["symbolMappings"]],
      type: "active",
    }),
    queryClient.invalidateQueries({ queryKey: [["trades"]] }),
    queryClient.refetchQueries({ queryKey: [["trades"]], type: "active" }),
    queryClient.invalidateQueries({ queryKey: [["accounts"]] }),
    queryClient.refetchQueries({ queryKey: [["accounts"]], type: "active" }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-chart-trades"] }),
    queryClient.refetchQueries({
      queryKey: ["dashboard-chart-trades"],
      type: "active",
    }),
  ]);
}

export default function SymbolMappingSettingsPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [canonicalSymbol, setCanonicalSymbol] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [customTab, setCustomTab] = useState("all");
  const [detectedTab, setDetectedTab] = useState("all");
  const [builtInTab, setBuiltInTab] = useState("all");
  const customMappingSectionRef = useRef<HTMLElement | null>(null);

  const { data: customMappingsRaw, isLoading: customMappingsLoading } =
    useQuery(trpcOptions.symbolMappings.list.queryOptions());
  const { data: detectedSymbolsRaw, isLoading: detectedSymbolsLoading } =
    useQuery(trpcOptions.symbolMappings.listDetectedSymbols.queryOptions());
  const { data: baseMappingsRaw, isLoading: baseMappingsLoading } = useQuery(
    trpcOptions.symbolMappings.listBaseMappings.queryOptions()
  );

  const customMappings = (customMappingsRaw ?? []) as CustomMappingRow[];
  const detectedSymbols = (detectedSymbolsRaw ?? []) as DetectedSymbolRow[];
  const baseMappings = (baseMappingsRaw ?? []) as BaseMappingRow[];

  const aliasSuggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...detectedSymbols.map((row) => row.rawSymbol),
          ...baseMappings.flatMap((row) => row.aliases),
          ...baseMappings.map((row) => row.canonicalSymbol),
        ])
      ).sort((left, right) => left.localeCompare(right)),
    [baseMappings, detectedSymbols]
  );

  const searchTerm = search.trim().toUpperCase();

  const customAssetClasses = useMemo(() => {
    const classes = new Set<string>();
    for (const row of customMappings) {
      classes.add(row.assetClass);
    }
    return Array.from(classes).sort();
  }, [customMappings]);

  const filteredCustomMappings = useMemo(() => {
    if (customTab === "all") {
      return customMappings;
    }

    return customMappings.filter((row) => row.assetClass === customTab);
  }, [customMappings, customTab]);

  const filteredDetectedSymbols = useMemo(() => {
    let rows = detectedSymbols;
    if (searchTerm) {
      rows = rows.filter((row) =>
        [row.rawSymbol, row.canonicalSymbol, row.assetClass, row.source].some(
          (value) => value.toUpperCase().includes(searchTerm)
        )
      );
    }
    if (detectedTab !== "all") {
      rows = rows.filter((row) => row.assetClass === detectedTab);
    }
    return rows;
  }, [detectedSymbols, searchTerm, detectedTab]);

  const filteredBaseMappings = useMemo(() => {
    let rows = baseMappings;
    if (searchTerm) {
      rows = rows.filter((row) =>
        [
          row.canonicalSymbol,
          row.assetClass,
          ...row.aliases,
          ...row.futuresRoots,
        ].some((value) => value.toUpperCase().includes(searchTerm))
      );
    }
    if (builtInTab !== "all") {
      rows = rows.filter((row) => row.assetClass === builtInTab);
    }
    return rows;
  }, [baseMappings, searchTerm, builtInTab]);

  const detectedAssetClasses = useMemo(() => {
    const classes = new Set<string>();
    for (const row of detectedSymbols) {
      classes.add(row.assetClass);
    }
    return Array.from(classes).sort();
  }, [detectedSymbols]);

  const builtInAssetClasses = useMemo(() => {
    const classes = new Set<string>();
    for (const row of baseMappings) {
      classes.add(row.assetClass);
    }
    return Array.from(classes).sort();
  }, [baseMappings]);

  const resetForm = () => {
    setEditingId(null);
    setCanonicalSymbol("");
    setAliases([]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = prepareMappingPayload({
        canonicalSymbol,
        aliases,
      });

      if (!payload.canonicalSymbol) {
        throw new Error("Enter a canonical symbol or add an alias first");
      }

      if (payload.aliases.length === 0) {
        throw new Error("Add at least one alias before saving");
      }

      return trpcClient.symbolMappings.upsert.mutate({
        id: editingId || undefined,
        canonicalSymbol: payload.canonicalSymbol,
        aliases: payload.aliases,
      });
    },
    onSuccess: async () => {
      await invalidateSymbolMappingQueries();
      resetForm();
      toast.success(
        editingId ? "Symbol mapping updated" : "Symbol mapping saved"
      );
    },
    onError: (error: any) => {
      toast.error(getSymbolMappingErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      trpcClient.symbolMappings.delete.mutate({ id }),
    onSuccess: async () => {
      await invalidateSymbolMappingQueries();
      if (editingId) {
        resetForm();
      }
      toast.success("Symbol mapping deleted");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete symbol mapping");
    },
  });

  const startEdit = (row: CustomMappingRow) => {
    setEditingId(row.id);
    setCanonicalSymbol(row.canonicalSymbol);
    setAliases(row.aliases);
  };

  const appendAlias = (
    rawSymbol: string,
    suggestedCanonicalSymbol?: string
  ) => {
    const nextAlias = normalizeMappingValue(rawSymbol);
    const nextCanonical =
      normalizeMappingValue(suggestedCanonicalSymbol) || nextAlias;
    const currentCanonical = normalizeMappingValue(canonicalSymbol);
    const currentAliases = Array.from(
      new Set(aliases.map(normalizeMappingValue).filter(Boolean))
    );
    const existingMapping = customMappings.find(
      (row) => normalizeMappingValue(row.canonicalSymbol) === nextCanonical
    );
    const existingAliases = Array.from(
      new Set(
        (existingMapping?.aliases ?? [])
          .map(normalizeMappingValue)
          .filter(Boolean)
      )
    );

    if (!nextAlias) {
      return;
    }

    const sameCanonicalDraft =
      currentCanonical.length > 0 && currentCanonical === nextCanonical;
    const baseAliases = Array.from(
      new Set([
        ...existingAliases,
        ...(sameCanonicalDraft ? currentAliases : []),
      ])
    );
    const aliasAlreadyPresent =
      nextAlias === nextCanonical || baseAliases.includes(nextAlias);
    const nextAliases = Array.from(new Set([...baseAliases, nextAlias])).filter(
      (alias) => alias !== nextCanonical
    );
    const startedNewDraft = !sameCanonicalDraft && !existingMapping;
    const loadedExistingMapping =
      Boolean(existingMapping) &&
      (!sameCanonicalDraft || editingId !== existingMapping?.id);

    setEditingId(
      existingMapping?.id ?? (sameCanonicalDraft ? editingId : null)
    );
    setCanonicalSymbol(existingMapping?.canonicalSymbol ?? nextCanonical);
    setAliases(nextAliases);

    customMappingSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    if (aliasAlreadyPresent) {
      toast.message(
        nextAlias === nextCanonical
          ? `${nextCanonical} is already the canonical symbol`
          : `${nextAlias} is already mapped to ${nextCanonical}`
      );
      return;
    }

    if (loadedExistingMapping) {
      toast.success(
        `Loaded the existing ${nextCanonical} mapping and added ${nextAlias}`
      );
      return;
    }

    if (startedNewDraft) {
      toast.success(
        nextAlias === nextCanonical
          ? `Started a new mapping draft for ${nextCanonical}`
          : `Started a new ${nextCanonical} mapping draft with ${nextAlias} as an alias`
      );
      return;
    }

    toast.success(`Added ${nextAlias} to the ${nextCanonical} draft`);
  };

  return (
    <main className="space-y-6 p-6 py-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Waypoints className="size-4 text-teal-400" />
          <span className="text-sm font-medium text-white/85">
            Symbol mapping
          </span>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-white/45">
          ProfitableEdge keeps your stored trade symbols intact and only links
          matching aliases together behind the scenes. Built-in coverage handles
          forex suffix variations plus common futures, index, metal, energy,
          crypto, and rates aliases. Custom mappings let you extend that
          grouping on your own terms.
        </p>
      </div>

      {/* Stat cards — GoalSurface style */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            icon: Database,
            label: "Built-in map",
            value: baseMappingsLoading ? "..." : baseMappings.length,
            description: "Canonical assets shipped by default.",
            color: "text-blue-400",
          },
          {
            icon: Layers,
            label: "Custom rules",
            value: customMappingsLoading ? "..." : customMappings.length,
            description: "User overrides saved in settings.",
            color: "text-teal-400",
          },
          {
            icon: Waypoints,
            label: "Detected symbols",
            value: detectedSymbolsLoading ? "..." : detectedSymbols.length,
            description: "Raw symbols present in your trade history.",
            color: "text-purple-400",
          },
        ].map((card) => (
          <GoalSurface key={card.label}>
            <div className="p-3.5">
              <div className="flex items-center gap-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-white/50">{card.label}</span>
              </div>
              <GoalContentSeparator className="mb-3.5 mt-3.5" />
              <div className="text-2xl font-semibold text-white">
                {card.value}
              </div>
              <p className="mt-1 text-xs text-white/40">{card.description}</p>
            </div>
          </GoalSurface>
        ))}
      </div>

      <Separator className="-mx-6" />

      {/* Custom mapping */}
      <section ref={customMappingSectionRef} className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-white/80">Custom mapping</h2>
          <p className="mt-0.5 text-xs text-white/40">
            Map one canonical asset to multiple raw broker symbols.
          </p>
        </div>

        <Separator className="-mx-6" />

        <div className="space-y-4">
          <div className="grid items-start gap-3 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label className="text-xs text-white/35">Canonical symbol</Label>
              <Input
                value={canonicalSymbol}
                onChange={(event) =>
                  setCanonicalSymbol(event.target.value.toUpperCase())
                }
                placeholder="NAS100"
                className="min-h-[38px] bg-sidebar-accent ring-white/5 text-white text-xs py-2"
              />
              {/*<p className="text-[11px] text-white/35">
                If you leave this blank, the first alias will be used as the
                internal group key.
              </p>*/}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-white/35">Aliases</Label>
              <TagMultiSelect
                value={aliases}
                suggestions={aliasSuggestions}
                placeholder="Add raw symbols like US100.cash, US100, NQH6"
                selectedLayout="grid"
                onChange={setAliases}
                className="rounded-md border-0 bg-sidebar-accent ring ring-white/5 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={saveMutation.isPending}
              className="h-9 rounded-sm text-xs"
            >
              Clear form
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className={getPropAssignActionButtonClassName({
                tone: "teal",
              })}
            >
              {editingId ? (
                <>
                  <Pencil className="mr-1 size-3.5" />
                  Update mapping
                </>
              ) : (
                <>
                  <Plus className="size-3" />
                  Save mapping
                </>
              )}
            </Button>
          </div>

          <Separator className="-mx-6" />

          <Tabs value={customTab} onValueChange={setCustomTab}>
            <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
              <TabsTriggerUnderlined
                value="all"
                className="h-10 pb-0 pt-0 text-xs font-medium data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
              >
                All
              </TabsTriggerUnderlined>
              {customAssetClasses.map((assetClass) => (
                <TabsTriggerUnderlined
                  key={assetClass}
                  value={assetClass}
                  className="h-10 pb-0 pt-0 text-xs font-medium data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
                >
                  {formatAssetClass(assetClass)}
                </TabsTriggerUnderlined>
              ))}
            </TabsListUnderlined>
            <Separator />

            <TabsContent value={customTab} forceMount className="mt-4">
              {customMappingsLoading ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : filteredCustomMappings.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCustomMappings.map((row) => (
                    <div
                      key={row.id}
                      className={cn(
                        CARD_OUTER,
                        editingId === row.id && "border-teal-500/35"
                      )}
                    >
                      <div className={cn(CARD_INNER, "p-3.5")}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              {row.canonicalSymbol}
                            </span>
                            <span className="rounded-sm bg-white/6 px-2 py-1 text-[10px] text-white/40">
                              {formatAssetClass(row.assetClass)}
                            </span>
                          </div>
                          <MappingCardMenu
                            onEdit={() => startEdit(row)}
                            onDelete={() => deleteMutation.mutate(row.id)}
                            deleteDisabled={deleteMutation.isPending}
                          />
                        </div>
                        <div className="mt-3">
                          <AliasCardGrid aliases={row.aliases} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-xs text-white/40">
                  No custom mappings yet. Save one to override the built-in map
                  or merge raw broker symbols that still need manual
                  normalization.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <Separator className="-mx-6" />

      {/* Search */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-white/80">Search coverage</h2>
          <p className="mt-0.5 text-xs text-white/40">
            Filter detected symbols and built-in mappings together.
          </p>
        </div>
        <div className="relative max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/25" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search NAS100, NQ, XAUUSD, CL, BTC..."
            className="bg-sidebar-accent pl-9 ring-white/5 text-white text-sm"
          />
        </div>
      </section>

      <Separator className="-mx-6" />

      {/* Detected symbols with tabs */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-white/80">
            Detected symbols
          </h2>
          <p className="mt-0.5 text-xs text-white/40">
            These raw symbols already exist in your trades and show how they
            currently resolve.
          </p>
        </div>

        <Tabs value={detectedTab} onValueChange={setDetectedTab}>
          <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
            <TabsTriggerUnderlined
              value="all"
              className="h-10 pb-0 pt-0 text-xs font-medium data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              All
            </TabsTriggerUnderlined>
            {detectedAssetClasses.map((ac) => (
              <TabsTriggerUnderlined
                key={ac}
                value={ac}
                className="h-10 pb-0 pt-0 text-xs font-medium data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
              >
                {formatAssetClass(ac)}
              </TabsTriggerUnderlined>
            ))}
          </TabsListUnderlined>
          <Separator />

          <TabsContent value={detectedTab} forceMount className="mt-4">
            {detectedSymbolsLoading ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : filteredDetectedSymbols.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredDetectedSymbols.map((row) => (
                  <div key={row.rawSymbol} className={CARD_OUTER}>
                    <div className={cn(CARD_INNER, "gap-2.5 p-3.5")}>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-white">
                          {row.rawSymbol}
                        </span>
                        <ArrowRightLeft className="size-3.5 text-white/25" />
                        <span className="text-teal-300">
                          {row.canonicalSymbol}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-sm bg-white/6 px-2 py-1 text-[10px] text-white/40">
                          {formatSource(row.source)}
                        </span>
                        <span className="rounded-sm bg-white/6 px-2 py-1 text-[10px] text-white/40">
                          {formatAssetClass(row.assetClass)}
                        </span>
                        <span className="text-xs text-white/35">
                          {row.tradeCount} trade
                          {row.tradeCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={() =>
                          appendAlias(row.rawSymbol, row.canonicalSymbol)
                        }
                        className={getPropAssignActionButtonClassName({
                          tone: "teal",
                          size: "sm",
                          className: "mt-auto w-fit",
                        })}
                      >
                        Add alias
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-xs text-white/40">
                No detected symbols matched the current search.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <Separator className="-mx-6" />

      {/* Built-in foundation with tabs */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-white/80">
            Built-in foundation
          </h2>
          <p className="mt-0.5 text-xs text-white/40">
            Default canonical map shipped by the platform before user overrides
            are applied.
          </p>
        </div>

        <Tabs value={builtInTab} onValueChange={setBuiltInTab}>
          <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
            <TabsTriggerUnderlined
              value="all"
              className="h-10 pb-0 pt-0 text-xs font-medium data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              All
            </TabsTriggerUnderlined>
            {builtInAssetClasses.map((ac) => (
              <TabsTriggerUnderlined
                key={ac}
                value={ac}
                className="h-10 pb-0 pt-0 text-xs font-medium data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
              >
                {formatAssetClass(ac)}
              </TabsTriggerUnderlined>
            ))}
          </TabsListUnderlined>
          <Separator />

          <TabsContent value={builtInTab} forceMount className="mt-4">
            {baseMappingsLoading ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : filteredBaseMappings.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredBaseMappings.map((row) => (
                  <div key={row.canonicalSymbol} className={CARD_OUTER}>
                    <div className={cn(CARD_INNER, "p-3.5")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {row.canonicalSymbol}
                        </span>
                        <span className="rounded-sm bg-white/6 px-2 py-1 text-[10px] text-white/40">
                          {formatAssetClass(row.assetClass)}
                        </span>
                      </div>
                      <div className="mt-3">
                        <AliasCardGrid aliases={row.aliases} />
                      </div>
                      {row.futuresRoots.length > 0 ? (
                        <p className="mt-3 text-xs text-white/35">
                          Futures roots: {row.futuresRoots.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-xs text-white/40">
                No built-in mappings matched the current search.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
