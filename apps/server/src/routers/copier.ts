import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { copyGroup, copySlave, copySignal } from "../db/schema/copier";
import { tradingAccount, trade } from "../db/schema/trading";
import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";
import { copierGroupProcedures } from "./copier/groups";
import { copierHealthProcedures } from "./copier/health";
import {
  COPIER_ACTIVITY_WINDOW_DAYS,
  COPIER_CONNECTION_FRESHNESS_MS,
  isAccountConnected,
  parseNumeric,
} from "./copier/shared";

export const copierRouter = router({
  /**
   * Portfolio-level copier dashboard used by the trade copier command center.
   * Combines setup readiness, recent activity, execution health, and group-level summaries
   * so the UI can render from a single query.
   */
  getDashboard: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const recentCutoff = new Date(
      now.getTime() - COPIER_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const freshnessCutoff = new Date(
      now.getTime() - COPIER_CONNECTION_FRESHNESS_MS
    );

    const [accountRows, groupRows] = await Promise.all([
      db
        .select({
          id: tradingAccount.id,
          name: tradingAccount.name,
          broker: tradingAccount.broker,
          brokerServer: tradingAccount.brokerServer,
          accountNumber: tradingAccount.accountNumber,
          initialBalance: tradingAccount.initialBalance,
          liveBalance: tradingAccount.liveBalance,
          liveEquity: tradingAccount.liveEquity,
          isVerified: tradingAccount.isVerified,
          lastSyncedAt: tradingAccount.lastSyncedAt,
          createdAt: tradingAccount.createdAt,
        })
        .from(tradingAccount)
        .where(eq(tradingAccount.userId, userId))
        .orderBy(desc(tradingAccount.createdAt)),
      db
        .select({
          group: copyGroup,
          masterAccount: tradingAccount,
        })
        .from(copyGroup)
        .innerJoin(tradingAccount, eq(copyGroup.masterAccountId, tradingAccount.id))
        .where(eq(copyGroup.userId, userId))
        .orderBy(desc(copyGroup.createdAt)),
    ]);

    const accountRoleMap = new Map<
      string,
      { isMaster: boolean; isSlave: boolean; groupNames: string[] }
    >();

    for (const { group, masterAccount } of groupRows) {
      const entry = accountRoleMap.get(masterAccount.id) ?? {
        isMaster: false,
        isSlave: false,
        groupNames: [],
      };
      entry.isMaster = true;
      entry.groupNames.push(group.name);
      accountRoleMap.set(masterAccount.id, entry);
    }

    const baseAccounts = accountRows.map((account) => {
      const roleEntry = accountRoleMap.get(account.id) ?? {
        isMaster: false,
        isSlave: false,
        groupNames: [],
      };
      const verified = account.isVerified === 1;
      const connected = isAccountConnected(
        account.isVerified,
        account.lastSyncedAt,
        freshnessCutoff
      );

      return {
        id: account.id,
        name: account.name,
        broker: account.broker,
        brokerServer: account.brokerServer,
        accountNumber: account.accountNumber,
        role: roleEntry.isMaster && roleEntry.isSlave
          ? "both"
          : roleEntry.isMaster
            ? "master"
            : roleEntry.isSlave
              ? "slave"
              : "unassigned",
        groupNames: roleEntry.groupNames,
        isVerified: verified,
        isConnected: connected,
        lastSyncedAt: account.lastSyncedAt,
        liveBalance: account.liveBalance?.toString() ?? null,
        liveEquity: account.liveEquity?.toString() ?? null,
        initialBalance: account.initialBalance?.toString() ?? null,
      };
    });

    if (!groupRows.length) {
      const verifiedAccounts = baseAccounts.filter((account) => account.isVerified);
      const connectedAccounts = baseAccounts.filter((account) => account.isConnected);
      const setupIssues = [];

      if (baseAccounts.length === 0) {
        setupIssues.push({
          tone: "critical",
          title: "No trading accounts linked",
          description:
            "Add at least one master account and one destination account before turning the copier on.",
        });
      } else if (!verifiedAccounts.length) {
        setupIssues.push({
          tone: "critical",
          title: "Accounts are not EA-verified",
          description:
            "The copier only goes live once accounts are synced and reporting their account number and balance.",
        });
      } else if (connectedAccounts.length < 2) {
        setupIssues.push({
          tone: "warning",
          title: "Not enough live accounts connected",
          description:
            "Keep at least one master and one slave actively reporting so the copier can route signals.",
        });
      } else {
        setupIssues.push({
          tone: "info",
          title: "Ready for your first routing group",
          description:
            "Create a copy group, assign a master, and attach one or more slave accounts to start copying trades.",
        });
      }

      return {
        overview: {
          groupCount: 0,
          activeGroupCount: 0,
          slaveCount: 0,
          activeSlaveCount: 0,
          totalSignals: 0,
          pendingSignals: 0,
          sentSignals: 0,
          executedSignals: 0,
          failedSignals: 0,
          rejectedSignals: 0,
          executionRate: 0,
          avgLatencyMs: 0,
          avgSlippage: 0,
          copiedProfit30d: 0,
          masterProfit30d: 0,
          copyDelta30d: 0,
          verifiedAccountCount: verifiedAccounts.length,
          connectedAccountCount: connectedAccounts.length,
          staleAccountCount: baseAccounts.filter(
            (account) => account.isVerified && !account.isConnected
          ).length,
          lastSignalAt: null,
        },
        setup: {
          issues: setupIssues,
          accounts: baseAccounts,
        },
        recentSignals: [],
        groups: [],
      };
    }

    const groupIds = groupRows.map(({ group }) => group.id);
    const groupMap = new Map(
      groupRows.map(({ group, masterAccount }) => [
        group.id,
        {
          group,
          masterAccount,
        },
      ])
    );

    const slaveRows = await db
      .select({
        id: copySlave.id,
        copyGroupId: copySlave.copyGroupId,
        isActive: copySlave.isActive,
        lotMode: copySlave.lotMode,
        fixedLot: copySlave.fixedLot,
        lotMultiplier: copySlave.lotMultiplier,
        riskPercent: copySlave.riskPercent,
        maxLotSize: copySlave.maxLotSize,
        maxDailyLoss: copySlave.maxDailyLoss,
        maxTradesPerDay: copySlave.maxTradesPerDay,
        maxDrawdownPercent: copySlave.maxDrawdownPercent,
        slMode: copySlave.slMode,
        slFixedPips: copySlave.slFixedPips,
        slMultiplier: copySlave.slMultiplier,
        tpMode: copySlave.tpMode,
        tpFixedPips: copySlave.tpFixedPips,
        tpMultiplier: copySlave.tpMultiplier,
        symbolWhitelist: copySlave.symbolWhitelist,
        symbolBlacklist: copySlave.symbolBlacklist,
        sessionFilter: copySlave.sessionFilter,
        minLotSize: copySlave.minLotSize,
        maxSlippagePips: copySlave.maxSlippagePips,
        copyPendingOrders: copySlave.copyPendingOrders,
        copySlTpModifications: copySlave.copySlTpModifications,
        reverseTrades: copySlave.reverseTrades,
        totalCopiedTrades: copySlave.totalCopiedTrades,
        totalProfit: copySlave.totalProfit,
        lastCopyAt: copySlave.lastCopyAt,
        createdAt: copySlave.createdAt,
        accountId: tradingAccount.id,
        accountName: tradingAccount.name,
        accountBroker: tradingAccount.broker,
        accountNumber: tradingAccount.accountNumber,
        accountLiveBalance: tradingAccount.liveBalance,
        accountLiveEquity: tradingAccount.liveEquity,
        accountInitialBalance: tradingAccount.initialBalance,
        accountIsVerified: tradingAccount.isVerified,
        accountLastSyncedAt: tradingAccount.lastSyncedAt,
      })
      .from(copySlave)
      .innerJoin(tradingAccount, eq(copySlave.slaveAccountId, tradingAccount.id))
      .where(inArray(copySlave.copyGroupId, groupIds))
      .orderBy(desc(copySlave.createdAt));

    for (const slave of slaveRows) {
      const roleEntry = accountRoleMap.get(slave.accountId) ?? {
        isMaster: false,
        isSlave: false,
        groupNames: [],
      };
      roleEntry.isSlave = true;
      const groupName = groupMap.get(slave.copyGroupId)?.group.name;
      if (groupName && !roleEntry.groupNames.includes(groupName)) {
        roleEntry.groupNames.push(groupName);
      }
      accountRoleMap.set(slave.accountId, roleEntry);
    }

    const slaveIds = slaveRows.map((slave) => slave.id);

    const [signalCountRows, healthSignalRows, recentSignalRows] = slaveIds.length
      ? await Promise.all([
          db
            .select({
              groupId: copySlave.copyGroupId,
              totalSignals: sql<string>`COUNT(*)`,
              pendingSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'pending' THEN 1 ELSE 0 END)`,
              sentSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'sent' THEN 1 ELSE 0 END)`,
              executedSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'executed' THEN 1 ELSE 0 END)`,
              failedSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'failed' THEN 1 ELSE 0 END)`,
              rejectedSignals: sql<string>`SUM(CASE WHEN ${copySignal.status} = 'rejected' THEN 1 ELSE 0 END)`,
            })
            .from(copySignal)
            .innerJoin(copySlave, eq(copySignal.copySlaveId, copySlave.id))
            .where(inArray(copySlave.copyGroupId, groupIds))
            .groupBy(copySlave.copyGroupId),
          db
            .select({
              id: copySignal.id,
              copySlaveId: copySignal.copySlaveId,
              groupId: copySlave.copyGroupId,
              signalType: copySignal.signalType,
              status: copySignal.status,
              masterTicket: copySignal.masterTicket,
              slaveTicket: copySignal.slaveTicket,
              symbol: copySignal.symbol,
              tradeType: copySignal.tradeType,
              masterVolume: copySignal.masterVolume,
              slaveVolume: copySignal.slaveVolume,
              openPrice: copySignal.openPrice,
              closePrice: copySignal.closePrice,
              executedPrice: copySignal.executedPrice,
              slippagePips: copySignal.slippagePips,
              profit: copySignal.profit,
              rejectionReason: copySignal.rejectionReason,
              errorMessage: copySignal.errorMessage,
              createdAt: copySignal.createdAt,
              executedAt: copySignal.executedAt,
            })
            .from(copySignal)
            .innerJoin(copySlave, eq(copySignal.copySlaveId, copySlave.id))
            .where(
              and(
                inArray(copySlave.copyGroupId, groupIds),
                gte(copySignal.createdAt, recentCutoff)
              )
            )
            .orderBy(desc(copySignal.createdAt)),
          db
            .select({
              id: copySignal.id,
              copySlaveId: copySignal.copySlaveId,
              groupId: copySlave.copyGroupId,
              signalType: copySignal.signalType,
              status: copySignal.status,
              masterTicket: copySignal.masterTicket,
              slaveTicket: copySignal.slaveTicket,
              symbol: copySignal.symbol,
              tradeType: copySignal.tradeType,
              masterVolume: copySignal.masterVolume,
              slaveVolume: copySignal.slaveVolume,
              openPrice: copySignal.openPrice,
              closePrice: copySignal.closePrice,
              executedPrice: copySignal.executedPrice,
              slippagePips: copySignal.slippagePips,
              profit: copySignal.profit,
              rejectionReason: copySignal.rejectionReason,
              errorMessage: copySignal.errorMessage,
              createdAt: copySignal.createdAt,
              executedAt: copySignal.executedAt,
            })
            .from(copySignal)
            .innerJoin(copySlave, eq(copySignal.copySlaveId, copySlave.id))
            .where(inArray(copySlave.copyGroupId, groupIds))
            .orderBy(desc(copySignal.createdAt))
            .limit(120),
        ])
      : [[], [], []];

    const ticketsByMasterAccount = new Map<string, Set<string>>();
    for (const signal of healthSignalRows) {
      if (signal.signalType !== "close") continue;
      const groupEntry = groupMap.get(signal.groupId);
      if (!groupEntry || !signal.masterTicket) continue;
      const masterAccountId = groupEntry.masterAccount.id;
      const tickets = ticketsByMasterAccount.get(masterAccountId) ?? new Set<string>();
      tickets.add(signal.masterTicket);
      ticketsByMasterAccount.set(masterAccountId, tickets);
    }

    const masterTradeRows = await Promise.all(
      Array.from(ticketsByMasterAccount.entries()).map(
        async ([accountId, ticketSet]) =>
          db
            .select({
              accountId: trade.accountId,
              ticket: trade.ticket,
              profit: trade.profit,
            })
            .from(trade)
            .where(
              and(
                eq(trade.accountId, accountId),
                inArray(trade.ticket, Array.from(ticketSet))
              )
            )
      )
    );

    const masterProfitByAccountAndTicket = new Map<string, number>();
    for (const rows of masterTradeRows) {
      for (const row of rows) {
        if (!row.ticket) continue;
        masterProfitByAccountAndTicket.set(
          `${row.accountId}:${row.ticket}`,
          parseNumeric(row.profit)
        );
      }
    }

    const signalCountsByGroup = new Map(
      signalCountRows.map((row) => [row.groupId, row])
    );
    const slavesByGroup = new Map<string, typeof slaveRows>();
    for (const slave of slaveRows) {
      const groupSlaves = slavesByGroup.get(slave.copyGroupId) ?? [];
      groupSlaves.push(slave);
      slavesByGroup.set(slave.copyGroupId, groupSlaves);
    }

    const healthSignalsByGroup = new Map<string, typeof healthSignalRows>();
    for (const signal of healthSignalRows) {
      const groupSignals = healthSignalsByGroup.get(signal.groupId) ?? [];
      groupSignals.push(signal);
      healthSignalsByGroup.set(signal.groupId, groupSignals);
    }

    const recentSignalsByGroup = new Map<string, typeof recentSignalRows>();
    for (const signal of recentSignalRows) {
      const groupSignals = recentSignalsByGroup.get(signal.groupId) ?? [];
      groupSignals.push(signal);
      recentSignalsByGroup.set(signal.groupId, groupSignals);
    }

    const formattedAccounts = accountRows.map((account) => {
      const roleEntry = accountRoleMap.get(account.id) ?? {
        isMaster: false,
        isSlave: false,
        groupNames: [],
      };
      const verified = account.isVerified === 1;
      const connected = isAccountConnected(
        account.isVerified,
        account.lastSyncedAt,
        freshnessCutoff
      );

      return {
        id: account.id,
        name: account.name,
        broker: account.broker,
        brokerServer: account.brokerServer,
        accountNumber: account.accountNumber,
        role: roleEntry.isMaster && roleEntry.isSlave
          ? "both"
          : roleEntry.isMaster
            ? "master"
            : roleEntry.isSlave
              ? "slave"
              : "unassigned",
        groupNames: roleEntry.groupNames,
        isVerified: verified,
        isConnected: connected,
        lastSyncedAt: account.lastSyncedAt,
        liveBalance: account.liveBalance?.toString() ?? null,
        liveEquity: account.liveEquity?.toString() ?? null,
        initialBalance: account.initialBalance?.toString() ?? null,
      };
    });

    const formatSignal = (
      signal: (typeof recentSignalRows)[number] | (typeof healthSignalRows)[number]
    ) => {
      const groupEntry = groupMap.get(signal.groupId);
      const slaveEntry = slaveRows.find((slave) => slave.id === signal.copySlaveId);
      const masterAccountId = groupEntry?.masterAccount.id ?? "";
      const masterProfit =
        signal.signalType === "close" && signal.masterTicket
          ? masterProfitByAccountAndTicket.get(
              `${masterAccountId}:${signal.masterTicket}`
            ) ?? null
          : null;
      const copiedProfit = signal.profit == null ? null : parseNumeric(signal.profit);
      const copyDelta =
        masterProfit != null && copiedProfit != null
          ? copiedProfit - masterProfit
          : null;

      return {
        id: signal.id,
        groupId: signal.groupId,
        groupName: groupEntry?.group.name ?? "Unknown group",
        masterAccountId,
        masterAccountName: groupEntry?.masterAccount.name ?? "Unknown master",
        slaveAccountId: slaveEntry?.accountId ?? "",
        slaveAccountName: slaveEntry?.accountName ?? "Unknown slave",
        signalType: signal.signalType,
        status: signal.status,
        masterTicket: signal.masterTicket,
        slaveTicket: signal.slaveTicket,
        symbol: signal.symbol,
        tradeType: signal.tradeType,
        masterVolume: signal.masterVolume,
        slaveVolume: signal.slaveVolume,
        openPrice: signal.openPrice,
        closePrice: signal.closePrice,
        executedPrice: signal.executedPrice,
        slippagePips:
          signal.slippagePips == null ? null : parseNumeric(signal.slippagePips),
        copiedProfit,
        masterProfit,
        copyDelta,
        rejectionReason: signal.rejectionReason,
        errorMessage: signal.errorMessage,
        createdAt: signal.createdAt,
        executedAt: signal.executedAt,
        latencyMs: signal.executedAt
          ? signal.executedAt.getTime() - signal.createdAt.getTime()
          : null,
      };
    };

    const groups = groupRows.map(({ group, masterAccount }) => {
      const masterConnected = isAccountConnected(
        masterAccount.isVerified,
        masterAccount.lastSyncedAt,
        freshnessCutoff
      );
      const slaveEntries = (slavesByGroup.get(group.id) ?? []).map((slave) => ({
        id: slave.id,
        isActive: slave.isActive,
        lotMode: slave.lotMode,
        fixedLot: slave.fixedLot,
        lotMultiplier: slave.lotMultiplier,
        riskPercent: slave.riskPercent,
        maxLotSize: slave.maxLotSize,
        maxDailyLoss: slave.maxDailyLoss,
        maxTradesPerDay: slave.maxTradesPerDay,
        maxDrawdownPercent: slave.maxDrawdownPercent,
        slMode: slave.slMode,
        slFixedPips: slave.slFixedPips,
        slMultiplier: slave.slMultiplier,
        tpMode: slave.tpMode,
        tpFixedPips: slave.tpFixedPips,
        tpMultiplier: slave.tpMultiplier,
        symbolWhitelist: slave.symbolWhitelist as string[] | null,
        symbolBlacklist: slave.symbolBlacklist as string[] | null,
        sessionFilter: slave.sessionFilter as string[] | null,
        minLotSize: slave.minLotSize,
        maxSlippagePips: slave.maxSlippagePips,
        copyPendingOrders: slave.copyPendingOrders,
        copySlTpModifications: slave.copySlTpModifications,
        reverseTrades: slave.reverseTrades,
        totalCopiedTrades: slave.totalCopiedTrades,
        totalProfit: slave.totalProfit,
        lastCopyAt: slave.lastCopyAt,
        createdAt: slave.createdAt,
        account: {
          id: slave.accountId,
          name: slave.accountName,
          broker: slave.accountBroker,
          accountNumber: slave.accountNumber,
          liveBalance: slave.accountLiveBalance?.toString() ?? null,
          liveEquity: slave.accountLiveEquity?.toString() ?? null,
          initialBalance: slave.accountInitialBalance?.toString() ?? null,
          isVerified: slave.accountIsVerified === 1,
          isConnected: isAccountConnected(
            slave.accountIsVerified,
            slave.accountLastSyncedAt,
            freshnessCutoff
          ),
          lastSyncedAt: slave.accountLastSyncedAt,
        },
      }));

      const activeSlaves = slaveEntries.filter((slave) => slave.isActive !== false);
      const groupSignals = healthSignalsByGroup.get(group.id) ?? [];
      const resolvedSignals = groupSignals.filter(
        (signal) =>
          signal.status === "executed" ||
          signal.status === "failed" ||
          signal.status === "rejected"
      );
      const executedSignals = resolvedSignals.filter(
        (signal) => signal.status === "executed"
      );
      const failedSignals = groupSignals.filter(
        (signal) => signal.status === "failed"
      );
      const rejectedSignals = groupSignals.filter(
        (signal) => signal.status === "rejected"
      );
      const recentClosedSignals = executedSignals.filter(
        (signal) => signal.signalType === "close"
      );

      const latencies = executedSignals
        .filter((signal) => signal.executedAt)
        .map(
          (signal) =>
            signal.executedAt!.getTime() - signal.createdAt.getTime()
        );
      const slippages = executedSignals
        .map((signal) => parseNumeric(signal.slippagePips))
        .filter((value) => value > 0);
      const avgLatencyMs =
        latencies.length > 0
          ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
          : 0;
      const avgSlippage =
        slippages.length > 0
          ? Number(
              (
                slippages.reduce((sum, value) => sum + value, 0) /
                slippages.length
              ).toFixed(2)
            )
          : 0;
      const maxSlippage =
        slippages.length > 0 ? Number(Math.max(...slippages).toFixed(2)) : 0;

      const failureReasonCounts: Record<string, number> = {};
      for (const signal of [...failedSignals, ...rejectedSignals]) {
        const reason =
          signal.errorMessage || signal.rejectionReason || "Unknown rejection";
        failureReasonCounts[reason] = (failureReasonCounts[reason] || 0) + 1;
      }

      const copiedProfit30d = recentClosedSignals.reduce(
        (sum, signal) => sum + parseNumeric(signal.profit),
        0
      );
      const masterProfit30d = recentClosedSignals.reduce((sum, signal) => {
        const profit = signal.masterTicket
          ? masterProfitByAccountAndTicket.get(
              `${masterAccount.id}:${signal.masterTicket}`
            ) ?? 0
          : 0;
        return sum + profit;
      }, 0);
      const copyDelta30d = copiedProfit30d - masterProfit30d;
      const wins30d = recentClosedSignals.filter(
        (signal) => parseNumeric(signal.profit) > 0
      ).length;
      const winRate30d =
        recentClosedSignals.length > 0
          ? Number(((wins30d / recentClosedSignals.length) * 100).toFixed(1))
          : 0;

      const resolvedCount = resolvedSignals.length;
      const executionRate =
        resolvedCount > 0
          ? Number(
              ((executedSignals.length / resolvedCount) * 100).toFixed(1)
            )
          : 0;
      const connectedSlaveCount = activeSlaves.filter(
        (slave) => slave.account.isConnected
      ).length;
      const connectionRate =
        activeSlaves.length > 0
          ? (connectedSlaveCount / activeSlaves.length) * 100
          : 0;
      const slippageScore =
        avgSlippage <= 1 ? 100 : avgSlippage <= 2 ? 88 : avgSlippage <= 4 ? 72 : 52;
      const readinessScore = masterConnected
        ? activeSlaves.length === 0
          ? 60
          : (connectionRate + 100) / 2
        : 35;
      const signalScore =
        resolvedCount > 0 ? executionRate * 0.65 + slippageScore * 0.35 : readinessScore;
      const healthScore = Math.round(readinessScore * 0.45 + signalScore * 0.55);

      let status: "healthy" | "watch" | "critical" | "armed" | "paused" = "armed";
      if (!group.isActive) status = "paused";
      else if (!masterConnected || activeSlaves.some((slave) => !slave.account.isConnected)) {
        status = healthScore >= 70 ? "watch" : "critical";
      } else if (resolvedCount === 0) {
        status = "armed";
      } else if (healthScore >= 85) {
        status = "healthy";
      } else if (healthScore >= 65) {
        status = "watch";
      } else {
        status = "critical";
      }

      const groupSignalCounts = signalCountsByGroup.get(group.id);

      return {
        id: group.id,
        name: group.name,
        isActive: group.isActive,
        createdAt: group.createdAt,
        masterAccount: {
          id: masterAccount.id,
          name: masterAccount.name,
          broker: masterAccount.broker,
          brokerServer: masterAccount.brokerServer,
          accountNumber: masterAccount.accountNumber,
          liveBalance: masterAccount.liveBalance?.toString() ?? null,
          liveEquity: masterAccount.liveEquity?.toString() ?? null,
          initialBalance: masterAccount.initialBalance?.toString() ?? null,
          isVerified: masterAccount.isVerified === 1,
          isConnected: masterConnected,
          lastSyncedAt: masterAccount.lastSyncedAt,
        },
        health: {
          status,
          score: healthScore,
          staleMaster: !masterConnected,
          staleSlaveCount: activeSlaves.filter(
            (slave) => !slave.account.isConnected
          ).length,
          avgLatencyMs,
          avgSlippage,
          maxSlippage,
          topFailureReasons: Object.entries(failureReasonCounts)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3),
          lastSignalAt: groupSignals[0]?.createdAt ?? null,
        },
        stats: {
          slaveCount: slaveEntries.length,
          activeSlaveCount: activeSlaves.length,
          totalTrades: activeSlaves.reduce(
            (sum, slave) => sum + Number(slave.totalCopiedTrades ?? 0),
            0
          ),
          totalProfit: activeSlaves.reduce(
            (sum, slave) => sum + parseNumeric(slave.totalProfit),
            0
          ),
          totalSignals: parseInt(groupSignalCounts?.totalSignals ?? "0", 10),
          pendingSignals: parseInt(groupSignalCounts?.pendingSignals ?? "0", 10),
          sentSignals: parseInt(groupSignalCounts?.sentSignals ?? "0", 10),
          executedSignals: parseInt(groupSignalCounts?.executedSignals ?? "0", 10),
          failedSignals: parseInt(groupSignalCounts?.failedSignals ?? "0", 10),
          rejectedSignals: parseInt(groupSignalCounts?.rejectedSignals ?? "0", 10),
          executionRate,
          copiedProfit30d: Number(copiedProfit30d.toFixed(2)),
          masterProfit30d: Number(masterProfit30d.toFixed(2)),
          copyDelta30d: Number(copyDelta30d.toFixed(2)),
          winRate30d,
          avgLatencyMs,
          avgSlippage,
        },
        slaves: slaveEntries,
        recentSignals: (recentSignalsByGroup.get(group.id) ?? [])
          .slice(0, 8)
          .map(formatSignal),
      };
    });

    const verifiedAccounts = formattedAccounts.filter((account) => account.isVerified);
    const connectedAccounts = formattedAccounts.filter((account) => account.isConnected);
    const activeGroups = groups.filter((group) => group.isActive !== false);
    const activeSlaves = groups.flatMap((group) =>
      group.slaves.filter((slave) => slave.isActive !== false)
    );
    const overallResolvedSignals = healthSignalRows.filter(
      (signal) =>
        signal.status === "executed" ||
        signal.status === "failed" ||
        signal.status === "rejected"
    );
    const overallExecutedSignals = overallResolvedSignals.filter(
      (signal) => signal.status === "executed"
    );
    const overallLatencies = overallExecutedSignals
      .filter((signal) => signal.executedAt)
      .map(
        (signal) => signal.executedAt!.getTime() - signal.createdAt.getTime()
      );
    const overallSlippages = overallExecutedSignals
      .map((signal) => parseNumeric(signal.slippagePips))
      .filter((value) => value > 0);
    const overviewExecutionRate =
      overallResolvedSignals.length > 0
        ? Number(
            (
              (overallExecutedSignals.length / overallResolvedSignals.length) *
              100
            ).toFixed(1)
          )
        : 0;

    const setupIssues = [];
    if (formattedAccounts.length < 2) {
      setupIssues.push({
        tone: "critical",
        title: "Two live accounts are required",
        description:
          "You need one master and at least one destination account before the copier can route signals.",
      });
    }
    if (!verifiedAccounts.length) {
      setupIssues.push({
        tone: "critical",
        title: "EA verification is missing",
        description:
          "Route accounts through the MT5 bridge so the copier receives fresh balances and account numbers.",
      });
    }
    if (groups.some((group) => group.stats.activeSlaveCount === 0)) {
      setupIssues.push({
        tone: "warning",
        title: "Some groups have no active slaves",
        description:
          "Groups without active destinations will never dispatch signals, even if the master is live.",
      });
    }
    if (groups.some((group) => group.health.staleMaster || group.health.staleSlaveCount > 0)) {
      setupIssues.push({
        tone: "warning",
        title: "Stale account connections detected",
        description:
          "At least one master or slave has stopped reporting recently, which will degrade execution quality.",
      });
    }
    if (!setupIssues.length) {
      setupIssues.push({
        tone: "info",
        title: "Copier routing is armed",
        description:
          "Masters and slaves are connected. Focus on queue health, slippage, and drift instead of setup.",
      });
    }

    return {
      overview: {
        groupCount: groups.length,
        activeGroupCount: activeGroups.length,
        slaveCount: slaveRows.length,
        activeSlaveCount: activeSlaves.length,
        totalSignals: signalCountRows.reduce(
          (sum, row) => sum + parseInt(row.totalSignals ?? "0", 10),
          0
        ),
        pendingSignals: signalCountRows.reduce(
          (sum, row) => sum + parseInt(row.pendingSignals ?? "0", 10),
          0
        ),
        sentSignals: signalCountRows.reduce(
          (sum, row) => sum + parseInt(row.sentSignals ?? "0", 10),
          0
        ),
        executedSignals: signalCountRows.reduce(
          (sum, row) => sum + parseInt(row.executedSignals ?? "0", 10),
          0
        ),
        failedSignals: signalCountRows.reduce(
          (sum, row) => sum + parseInt(row.failedSignals ?? "0", 10),
          0
        ),
        rejectedSignals: signalCountRows.reduce(
          (sum, row) => sum + parseInt(row.rejectedSignals ?? "0", 10),
          0
        ),
        executionRate: overviewExecutionRate,
        avgLatencyMs:
          overallLatencies.length > 0
            ? Math.round(
                overallLatencies.reduce((sum, value) => sum + value, 0) /
                  overallLatencies.length
              )
            : 0,
        avgSlippage:
          overallSlippages.length > 0
            ? Number(
                (
                  overallSlippages.reduce((sum, value) => sum + value, 0) /
                  overallSlippages.length
                ).toFixed(2)
              )
            : 0,
        copiedProfit30d: Number(
          groups.reduce((sum, group) => sum + group.stats.copiedProfit30d, 0).toFixed(2)
        ),
        masterProfit30d: Number(
          groups.reduce((sum, group) => sum + group.stats.masterProfit30d, 0).toFixed(2)
        ),
        copyDelta30d: Number(
          groups.reduce((sum, group) => sum + group.stats.copyDelta30d, 0).toFixed(2)
        ),
        verifiedAccountCount: verifiedAccounts.length,
        connectedAccountCount: connectedAccounts.length,
        staleAccountCount: formattedAccounts.filter(
          (account) => account.isVerified && !account.isConnected
        ).length,
        lastSignalAt: recentSignalRows[0]?.createdAt ?? null,
      },
      setup: {
        issues: setupIssues,
        accounts: formattedAccounts,
      },
      recentSignals: recentSignalRows.slice(0, 30).map(formatSignal),
      groups,
    };
  }),

  ...copierGroupProcedures,
  ...copierHealthProcedures,
});
