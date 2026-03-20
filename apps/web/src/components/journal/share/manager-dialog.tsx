"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Mail,
  MailPlus,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { JournalListEntry } from "@/components/journal/list/list-types";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

function buildJournalSharePath(shareToken: string) {
  return `/share/journal/${shareToken}`;
}

function parseInviteEmails(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]/g)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function JournalShareManagerDialog({
  isOpen,
  onOpenChange,
  accountId,
}: {
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  accountId?: string;
}) {
  const utils = trpc.useUtils() as any;
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [intentToCreate, setIntentToCreate] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEntryIds, setDraftEntryIds] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");

  const { data: entriesData } = trpc.journal.list.useQuery(
    {
      limit: 100,
      accountId,
      isArchived: false,
      sortBy: "updatedAt",
      sortOrder: "desc",
    },
    { enabled: isOpen }
  );
  const { data: ownerShares = [] } =
    trpc.journal.shares.listOwnerShares.useQuery(undefined, {
      enabled: isOpen,
    });
  const { data: ownerShareDetail } = trpc.journal.shares.getOwnerShare.useQuery(
    { shareId: selectedShareId! },
    { enabled: isOpen && Boolean(selectedShareId) }
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
    onSuccess: async () => {
      if (!selectedShareId) return;
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
    onSuccess: async () => {
      if (!selectedShareId) return;
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
  const parsedInviteEmails = useMemo(
    () => parseInviteEmails(inviteInput),
    [inviteInput]
  );
  const isCreateMode = !selectedShareId;

  useEffect(() => {
    if (!isOpen) {
      setIntentToCreate(false);
      return;
    }

    if (!intentToCreate && !selectedShareId && ownerShares.length > 0) {
      setSelectedShareId(ownerShares[0]?.id ?? null);
    }
  }, [isOpen, ownerShares, selectedShareId, intentToCreate]);

  useEffect(() => {
    if (!isCreateMode || ownerShares.length > 0) {
      return;
    }

    setDraftName("Mentor review share");
    setDraftEntryIds([]);
  }, [isCreateMode, ownerShares.length]);

  useEffect(() => {
    if (!ownerShareDetail) {
      return;
    }

    setDraftName(ownerShareDetail.share.name || "");
    setDraftEntryIds(ownerShareDetail.selectedEntryIds || []);
  }, [ownerShareDetail]);

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
      inviteEmails: parsedInviteEmails,
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(92vh,820px)] max-w-2xl flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg"
      >
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
              <Users className="size-3 text-white/60 relative z-10" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">
                Private journal shares
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                Bundle selected pages into a read-only share, invite approved
                viewers, and manage incoming access requests.
              </p>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:brightness-110 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator className="bg-white/5" />

          <ScrollArea className="min-h-0 flex-1">
            <div>
              {/* Shares */}
              <section className="space-y-3 px-5 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/28">
                    <Users className="size-3.5" />
                    Shares
                  </div>
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
                <div className="space-y-2">
                  {ownerShares.map((share: any) => (
                    <button
                      key={share.id}
                      type="button"
                      onClick={() => setSelectedShareId(share.id)}
                      className={cn(
                        "w-full rounded-lg ring px-4 py-3 text-left transition-colors",
                        share.id === selectedShareId
                          ? "ring-teal-400/30 bg-teal-400/10"
                          : "ring-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">
                            {share.name}
                          </div>
                          <div className="mt-0.5 text-xs text-white/38">
                            {share.selectedEntryCount} page
                            {share.selectedEntryCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "ring-white/10 text-[10px]",
                            share.isActive ? "text-teal-200" : "text-white/40"
                          )}
                        >
                          {share.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <Separator className="bg-white/5" />

              {/* Share setup */}
              <section className="space-y-3 px-5 py-5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/28">
                  Share setup
                </div>
                <Input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
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
                    className="rounded-sm bg-teal-500/18 px-3 text-xs text-teal-100 hover:bg-teal-500/24"
                  >
                    <ShieldCheck className="size-3" />
                    {isCreateMode ? "Create share" : "Save changes"}
                  </Button>
                  {activeShare?.shareToken ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-sm ring-white/10 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.04]"
                      onClick={() =>
                        handleCopyShareLink(activeShare.shareToken)
                      }
                    >
                      <Copy className="size-3" />
                      Copy link
                    </Button>
                  ) : null}
                  {selectedShareId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-sm ring-white/10 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.04]"
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

              <Separator className="bg-white/5" />

              {/* Included pages */}
              <section className="space-y-3 px-5 py-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/28">
                    Included pages
                  </div>
                  <Badge
                    variant="outline"
                    className="ring-white/10 text-white/60"
                  >
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

              <Separator className="bg-white/5" />

              {/* Invite viewers */}
              <section className="space-y-3 px-5 py-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/28">
                  <Mail className="size-3.5" />
                  Invite approved viewers
                </div>
                <Textarea
                  value={inviteInput}
                  onChange={(event) => setInviteInput(event.target.value)}
                  placeholder="mentor@example.com, coach@example.com"
                  className="min-h-[100px] ring-white/10 bg-white/[0.03] text-white placeholder:text-white/24"
                />
                <Button
                  size="sm"
                  disabled={!selectedShareId || parsedInviteEmails.length === 0}
                  className="rounded-sm bg-white/8 px-3 text-xs text-white hover:bg-white/12"
                  onClick={() =>
                    selectedShareId
                      ? addInvites.mutate({
                          shareId: selectedShareId,
                          emails: parsedInviteEmails,
                        })
                      : undefined
                  }
                >
                  <MailPlus className="size-3" />
                  Send invites
                </Button>
              </section>

              {selectedShareId ? (
                <>
                  <Separator className="bg-white/5" />

                  <section className="space-y-3 px-5 py-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/28">
                      <Users className="size-3.5" />
                      Pending requests
                    </div>
                    {pendingRequests.length === 0 ? (
                      <p className="text-sm text-white/38">
                        No access requests yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {pendingRequests.map((request: any) => (
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
                                className="rounded-sm bg-teal-500/18 px-3 text-xs text-teal-100 hover:bg-teal-500/24"
                                onClick={() =>
                                  approveRequest.mutate({
                                    requestId: request.id,
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-sm ring-white/10 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.04]"
                                onClick={() =>
                                  rejectRequest.mutate({
                                    requestId: request.id,
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {rejectedRequests.length > 0 ? (
                    <>
                      <Separator className="bg-white/5" />

                      <section className="space-y-3 px-5 py-5">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/28">
                          <Users className="size-3.5" />
                          Declined requests
                        </div>
                        <p className="text-xs text-white/40">
                          These users were declined. Remove to let them request
                          again.
                        </p>
                        <div className="space-y-2">
                          {rejectedRequests.map((request: any) => (
                            <div
                              key={request.id}
                              className="rounded-lg ring ring-white/8 bg-white/[0.02] px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-white">
                                    {request.requesterName || "Viewer"}
                                  </div>
                                  <div className="mt-0.5 text-xs text-white/38">
                                    {request.requesterEmail ||
                                      "No email available"}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-sm ring-white/10 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.04]"
                                  onClick={() =>
                                    clearRejection.mutate({
                                      requestId: request.id,
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : null}

                  <Separator className="bg-white/5" />

                  <section className="space-y-3 px-5 py-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/28">
                      <Link2 className="size-3.5" />
                      Sent invites
                    </div>
                    {invites.length === 0 ? (
                      <p className="text-sm text-white/38">
                        No invites sent for this share yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {invites.map((invite: any) => (
                          <div
                            key={invite.id}
                            className="rounded-lg ring ring-white/8 bg-white/[0.02] px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">
                                  {invite.invitedEmail}
                                </div>
                                <div className="mt-0.5 text-xs text-white/38">
                                  {invite.status}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="ring-white/10 text-[10px] text-white/58"
                              >
                                {invite.status}
                              </Badge>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-sm ring-white/10 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.04]"
                                onClick={() =>
                                  resendInvite.mutate({ inviteId: invite.id })
                                }
                              >
                                Resend
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-sm ring-white/10 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.04]"
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

                  <Separator className="bg-white/5" />

                  <section className="space-y-3 px-5 py-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/28">
                      <UserCheck className="size-3.5" />
                      Approved viewers
                    </div>
                    {viewers.length === 0 ? (
                      <p className="text-sm text-white/38">
                        No approved viewers yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {viewers.map((viewer: any) => (
                          <div
                            key={viewer.id}
                            className="rounded-lg ring ring-white/8 bg-white/[0.02] px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">
                                  {viewer.name || "Viewer"}
                                </div>
                                <div className="mt-0.5 text-xs text-white/38">
                                  {viewer.email || "No email available"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="ring-white/10 text-[10px] text-white/58"
                                >
                                  {viewer.source}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-sm ring-white/10 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.04]"
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
                <div className="px-5 pb-5">
                  <div className="rounded-lg ring ring-dashed ring-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/42">
                    Create the share first, then invite viewers and process
                    access requests here.
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
