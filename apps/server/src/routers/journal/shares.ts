import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";

import { db } from "../../db";
import {
  journalEntry,
  journalShare,
  journalShareAccessRequest,
  journalShareEntry,
  journalShareInvite,
  journalShareViewer,
  user as userTable,
  type JournalBlock,
  type JournalShareViewerSource,
} from "../../db/schema";
import {
  buildJournalSharePath,
  buildJournalShareUrl,
  sendJournalShareAccessRequestEmail,
  sendJournalShareApprovedEmail,
  sendJournalShareInviteEmail,
} from "../../lib/journal-share-email";
import { createNotification } from "../../lib/notifications";
import { protectedProcedure, router } from "../../lib/trpc";

const shareTokenGenerator = customAlphabet(
  "abcdefghjkmnpqrstuvwxyz23456789",
  20
);

const shareNameSchema = z.string().trim().min(1).max(120);
const shareEntryIdsSchema = z.array(z.string().min(1)).min(1).max(100);
const shareEmailSchema = z.string().trim().email();

type ShareOwnerRow = {
  id: string;
  ownerUserId: string;
  name: string;
  shareToken: string;
  isActive: boolean;
  revokedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerName: string | null;
  ownerDisplayName: string | null;
  ownerEmail: string | null;
};

type ViewerIdentity = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

function getOwnerLabel(share: Pick<ShareOwnerRow, "ownerDisplayName" | "ownerName" | "ownerEmail">) {
  return (
    share.ownerDisplayName ||
    share.ownerName ||
    share.ownerEmail ||
    "Trader"
  );
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function buildEntryPreview(blocks: JournalBlock[] | null | undefined): string {
  if (!Array.isArray(blocks)) return "";

  for (const block of blocks) {
    const content = stripHtml(block.content || "");
    if (content) {
      return content.slice(0, 200);
    }

    if (block.children?.length) {
      const childPreview = buildEntryPreview(block.children);
      if (childPreview) {
        return childPreview.slice(0, 200);
      }
    }
  }

  return "";
}

function sanitizeSharedBlocks(blocks: JournalBlock[] | null | undefined): JournalBlock[] {
  if (!Array.isArray(blocks)) return [];

  return blocks.map((block) => {
    const nextProps = block.props
      ? {
          ...block.props,
          tradeId: undefined,
          tradeIds: undefined,
          accountId: undefined,
          chartConfig: block.props.chartConfig
            ? {
                ...block.props.chartConfig,
                accountId: undefined,
                accountIds: undefined,
              }
            : undefined,
        }
      : undefined;

    return {
      ...block,
      props: nextProps,
      children: block.children?.length
        ? sanitizeSharedBlocks(block.children)
        : undefined,
    };
  });
}

function buildShareSummary(share: ShareOwnerRow) {
  return {
    id: share.id,
    name: share.name,
    shareToken: share.shareToken,
    sharePath: buildJournalSharePath(share.shareToken),
    shareUrl: buildJournalShareUrl(share.shareToken),
    isActive: share.isActive,
    revokedAt: share.revokedAt,
    viewCount: share.viewCount,
    lastViewedAt: share.lastViewedAt,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
    ownerName: getOwnerLabel(share),
  };
}

function sanitizeSharedEntryPayload(entry: typeof journalEntry.$inferSelect) {
  const content = sanitizeSharedBlocks(entry.content as JournalBlock[] | null);

  return {
    id: entry.id,
    title: entry.title,
    emoji: entry.emoji,
    coverImageUrl: entry.coverImageUrl,
    coverImagePosition: entry.coverImagePosition,
    entryType: entry.entryType,
    tags: (entry.tags as string[] | null) ?? [],
    journalDate: entry.journalDate,
    tradePhase: entry.tradePhase,
    psychology: entry.psychology,
    plannedEntryPrice: entry.plannedEntryPrice,
    plannedExitPrice: entry.plannedExitPrice,
    plannedStopLoss: entry.plannedStopLoss,
    plannedTakeProfit: entry.plannedTakeProfit,
    plannedRiskReward: entry.plannedRiskReward,
    plannedNotes: entry.plannedNotes,
    actualOutcome: entry.actualOutcome,
    actualPnl: entry.actualPnl,
    actualPips: entry.actualPips,
    postTradeAnalysis: entry.postTradeAnalysis,
    lessonsLearned: entry.lessonsLearned,
    wordCount: entry.wordCount,
    readTimeMinutes: entry.readTimeMinutes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    preview: buildEntryPreview(content),
    content,
  };
}

async function getViewerIdentity(userId: string): Promise<ViewerIdentity> {
  const [viewer] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      emailVerified: userTable.emailVerified,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!viewer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  return viewer;
}

async function getShareByIdForOwner(userId: string, shareId: string) {
  const [share] = await db
    .select({
      id: journalShare.id,
      ownerUserId: journalShare.ownerUserId,
      name: journalShare.name,
      shareToken: journalShare.shareToken,
      isActive: journalShare.isActive,
      revokedAt: journalShare.revokedAt,
      viewCount: journalShare.viewCount,
      lastViewedAt: journalShare.lastViewedAt,
      createdAt: journalShare.createdAt,
      updatedAt: journalShare.updatedAt,
      ownerName: userTable.name,
      ownerDisplayName: userTable.displayName,
      ownerEmail: userTable.email,
    })
    .from(journalShare)
    .innerJoin(userTable, eq(userTable.id, journalShare.ownerUserId))
    .where(
      and(eq(journalShare.id, shareId), eq(journalShare.ownerUserId, userId))
    )
    .limit(1);

  if (!share) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
  }

  return share satisfies ShareOwnerRow;
}

