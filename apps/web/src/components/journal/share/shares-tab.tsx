"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Mail,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import type { JournalListEntry } from "@/components/journal/list/list-types";
import {
  JournalShareInviteInput,
  parseInviteUsernames,
} from "@/components/journal/share/journal-share-invite-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

function buildJournalSharePath(shareToken: string) {
  return `/share/journal/${shareToken}`;
}

const primaryActionButtonClass =
  "rounded-sm bg-teal-500/18 ring-teal-500/30 px-3 text-xs text-teal-100 hover:bg-teal-500/24";
const neutralActionButtonClass =
  "rounded-sm bg-white/8 ring-white/10 px-3 text-xs text-white/80 hover:bg-white/12";
const warningActionButtonClass =
  "rounded-sm bg-amber-500/16 ring-amber-500/30 px-3 text-xs text-amber-100 hover:bg-amber-500/22";
const destructiveActionButtonClass =
  "rounded-sm bg-rose-500/16 ring-rose-500/30 px-3 text-xs text-rose-100 hover:bg-rose-500/22";

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getInviteStatusBadgeClassName(status: string) {
  switch (status.toLowerCase()) {
    case "pending":
      return "rounded-sm bg-amber-500/16 ring-amber-500/30 px-2.5 py-1 text-[10px] font-medium text-amber-100 capitalize";
    case "claimed":
      return "rounded-sm bg-teal-500/18 ring-teal-500/30 px-2.5 py-1 text-[10px] font-medium text-teal-100 capitalize";
    case "declined":
      return "rounded-sm bg-rose-500/16 ring-rose-500/30 px-2.5 py-1 text-[10px] font-medium text-rose-100 capitalize";
    case "revoked":
      return "rounded-sm bg-rose-500/16 ring-rose-500/30 px-2.5 py-1 text-[10px] font-medium text-rose-100 capitalize";
    case "expired":
      return "rounded-sm bg-white/8 ring-white/10 px-2.5 py-1 text-[10px] font-medium text-white/70 capitalize";
    default:
      return "rounded-sm bg-white/8 ring-white/10 px-2.5 py-1 text-[10px] font-medium text-white/70 capitalize";
  }
}

