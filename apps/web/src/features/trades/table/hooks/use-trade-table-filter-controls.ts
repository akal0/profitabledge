"use client";

import * as React from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState, useQueryStates } from "nuqs";

import { trpcClient, trpcOptions } from "@/utils/trpc";
import {
  deriveTradeTableFilterState,
  type TradeTableStatFilters,
} from "@/features/trades/table/lib/trade-table-filter-state";
import type {
  SelectedTradeView,
  SelectedTradeViewConfig,
} from "@/features/trades/table/lib/trade-table-view-state";

export function useTradeTableFilterControls() {
  const [qParam, setQParam] = useQueryState("q", { defaultValue: "" });
  const [idsParam, setIdsParam] = useQueryState("ids", { defaultValue: "" });
  const [slParam, setSlParam] = useQueryState("sl", { defaultValue: "" });
  const [tpParam, setTpParam] = useQueryState("tp", { defaultValue: "" });
  const [dirParam, setDirParam] = useQueryState("dir", { defaultValue: "all" });
  const [symbolsParam, setSymbolsParam] = useQueryState("symbols", {
    defaultValue: "",
  });
  const [killzonesParam, setKillzonesParam] = useQueryState("killzones", {
    defaultValue: "",
  });
  const [sessionTagsParam, setSessionTagsParam] = useQueryState("sessionTags", {
    defaultValue: "",
  });
  const [modelTagsParam, setModelTagsParam] = useQueryState("modelTags", {
    defaultValue: "",
  });
  const [protocolParam, setProtocolParam] = useQueryState("protocol", {
    defaultValue: "",
  });
  const [outcomeParam, setOutcomeParam] = useQueryState("outcome", {
    defaultValue: "",
  });
  const [holdParam, setHoldParam] = useQueryState("hold", { defaultValue: "" });
  const [volParam, setVolParam] = useQueryState("vol", { defaultValue: "" });
  const [plParam, setPlParam] = useQueryState("pl", { defaultValue: "" });
  const [comParam, setComParam] = useQueryState("com", { defaultValue: "" });
  const [swapParam, setSwapParam] = useQueryState("swap", {
    defaultValue: "",
  });
  const [rrParam, setRrParam] = useQueryState("rr", { defaultValue: "" });
  const [mfeParam, setMfeParam] = useQueryState("mfe", { defaultValue: "" });
  const [maeParam, setMaeParam] = useQueryState("mae", { defaultValue: "" });
  const [effParam, setEffParam] = useQueryState("eff", { defaultValue: "" });
  const [sortParam, setSortParam] = useQueryState("sort", {
    defaultValue: "open:desc",
  });
  const [viewParam, setViewParam] = useQueryState("view", {
    defaultValue: "",
  });
  const [{ oStart, oEnd }, setRangeParams] = useQueryStates(
    {
      oStart: parseAsString.withDefault(""),
      oEnd: parseAsString.withDefault(""),
    },
    { history: "push" }
  );

  const activeViewKey = React.useMemo(
    () =>
      viewParam
        ? trpcOptions.views.get.queryOptions({ id: viewParam }).queryKey
        : (["views", "inactive", "selected-view"] as const),
    [viewParam]
  );
  const { data: selectedViewRaw } = useSuspenseQuery<SelectedTradeView | null>({
    queryKey: activeViewKey,
    queryFn: async () => {
      if (!viewParam) {
        return null;
      }

      return (await trpcClient.views.get.query({
        id: viewParam,
      })) as SelectedTradeView;
    },
    staleTime: viewParam ? 30_000 : Infinity,
  });
  const selectedView = selectedViewRaw ?? undefined;
  const selectedViewConfig = React.useMemo<SelectedTradeViewConfig | undefined>(
    () =>
      selectedView?.config && typeof selectedView.config === "object"
        ? (selectedView.config as SelectedTradeViewConfig)
        : undefined,
    [selectedView?.config]
  );
  const selectedViewVisibleColumns = React.useMemo(
    () =>
      Array.isArray(selectedViewConfig?.visibleColumns) &&
      selectedViewConfig.visibleColumns.length > 0
        ? selectedViewConfig.visibleColumns
        : null,
    [selectedViewConfig?.visibleColumns]
  );

  const q = qParam || "";
  const filterState = React.useMemo(
    () =>
      deriveTradeTableFilterState({
        idsParam,
        slParam,
        tpParam,
        dirParam,
        symbolsParam,
        killzonesParam,
        sessionTagsParam,
        modelTagsParam,
        protocolParam,
        outcomeParam,
        holdParam,
        volParam,
        plParam,
        comParam,
        swapParam,
        rrParam,
        mfeParam,
        maeParam,
        effParam,
        oStart,
        oEnd,
        selectedViewConfig,
      }),
    [
      idsParam,
      slParam,
      tpParam,
      dirParam,
      symbolsParam,
      killzonesParam,
      sessionTagsParam,
      modelTagsParam,
      protocolParam,
      outcomeParam,
      holdParam,
      volParam,
      plParam,
      comParam,
      swapParam,
      rrParam,
      mfeParam,
      maeParam,
      effParam,
      oStart,
      oEnd,
      selectedViewConfig,
    ]
  );

  const statFilterSeed = React.useMemo<TradeTableStatFilters>(
    () => ({
      rrMin: filterState.statFilterSeed.rrMin,
      rrMax: filterState.statFilterSeed.rrMax,
      mfeMin: filterState.statFilterSeed.mfeMin,
      mfeMax: filterState.statFilterSeed.mfeMax,
      maeMin: filterState.statFilterSeed.maeMin,
      maeMax: filterState.statFilterSeed.maeMax,
      efficiencyMin: filterState.statFilterSeed.efficiencyMin,
      efficiencyMax: filterState.statFilterSeed.efficiencyMax,
    }),
    [
      filterState.statFilterSeed.efficiencyMax,
      filterState.statFilterSeed.efficiencyMin,
      filterState.statFilterSeed.maeMax,
      filterState.statFilterSeed.maeMin,
      filterState.statFilterSeed.mfeMax,
      filterState.statFilterSeed.mfeMin,
      filterState.statFilterSeed.rrMax,
      filterState.statFilterSeed.rrMin,
    ]
  );

  const [statFilters, setStatFilters] =
    React.useState<TradeTableStatFilters>(statFilterSeed);

  React.useEffect(() => {
    setStatFilters(statFilterSeed);
  }, [statFilterSeed]);

  return {
    q,
    qParam,
    idsParam,
    slParam,
    tpParam,
    dirParam,
    symbolsParam,
    killzonesParam,
    sessionTagsParam,
    modelTagsParam,
    protocolParam,
    outcomeParam,
    holdParam,
    volParam,
    plParam,
    comParam,
    swapParam,
    rrParam,
    mfeParam,
    maeParam,
    effParam,
    sortParam,
    viewParam,
    oStart,
    oEnd,
    selectedViewConfig,
    selectedViewVisibleColumns,
    filterState,
    statFilters,
    setStatFilters,
    setQParam,
    setIdsParam,
    setSlParam,
    setTpParam,
    setDirParam,
    setSymbolsParam,
    setKillzonesParam,
    setSessionTagsParam,
    setModelTagsParam,
    setProtocolParam,
    setOutcomeParam,
    setHoldParam,
    setVolParam,
    setPlParam,
    setComParam,
    setSwapParam,
    setRrParam,
    setMfeParam,
    setMaeParam,
    setEffParam,
    setSortParam,
    setViewParam,
    setRangeParams,
  };
}
