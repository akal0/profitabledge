import { create } from "zustand";
import type { StateCreator } from "zustand";
import { trpcClient } from "@/utils/trpc";

export type AccountStats = {
  totalProfit: number;
  profitFactor: number | null;
  wins: number;
  losses: number;
  winrate: number;
  winStreak: number;
  recentOutcomes: ("W" | "L")[];
  averageHoldSeconds?: number;
};

type StatsState = {
  statsByAccount: Record<string, AccountStats | undefined>;
  loadingByAccount: Record<string, boolean | undefined>;
  lastFetchedAt: Record<string, number | undefined>;
  fetchStats: (accountId: string) => Promise<void>;
  isLoading: (accountId?: string) => boolean;
  getStats: (accountId?: string) => AccountStats | undefined;
};

const createStatsSlice: StateCreator<StatsState, [], [], StatsState> = (
  set,
  get
) => ({
  statsByAccount: {},
  loadingByAccount: {},
  lastFetchedAt: {},
  async fetchStats(accountId: string) {
    if (!accountId) return;
    // Avoid duplicate inflight
    if (get().loadingByAccount[accountId]) return;
    set((s) => ({
      loadingByAccount: { ...s.loadingByAccount, [accountId]: true },
    }));
    try {
      const data = await trpcClient.accounts.stats.query({ accountId });
      set((s) => ({
        statsByAccount: { ...s.statsByAccount, [accountId]: data },
        lastFetchedAt: { ...s.lastFetchedAt, [accountId]: Date.now() },
      }));
    } catch (e) {
      // noop; could add error map
    } finally {
      set((s) => ({
        loadingByAccount: { ...s.loadingByAccount, [accountId]: false },
      }));
    }
  },
  isLoading(accountId?: string) {
    if (!accountId) return false;
    return Boolean(get().loadingByAccount[accountId]);
  },
  getStats(accountId?: string) {
    if (!accountId) return undefined;
    return get().statsByAccount[accountId];
  },
});

export const useStatsStore = create<StatsState>()(createStatsSlice);
