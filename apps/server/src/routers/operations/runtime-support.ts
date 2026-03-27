import { TRPCError } from "@trpc/server";
import {
  getFeatureRequestAreaById,
  getFeatureRequestFeatureById,
  getFeatureRequestSelectionLabel,
  getFeatureRequestSubfeatureById,
  isValidFeatureRequestSelection,
} from "@profitabledge/platform";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import {
  appEvent,
  userFeedback,
} from "../../db/schema/operations";
import { user } from "../../db/schema/auth";
import { platformConnection, syncLog } from "../../db/schema/connections";
import { tradingAccount } from "../../db/schema/trading";
import { getServerEnv } from "../../lib/env";
import {
  assertAlphaFeatureEnabled,
  getServerAlphaFlags,
} from "../../lib/ops/alpha-runtime";
import {
  ensureActivationMilestone,
  listActivationMilestones,
  listRecentVisibleErrors,
  listRecentUserEvents,
  recordAppEvent,
} from "../../lib/ops/event-log";
import {
  createFeatureRequestGithubIssue,
  createGithubIssue,
} from "../../lib/ops/github-feature-requests";
import { buildServerHealthSnapshot } from "../../lib/ops/health";
import { hasStaffAccess } from "../../lib/staff-access";
import { protectedProcedure } from "../../lib/trpc";
import {
  alphaMilestoneSchema,
  clientEventCategorySchema,
  supportFeedbackCategorySchema,
  supportFeedbackPrioritySchema,
} from "./shared";

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function classifySyncRecency(lastSyncedAt: Date | null) {
  if (!lastSyncedAt) return "never";
  const ageMinutes = (Date.now() - lastSyncedAt.getTime()) / 60_000;
  if (ageMinutes <= 15) return "fresh";
  if (ageMinutes <= 240) return "stale";
  return "offline";
}

function buildFeatureRequestGithubIssueTitle(
  targetLabel: string,
  subject: string
) {
  return `[Feature request] ${targetLabel}: ${subject.trim()}`;
}

function buildFeatureRequestGithubIssueBody(input: {
  targetLabel: string;
  subject: string;
  message: string;
  pagePath: string | null;
  proposedFeatureName: string | null;
  userName: string | null;
  userEmail: string | null;
  username: string | null;
  userId: string;
}) {
  return [
    "## Requested improvement",
    input.subject.trim(),
    "",
    "## Product area",
    input.targetLabel,
    "",
    ...(input.proposedFeatureName
      ? ["## Proposed feature name", input.proposedFeatureName, ""]
      : []),
    "## Details",
    input.message.trim(),
    "",
    "## Submitted from",
    `- Page: ${input.pagePath ?? "Unknown"}`,
    "- Source: Sidebar request a feature dialog",
    "",
    "## Member context",
    `- User ID: ${input.userId}`,
    `- Name: ${input.userName ?? "Unknown"}`,
    `- Username: ${input.username ?? "Unknown"}`,
    `- Email: ${input.userEmail ?? "Unknown"}`,
  ].join("\n");
}

function buildBugReportGithubIssueTitle(subject: string) {
  return `[Bug report] ${subject.trim()}`;
}

function buildBugReportGithubIssueBody(input: {
  subject: string;
  message: string;
  pagePath: string | null;
  screenshotUrl: string | null;
  userName: string | null;
  userEmail: string | null;
  username: string | null;
  userId: string;
}) {
  return [
    "## Bug summary",
    input.subject.trim(),
    "",
    "## Details",
    input.message.trim(),
    "",
    ...(input.screenshotUrl
      ? [
          "## Screenshot",
          `[View screenshot](${input.screenshotUrl})`,
          "",
          `![Bug screenshot](${input.screenshotUrl})`,
          "",
        ]
      : []),
    "## Submitted from",
    `- Page: ${input.pagePath ?? "Unknown"}`,
    "- Source: Sidebar support report a bug dialog",
    "",
    "## Member context",
    `- User ID: ${input.userId}`,
    `- Name: ${input.userName ?? "Unknown"}`,
    `- Username: ${input.username ?? "Unknown"}`,
    `- Email: ${input.userEmail ?? "Unknown"}`,
  ].join("\n");
}

