"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookLock, Clock3, ShieldX } from "lucide-react";

import { JournalShareReader } from "@/components/journal/share/reader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { buildLoginPath, buildSignUpPath } from "@/lib/post-auth-paths";
import { useConfirmedSession } from "@/lib/use-confirmed-session";
import { trpc } from "@/utils/trpc";

function buildJournalSharePath(shareToken: string) {
  return `/share/journal/${shareToken}`;
}

function ShareStateCard({
  title,
  description,
  action,
  accent = "teal",
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  accent?: "teal" | "amber" | "rose";
}) {
  const accentClasses = {
    teal: "ring-teal-400/15 bg-teal-400/6 text-teal-100",
    amber: "ring-amber-400/15 bg-amber-400/6 text-amber-100",
    rose: "ring-rose-400/15 bg-rose-400/6 text-rose-100",
  } as const;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] px-6 py-10 text-center text-white min-w-screen">
      <div
        className={`w-full max-w-xl rounded-2xl ring px-6 py-8 ${accentClasses[accent]}`}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full ring ring-current/20 bg-black/20">
          <BookLock className="size-5" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-current/75">{description}</p>
        {action ? (
          <div className="mt-6 flex justify-center">{action}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function JournalSharePage() {
  const params = useParams<{ shareToken: string }>();
  const router = useRouter();
  const shareToken =
    typeof params?.shareToken === "string" ? params.shareToken : "";
  const returnTo = useMemo(
    () => buildJournalSharePath(shareToken),
    [shareToken]
  );
  const loginPath = useMemo(() => buildLoginPath(returnTo), [returnTo]);
  const signUpPath = useMemo(() => buildSignUpPath(returnTo), [returnTo]);
  const {
    hasConfirmedSession,
    hasAttemptedSessionRecovery,
    isRecoveringSession,
    isSessionPending,
  } = useConfirmedSession();
  const utils = trpc.useUtils() as any;
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionPending || isRecoveringSession) {
      return;
    }

    if (!hasConfirmedSession && hasAttemptedSessionRecovery) {
      router.replace(loginPath);
    }
  }, [
    hasAttemptedSessionRecovery,
    hasConfirmedSession,
    isRecoveringSession,
    isSessionPending,
    loginPath,
    router,
  ]);

  const gateQuery = trpc.journal.shares.resolveGate.useQuery(
    { shareToken },
    {
      enabled: Boolean(shareToken) && hasConfirmedSession,
      refetchInterval: (query) =>
        (query.state.data as any)?.gateState === "pending" ? 8000 : false,
    }
  );
  const requestAccess = trpc.journal.shares.requestAccess.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.journal.shares.resolveGate.invalidate({ shareToken }),
        utils.journal.shares.listEntries.invalidate({ shareToken }),
      ]);
    },
  });

  const gateState = gateQuery.data?.gateState;
  const canRead = gateState === "approved";

  const entriesQuery = trpc.journal.shares.listEntries.useQuery(
    { shareToken },
    { enabled: canRead }
  );

  useEffect(() => {
    if (!canRead) {
      setSelectedEntryId(null);
      return;
    }

    const firstEntryId = entriesQuery.data?.entries[0]?.id ?? null;
    if (!selectedEntryId && firstEntryId) {
      setSelectedEntryId(firstEntryId);
    }
  }, [canRead, entriesQuery.data, selectedEntryId]);

  const entryQuery = trpc.journal.shares.getEntry.useQuery(
    { shareToken, entryId: selectedEntryId! },
    {
      enabled: canRead && Boolean(selectedEntryId),
    }
  );

  if (!shareToken || isSessionPending || isRecoveringSession) {
    return (
      <RouteLoadingFallback
        route="journalShare"
        className="min-h-screen bg-[#0c0d10]"
      />
    );
  }

  if (!hasConfirmedSession) {
    return (
      <RouteLoadingFallback
        route="journalShare"
        className="min-h-screen bg-[#0c0d10]"
      />
    );
  }

  if (gateQuery.isLoading) {
    return (
      <RouteLoadingFallback
        route="journalShare"
        className="min-h-screen bg-[#0c0d10]"
      />
    );
  }

  if (!gateQuery.data || gateState === "inactive") {
    return (
      <ShareStateCard
        title="This share is no longer available"
        description="The owner has revoked or deactivated this private journal share."
        accent="rose"
      />
    );
  }

  if (gateState === "rejected") {
    return (
      <ShareStateCard
        title="Access was denied"
        description="The owner declined this access request. Ask them to invite or approve your account if you still need access."
        accent="rose"
      />
    );
  }

  if (gateState === "pending") {
    return (
      <ShareStateCard
        title="Access request pending"
        description="Your request has been sent to the owner. You’ll be able to open the shared journal as soon as they approve your account."
        accent="amber"
        action={
          <Badge
            variant="outline"
            className="ring-amber-300/20 bg-black/20 text-amber-100 py-2 gap-2"
          >
            <Clock3 className="size-3" />
            Waiting for approval
          </Badge>
        }
      />
    );
  }

  if (gateState === "requestable") {
    return (
      <ShareStateCard
        title="Request access to this journal share"
        description="This link only identifies the share. The owner still needs to approve your Profitabledge account before any pages become visible."
        action={
          <div className="flex flex-col items-center gap-3">
            <Button
              disabled={requestAccess.isPending}
              onClick={() => requestAccess.mutate({ shareToken })}
              className="ring-teal-400/15 bg-teal-400/6 text-teal-100 hover:bg-teal-400/25"
            >
              Request access
            </Button>
          </div>
        }
      />
    );
  }

  if (!canRead || entriesQuery.isLoading || entryQuery.isLoading) {
    return (
      <RouteLoadingFallback
        route="journalShare"
        className="min-h-screen bg-[#0c0d10]"
      />
    );
  }

  if (!gateQuery.data.share) {
    return (
      <ShareStateCard
        title="Share unavailable"
        description="The share metadata could not be loaded."
        accent="rose"
        action={
          <div className="inline-flex items-center gap-2 rounded-full ring ring-current/15 px-3 py-1.5 text-xs">
            <ShieldX className="size-3.5" />
            Metadata unavailable
          </div>
        }
      />
    );
  }

  return (
    <JournalShareReader
      share={gateQuery.data.share}
      entries={entriesQuery.data?.entries || []}
      selectedEntryId={selectedEntryId}
      selectedEntry={entryQuery.data?.entry ?? null}
      onSelectEntry={setSelectedEntryId}
    />
  );
}
