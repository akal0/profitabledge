"use client";

import { create } from "zustand";

export type TabAttentionActivityKey =
  | "assistant"
  | "daily-briefing"
  | "demo-workspace"
  | "insights";

type TabAttentionState = {
  activityCounts: Partial<Record<TabAttentionActivityKey, number>>;
  activeActivityCount: number;
};

function incrementCount(
  counts: Partial<Record<TabAttentionActivityKey, number>>,
  key: TabAttentionActivityKey
) {
  return {
    ...counts,
    [key]: (counts[key] ?? 0) + 1,
  };
}

function decrementCount(
  counts: Partial<Record<TabAttentionActivityKey, number>>,
  key: TabAttentionActivityKey
) {
  const nextValue = Math.max((counts[key] ?? 0) - 1, 0);

  if (nextValue === 0) {
    const { [key]: _removed, ...remaining } = counts;
    return remaining;
  }

  return {
    ...counts,
    [key]: nextValue,
  };
}

export const useTabAttentionStore = create<TabAttentionState>(() => ({
  activityCounts: {},
  activeActivityCount: 0,
}));

export function startTabAttentionActivity(key: TabAttentionActivityKey) {
  let released = false;

  useTabAttentionStore.setState((state) => ({
    activityCounts: incrementCount(state.activityCounts, key),
    activeActivityCount: state.activeActivityCount + 1,
  }));

  return () => {
    if (released) {
      return;
    }

    released = true;

    useTabAttentionStore.setState((state) => ({
      activityCounts: decrementCount(state.activityCounts, key),
      activeActivityCount: Math.max(state.activeActivityCount - 1, 0),
    }));
  };
}
