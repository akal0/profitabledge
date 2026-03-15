import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import {
  propChallengeInstance,
  propChallengeStageAccount,
  tradingAccount,
} from "../db/schema/trading";
import { createNotification } from "./notifications";

type TradingAccountRecord = typeof tradingAccount.$inferSelect;
type ChallengeInstanceRecord = typeof propChallengeInstance.$inferSelect;

type AttachPropAccountInput = {
  userId: string;
  accountId: string;
  propFirmId: string;
  challengeRuleId: string;
  currentPhase: number;
  phaseStartDate: string;
  startBalance: number;
  startEquity: number;
  manualOverride: boolean;
  challengeInstanceId?: string | null;
  phaseLabel?: string | null;
};

function toDayValue(value: string | Date | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return value.toISOString().split("T")[0];
}

function isCurrentStageAccount(
  account: Pick<TradingAccountRecord, "propIsCurrentChallengeStage">
) {
  return account.propIsCurrentChallengeStage !== false;
}

function defaultPhaseLabel(phaseOrder: number) {
  return phaseOrder === 0 ? "Funded" : `Phase ${phaseOrder}`;
}

function resolveChallengeStatus(
  phaseStatus: string | null | undefined,
  currentPhase: number
) {
  if (phaseStatus === "failed") return "failed";
  if (phaseStatus === "paused") return "paused";
  if (currentPhase === 0) return "passed";
  return "active";
}

function resolveStageStatus(
  phaseStatus: string | null | undefined,
  currentStage: boolean
) {
  if (phaseStatus === "failed") return "failed";
  if (phaseStatus === "paused") return currentStage ? "paused" : "superseded";
  if (phaseStatus === "passed") return "passed";
  return currentStage ? "active" : "superseded";
}

async function getPropAccount(accountId: string) {
  return db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });
}