async function getShareByToken(shareToken: string) {
  const [share] = await db
    .select({
      id: journalShare.id,
      ownerUserId: journalShare.ownerUserId,
      name: journalShare.name,
      shareToken: journalShare.shareToken,
      isActive: journalShare.isActive,
      revokedAt: journalShare.revokedAt,
      viewCount: journalShare.viewCount,
      lastViewedAt: journalShare.lastViewedAt,
      createdAt: journalShare.createdAt,
      updatedAt: journalShare.updatedAt,
      ownerName: userTable.name,
      ownerDisplayName: userTable.displayName,
      ownerEmail: userTable.email,
    })
    .from(journalShare)
    .innerJoin(userTable, eq(userTable.id, journalShare.ownerUserId))
    .where(eq(journalShare.shareToken, shareToken))
    .limit(1);

  if (!share) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
  }

  return share satisfies ShareOwnerRow;
}

async function assertOwnedEntryIds(userId: string, entryIds: string[]) {
  const uniqueEntryIds = [...new Set(entryIds)];
  const rows = await db
    .select({ id: journalEntry.id })
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.userId, userId),
        inArray(journalEntry.id, uniqueEntryIds)
      )
    );

  if (rows.length !== uniqueEntryIds.length) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "One or more journal entries do not belong to the current user.",
    });
  }

  return uniqueEntryIds;
}

async function replaceShareEntries(shareId: string, entryIds: string[]) {
  await db.delete(journalShareEntry).where(eq(journalShareEntry.shareId, shareId));

  await db.insert(journalShareEntry).values(
    entryIds.map((journalEntryId, index) => ({
      shareId,
      journalEntryId,
      sortOrder: index,
    }))
  );
}

async function upsertApprovedViewer(input: {
  shareId: string;
  viewerUserId: string;
  approvedByUserId: string;
  source: JournalShareViewerSource;
}) {
  const approvedAt = new Date();

  await db
    .insert(journalShareViewer)
    .values({
      shareId: input.shareId,
      viewerUserId: input.viewerUserId,
      approvedByUserId: input.approvedByUserId,
      source: input.source,
      status: "approved",
      approvedAt,
      revokedAt: null,
      updatedAt: approvedAt,
    })
    .onConflictDoUpdate({
      target: [journalShareViewer.shareId, journalShareViewer.viewerUserId],
      set: {
        approvedByUserId: input.approvedByUserId,
        source: input.source,
        status: "approved",
        approvedAt,
        revokedAt: null,
        updatedAt: approvedAt,
      },
    });
}