export function JournalSharesTab({ accountId }: { accountId?: string }) {
  const utils = trpc.useUtils() as any;
  const queuedInviteKeyRef = useRef<string | null>(null);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [intentToCreate, setIntentToCreate] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEntryIds, setDraftEntryIds] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");

  const { data: entriesData } = trpc.journal.list.useQuery({
    limit: 100,
    accountId,
    isArchived: false,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });
  const { data: ownerShares = [] } =
    trpc.journal.shares.listOwnerShares.useQuery(undefined, {
      refetchInterval: 15_000,
    });
  const { data: ownerShareDetail } = trpc.journal.shares.getOwnerShare.useQuery(
    { shareId: selectedShareId! },
    {
      enabled: Boolean(selectedShareId),
      refetchInterval: (query) =>
        (query.state.data as any)?.pendingRequests?.length > 0 ? 8_000 : 15_000,
    }
  );

  const createShare = trpc.journal.shares.create.useMutation({
    onSuccess: async (result: any) => {
      await utils.journal.shares.listOwnerShares.invalidate();
      setSelectedShareId(result.share.id);
      setIntentToCreate(false);
      setInviteInput("");
      toast.success("Journal share created");
    },
  });
  const updateShare = trpc.journal.shares.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.journal.shares.listOwnerShares.invalidate(),
        selectedShareId
          ? utils.journal.shares.getOwnerShare.invalidate({
              shareId: selectedShareId,
            })
          : Promise.resolve(),
      ]);
      toast.success("Share updated");
    },
  });
  const setShareActive = trpc.journal.shares.setActive.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.journal.shares.listOwnerShares.invalidate(),
        selectedShareId
          ? utils.journal.shares.getOwnerShare.invalidate({
              shareId: selectedShareId,
            })
          : Promise.resolve(),
      ]);
    },
  });
  const addInvites = trpc.journal.shares.addInvites.useMutation({
    onSuccess: async () => {
      if (!selectedShareId) return;
      setInviteInput("");
      await utils.journal.shares.getOwnerShare.invalidate({
        shareId: selectedShareId,
      });
      toast.success("Invites sent");
    },
  });
  const resendInvite = trpc.journal.shares.resendInvite.useMutation({
    onSuccess: async () => {
      if (!selectedShareId) return;
      await utils.journal.shares.getOwnerShare.invalidate({
        shareId: selectedShareId,
      });
      toast.success("Invite resent");
    },
  });
  const revokeInvite = trpc.journal.shares.revokeInvite.useMutation({
    onSuccess: async (_data, variables) => {
      if (!selectedShareId) return;
      utils.journal.shares.getOwnerShare.setData(
        { shareId: selectedShareId },
        (current: any) =>
          current
            ? {
                ...current,
                invites: (current.invites ?? []).filter(
                  (invite: any) => invite.id !== variables.inviteId
                ),
              }
            : current
      );
      await utils.journal.shares.getOwnerShare.invalidate({
        shareId: selectedShareId,
      });
      toast.success("Invite revoked");
    },
  });
  const approveRequest = trpc.journal.shares.approveRequest.useMutation({
    onSuccess: async () => {
      if (!selectedShareId) return;
      await utils.journal.shares.getOwnerShare.invalidate({
        shareId: selectedShareId,
      });
      toast.success("Access approved");
    },
  });
  const rejectRequest = trpc.journal.shares.rejectRequest.useMutation({
    onSuccess: async () => {
      if (!selectedShareId) return;
      await utils.journal.shares.getOwnerShare.invalidate({
        shareId: selectedShareId,
      });
      toast.success("Request rejected");
    },
  });
  const revokeViewer = trpc.journal.shares.revokeViewer.useMutation({
    onSuccess: async (_data, variables) => {
      if (!selectedShareId) return;
      utils.journal.shares.getOwnerShare.setData(
        { shareId: selectedShareId },
        (current: any) =>
          current
            ? {
                ...current,
                viewers: (current.viewers ?? []).filter(
                  (viewer: any) => viewer.id !== variables.viewerId
                ),
              }
            : current
      );
      await utils.journal.shares.getOwnerShare.invalidate({
        shareId: selectedShareId,
      });
      toast.success("Viewer removed");
    },
  });
  const clearRejection = trpc.journal.shares.clearRejectedRequest.useMutation({
    onSuccess: async () => {
      if (!selectedShareId) return;
      await utils.journal.shares.getOwnerShare.invalidate({
        shareId: selectedShareId,
      });
      toast.success("Rejection cleared — they can request access again");
    },
  });

  const entries = (entriesData?.items || []) as JournalListEntry[];
  const selectedEntrySet = useMemo(
    () => new Set(draftEntryIds),
    [draftEntryIds]
  );
  const activeShare = ownerShareDetail?.share ?? null;
  const pendingRequests = ownerShareDetail?.pendingRequests ?? [];
  const rejectedRequests = ownerShareDetail?.rejectedRequests ?? [];
  const invites = ownerShareDetail?.invites ?? [];
  const viewers = ownerShareDetail?.viewers ?? [];
  const parsedInviteUsernames = useMemo(
    () => parseInviteUsernames(inviteInput),
    [inviteInput]
  );
  const inviteSelectionKey = parsedInviteUsernames.join(",");
  const isCreateMode = !selectedShareId;
  const ownerShareCount = ownerShares.length;

  useEffect(() => {
    if (
      !intentToCreate &&
      !selectedShareId &&
      (ownerShares as any[]).length > 0
    ) {
      setSelectedShareId((ownerShares as any[])[0]?.id ?? null);
    }
  }, [ownerShares, selectedShareId, intentToCreate]);

  useEffect(() => {
    if (!ownerShareDetail) return;
    setDraftName(ownerShareDetail.share.name || "");
    setDraftEntryIds(ownerShareDetail.selectedEntryIds || []);
  }, [ownerShareDetail]);

  useEffect(() => {
    if (!isCreateMode || ownerShareCount > 0) return;
    setDraftName("Mentor review share");
    setDraftEntryIds([]);
  }, [isCreateMode, ownerShareCount]);

  useEffect(() => {
    if (!selectedShareId || isCreateMode || inviteSelectionKey.length === 0) {
      queuedInviteKeyRef.current = null;
      return;
    }

    const submissionKey = `${selectedShareId}:${inviteSelectionKey}`;
    if (queuedInviteKeyRef.current === submissionKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      queuedInviteKeyRef.current = submissionKey;
      addInvites.mutate({
        shareId: selectedShareId,
        usernames: parsedInviteUsernames,
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    inviteSelectionKey,
    isCreateMode,
    parsedInviteUsernames,
    selectedShareId,
    addInvites,
  ]);

  const handleToggleEntry = (entryId: string) => {
    setDraftEntryIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId]
    );
  };

  const handleCreateShare = async () => {
    if (!draftName.trim()) {
      toast.error("Share name is required");
      return;
    }
    if (draftEntryIds.length === 0) {
      toast.error("Select at least one journal page");
      return;
    }
    await createShare.mutateAsync({
      name: draftName.trim(),
      entryIds: draftEntryIds,
      inviteUsernames: parsedInviteUsernames,
    });
  };

  const handleSaveShare = async () => {
    if (!selectedShareId) return;
    await updateShare.mutateAsync({
      shareId: selectedShareId,
      name: draftName.trim(),
      entryIds: draftEntryIds,
    });
  };

  const handleCopyShareLink = async (shareToken: string) => {
    const url = `${window.location.origin}${buildJournalSharePath(shareToken)}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Left: share list */}
      <aside className="flex w-64 shrink-0 flex-col xl:w-72">
        <div className="flex items-center justify-between px-8 py-4">
          <span className="text-xs font-medium  text-white/38">Shares</span>
          <Button
            size="sm"
            className="h-7 rounded-sm bg-white/8 px-3 text-xs text-white hover:bg-white/12"
            onClick={() => {
              setIntentToCreate(true);
              setSelectedShareId(null);
              setDraftName("Mentor review share");
              setDraftEntryIds([]);
              setInviteInput("");
            }}
          >
            New share
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {(ownerShares as any[]).map((share: any) => (
              <button
                key={share.id}
                type="button"
                onClick={() => {
                  setIntentToCreate(false);
                  setSelectedShareId(share.id);
                }}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                  share.id === selectedShareId
                    ? "bg-teal-400/10 text-white"
                    : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {share.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ring-teal-500/30 text-[10px] shrink-0",
                      share.isActive
                        ? "text-teal-300"
                        : "text-white/35 ring-white/10"
                    )}
                  >
                    {share.isActive ? "Active" : "Off"}
                  </Badge>
                </div>
                <div className="mt-0.5 text-xs text-white/35">
                  {share.selectedEntryCount} page
                  {share.selectedEntryCount === 1 ? "" : "s"}
                  {share.pendingRequestCount > 0 ? (
                    <span className="ml-2 text-amber-300/80">
                      · {share.pendingRequestCount} pending
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
            {(ownerShares as any[]).length === 0 && !intentToCreate ? (
              <p className="px-3 py-4 text-sm text-white/30">No shares yet.</p>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      <VerticalSeparator />

      {/* Right: detail */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Share setup */}
        <section className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
          <div className="text-xs  text-white/28">
            {isCreateMode ? "New share" : "Share setup"}
          </div>
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Mentor review share"
            className="ring-white/10 bg-white/[0.03] text-white placeholder:text-white/24"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={
                createShare.isPending ||
                updateShare.isPending ||
                !draftName.trim()
              }
              onClick={isCreateMode ? handleCreateShare : handleSaveShare}
              className={primaryActionButtonClass}
            >
              <ShieldCheck className="size-3" />
              {isCreateMode ? "Create share" : "Save changes"}
            </Button>
            {activeShare?.shareToken ? (
              <Button
                size="sm"
                className={neutralActionButtonClass}
                onClick={() => handleCopyShareLink(activeShare.shareToken)}
              >
                <Copy className="size-3" />
                Copy link
              </Button>
            ) : null}
            {selectedShareId ? (
              <Button
                size="sm"
                className={
                  activeShare?.isActive
                    ? destructiveActionButtonClass
                    : primaryActionButtonClass
                }
                onClick={() =>
                  setShareActive.mutate({
                    shareId: selectedShareId,
                    isActive: !activeShare?.isActive,
                  })
                }
              >
                {activeShare?.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            ) : null}
          </div>
        </section>

        <Separator />

        {/* Included pages */}
        <section className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="text-xs  text-white/28">Included pages</div>
            <Badge variant="outline" className="ring-white/10 text-white/60">
              {draftEntryIds.length} selected
            </Badge>
          </div>
          <p className="text-xs text-white/40">
            Select the journal pages that should appear in this share.
          </p>
          <div className="space-y-2">
            {entries.map((entry) => {
              const isSelected = selectedEntrySet.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleToggleEntry(entry.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg ring px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "ring-teal-400/30 bg-teal-400/10"
                      : "ring-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded ring",
                      isSelected
                        ? "ring-teal-300 bg-teal-400/15 text-teal-200"
                        : "ring-white/12 text-transparent"
                    )}
                  >
                    <Check className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {entry.title}
                    </div>
                    {entry.preview ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">
                        {entry.preview}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* Invite viewers */}
        <section className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
          <div className="flex items-center gap-2 text-xs  text-white/28">
            <Mail className="size-3.5" />
            Invite approved viewers
          </div>
          <JournalShareInviteInput
            value={inviteInput}
            onChange={setInviteInput}
            shareId={selectedShareId ?? undefined}
            placeholder="@username"
            textareaClassName="min-h-[80px]"
          />
        </section>

        {selectedShareId ? (
          <>
            {/* Pending requests */}
            {pendingRequests.length > 0 ? (
              <>
                <Separator />
                <section className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
                  <div className="flex items-center gap-2 text-xs  text-white/28">
                    <Users className="size-3.5" />
                    Pending requests
                  </div>
                  <div className="space-y-2">
                    {(pendingRequests as any[]).map((request: any) => (
                      <div
                        key={request.id}
                        className="rounded-lg ring ring-white/8 bg-white/[0.02] px-4 py-3"
                      >
                        <div className="text-sm font-medium text-white">
                          {request.requesterName || "Viewer"}
                        </div>
                        <div className="mt-0.5 text-xs text-white/38">
                          {request.requesterEmail || "No email available"}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            className={primaryActionButtonClass}
                            onClick={() =>
                              approveRequest.mutate({ requestId: request.id })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            className={destructiveActionButtonClass}
                            onClick={() =>
                              rejectRequest.mutate({ requestId: request.id })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : null}

            {/* Declined requests */}
            {rejectedRequests.length > 0 ? (
              <>
                <Separator />
                <section className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
                  <div className="flex items-center gap-2 text-xs  text-white/28">
                    <Users className="size-3.5" />
                    Declined requests
                  </div>
                  <p className="text-xs text-white/40">
                    Remove to let them request access again.
                  </p>
                  <div className="space-y-2">
                    {(rejectedRequests as any[]).map((request: any) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between gap-3 rounded-lg ring ring-white/8 bg-white/[0.02] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">
                            {request.requesterName || "Viewer"}
                          </div>
                          <div className="mt-0.5 text-xs text-white/38">
                            {request.requesterEmail || "No email available"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className={neutralActionButtonClass + " shrink-0"}
                          onClick={() =>
                            clearRejection.mutate({ requestId: request.id })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : null}

            {/* Sent invites */}
            <Separator />
            <section className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
              <div className="flex items-center gap-2 text-xs  text-white/28">
                <Link2 className="size-3.5" />
                Sent invites
              </div>
              {invites.length === 0 ? (
                <p className="text-sm text-white/38">
                  No invites sent for this share yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {(invites as any[]).map((invite: any) => (
                    <div
                      key={invite.id}
                      className="rounded-lg ring ring-white/8 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-8 ring ring-white/8">
                            <AvatarImage
                              alt={
                                invite.invitedUsername ||
                                invite.invitedName ||
                                invite.invitedEmail
                              }
                              src={invite.invitedImage ?? undefined}
                            />
                            <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-white/80">
                              {getInitials(
                                invite.invitedName ||
                                  invite.invitedUsername ||
                                  invite.invitedEmail
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">
                              {invite.invitedUsername
                                ? `@${invite.invitedUsername}`
                                : invite.invitedEmail}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-white/38">
                              {invite.invitedName || invite.invitedEmail}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${getInviteStatusBadgeClassName(invite.status)} shrink-0`}
                        >
                          {invite.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className={warningActionButtonClass}
                          onClick={() =>
                            resendInvite.mutate({ inviteId: invite.id })
                          }
                        >
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          className={destructiveActionButtonClass}
                          onClick={() =>
                            revokeInvite.mutate({ inviteId: invite.id })
                          }
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Approved viewers */}
            <Separator />
            <section className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
              <div className="flex items-center gap-2 text-xs  text-white/28">
                <UserCheck className="size-3.5" />
                Approved viewers
              </div>
              {viewers.length === 0 ? (
                <p className="text-sm text-white/38">
                  No approved viewers yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {(viewers as any[]).map((viewer: any) => (
                    <div
                      key={viewer.id}
                      className="rounded-lg ring ring-white/8 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-8 ring ring-white/8">
                            <AvatarImage
                              alt={viewer.username || viewer.name || viewer.email}
                              src={viewer.image ?? undefined}
                            />
                            <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-white/80">
                              {getInitials(
                                viewer.username || viewer.name || viewer.email
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">
                              {viewer.username
                                ? `@${viewer.username}`
                                : viewer.name || "Viewer"}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-white/38">
                              {viewer.username && viewer.name
                                ? viewer.name
                                : viewer.email || "No email available"}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            variant="outline"
                            className="ring-white/10 text-[10px] text-white/58"
                          >
                            {viewer.source}
                          </Badge>
                          <Button
                            size="sm"
                            className={destructiveActionButtonClass}
                            onClick={() =>
                              revokeViewer.mutate({ viewerId: viewer.id })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mx-auto w-full max-w-3xl px-6 py-6">
            <div className="rounded-lg ring ring-dashed ring-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/42">
              Create the share first, then invite viewers and manage access
              requests here.
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