function buildGithubDeliveryMetadata(
  githubIssue:
    | Awaited<ReturnType<typeof createGithubIssue>>
    | Awaited<ReturnType<typeof createFeatureRequestGithubIssue>>
) {
  if (githubIssue.status === "created") {
    return {
      githubDeliveryStatus: "created" as const,
      githubIssueNumber: githubIssue.issueNumber,
      githubIssueUrl: githubIssue.issueUrl,
      githubIssueError: null,
    };
  }

  if (githubIssue.status === "skipped") {
    return {
      githubDeliveryStatus: "stored_only" as const,
      githubIssueNumber: null,
      githubIssueUrl: null,
      githubIssueError: null,
    };
  }

  return {
    githubDeliveryStatus: "failed" as const,
    githubIssueNumber: null,
    githubIssueUrl: null,
    githubIssueError: githubIssue.error,
  };
}

export const operationsRuntimeSupportProcedures = {
  getAlphaRuntime: protectedProcedure.query(async ({ ctx }) => {
    const flags = getServerAlphaFlags();
    const milestones = await listActivationMilestones(ctx.session.user.id);

    return {
      flags,
      milestones: milestones.map((row) => ({
        key: row.key,
        count: row.count,
        firstSeenAt: toIso(row.firstSeenAt),
        lastSeenAt: toIso(row.lastSeenAt),
      })),
    };
  }),

  getSupportSnapshot: protectedProcedure.query(async ({ ctx }) => {
    assertAlphaFeatureEnabled("supportDiagnostics");
    const userId = ctx.session.user.id;
    const profileRow = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        username: true,
      },
    });

    if (
      !hasStaffAccess({
        role: profileRow?.role ?? null,
        email: profileRow?.email ?? null,
      })
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    const flags = getServerAlphaFlags();

    const [
      connections,
      accounts,
      milestones,
      recentEvents,
      recentErrors,
      feedback,
    ] =
      await Promise.all([
        db.query.platformConnection.findMany({
          where: eq(platformConnection.userId, userId),
          orderBy: desc(platformConnection.updatedAt),
        }),
        db.query.tradingAccount.findMany({
          where: eq(tradingAccount.userId, userId),
          columns: {
            id: true,
            name: true,
            broker: true,
            accountNumber: true,
            lastSyncedAt: true,
            liveBalance: true,
            liveEquity: true,
            isVerified: true,
            isPropAccount: true,
          },
        }),
        listActivationMilestones(userId),
        listRecentUserEvents(userId, 20),
        listRecentVisibleErrors(userId, 8),
        db
          .select()
          .from(userFeedback)
          .where(eq(userFeedback.userId, userId))
          .orderBy(desc(userFeedback.createdAt))
          .limit(10),
      ]);

    const connectionIds = connections.map((row) => row.id);
    const recentSyncLogs =
      connectionIds.length > 0
        ? await db.query.syncLog.findMany({
            where: inArray(syncLog.connectionId, connectionIds),
            orderBy: desc(syncLog.createdAt),
            limit: 10,
          })
        : [];

    const accountsById = new Map(accounts.map((account) => [account.id, account]));

    const connectionDiagnostics = connections.map((connection) => ({
      id: connection.id,
      displayName: connection.displayName,
      provider: connection.provider,
      status: connection.status,
      isPaused: connection.isPaused,
      lastError: connection.lastError,
      lastSyncAttemptAt: toIso(connection.lastSyncAttemptAt),
      lastSyncSuccessAt: toIso(connection.lastSyncSuccessAt),
      syncIntervalMinutes: connection.syncIntervalMinutes,
      account: connection.accountId
        ? accountsById.get(connection.accountId) ?? null
        : null,
    }));

    const accountDiagnostics = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      broker: account.broker,
      accountNumber: account.accountNumber,
      lastSyncedAt: toIso(account.lastSyncedAt),
      syncHealth: classifySyncRecency(account.lastSyncedAt),
      liveBalance: account.liveBalance?.toString() ?? null,
      liveEquity: account.liveEquity?.toString() ?? null,
      isVerified: account.isVerified,
      isPropAccount: account.isPropAccount,
    }));

    const connectionSummary = {
      total: connections.length,
      active: connections.filter((row) => row.status === "active").length,
      pending: connections.filter((row) => row.status === "pending").length,
      error: connections.filter((row) => row.status === "error").length,
      paused: connections.filter((row) => row.isPaused).length,
      terminal: connections.filter((row) =>
        row.provider === "mt5-terminal" || row.provider === "mt4-terminal"
      ).length,
    };

    const accountSummary = {
      total: accounts.length,
      fresh: accounts.filter(
        (row) => classifySyncRecency(row.lastSyncedAt) === "fresh"
      ).length,
      stale: accounts.filter(
        (row) => classifySyncRecency(row.lastSyncedAt) === "stale"
      ).length,
      offline: accounts.filter(
        (row) => classifySyncRecency(row.lastSyncedAt) === "offline"
      ).length,
      neverSynced: accounts.filter(
        (row) => classifySyncRecency(row.lastSyncedAt) === "never"
      ).length,
    };

    return {
      supportEmail: getServerEnv().ALPHA_SUPPORT_EMAIL ?? "support@profitabledge.com",
      runtime: buildServerHealthSnapshot(),
      profile: profileRow,
      flags,
      milestones: milestones.map((row) => ({
        key: row.key,
        count: row.count,
        firstSeenAt: toIso(row.firstSeenAt),
        lastSeenAt: toIso(row.lastSeenAt),
      })),
      diagnostics: {
        connectionSummary,
        accountSummary,
        connections: connectionDiagnostics,
        accounts: accountDiagnostics,
        recentSyncLogs: recentSyncLogs.map((row) => ({
          id: row.id,
          connectionId: row.connectionId,
          accountId: row.accountId,
          status: row.status,
          tradesFound: row.tradesFound,
          tradesInserted: row.tradesInserted,
          tradesDuplicated: row.tradesDuplicated,
          errorMessage: row.errorMessage,
          durationMs: row.durationMs,
          createdAt: toIso(row.createdAt),
        })),
      },
      recentEvents: recentEvents.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
      })),
      recentErrors: recentErrors.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
      })),
      feedback: feedback.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      })),
    };
  }),

  submitFeedback: protectedProcedure
    .input(
      z.object({
        category: supportFeedbackCategorySchema,
        priority: supportFeedbackPrioritySchema.default("normal"),
        subject: z.string().min(4).max(160),
        message: z.string().min(10).max(4000),
        pagePath: z.string().max(400).nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("feedback");
      const userRow = await db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id),
        columns: {
          email: true,
        },
      });

      const [created] = await db
        .insert(userFeedback)
        .values({
          userId: ctx.session.user.id,
          email: userRow?.email ?? null,
          category: input.category,
          priority: input.priority,
          subject: input.subject,
          message: input.message,
          pagePath: input.pagePath ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();

      await Promise.all([
        ensureActivationMilestone({
          userId: ctx.session.user.id,
          key: "feedback_submitted",
          source: "support",
          metadata: {
            category: input.category,
            priority: input.priority,
          },
        }),
        recordAppEvent({
          userId: ctx.session.user.id,
          category: "feedback",
          name: "feedback.submitted",
          source: "web",
          pagePath: input.pagePath ?? null,
          summary: input.subject,
          metadata: {
            category: input.category,
            priority: input.priority,
          },
          isUserVisible: true,
        }),
      ]);

      return {
        id: created.id,
        status: created.status,
      };
    }),

  submitBugReport: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(4).max(160),
        message: z.string().min(10).max(4000),
        pagePath: z.string().max(400).nullable().optional(),
        screenshotUrl: z.string().url().max(2000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("feedback");

      const subject = input.subject.trim();
      const message = input.message.trim();
      const screenshotUrl = input.screenshotUrl?.trim() || null;

      const userRow = await db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id),
        columns: {
          email: true,
          name: true,
          username: true,
        },
      });

      const baseMetadata = {
        origin: "sidebar-report-bug",
        requestType: "bug-report",
        screenshotUrl,
      };

      const [created] = await db
        .insert(userFeedback)
        .values({
          userId: ctx.session.user.id,
          email: userRow?.email ?? null,
          category: "bug",
          priority: "normal",
          subject,
          message,
          pagePath: input.pagePath ?? null,
          metadata: {
            ...baseMetadata,
            githubDeliveryStatus: "pending",
          },
        })
        .returning();

      const githubIssue = await createGithubIssue({
        title: buildBugReportGithubIssueTitle(subject),
        body: buildBugReportGithubIssueBody({
          subject,
          message,
          pagePath: input.pagePath ?? null,
          screenshotUrl,
          userName: userRow?.name ?? null,
          userEmail: userRow?.email ?? null,
          username: userRow?.username ?? null,
          userId: ctx.session.user.id,
        }),
      });

      const githubMetadata = buildGithubDeliveryMetadata(githubIssue);

      await Promise.all([
        db
          .update(userFeedback)
          .set({
            metadata: {
              ...baseMetadata,
              ...githubMetadata,
            },
            updatedAt: new Date(),
          })
          .where(eq(userFeedback.id, created.id)),
        ensureActivationMilestone({
          userId: ctx.session.user.id,
          key: "feedback_submitted",
          source: "support",
          metadata: {
            category: "bug",
            type: "bug-report",
            screenshotAttached: Boolean(screenshotUrl),
          },
        }),
        recordAppEvent({
          userId: ctx.session.user.id,
          category: "feedback",
          name: "bug_report.submitted",
          source: "web",
          pagePath: input.pagePath ?? null,
          summary: subject,
          metadata: {
            screenshotAttached: Boolean(screenshotUrl),
            githubDeliveryStatus: githubMetadata.githubDeliveryStatus,
          },
          isUserVisible: true,
        }),
      ]);

      return {
        id: created.id,
        status: created.status,
        deliveryStatus: githubMetadata.githubDeliveryStatus,
        issueUrl: githubMetadata.githubIssueUrl,
      };
    }),

  submitFeatureRequest: protectedProcedure
    .input(
      z.object({
        areaId: z.string().min(2).max(80),
        featureId: z.string().min(2).max(80).nullable().optional(),
        subfeatureId: z.string().min(2).max(80).nullable().optional(),
        proposedFeatureName: z.string().min(2).max(160).nullable().optional(),
        subject: z.string().min(4).max(160),
        message: z.string().min(10).max(4000),
        pagePath: z.string().max(400).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("feedback");

      const subject = input.subject.trim();
      const message = input.message.trim();
      const selection = {
        areaId: input.areaId,
        featureId: input.featureId ?? null,
        subfeatureId: input.subfeatureId ?? null,
      };
      const proposedFeatureName =
        input.proposedFeatureName?.trim() ||
        (selection.areaId === "new-feature" ? subject : null);

      if (!isValidFeatureRequestSelection(selection)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a valid product area and feature.",
        });
      }

      const area = getFeatureRequestAreaById(selection.areaId);
      const feature = getFeatureRequestFeatureById(
        selection.areaId,
        selection.featureId
      );
      const subfeature = getFeatureRequestSubfeatureById(
        selection.areaId,
        selection.featureId,
        selection.subfeatureId
      );
      const targetLabel =
        selection.areaId === "new-feature"
          ? [area?.label ?? "Completely new feature", proposedFeatureName]
              .filter((value): value is string => Boolean(value))
              .join(" > ")
          : getFeatureRequestSelectionLabel(selection);

      const userRow = await db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id),
        columns: {
          email: true,
          name: true,
          username: true,
        },
      });

      const baseMetadata = {
        origin: "sidebar-request-feature",
        requestType: "feature-request",
        areaId: selection.areaId,
        areaLabel: area?.label ?? null,
        featureId: selection.featureId,
        featureLabel: feature?.label ?? null,
        subfeatureId: selection.subfeatureId,
        subfeatureLabel: subfeature?.label ?? null,
        proposedFeatureName,
      };

      const [created] = await db
        .insert(userFeedback)
        .values({
          userId: ctx.session.user.id,
          email: userRow?.email ?? null,
          category: "idea",
          priority: "normal",
          subject,
          message,
          pagePath: input.pagePath ?? null,
          metadata: {
            ...baseMetadata,
            githubDeliveryStatus: "pending",
          },
        })
        .returning();

      const githubIssue = await createFeatureRequestGithubIssue({
        title: buildFeatureRequestGithubIssueTitle(targetLabel, subject),
        body: buildFeatureRequestGithubIssueBody({
          targetLabel,
          subject,
          message,
          pagePath: input.pagePath ?? null,
          proposedFeatureName,
          userName: userRow?.name ?? null,
          userEmail: userRow?.email ?? null,
          username: userRow?.username ?? null,
          userId: ctx.session.user.id,
        }),
      });

      const githubMetadata = buildGithubDeliveryMetadata(githubIssue);

      await Promise.all([
        db
          .update(userFeedback)
          .set({
            metadata: {
              ...baseMetadata,
              ...githubMetadata,
            },
            updatedAt: new Date(),
          })
          .where(eq(userFeedback.id, created.id)),
        ensureActivationMilestone({
          userId: ctx.session.user.id,
          key: "feedback_submitted",
          source: "support",
          metadata: {
            category: "idea",
            type: "feature-request",
            areaId: selection.areaId,
            featureId: selection.featureId,
            subfeatureId: selection.subfeatureId,
          },
        }),
        recordAppEvent({
          userId: ctx.session.user.id,
          category: "feedback",
          name: "feature_request.submitted",
          source: "web",
          pagePath: input.pagePath ?? null,
          summary: subject,
          metadata: {
            areaId: selection.areaId,
            featureId: selection.featureId,
            subfeatureId: selection.subfeatureId,
            githubDeliveryStatus: githubMetadata.githubDeliveryStatus,
          },
          isUserVisible: true,
        }),
      ]);

      return {
        id: created.id,
        status: created.status,
        deliveryStatus: githubMetadata.githubDeliveryStatus,
      };
    }),

  trackMilestone: protectedProcedure
    .input(
      z.object({
        key: alphaMilestoneSchema,
        pagePath: z.string().max(400).nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all([
        ensureActivationMilestone({
          userId: ctx.session.user.id,
          key: input.key,
          source: "web",
          metadata: input.metadata ?? null,
        }),
        recordAppEvent({
          userId: ctx.session.user.id,
          category: "activation",
          name: `milestone.${input.key}`,
          source: "web",
          pagePath: input.pagePath ?? null,
          summary: input.key,
          metadata: input.metadata ?? null,
        }),
      ]);

      return { success: true };
    }),

  trackClientEvent: protectedProcedure
    .input(
      z.object({
        category: clientEventCategorySchema,
        name: z.string().min(3).max(80),
        summary: z.string().max(240).nullable().optional(),
        pagePath: z.string().max(400).nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await recordAppEvent({
        userId: ctx.session.user.id,
        category: input.category,
        name: input.name,
        source: "web",
        pagePath: input.pagePath ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata ?? null,
      });

      return { success: true };
    }),
};