async function claimPendingInvite(input: {
  share: ShareOwnerRow;
  viewer: ViewerIdentity;
}) {
  if (!input.viewer.emailVerified) {
    return { claimed: false as const };
  }

  const normalizedEmail = normalizeInviteEmail(input.viewer.email);
  const [invite] = await db
    .select()
    .from(journalShareInvite)
    .where(
      and(
        eq(journalShareInvite.shareId, input.share.id),
        eq(journalShareInvite.invitedEmailNormalized, normalizedEmail)
      )
    )
    .limit(1);

  if (!invite) {
    return { claimed: false as const };
  }

  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(journalShareInvite)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(eq(journalShareInvite.id, invite.id));
    return { claimed: false as const };
  }

  if (invite.status !== "pending" && invite.status !== "claimed") {
    return { claimed: false as const };
  }

  const now = new Date();

  await upsertApprovedViewer({
    shareId: input.share.id,
    viewerUserId: input.viewer.id,
    approvedByUserId: input.share.ownerUserId,
    source: "invite",
  });

  await db
    .update(journalShareInvite)
    .set({
      status: "claimed",
      claimedViewerUserId: input.viewer.id,
      claimedAt: now,
      updatedAt: now,
    })
    .where(eq(journalShareInvite.id, invite.id));

  return { claimed: true as const, inviteId: invite.id };
}

async function resolveShareAccess(input: {
  shareToken: string;
  viewerUserId: string;
}) {
  const [share, viewer] = await Promise.all([
    getShareByToken(input.shareToken),
    getViewerIdentity(input.viewerUserId),
  ]);

  const shareSummary = buildShareSummary(share);

  if (!share.isActive) {
    return {
      share,
      shareSummary,
      gateState: "inactive" as const,
      autoClaimed: false,
      isOwner: false,
    };
  }

  if (share.ownerUserId === viewer.id) {
    return {
      share,
      shareSummary,
      gateState: "approved" as const,
      autoClaimed: false,
      isOwner: true,
    };
  }

  const [viewerRow] = await db
    .select()
    .from(journalShareViewer)
    .where(
      and(
        eq(journalShareViewer.shareId, share.id),
        eq(journalShareViewer.viewerUserId, viewer.id)
      )
    )
    .limit(1);

  if (viewerRow?.status === "approved") {
    return {
      share,
      shareSummary,
      gateState: "approved" as const,
      autoClaimed: false,
      isOwner: false,
    };
  }

  const inviteClaim = await claimPendingInvite({ share, viewer });
  if (inviteClaim.claimed) {
    return {
      share,
      shareSummary,
      gateState: "approved" as const,
      autoClaimed: true,
      isOwner: false,
    };
  }

  const [request] = await db
    .select()
    .from(journalShareAccessRequest)
    .where(
      and(
        eq(journalShareAccessRequest.shareId, share.id),
        eq(journalShareAccessRequest.requesterUserId, viewer.id)
      )
    )
    .limit(1);

  if (request?.status === "pending") {
    return {
      share,
      shareSummary,
      gateState: "pending" as const,
      autoClaimed: false,
      isOwner: false,
      request,
    };
  }

  if (request?.status === "rejected") {
    return {
      share,
      shareSummary,
      gateState: "rejected" as const,
      autoClaimed: false,
      isOwner: false,
      request,
    };
  }

  return {
    share,
    shareSummary,
    gateState: "requestable" as const,
    autoClaimed: false,
    isOwner: false,
    request,
  };
}

async function requireApprovedShareAccess(input: {
  shareToken: string;
  viewerUserId: string;
}) {
  const resolved = await resolveShareAccess(input);

  if (resolved.gateState !== "approved") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this journal share.",
    });
  }

  return resolved;
}

