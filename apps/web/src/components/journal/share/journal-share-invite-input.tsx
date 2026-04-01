"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Loader2, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  getBillingPlanTitle,
  type BillingPlanKey,
} from "@/features/settings/billing/lib/plan-labels";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type InviteCandidate = {
  id: string;
  username: string;
  name?: string | null;
  displayName?: string | null;
  image?: string | null;
  planKey?: "student" | "professional" | "institutional" | null;
  isVerified?: boolean;
  isPremium?: boolean;
};

function getPlanBadgeClassName(planKey?: InviteCandidate["planKey"]) {
  switch (planKey) {
    case "professional":
      return "ring ring-blue-500/20 bg-blue-500/10 text-blue-300";
    case "institutional":
      return "ring ring-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    default:
      return "ring ring-white/10 bg-white/5 text-white/70";
  }
}

export function parseInviteUsernames(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]/g)
        .map((value) => value.trim().replace(/^@+/, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeInviteUsername(username: string) {
  return username.trim().replace(/^@+/, "").toLowerCase();
}

function getActiveMentionQuery(value: string) {
  const token = value.trim();

  if (!token.startsWith("@")) {
    return null;
  }

  if (/\s/.test(token.slice(1))) {
    return null;
  }

  return normalizeInviteUsername(token.slice(1));
}

function getCandidateLabel(candidate: {
  displayName?: string | null;
  name?: string | null;
  username: string;
}) {
  return candidate.displayName || candidate.name || `@${candidate.username}`;
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type JournalShareInviteInputProps = {
  value: string;
  onChange: (nextValue: string) => void;
  shareId?: string;
  className?: string;
  textareaClassName?: string;
  placeholder?: string;
};

export function JournalShareInviteInput({
  value,
  onChange,
  shareId,
  className,
  textareaClassName,
  placeholder = "@username",
}: JournalShareInviteInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [inviteQuery, setInviteQuery] = useState("");
  const [knownCandidatesByUsername, setKnownCandidatesByUsername] = useState<
    Record<string, InviteCandidate>
  >({});

  const selectedUsernames = useMemo(() => parseInviteUsernames(value), [value]);
  const selectedUsernameSet = useMemo(
    () => new Set(selectedUsernames),
    [selectedUsernames]
  );
  const activeMentionQuery = useMemo(
    () => getActiveMentionQuery(inviteQuery),
    [inviteQuery]
  );
  const deferredQuery = useDeferredValue(activeMentionQuery ?? "");

  const { data: searchResults = [], isFetching } =
    trpc.journal.shares.searchInviteCandidates.useQuery(
      {
        query: deferredQuery,
        shareId,
      },
      {
        enabled: isFocused && activeMentionQuery !== null,
        staleTime: 15_000,
      }
    );

  const candidates = useMemo(
    () =>
      (searchResults as InviteCandidate[]).filter(
        (candidate) => !selectedUsernameSet.has(candidate.username)
      ),
    [searchResults, selectedUsernameSet]
  );
  const selectedUsers = useMemo(
    () =>
      selectedUsernames.map((username) => ({
        ...(knownCandidatesByUsername[username] ?? {}),
        username,
      })),
    [knownCandidatesByUsername, selectedUsernames]
  );
  const isSuggestionsOpen = isFocused && activeMentionQuery !== null;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [deferredQuery, candidates.length]);

  useEffect(() => {
    if ((searchResults as InviteCandidate[]).length === 0) return;

    setKnownCandidatesByUsername((current) => {
      const next = { ...current };

      for (const candidate of searchResults as InviteCandidate[]) {
        next[candidate.username] = candidate;
      }

      return next;
    });
  }, [searchResults]);

  const insertCandidate = (candidate: InviteCandidate) => {
    setKnownCandidatesByUsername((current) => ({
      ...current,
      [candidate.username]: candidate,
    }));
    onChange([...selectedUsernames, candidate.username].join(", "));
    setInviteQuery("");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const removeCandidate = (username: string) => {
    onChange(selectedUsernames.filter((item) => item !== username).join(", "));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isSuggestionsOpen || candidates.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current >= candidates.length - 1 ? 0 : current + 1
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current <= 0 ? candidates.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const candidate = candidates[highlightedIndex];
      if (candidate) {
        insertCandidate(candidate);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setInviteQuery("");
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={inviteQuery}
          onChange={(event) => {
            setInviteQuery(event.target.value);
          }}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 0);
          }}
          onKeyDown={handleKeyDown}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          className={cn(
            "ring-white/10 bg-white/[0.03] text-white placeholder:text-white/24",
            textareaClassName
          )}
        />

        {isSuggestionsOpen ? (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-md ring ring-white/10 bg-sidebar/98 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 border-b border-white/6 px-3 py-2 text-[11px] text-white/45">
              <span>
                {activeMentionQuery
                  ? `Matches for @${activeMentionQuery}`
                  : "Suggested usernames"}
              </span>
              <span>Enter to select</span>
            </div>

            {isFetching && candidates.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-white/55">
                <Loader2 className="size-3.5 animate-spin" />
                Searching usernames...
              </div>
            ) : null}

            {!isFetching && candidates.length === 0 ? (
              <div className="px-3 py-3 text-sm text-white/45">
                {activeMentionQuery
                  ? `No usernames found for @${activeMentionQuery}.`
                  : "No invite candidates available."}
              </div>
            ) : null}

            {candidates.length > 0 ? (
              <div className="max-h-72 overflow-y-auto p-1.5">
                {candidates.map((candidate, index) => {
                  const label = getCandidateLabel(candidate);
                  const planTitle = getBillingPlanTitle(
                    (candidate.planKey ?? "student") as BillingPlanKey
                  );

                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left transition-colors",
                        index === highlightedIndex
                          ? "bg-white/8 text-white"
                          : "text-white/75 hover:bg-white/[0.04] hover:text-white"
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        insertCandidate(candidate);
                      }}
                    >
                      <Avatar className="size-8 ring ring-white/8">
                        <AvatarImage
                          alt={label}
                          src={candidate.image ?? undefined}
                        />
                        <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-white/75">
                          {getInitials(label)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          @{candidate.username}
                        </div>
                        <div className="truncate text-xs text-white/45">
                          {label}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium",
                          getPlanBadgeClassName(candidate.planKey)
                        )}
                      >
                        {planTitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => {
            const label = getCandidateLabel(user);

            return (
              <div
                key={user.username}
                className="inline-flex items-center gap-2 rounded-full ring ring-white/10 bg-white/[0.04] px-2 py-1"
              >
                <Avatar className="size-5 ring ring-white/8">
                  <AvatarImage alt={label} src={user.image ?? undefined} />
                  <AvatarFallback className="bg-sidebar-accent text-[9px] font-semibold text-white/75">
                    {getInitials(label)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-white/75">@{user.username}</span>
                <button
                  type="button"
                  className="inline-flex size-4 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/8 hover:text-white/75"
                  onClick={() => removeCandidate(user.username)}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="text-xs text-white/40">
        {shareId
          ? "Type `@` to search and add viewers. Selected users send automatically after a short pause and can be removed before then."
          : "Type `@` to search and queue viewers. Selected users appear below and can be removed before you create the share."}
      </p>
    </div>
  );
}
