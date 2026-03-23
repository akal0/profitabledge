"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Search, Trash2, UserPlus2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { trpc, trpcOptions } from "@/utils/trpc";

type EdgeShareRole = "viewer" | "editor";

type SharedMember = {
  id: string;
  userId: string;
  name: string | null;
  displayName: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  role: EdgeShareRole;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type ShareCandidate = {
  id: string;
  name: string | null;
  displayName: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  sharedRole: EdgeShareRole | null;
};

function getPersonLabel(person: {
  name?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  return (
    person.displayName?.trim() ||
    person.name?.trim() ||
    person.username?.trim() ||
    person.email?.trim() ||
    "Trader"
  );
}

function getPersonSecondary(person: {
  username?: string | null;
  email?: string | null;
}) {
  return person.username?.trim()
    ? `@${person.username.trim()}`
    : person.email?.trim() || "Profitabledge trader";
}

function getInitials(label: string) {
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "PE";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatRoleLabel(role: EdgeShareRole) {
  return role === "editor" ? "Editor" : "Viewer";
}

type EdgeShareSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edgeId: string;
  edgeName: string;
  sharedMembers: SharedMember[];
  onSharedStateChange?: () => Promise<void> | void;
};

export function EdgeShareSheet({
  open,
  onOpenChange,
  edgeId,
  edgeName,
  sharedMembers,
  onSharedStateChange,
}: EdgeShareSheetProps) {
  const utils = trpc.useUtils() as any;
  const shareEdge = trpc.edges.share.useMutation();
  const unshareEdge = trpc.edges.unshare.useMutation();
  const meQuery = useQuery(trpcOptions.users.me.queryOptions());
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const [inviteRole, setInviteRole] = useState<EdgeShareRole>("viewer");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, EdgeShareRole>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchValue("");
      setDebouncedSearchValue("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchValue(searchValue.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [open, searchValue]);

  useEffect(() => {
    setRoleDrafts(
      Object.fromEntries(
        sharedMembers.map((member) => [member.userId, member.role] as const)
      )
    );
  }, [sharedMembers]);

  const candidatesQuery = useQuery({
    ...trpcOptions.edges.searchShareCandidates.queryOptions({
      edgeId,
      query: debouncedSearchValue || "search",
    }),
    enabled: open && debouncedSearchValue.length >= 2,
  });

  const sortedMembers = useMemo(
    () =>
      [...sharedMembers].sort((left, right) =>
        getPersonLabel(left).localeCompare(getPersonLabel(right))
      ),
    [sharedMembers]
  );
  const isOwnAccountSearch = useMemo(() => {
    const normalizedQuery = debouncedSearchValue.trim().toLowerCase();
    const me = meQuery.data;

    if (!normalizedQuery || !me) {
      return false;
    }

    const ownValues = [
      me.username,
      me.name,
      me.displayName,
      me.email,
    ]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));

    return ownValues.some((value) => value.includes(normalizedQuery));
  }, [debouncedSearchValue, meQuery.data]);

  const refreshSharingState = async () => {
    await Promise.all([
      onSharedStateChange?.(),
      utils.edges.searchShareCandidates.invalidate(),
    ]);
  };

  const handleShare = async (userId: string, role: EdgeShareRole) => {
    setBusyUserId(userId);
    try {
      await shareEdge.mutateAsync({ edgeId, userId, role });
      await refreshSharingState();
      toast.success(
        role === "editor" ? "Editor access granted" : "Viewer access granted"
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRoleChange = async (member: SharedMember, nextRole: EdgeShareRole) => {
    const previousRole = roleDrafts[member.userId] ?? member.role;
    setRoleDrafts((currentDrafts) => ({
      ...currentDrafts,
      [member.userId]: nextRole,
    }));

    try {
      await handleShare(member.userId, nextRole);
    } catch {
      setRoleDrafts((currentDrafts) => ({
        ...currentDrafts,
        [member.userId]: previousRole,
      }));
    }
  };

  const handleUnshare = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await unshareEdge.mutateAsync({ edgeId, userId });
      await refreshSharingState();
      toast.success("Access removed");
    } finally {
      setBusyUserId(null);
    }
  };

  const candidates = (candidatesQuery.data ?? []) as ShareCandidate[];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/5 bg-sidebar sm:max-w-xl"
      >
        <SheetHeader className="border-b border-white/5 px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <UsersRound className="size-4 text-primary" />
            Share Edge
          </SheetTitle>
          <SheetDescription className="max-w-md text-xs leading-relaxed text-white/45">
            Share <span className="text-white/72">{edgeName}</span> directly with
            other Profitabledge traders. Direct shares appear in Shared Edges.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 px-6 py-6 text-xs">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white/78">Current access</p>
                <p className="mt-1 text-xs text-white/40">
                  Manage who can view or edit this Edge inside Profitabledge.
                </p>
              </div>
              <Badge className="border-white/10 bg-white/5 text-white/70">
                {sortedMembers.length} shared
              </Badge>
            </div>

            {sortedMembers.length > 0 ? (
              <div className="space-y-2">
                {sortedMembers.map((member) => {
                  const personLabel = getPersonLabel(member);
                  const currentRole = roleDrafts[member.userId] ?? member.role;
                  const isBusy = busyUserId === member.userId;

                  return (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-9 border border-white/10">
                          {member.image ? (
                            <AvatarImage alt={personLabel} src={member.image} />
                          ) : null}
                          <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-white/80">
                            {getInitials(personLabel)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white/84">
                            {personLabel}
                          </p>
                          <p className="truncate text-xs text-white/42">
                            {getPersonSecondary(member)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={currentRole}
                          onValueChange={(value) =>
                            void handleRoleChange(member, value as EdgeShareRole)
                          }
                          disabled={isBusy}
                        >
                          <SelectTrigger className="h-8 w-[110px] rounded-full border-white/10 bg-white/5 px-3 text-xs text-white/72 shadow-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 rounded-full border border-white/10 bg-white/5 text-white/56 hover:bg-white/10 hover:text-white"
                          disabled={isBusy}
                          onClick={() =>
                            void handleUnshare(member.userId).catch(() => undefined)
                          }
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-white/42">
                This Edge has not been shared with anyone yet.
              </div>
            )}
          </section>

          <Separator className="bg-white/6" />

          <section className="space-y-3">
            <div>
              <p className="text-sm font-medium text-white/78">Invite people</p>
              <p className="mt-1 text-xs text-white/40">
                Search by name, username, or email and send direct access.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/28" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search Profitabledge users"
                  className="h-9 border-white/10 bg-white/5 pl-9 text-xs text-white placeholder:text-white/25"
                />
              </div>

              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as EdgeShareRole)}
              >
                <SelectTrigger className="h-9 w-[118px] rounded-full border-white/10 bg-white/5 px-3 text-xs text-white/72 shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {debouncedSearchValue.length < 2 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-white/42">
                Type at least 2 characters to search for traders.
              </div>
            ) : candidatesQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-5 text-white/52">
                <Loader2 className="size-3.5 animate-spin" />
                Searching traders...
              </div>
            ) : candidates.length > 0 ? (
              <div className="space-y-2">
                {candidates.map((candidate) => {
                  const personLabel = getPersonLabel(candidate);
                  const isBusy = busyUserId === candidate.id;
                  const alreadySharedRole = candidate.sharedRole;
                  const hasMatchingRole =
                    alreadySharedRole != null && inviteRole === alreadySharedRole;
                  const actionLabel = alreadySharedRole
                    ? `Update to ${formatRoleLabel(inviteRole)}`
                    : `Share as ${formatRoleLabel(inviteRole)}`;

                  return (
                    <div
                      key={candidate.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-9 border border-white/10">
                          {candidate.image ? (
                            <AvatarImage alt={personLabel} src={candidate.image} />
                          ) : null}
                          <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-white/80">
                            {getInitials(personLabel)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white/84">
                            {personLabel}
                          </p>
                          <p className="truncate text-xs text-white/42">
                            {getPersonSecondary(candidate)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {alreadySharedRole ? (
                          <Badge className="border-white/10 bg-white/5 text-white/70">
                            {formatRoleLabel(alreadySharedRole)}
                          </Badge>
                        ) : null}
                        {!hasMatchingRole ? (
                          <Button
                            size="sm"
                            className={cn(
                              "h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/80 hover:bg-white/10"
                            )}
                            disabled={isBusy}
                            onClick={() =>
                              void handleShare(candidate.id, inviteRole).catch(
                                () => undefined
                              )
                            }
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : alreadySharedRole ? (
                              <Eye className="size-3.5" />
                            ) : (
                              <UserPlus2 className="size-3.5" />
                            )}
                            {actionLabel}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isOwnAccountSearch ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-white/42">
                That search matches your own account. Edge sharing only shows
                other Profitabledge traders, so you cannot share an Edge with
                yourself.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-white/42">
                No matching traders found.
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