async function addInviteBatch(input: {
  share: ShareOwnerRow;
  inviter: ViewerIdentity;
  emails: string[];
}) {
  const uniqueEmails = [...new Set(input.emails.map(normalizeInviteEmail))];
  const results: Array<{
    email: string;
    inviteId?: string;
    emailSent: boolean;
    skipped?: boolean;
    reason?: string;
  }> = [];

  for (const normalizedEmail of uniqueEmails) {
    if (normalizedEmail === normalizeInviteEmail(input.inviter.email)) {
      results.push({
        email: normalizedEmail,
        emailSent: false,
        skipped: true,
        reason: "owner_email",
      });
      continue;
    }

    const existingApprovedViewer = await db
      .select({
        id: journalShareViewer.id,
      })
      .from(journalShareViewer)
      .innerJoin(
        userTable,
        eq(userTable.id, journalShareViewer.viewerUserId)
      )
      .where(
        and(
          eq(journalShareViewer.shareId, input.share.id),
          eq(journalShareViewer.status, "approved"),
          eq(userTable.email, normalizedEmail)
        )
      )
      .limit(1);

    if (existingApprovedViewer.length > 0) {
      results.push({
        email: normalizedEmail,
        emailSent: false,
        skipped: true,
        reason: "already_approved",
      });
      continue;
    }

    const now = new Date();
    const [invite] = await db
      .insert(journalShareInvite)
      .values({
        shareId: input.share.id,
        invitedByUserId: input.inviter.id,
        invitedEmail: normalizedEmail,
        invitedEmailNormalized: normalizedEmail,
        status: "pending",
        revokedAt: null,
        lastSentAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [journalShareInvite.shareId, journalShareInvite.invitedEmailNormalized],
        set: {
          invitedByUserId: input.inviter.id,
          invitedEmail: normalizedEmail,
          status: "pending",
          revokedAt: null,
          expiresAt: null,
          lastSentAt: now,
          updatedAt: now,
        },
      })
      .returning({
        id: journalShareInvite.id,
      });

    const emailResult = await sendJournalShareInviteEmail({
      recipientEmail: normalizedEmail,
      inviterName: input.inviter.name,
      shareName: input.share.name,
      shareToken: input.share.shareToken,
    });

    results.push({
      email: normalizedEmail,
      inviteId: invite?.id,
      emailSent: emailResult.sent,
      reason: emailResult.error,
    });
  }

  return results;
}