async function upsertStageAccountRow(input: {
  challengeInstanceId: string;
  accountId: string;
  phaseOrder: number;
  phaseLabel?: string | null;
  stageStatus: string;
  phaseStartedAt?: string | null;
  phaseCompletedAt?: Date | null;
  phaseFailedAt?: Date | null;
  startBalance?: number | null;
  startEquity?: number | null;
}) {
  const existing = await db.query.propChallengeStageAccount.findFirst({
    where: and(
      eq(
        propChallengeStageAccount.challengeInstanceId,
        input.challengeInstanceId
      ),
      eq(propChallengeStageAccount.accountId, input.accountId),
      eq(propChallengeStageAccount.phaseOrder, input.phaseOrder)
    ),
  });

  if (existing) {
    await db
      .update(propChallengeStageAccount)
      .set({
        phaseLabel: input.phaseLabel ?? existing.phaseLabel,
        stageStatus: input.stageStatus,
        phaseStartedAt: input.phaseStartedAt ?? existing.phaseStartedAt,
        phaseCompletedAt:
          input.phaseCompletedAt === undefined
            ? existing.phaseCompletedAt
            : input.phaseCompletedAt,
        phaseFailedAt:
          input.phaseFailedAt === undefined
            ? existing.phaseFailedAt
            : input.phaseFailedAt,
        startBalance:
          input.startBalance == null
            ? existing.startBalance
            : input.startBalance.toFixed(2),
        startEquity:
          input.startEquity == null
            ? existing.startEquity
            : input.startEquity.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(propChallengeStageAccount.id, existing.id));

    return existing.id;
  }

  const [row] = await db
    .insert(propChallengeStageAccount)
    .values({
      challengeInstanceId: input.challengeInstanceId,
      accountId: input.accountId,
      phaseOrder: input.phaseOrder,
      phaseLabel: input.phaseLabel ?? defaultPhaseLabel(input.phaseOrder),
      stageStatus: input.stageStatus,
      phaseStartedAt: input.phaseStartedAt ?? null,
      phaseCompletedAt: input.phaseCompletedAt ?? null,
      phaseFailedAt: input.phaseFailedAt ?? null,
      startBalance:
        input.startBalance == null ? null : input.startBalance.toFixed(2),
      startEquity:
        input.startEquity == null ? null : input.startEquity.toFixed(2),
    })
    .returning({ id: propChallengeStageAccount.id });

  return row?.id ?? null;
}

async function updateHistoricalCurrentAccounts(
  challengeInstanceId: string,
  nextCurrentAccountId: string
) {
  const previousCurrentAccounts = await db.query.tradingAccount.findMany({
    where: and(
      eq(tradingAccount.propChallengeInstanceId, challengeInstanceId),
      eq(tradingAccount.propIsCurrentChallengeStage, true),
      ne(tradingAccount.id, nextCurrentAccountId)
    ),
    columns: {
      id: true,
    },
  });

  if (!previousCurrentAccounts.length) {
    return;
  }

  await db
    .update(tradingAccount)
    .set({
      propIsCurrentChallengeStage: false,
      propPhaseStatus: "paused",
    })
    .where(
      and(
        eq(tradingAccount.propChallengeInstanceId, challengeInstanceId),
        eq(tradingAccount.propIsCurrentChallengeStage, true),
        ne(tradingAccount.id, nextCurrentAccountId)
      )
    );

  for (const previousAccount of previousCurrentAccounts) {
    const activeStageRows = await db.query.propChallengeStageAccount.findMany({
      where: and(
        eq(propChallengeStageAccount.challengeInstanceId, challengeInstanceId),
        eq(propChallengeStageAccount.accountId, previousAccount.id),
        eq(propChallengeStageAccount.stageStatus, "active")
      ),
    });

    if (!activeStageRows.length) continue;

    await db
      .update(propChallengeStageAccount)
      .set({
        stageStatus: "superseded",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(
            propChallengeStageAccount.challengeInstanceId,
            challengeInstanceId
          ),
          eq(propChallengeStageAccount.accountId, previousAccount.id),
          eq(propChallengeStageAccount.stageStatus, "active")
        )
      );
  }
}

export async function ensurePropChallengeLineageForAccount(accountId: string) {
  const account = await db.query.tradingAccount.findFirst({
    where: eq(tradingAccount.id, accountId),
  });

  if (
    !account ||
    !account.isPropAccount ||
    !account.propFirmId ||
    !account.propChallengeRuleId ||
    account.propCurrentPhase == null
  ) {
    return null;
  }

  const currentStage = isCurrentStageAccount(account);
  const phaseStartDate =
    toDayValue(account.propPhaseStartDate) ?? toDayValue(account.createdAt);
  const challengeStatus = resolveChallengeStatus(
    account.propPhaseStatus,
    account.propCurrentPhase
  );

  let challengeInstance: ChallengeInstanceRecord | null =
    account.propChallengeInstanceId
      ? (await db.query.propChallengeInstance.findFirst({
          where: eq(propChallengeInstance.id, account.propChallengeInstanceId),
        })) ?? null
      : null;

  if (!challengeInstance) {
    const [createdChallengeInstance] = await db
      .insert(propChallengeInstance)
      .values({
        userId: account.userId,
        propFirmId: account.propFirmId,
        propChallengeRuleId: account.propChallengeRuleId,
        currentPhase: account.propCurrentPhase,
        status: challengeStatus,
        currentAccountId: currentStage ? account.id : null,
        startedAt: phaseStartDate,
        lastStageStartedAt: phaseStartDate,
        passedAt: account.propCurrentPhase === 0 ? new Date() : null,
        failedAt: challengeStatus === "failed" ? new Date() : null,
      })
      .returning();

    challengeInstance = createdChallengeInstance ?? null;

    if (challengeInstance) {
      await db
        .update(tradingAccount)
        .set({
          propChallengeInstanceId: challengeInstance.id,
          propIsCurrentChallengeStage: currentStage,
        })
        .where(eq(tradingAccount.id, account.id));
    }
  } else {
    await db
      .update(propChallengeInstance)
      .set({
        propFirmId: account.propFirmId,
        propChallengeRuleId: account.propChallengeRuleId,
        currentPhase: currentStage
          ? account.propCurrentPhase
          : challengeInstance.currentPhase,
        status: currentStage ? challengeStatus : challengeInstance.status,
        currentAccountId: currentStage
          ? account.id
          : challengeInstance.currentAccountId,
        lastStageStartedAt: currentStage
          ? phaseStartDate
          : challengeInstance.lastStageStartedAt,
        passedAt:
          currentStage && account.propCurrentPhase === 0
            ? challengeInstance.passedAt ?? new Date()
            : challengeInstance.passedAt,
        failedAt:
          currentStage && challengeStatus === "failed"
            ? new Date()
            : challengeStatus !== "failed"
            ? null
            : challengeInstance.failedAt,
        updatedAt: new Date(),
      })
      .where(eq(propChallengeInstance.id, challengeInstance.id));

    if (!account.propChallengeInstanceId) {
      await db
        .update(tradingAccount)
        .set({ propChallengeInstanceId: challengeInstance.id })
        .where(eq(tradingAccount.id, account.id));
    }
  }

  if (!challengeInstance) {
    return null;
  }

  await upsertStageAccountRow({
    challengeInstanceId: challengeInstance.id,
    accountId: account.id,
    phaseOrder: account.propCurrentPhase,
    phaseLabel: defaultPhaseLabel(account.propCurrentPhase),
    stageStatus: resolveStageStatus(account.propPhaseStatus, currentStage),
    phaseStartedAt: phaseStartDate,
    phaseCompletedAt:
      account.propPhaseStatus === "passed" ? new Date() : undefined,
    phaseFailedAt:
      account.propPhaseStatus === "failed" ? new Date() : undefined,
    startBalance:
      account.propPhaseStartBalance == null
        ? null
        : Number(account.propPhaseStartBalance),
    startEquity:
      account.propPhaseStartEquity == null
        ? null
        : Number(account.propPhaseStartEquity),
  });

  return challengeInstance.id;
}

export async function listContinuablePropChallenges(userId: string) {
  const propAccounts = await db.query.tradingAccount.findMany({
    where: and(
      eq(tradingAccount.userId, userId),
      eq(tradingAccount.isPropAccount, true)
    ),
    columns: {
      id: true,
      propIsCurrentChallengeStage: true,
    },
  });

  for (const account of propAccounts) {
    if (account.propIsCurrentChallengeStage === false) continue;
    await ensurePropChallengeLineageForAccount(account.id);
  }

  return db.query.propChallengeInstance.findMany({
    where: and(
      eq(propChallengeInstance.userId, userId),
      ne(propChallengeInstance.status, "failed")
    ),
    orderBy: [desc(propChallengeInstance.updatedAt)],
    with: {
      currentAccount: {
        columns: {
          id: true,
          name: true,
          broker: true,
          propCurrentPhase: true,
          propPhaseStatus: true,
        },
      },
      stageAccounts: {
        orderBy: [desc(propChallengeStageAccount.createdAt)],
        with: {
          account: {
            columns: {
              id: true,
              name: true,
              broker: true,
            },
          },
        },
      },
    },
  });
}

export async function attachAccountToPropChallenge(
  input: AttachPropAccountInput
) {
  const account = await getPropAccount(input.accountId);

  if (!account || account.userId !== input.userId) {
    throw new Error("Account not found or access denied");
  }

  let challengeInstance: ChallengeInstanceRecord | null = null;
  let currentPhase = input.currentPhase;
  let propFirmId = input.propFirmId;
  let challengeRuleId = input.challengeRuleId;

  if (input.challengeInstanceId) {
    challengeInstance =
      (await db.query.propChallengeInstance.findFirst({
        where: and(
          eq(propChallengeInstance.id, input.challengeInstanceId),
          eq(propChallengeInstance.userId, input.userId)
        ),
      })) ?? null;

    if (!challengeInstance) {
      throw new Error("Challenge not found or access denied");
    }

    currentPhase = challengeInstance.currentPhase;
    propFirmId = challengeInstance.propFirmId;
    challengeRuleId = challengeInstance.propChallengeRuleId;
    await updateHistoricalCurrentAccounts(
      challengeInstance.id,
      input.accountId
    );
  } else {
    const [createdChallengeInstance] = await db
      .insert(propChallengeInstance)
      .values({
        userId: input.userId,
        propFirmId,
        propChallengeRuleId: challengeRuleId,
        currentPhase,
        status: currentPhase === 0 ? "passed" : "active",
        currentAccountId: input.accountId,
        startedAt: input.phaseStartDate,
        lastStageStartedAt: input.phaseStartDate,
        passedAt: currentPhase === 0 ? new Date() : null,
      })
      .returning();

    challengeInstance = createdChallengeInstance ?? null;
  }

  if (!challengeInstance) {
    throw new Error("Failed to create challenge instance");
  }

  await upsertStageAccountRow({
    challengeInstanceId: challengeInstance.id,
    accountId: input.accountId,
    phaseOrder: currentPhase,
    phaseLabel: input.phaseLabel ?? defaultPhaseLabel(currentPhase),
    stageStatus: "active",
    phaseStartedAt: input.phaseStartDate,
    phaseCompletedAt: null,
    phaseFailedAt: null,
    startBalance: input.startBalance,
    startEquity: input.startEquity,
  });

  await db
    .update(propChallengeInstance)
    .set({
      propFirmId,
      propChallengeRuleId: challengeRuleId,
      currentPhase,
      status: currentPhase === 0 ? "passed" : "active",
      currentAccountId: input.accountId,
      lastStageStartedAt: input.phaseStartDate,
      passedAt:
        currentPhase === 0
          ? challengeInstance.passedAt ?? new Date()
          : challengeInstance.passedAt,
      failedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(propChallengeInstance.id, challengeInstance.id));

  await db
    .update(tradingAccount)
    .set({
      isPropAccount: true,
      propFirmId,
      propChallengeRuleId: challengeRuleId,
      propCurrentPhase: currentPhase,
      propPhaseStartDate: input.phaseStartDate,
      propPhaseStartBalance: input.startBalance.toFixed(2),
      propPhaseStartEquity: input.startEquity.toFixed(2),
      propDailyHighWaterMark: input.startEquity.toFixed(2),
      propPhaseHighWaterMark: input.startEquity.toFixed(2),
      propPhaseCurrentProfit: "0",
      propPhaseCurrentProfitPercent: "0",
      propPhaseTradingDays: 0,
      propPhaseStatus: "active",
      propPhaseBestDayProfit: "0",
      propPhaseBestDayProfitPercent: "0",
      propManualOverride: input.manualOverride,
      propChallengeInstanceId: challengeInstance.id,
      propIsCurrentChallengeStage: true,
      propDetectedFirmId: propFirmId,
    })
    .where(eq(tradingAccount.id, input.accountId));

  const phaseLabel = input.phaseLabel ?? defaultPhaseLabel(currentPhase);
  await createNotification({
    userId: input.userId,
    accountId: input.accountId,
    type: "prop_journey",
    title: input.challengeInstanceId
      ? `${account.name} linked to ${phaseLabel}`
      : `${account.name} started ${phaseLabel}`,
    body: input.challengeInstanceId
      ? `This account now continues the prop challenge from ${phaseLabel}.`
      : `Prop tracking started for ${phaseLabel}.`,
    metadata: {
      accountId: input.accountId,
      challengeInstanceId: challengeInstance.id,
      propFirmId,
      challengeRuleId,
      phaseOrder: currentPhase,
      phaseLabel,
    },
    dedupeKey: `prop-journey:${challengeInstance.id}:${
      input.accountId
    }:${currentPhase}:${input.challengeInstanceId ? "continue" : "start"}`,
  });

  return challengeInstance;
}

export async function recordPropChallengePhaseAdvance(input: {
  accountId: string;
  nextPhase: number;
  phaseStartedAt: string;
  startBalance: number;
  startEquity: number;
  previousPhase: number;
  previousPhaseLabel?: string | null;
  nextPhaseLabel?: string | null;
}) {
  const account = await getPropAccount(input.accountId);

  if (
    !account ||
    !account.propChallengeInstanceId ||
    !isCurrentStageAccount(account)
  ) {
    return null;
  }

  await upsertStageAccountRow({
    challengeInstanceId: account.propChallengeInstanceId,
    accountId: account.id,
    phaseOrder: input.previousPhase,
    phaseLabel:
      input.previousPhaseLabel ?? defaultPhaseLabel(input.previousPhase),
    stageStatus: "passed",
    phaseCompletedAt: new Date(),
  });

  await upsertStageAccountRow({
    challengeInstanceId: account.propChallengeInstanceId,
    accountId: account.id,
    phaseOrder: input.nextPhase,
    phaseLabel: input.nextPhaseLabel ?? defaultPhaseLabel(input.nextPhase),
    stageStatus: "active",
    phaseStartedAt: input.phaseStartedAt,
    phaseCompletedAt: null,
    phaseFailedAt: null,
    startBalance: input.startBalance,
    startEquity: input.startEquity,
  });

  await db
    .update(propChallengeInstance)
    .set({
      currentPhase: input.nextPhase,
      status: input.nextPhase === 0 ? "passed" : "active",
      currentAccountId: account.id,
      lastStageStartedAt: input.phaseStartedAt,
      passedAt: input.nextPhase === 0 ? new Date() : null,
      failedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(propChallengeInstance.id, account.propChallengeInstanceId));

  return account.propChallengeInstanceId;
}

export async function syncPropChallengeOutcomeForAccount(input: {
  accountId: string;
  phaseStatus: string | null | undefined;
}) {
  const account = await getPropAccount(input.accountId);

  if (
    !account ||
    !account.propChallengeInstanceId ||
    !account.isPropAccount ||
    !isCurrentStageAccount(account) ||
    account.propCurrentPhase == null
  ) {
    return null;
  }

  const challengeStatus = resolveChallengeStatus(
    input.phaseStatus,
    account.propCurrentPhase
  );

  await db
    .update(propChallengeInstance)
    .set({
      status: challengeStatus,
      currentPhase: account.propCurrentPhase,
      currentAccountId: account.id,
      passedAt:
        account.propCurrentPhase === 0
          ? new Date()
          : challengeStatus !== "passed"
          ? null
          : undefined,
      failedAt: challengeStatus === "failed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(propChallengeInstance.id, account.propChallengeInstanceId));

  await upsertStageAccountRow({
    challengeInstanceId: account.propChallengeInstanceId,
    accountId: account.id,
    phaseOrder: account.propCurrentPhase,
    phaseLabel: defaultPhaseLabel(account.propCurrentPhase),
    stageStatus: resolveStageStatus(input.phaseStatus, true),
    phaseStartedAt: toDayValue(account.propPhaseStartDate),
    phaseCompletedAt: input.phaseStatus === "passed" ? new Date() : undefined,
    phaseFailedAt: input.phaseStatus === "failed" ? new Date() : undefined,
    startBalance:
      account.propPhaseStartBalance == null
        ? null
        : Number(account.propPhaseStartBalance),
    startEquity:
      account.propPhaseStartEquity == null
        ? null
        : Number(account.propPhaseStartEquity),
  });

  return account.propChallengeInstanceId;
}

export async function pausePropChallengeForAccount(accountId: string) {
  const account = await getPropAccount(accountId);

  if (!account?.propChallengeInstanceId) {
    return null;
  }

  if (isCurrentStageAccount(account)) {
    await db
      .update(propChallengeInstance)
      .set({
        currentAccountId: null,
        status: "paused",
        updatedAt: new Date(),
      })
      .where(eq(propChallengeInstance.id, account.propChallengeInstanceId));
  }

  if (account.propCurrentPhase != null) {
    await upsertStageAccountRow({
      challengeInstanceId: account.propChallengeInstanceId,
      accountId: account.id,
      phaseOrder: account.propCurrentPhase,
      phaseLabel: defaultPhaseLabel(account.propCurrentPhase),
      stageStatus: "paused",
      phaseStartedAt: toDayValue(account.propPhaseStartDate),
      startBalance:
        account.propPhaseStartBalance == null
          ? null
          : Number(account.propPhaseStartBalance),
      startEquity:
        account.propPhaseStartEquity == null
          ? null
          : Number(account.propPhaseStartEquity),
    });
  }

  return account.propChallengeInstanceId;
}

export async function deleteOrphanedPropChallengeInstances(
  challengeInstanceIds: string[]
) {
  const uniqueIds = Array.from(
    new Set(challengeInstanceIds.filter((id): id is string => Boolean(id)))
  );

  if (!uniqueIds.length) {
    return 0;
  }

  let deletedCount = 0;

  for (const challengeInstanceId of uniqueIds) {
    const [stageCountRow] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(propChallengeStageAccount)
      .where(
        eq(propChallengeStageAccount.challengeInstanceId, challengeInstanceId)
      );

    const remainingStageCount = Number(stageCountRow?.count ?? 0);
    if (remainingStageCount > 0) {
      continue;
    }

    const [accountCountRow] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(tradingAccount)
      .where(eq(tradingAccount.propChallengeInstanceId, challengeInstanceId));

    const remainingAccountCount = Number(accountCountRow?.count ?? 0);
    if (remainingAccountCount > 0) {
      continue;
    }

    await db
      .delete(propChallengeInstance)
      .where(eq(propChallengeInstance.id, challengeInstanceId));
    deletedCount += 1;
  }

  return deletedCount;
}

export async function getPropChallengeLineageForAccount(accountId: string) {
  const challengeInstanceId = await ensurePropChallengeLineageForAccount(
    accountId
  );

  if (!challengeInstanceId) {
    return {
      challengeInstance: null,
      stageAccounts: [],
    };
  }

  const challengeInstance = await db.query.propChallengeInstance.findFirst({
    where: eq(propChallengeInstance.id, challengeInstanceId),
    with: {
      currentAccount: {
        columns: {
          id: true,
          name: true,
          broker: true,
          propCurrentPhase: true,
        },
      },
    },
  });

  const stageAccounts = await db.query.propChallengeStageAccount.findMany({
    where: eq(
      propChallengeStageAccount.challengeInstanceId,
      challengeInstanceId
    ),
    orderBy: [desc(propChallengeStageAccount.createdAt)],
    with: {
      account: {
        columns: {
          id: true,
          name: true,
          broker: true,
          propCurrentPhase: true,
        },
      },
    },
  });

  return {
    challengeInstance,
    stageAccounts,
  };
}