export const journalSharesRouter = router({
  listOwnerShares: protectedProcedure.query(async ({ ctx }) => {
    const shares = await db
      .select({
        id: journalShare.id,
        ownerUserId: journalShare.ownerUserId,
        name: journalShare.name,
        shareToken: journalShare.shareToken,
        isActive: journalShare.isActive,
        revokedAt: journalShare.revokedAt,
        viewCount: journalShare.viewCount,
        lastViewedAt: journalShare.lastViewedAt,
        createdAt: journalShare.createdAt,
        updatedAt: journalShare.updatedAt,
        ownerName: userTable.name,
        ownerDisplayName: userTable.displayName,
        ownerEmail: userTable.email,
      })
      .from(journalShare)
      .innerJoin(userTable, eq(userTable.id, journalShare.ownerUserId))
      .where(eq(journalShare.ownerUserId, ctx.session.user.id))
      .orderBy(desc(journalShare.createdAt));

    return Promise.all(
      shares.map(async (share) => {
        const [selectedEntries, invites, viewers, pendingRequests] =
          await Promise.all([
            db
              .select({ id: journalShareEntry.id })
              .from(journalShareEntry)
              .where(eq(journalShareEntry.shareId, share.id)),
            db
              .select({ id: journalShareInvite.id })
              .from(journalShareInvite)
              .where(
                and(
                  eq(journalShareInvite.shareId, share.id),
                  eq(journalShareInvite.status, "pending")
                )
              ),
            db
              .select({ id: journalShareViewer.id })
              .from(journalShareViewer)
              .where(
                and(
                  eq(journalShareViewer.shareId, share.id),
                  eq(journalShareViewer.status, "approved")
                )
              ),
            db
              .select({ id: journalShareAccessRequest.id })
              .from(journalShareAccessRequest)
              .where(
                and(
                  eq(journalShareAccessRequest.shareId, share.id),
                  eq(journalShareAccessRequest.status, "pending")
                )
              ),
          ]);

        return {
          ...buildShareSummary(share),
          selectedEntryCount: selectedEntries.length,
          pendingInviteCount: invites.length,
          approvedViewerCount: viewers.length,
          pendingRequestCount: pendingRequests.length,
        };
      })
    );
  }),

  getOwnerShare: protectedProcedure
    .input(z.object({ shareId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const share = await getShareByIdForOwner(ctx.session.user.id, input.shareId);

      const [selectedEntries, invites, viewers, requests] = await Promise.all([
        db
          .select({
            journalEntryId: journalShareEntry.journalEntryId,
          })
          .from(journalShareEntry)
          .where(eq(journalShareEntry.shareId, share.id))
          .orderBy(asc(journalShareEntry.sortOrder)),
        db
          .select({
            id: journalShareInvite.id,
            invitedEmail: journalShareInvite.invitedEmail,
            status: journalShareInvite.status,
            claimedViewerUserId: journalShareInvite.claimedViewerUserId,
            claimedAt: journalShareInvite.claimedAt,
            revokedAt: journalShareInvite.revokedAt,
            expiresAt: journalShareInvite.expiresAt,
            lastSentAt: journalShareInvite.lastSentAt,
            createdAt: journalShareInvite.createdAt,
            updatedAt: journalShareInvite.updatedAt,
          })
          .from(journalShareInvite)
          .where(eq(journalShareInvite.shareId, share.id))
          .orderBy(desc(journalShareInvite.createdAt)),
        db
          .select({
            id: journalShareViewer.id,
            viewerId: journalShareViewer.viewerUserId,
            status: journalShareViewer.status,
            source: journalShareViewer.source,
            approvedAt: journalShareViewer.approvedAt,
            revokedAt: journalShareViewer.revokedAt,
            name: userTable.name,
            displayName: userTable.displayName,
            email: userTable.email,
            image: userTable.image,
          })
          .from(journalShareViewer)
          .innerJoin(userTable, eq(userTable.id, journalShareViewer.viewerUserId))
          .where(eq(journalShareViewer.shareId, share.id))
          .orderBy(desc(journalShareViewer.approvedAt)),
        db
          .select({
            id: journalShareAccessRequest.id,
            requesterUserId: journalShareAccessRequest.requesterUserId,
            requesterEmailSnapshot: journalShareAccessRequest.requesterEmailSnapshot,
            requesterNameSnapshot: journalShareAccessRequest.requesterNameSnapshot,
            message: journalShareAccessRequest.message,
            status: journalShareAccessRequest.status,
            createdAt: journalShareAccessRequest.createdAt,
            updatedAt: journalShareAccessRequest.updatedAt,
            name: userTable.name,
            displayName: userTable.displayName,
            email: userTable.email,
            image: userTable.image,
          })
          .from(journalShareAccessRequest)
          .innerJoin(userTable, eq(userTable.id, journalShareAccessRequest.requesterUserId))
          .where(
            and(
              eq(journalShareAccessRequest.shareId, share.id),
              inArray(journalShareAccessRequest.status, ["pending", "rejected"])
            )
          )
          .orderBy(desc(journalShareAccessRequest.createdAt)),
      ]);

      return {
        share: buildShareSummary(share),
        selectedEntryIds: selectedEntries.map((entry) => entry.journalEntryId),
        invites,
        viewers: viewers.map((viewer) => ({
          id: viewer.id,
          viewerId: viewer.viewerId,
          status: viewer.status,
          source: viewer.source,
          approvedAt: viewer.approvedAt,
          revokedAt: viewer.revokedAt,
          name: viewer.displayName || viewer.name || viewer.email,
          email: viewer.email,
          image: viewer.image,
        })),
        pendingRequests: requests.filter((r) => r.status === "pending").map((request) => ({
          id: request.id,
          requesterUserId: request.requesterUserId,
          requesterName:
            request.displayName ||
            request.name ||
            request.requesterNameSnapshot ||
            request.email ||
            request.requesterEmailSnapshot ||
            "Viewer",
          requesterEmail:
            request.email || request.requesterEmailSnapshot || null,
          image: request.image,
          message: request.message,
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        })),
        rejectedRequests: requests.filter((r) => r.status === "rejected").map((request) => ({
          id: request.id,
          requesterUserId: request.requesterUserId,
          requesterName:
            request.displayName ||
            request.name ||
            request.requesterNameSnapshot ||
            request.email ||
            request.requesterEmailSnapshot ||
            "Viewer",
          requesterEmail:
            request.email || request.requesterEmailSnapshot || null,
          image: request.image,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        })),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: shareNameSchema,
        entryIds: shareEntryIdsSchema,
        inviteEmails: z.array(shareEmailSchema).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [owner, entryIds] = await Promise.all([
        getViewerIdentity(ctx.session.user.id),
        assertOwnedEntryIds(ctx.session.user.id, input.entryIds),
      ]);

      const [share] = await db
        .insert(journalShare)
        .values({
          ownerUserId: owner.id,
          name: input.name,
          shareToken: shareTokenGenerator(),
          isActive: true,
        })
        .returning({
          id: journalShare.id,
        });

      if (!share) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journal share.",
        });
      }

      await replaceShareEntries(share.id, entryIds);

      const createdShare = await getShareByIdForOwner(owner.id, share.id);
      const inviteResults =
        input.inviteEmails && input.inviteEmails.length > 0
          ? await addInviteBatch({
              share: createdShare,
              inviter: owner,
              emails: input.inviteEmails,
            })
          : [];

      return {
        share: buildShareSummary(createdShare),
        selectedEntryIds: entryIds,
        inviteResults,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        shareId: z.string().min(1),
        name: shareNameSchema,
        entryIds: shareEntryIdsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await getShareByIdForOwner(ctx.session.user.id, input.shareId);
      const entryIds = await assertOwnedEntryIds(ctx.session.user.id, input.entryIds);

      await db
        .update(journalShare)
        .set({
          name: input.name,
          updatedAt: new Date(),
        })
        .where(eq(journalShare.id, input.shareId));

      await replaceShareEntries(input.shareId, entryIds);

      const updatedShare = await getShareByIdForOwner(
        ctx.session.user.id,
        input.shareId
      );

      return {
        share: buildShareSummary(updatedShare),
        selectedEntryIds: entryIds,
      };
    }),

  setActive: protectedProcedure
    .input(
      z.object({
        shareId: z.string().min(1),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await getShareByIdForOwner(ctx.session.user.id, input.shareId);

      const now = new Date();
      await db
        .update(journalShare)
        .set({
          isActive: input.isActive,
          revokedAt: input.isActive ? null : now,
          updatedAt: now,
        })
        .where(eq(journalShare.id, input.shareId));

      const share = await getShareByIdForOwner(ctx.session.user.id, input.shareId);
      return { share: buildShareSummary(share) };
    }),

  addInvites: protectedProcedure
    .input(
      z.object({
        shareId: z.string().min(1),
        emails: z.array(shareEmailSchema).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [share, inviter] = await Promise.all([
        getShareByIdForOwner(ctx.session.user.id, input.shareId),
        getViewerIdentity(ctx.session.user.id),
      ]);

      const inviteResults = await addInviteBatch({
        share,
        inviter,
        emails: input.emails,
      });

      return { inviteResults };
    }),

  resendInvite: protectedProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [invite] = await db
        .select({
          id: journalShareInvite.id,
          shareId: journalShareInvite.shareId,
          invitedEmail: journalShareInvite.invitedEmail,
        })
        .from(journalShareInvite)
        .innerJoin(journalShare, eq(journalShare.id, journalShareInvite.shareId))
        .where(
          and(
            eq(journalShareInvite.id, input.inviteId),
            eq(journalShare.ownerUserId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      const [share, inviter] = await Promise.all([
        getShareByIdForOwner(ctx.session.user.id, invite.shareId),
        getViewerIdentity(ctx.session.user.id),
      ]);

      await db
        .update(journalShareInvite)
        .set({
          status: "pending",
          revokedAt: null,
          lastSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(journalShareInvite.id, invite.id));

      const emailResult = await sendJournalShareInviteEmail({
        recipientEmail: invite.invitedEmail,
        inviterName: inviter.name,
        shareName: share.name,
        shareToken: share.shareToken,
      });

      return {
        inviteId: invite.id,
        emailSent: emailResult.sent,
        reason: emailResult.error,
      };
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [invite] = await db
        .select({
          id: journalShareInvite.id,
        })
        .from(journalShareInvite)
        .innerJoin(journalShare, eq(journalShare.id, journalShareInvite.shareId))
        .where(
          and(
            eq(journalShareInvite.id, input.inviteId),
            eq(journalShare.ownerUserId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      await db
        .update(journalShareInvite)
        .set({
          status: "revoked",
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(journalShareInvite.id, invite.id));

      return { inviteId: invite.id, success: true };
    }),

  approveRequest: protectedProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await db
        .select({
          id: journalShareAccessRequest.id,
          shareId: journalShareAccessRequest.shareId,
          requesterUserId: journalShareAccessRequest.requesterUserId,
          requesterEmailSnapshot: journalShareAccessRequest.requesterEmailSnapshot,
          status: journalShareAccessRequest.status,
        })
        .from(journalShareAccessRequest)
        .innerJoin(journalShare, eq(journalShare.id, journalShareAccessRequest.shareId))
        .where(
          and(
            eq(journalShareAccessRequest.id, input.requestId),
            eq(journalShare.ownerUserId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      }

      const [share, approver, viewer] = await Promise.all([
        getShareByIdForOwner(ctx.session.user.id, request.shareId),
        getViewerIdentity(ctx.session.user.id),
        getViewerIdentity(request.requesterUserId),
      ]);

      await upsertApprovedViewer({
        shareId: request.shareId,
        viewerUserId: request.requesterUserId,
        approvedByUserId: ctx.session.user.id,
        source: "request",
      });

      await db
        .update(journalShareAccessRequest)
        .set({
          status: "approved",
          decidedByUserId: ctx.session.user.id,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(journalShareAccessRequest.id, request.id));

      const normalizedEmail = normalizeInviteEmail(viewer.email);
      await db
        .update(journalShareInvite)
        .set({
          status: "claimed",
          claimedViewerUserId: viewer.id,
          claimedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(journalShareInvite.shareId, request.shareId),
            eq(journalShareInvite.invitedEmailNormalized, normalizedEmail)
          )
        );

      const emailResult = await sendJournalShareApprovedEmail({
        recipientEmail: viewer.email,
        approverName: approver.name,
        shareName: share.name,
        shareToken: share.shareToken,
      });

      return {
        requestId: request.id,
        viewerUserId: viewer.id,
        emailSent: emailResult.sent,
        reason: emailResult.error,
      };
    }),

  rejectRequest: protectedProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await db
        .select({
          id: journalShareAccessRequest.id,
        })
        .from(journalShareAccessRequest)
        .innerJoin(journalShare, eq(journalShare.id, journalShareAccessRequest.shareId))
        .where(
          and(
            eq(journalShareAccessRequest.id, input.requestId),
            eq(journalShare.ownerUserId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      }

      await db
        .update(journalShareAccessRequest)
        .set({
          status: "rejected",
          decidedByUserId: ctx.session.user.id,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(journalShareAccessRequest.id, request.id));

      return { requestId: request.id, success: true };
    }),

  revokeViewer: protectedProcedure
    .input(z.object({ viewerId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [viewerRow] = await db
        .select({
          id: journalShareViewer.id,
          shareId: journalShareViewer.shareId,
          viewerUserId: journalShareViewer.viewerUserId,
          viewerEmail: userTable.email,
        })
        .from(journalShareViewer)
        .innerJoin(journalShare, eq(journalShare.id, journalShareViewer.shareId))
        .innerJoin(userTable, eq(userTable.id, journalShareViewer.viewerUserId))
        .where(
          and(
            eq(journalShareViewer.id, input.viewerId),
            eq(journalShare.ownerUserId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!viewerRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viewer not found" });
      }

      const now = new Date();
      await db
        .update(journalShareViewer)
        .set({
          status: "revoked",
          revokedAt: now,
          updatedAt: now,
        })
        .where(eq(journalShareViewer.id, viewerRow.id));

      await db
        .update(journalShareInvite)
        .set({
          status: "revoked",
          revokedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(journalShareInvite.shareId, viewerRow.shareId),
            eq(
              journalShareInvite.invitedEmailNormalized,
              normalizeInviteEmail(viewerRow.viewerEmail)
            )
          )
        );

      return { viewerId: viewerRow.id, success: true };
    }),

  clearRejectedRequest: protectedProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await db
        .select({
          id: journalShareAccessRequest.id,
          shareId: journalShareAccessRequest.shareId,
          status: journalShareAccessRequest.status,
        })
        .from(journalShareAccessRequest)
        .innerJoin(journalShare, eq(journalShare.id, journalShareAccessRequest.shareId))
        .where(
          and(
            eq(journalShareAccessRequest.id, input.requestId),
            eq(journalShare.ownerUserId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      }

      if (request.status !== "rejected") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request is not rejected" });
      }

      await db
        .delete(journalShareAccessRequest)
        .where(eq(journalShareAccessRequest.id, request.id));

      return { requestId: request.id, success: true };
    }),

  resolveGate: protectedProcedure
    .input(z.object({ shareToken: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const resolved = await resolveShareAccess({
        shareToken: input.shareToken,
        viewerUserId: ctx.session.user.id,
      });

      return {
        gateState: resolved.gateState,
        autoClaimed: resolved.autoClaimed,
        isOwner: resolved.isOwner,
        share: resolved.shareSummary,
      };
    }),

  requestAccess: protectedProcedure
    .input(
      z.object({
        shareToken: z.string().min(1).max(64),
        message: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveShareAccess({
        shareToken: input.shareToken,
        viewerUserId: ctx.session.user.id,
      });

      if (resolved.gateState !== "requestable") {
        return {
          gateState: resolved.gateState,
          share: resolved.shareSummary,
        };
      }

      const viewer = await getViewerIdentity(ctx.session.user.id);
      const now = new Date();
      const [request] = await db
        .insert(journalShareAccessRequest)
        .values({
          shareId: resolved.share.id,
          requesterUserId: viewer.id,
          requesterEmailSnapshot: viewer.email,
          requesterNameSnapshot: viewer.name,
          message: input.message?.trim() || null,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            journalShareAccessRequest.shareId,
            journalShareAccessRequest.requesterUserId,
          ],
          set: {
            requesterEmailSnapshot: viewer.email,
            requesterNameSnapshot: viewer.name,
            message: input.message?.trim() || null,
            status: "pending",
            decidedByUserId: null,
            decidedAt: null,
            updatedAt: now,
          },
        })
        .returning({
          id: journalShareAccessRequest.id,
        });

      await createNotification({
        userId: resolved.share.ownerUserId,
        type: "journal_share_request",
        title: `${viewer.name} requested journal access`,
        body: `New request for "${resolved.share.name}".`,
        metadata: {
          shareId: resolved.share.id,
          shareToken: resolved.share.shareToken,
          requestId: request?.id ?? null,
          requesterUserId: viewer.id,
          sharePath: buildJournalSharePath(resolved.share.shareToken),
        },
        dedupeKey: `journal-share-request:${resolved.share.id}:${viewer.id}`,
      });

      await sendJournalShareAccessRequestEmail({
        ownerEmail: resolved.share.ownerEmail || "",
        ownerName: resolved.share.ownerDisplayName || resolved.share.ownerName,
        requesterName: viewer.name,
        requesterEmail: viewer.email,
        shareName: resolved.share.name,
        shareToken: resolved.share.shareToken,
      });

      return {
        gateState: "pending" as const,
        share: resolved.shareSummary,
        requestId: request?.id ?? null,
      };
    }),

  listEntries: protectedProcedure
    .input(z.object({ shareToken: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const resolved = await requireApprovedShareAccess({
        shareToken: input.shareToken,
        viewerUserId: ctx.session.user.id,
      });

      const rows = await db
        .select({
          sortOrder: journalShareEntry.sortOrder,
          entry: journalEntry,
        })
        .from(journalShareEntry)
        .innerJoin(journalEntry, eq(journalEntry.id, journalShareEntry.journalEntryId))
        .where(eq(journalShareEntry.shareId, resolved.share.id))
        .orderBy(asc(journalShareEntry.sortOrder));

      return {
        share: resolved.shareSummary,
        entries: rows.map(({ entry, sortOrder }) => {
          const payload = sanitizeSharedEntryPayload(entry);
          return {
            id: payload.id,
            title: payload.title,
            emoji: payload.emoji,
            coverImageUrl: payload.coverImageUrl,
            coverImagePosition: payload.coverImagePosition,
            entryType: payload.entryType,
            tags: payload.tags,
            journalDate: payload.journalDate,
            updatedAt: payload.updatedAt,
            createdAt: payload.createdAt,
            preview: payload.preview,
            sortOrder,
          };
        }),
      };
    }),

  getEntry: protectedProcedure
    .input(
      z.object({
        shareToken: z.string().min(1).max(64),
        entryId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const resolved = await requireApprovedShareAccess({
        shareToken: input.shareToken,
        viewerUserId: ctx.session.user.id,
      });

      const [row] = await db
        .select({
          entry: journalEntry,
        })
        .from(journalShareEntry)
        .innerJoin(journalEntry, eq(journalEntry.id, journalShareEntry.journalEntryId))
        .where(
          and(
            eq(journalShareEntry.shareId, resolved.share.id),
            eq(journalShareEntry.journalEntryId, input.entryId)
          )
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shared journal entry not found.",
        });
      }

      await db
        .update(journalShare)
        .set({
          viewCount: resolved.share.viewCount + 1,
          lastViewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(journalShare.id, resolved.share.id));

      return {
        share: resolved.shareSummary,
        entry: sanitizeSharedEntryPayload(row.entry),
      };
    }),
});
