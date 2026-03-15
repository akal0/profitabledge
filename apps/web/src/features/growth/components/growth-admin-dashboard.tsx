"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, BadgePercent, Copy, Shield, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GrowthCardShell,
  GrowthPageBody,
  GrowthPageShell,
} from "@/features/growth/components/growth-page-primitives";
import { trpcOptions } from "@/utils/trpc";

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents ?? 0) / 100);
}

function formatStatusLabel(status?: string | null) {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatPaymentMethodType(methodType?: string | null) {
  if (!methodType) return "Other";
  return methodType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function GrowthAdminDashboard() {
  const [betaForm, setBetaForm] = useState({
    label: "",
    description: "",
    code: "",
    maxRedemptions: "",
  });

  const billingStateQuery = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const betaCodesQuery = useQuery({
    ...trpcOptions.billing.listPrivateBetaCodes.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const affiliateApplicationsQuery = useQuery({
    ...trpcOptions.billing.listAffiliateApplications.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const waitlistEntriesQuery = useQuery({
    ...trpcOptions.billing.listPrivateBetaWaitlistEntries.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const affiliatePayoutQueueQuery = useQuery({
    ...trpcOptions.billing.listAffiliatePayoutQueue.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });

  const createPrivateBetaCode = useMutation(
    trpcOptions.billing.createPrivateBetaCode.mutationOptions()
  );
  const approveAffiliate = useMutation({
    ...trpcOptions.billing.approveAffiliate.mutationOptions(),
    onSuccess: () => {
      void affiliateApplicationsQuery.refetch();
      void billingStateQuery.refetch();
      toast.success("Affiliate approved");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to approve affiliate"
      );
    },
  });
  const rejectAffiliate = useMutation({
    ...trpcOptions.billing.rejectAffiliate.mutationOptions(),
    onSuccess: () => {
      void affiliateApplicationsQuery.refetch();
      toast.success("Affiliate application rejected");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to reject affiliate"
      );
    },
  });
  const updateWaitlistEntry = useMutation({
    ...trpcOptions.billing.updatePrivateBetaWaitlistEntry.mutationOptions(),
    onSuccess: () => {
      void waitlistEntriesQuery.refetch();
      toast.success("Waitlist entry updated");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to update waitlist"
      );
    },
  });
  const recordAffiliatePayout = useMutation({
    ...trpcOptions.billing.recordAffiliatePayout.mutationOptions(),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      toast.success("Affiliate payout recorded");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to record payout"
      );
    },
  });

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Unable to copy right now");
    }
  };

  const handleCreateBetaCode = async () => {
    if (!betaForm.label.trim()) {
      toast.error("Label is required");
      return;
    }

    const parsed = betaForm.maxRedemptions.trim()
      ? Number(betaForm.maxRedemptions)
      : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast.error("Max redemptions must be a positive number");
      return;
    }

    try {
      await createPrivateBetaCode.mutateAsync({
        label: betaForm.label.trim(),
        description: betaForm.description.trim() || undefined,
        code: betaForm.code.trim() || undefined,
        maxRedemptions: parsed ? Math.floor(parsed) : null,
      });
      setBetaForm({ label: "", description: "", code: "", maxRedemptions: "" });
      toast.success("Beta code created");
      void betaCodesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create beta code"
      );
    }
  };

  const handleWaitlistStatusUpdate = async (
    entryId: string,
    status: string
  ) => {
    await updateWaitlistEntry.mutateAsync({
      entryId,
      status,
    });
  };

  const handleRecordAffiliatePayout = async (affiliateUserId: string) => {
    await recordAffiliatePayout.mutateAsync({
      affiliateUserId,
    });
  };

  if (billingStateQuery.isLoading) {
    return (
      <GrowthPageShell
        title="Growth admin"
        description="Manage private beta access, affiliate approvals, waitlist review, and payouts"
      >
        <GrowthPageBody className="space-y-4">
          <div className="h-36 animate-pulse rounded-sm bg-sidebar" />
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-sm bg-sidebar"
              />
            ))}
          </div>
        </GrowthPageBody>
      </GrowthPageShell>
    );
  }

  if (billingStateQuery.data?.admin?.isAdmin !== true) {
    return (
      <GrowthPageShell
        title="Growth admin"
        description="Manage private beta access, affiliate approvals, waitlist review, and payouts"
      >
        <GrowthPageBody>
          <GrowthCardShell className="max-w-2xl">
            <div className="p-6">
              <p className="text-sm font-medium text-white">Admin access required</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                This route is only available to allowlisted admin accounts.
              </p>
            </div>
          </GrowthCardShell>
        </GrowthPageBody>
      </GrowthPageShell>
    );
  }

  return (
    <GrowthPageShell
      title="Growth admin"
      description="Manage private beta access, affiliate approvals, waitlist review, and payouts"
    >
      <GrowthPageBody className="space-y-6">
        <GrowthCardShell className="overflow-hidden">
          <div className="border-b border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6">
            <Badge className="rounded-full bg-teal-500/10 text-[10px] text-teal-200 ring ring-teal-500/15">
              Admin only
            </Badge>
            <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">
              Operational controls for growth access
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Issue beta codes, review affiliate applications, manage the waitlist,
              and record affiliate payouts from one route.
            </p>
          </div>
        </GrowthCardShell>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <GrowthCardShell>
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="size-3.5 text-teal-300" />
              <p className="text-xs font-medium text-white">Create beta code</p>
            </div>
            <div className="grid gap-3">
              <div>
                <Label className="text-[10px] text-white/40">Label</Label>
                <Input
                  value={betaForm.label}
                  onChange={(event) =>
                    setBetaForm((state) => ({
                      ...state,
                      label: event.target.value,
                    }))
                  }
                  placeholder="March rollout cohort"
                  className="mt-1.5 ring-white/5 bg-sidebar text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-white/40">Description</Label>
                <Input
                  value={betaForm.description}
                  onChange={(event) =>
                    setBetaForm((state) => ({
                      ...state,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Optional internal note"
                  className="mt-1.5 ring-white/5 bg-sidebar text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-white/40">Custom code</Label>
                <Input
                  value={betaForm.code}
                  onChange={(event) =>
                    setBetaForm((state) => ({
                      ...state,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Optional"
                  className="mt-1.5 ring-white/5 bg-sidebar text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-white/40">
                  Max redemptions
                </Label>
                <Input
                  value={betaForm.maxRedemptions}
                  onChange={(event) =>
                    setBetaForm((state) => ({
                      ...state,
                      maxRedemptions: event.target.value,
                    }))
                  }
                  placeholder="Unlimited"
                  className="mt-1.5 ring-white/5 bg-sidebar text-xs"
                />
              </div>
            </div>
            <Button
              onClick={handleCreateBetaCode}
              disabled={createPrivateBetaCode.isPending}
              className="mt-4 h-9 rounded-sm bg-teal-600 px-4 text-xs text-white hover:brightness-110"
            >
              {createPrivateBetaCode.isPending ? "Creating..." : "Create beta code"}
            </Button>
          </div>
        </GrowthCardShell>

        <GrowthCardShell>
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="size-3.5 text-amber-300" />
              <p className="text-xs font-medium text-white">Issued beta codes</p>
            </div>
            <div className="space-y-2">
              {betaCodesQuery.data?.length ? (
                betaCodesQuery.data.map((code) => {
                  const remaining =
                    code.maxRedemptions === null
                      ? "Unlimited"
                      : `${code.redeemedCount}/${code.maxRedemptions}`;

                  return (
                    <div
                      key={code.id}
                      className="rounded-sm ring ring-white/5 bg-sidebar-accent p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-white">
                            {code.label}
                          </p>
                          <p className="text-[10px] text-white/35">
                            {code.description || "No description"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              code.isActive
                                ? "ring ring-teal-500/20 bg-teal-900/30 text-[10px] text-teal-300"
                                : "ring ring-rose-500/20 bg-rose-900/30 text-[10px] text-rose-300"
                            }
                          >
                            {code.isActive ? "Active" : "Disabled"}
                          </Badge>
                          <Button
                            onClick={() =>
                              copyToClipboard(code.code, "Beta code copied")
                            }
                            className="h-7 gap-1 rounded-sm ring ring-white/5 bg-sidebar px-2.5 text-[10px] text-white hover:brightness-110"
                          >
                            <Copy className="size-3" />
                            Copy
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1 text-[10px] text-white/35 sm:grid-cols-3">
                        <span>Code: {code.code}</span>
                        <span>Redemptions: {remaining}</span>
                        <span>Expires: {formatDate(code.expiresAt)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
                  No beta codes created yet.
                </div>
              )}
            </div>
          </div>
        </GrowthCardShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GrowthCardShell>
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Banknote className="size-3.5 text-emerald-300" />
              <p className="text-xs font-medium text-white">Affiliate payouts</p>
            </div>

            <div className="space-y-2">
              {affiliatePayoutQueueQuery.data?.length ? (
                affiliatePayoutQueueQuery.data.map((entry) => {
                  const canRecordPayout =
                    entry.summary.availableAmount > 0 &&
                    Boolean(entry.defaultPaymentMethod);
                  const latestPayout = entry.recentPayouts[0] ?? null;
                  const isRecordingThisPayout =
                    recordAffiliatePayout.isPending &&
                    recordAffiliatePayout.variables?.affiliateUserId ===
                      entry.affiliate.id;

                  return (
                    <div
                      key={entry.affiliate.id}
                      className="rounded-sm ring ring-white/5 bg-sidebar-accent p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-white">
                            {entry.affiliate.name || entry.affiliate.email}
                          </p>
                          <p className="text-[10px] text-white/35">
                            {entry.affiliate.email} • Code {entry.affiliate.code}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="ring ring-emerald-500/20 bg-emerald-900/30 text-[10px] text-emerald-300">
                            {formatCurrency(entry.summary.availableAmount)} ready
                          </Badge>
                          <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                            {entry.summary.availableEventCount} unpaid event
                            {entry.summary.availableEventCount === 1 ? "" : "s"}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 text-[11px] text-white/40 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
                            Default method
                          </p>
                          <p className="mt-1 text-white/60">
                            {entry.defaultPaymentMethod
                              ? `${entry.defaultPaymentMethod.label} · ${formatPaymentMethodType(
                                  entry.defaultPaymentMethod.methodType
                                )}`
                              : "No method on file"}
                          </p>
                          {entry.defaultPaymentMethod?.recipientName ? (
                            <p className="mt-1">
                              Recipient: {entry.defaultPaymentMethod.recipientName}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
                            Last payout
                          </p>
                          <p className="mt-1 text-white/60">
                            {latestPayout
                              ? `${formatCurrency(latestPayout.amount)} on ${formatDate(
                                  latestPayout.paidAt ?? latestPayout.createdAt
                                )}`
                              : "No payout recorded yet"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] text-white/35">
                          {canRecordPayout
                            ? "Record the full currently unpaid commission as sent."
                            : entry.defaultPaymentMethod
                              ? "Nothing is available to pay out yet."
                              : "This affiliate needs to add a payment method first."}
                        </p>

                        <Button
                          onClick={() =>
                            handleRecordAffiliatePayout(entry.affiliate.id)
                          }
                          disabled={
                            !canRecordPayout || recordAffiliatePayout.isPending
                          }
                          className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                        >
                          {isRecordingThisPayout ? "Recording..." : "Record payout"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
                  No approved affiliates have payout data yet.
                </div>
              )}
            </div>
          </div>
        </GrowthCardShell>

        <div className="space-y-4">
          <GrowthCardShell>
            <div className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <BadgePercent className="size-3.5 text-blue-300" />
                <p className="text-xs font-medium text-white">
                  Affiliate applications
                </p>
              </div>
              <div className="space-y-2">
                {affiliateApplicationsQuery.data?.length ? (
                  affiliateApplicationsQuery.data.map((entry) => (
                    <div
                      key={entry.application.id}
                      className="rounded-sm ring ring-white/5 bg-sidebar-accent p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-white">
                            {entry.user.name || entry.user.email}
                          </p>
                          <p className="text-[10px] text-white/35">
                            {entry.user.email}
                          </p>
                          <p className="mt-2 text-[11px] leading-5 text-white/40">
                            {entry.application.message || "No application note"}
                          </p>
                        </div>
                        <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                          {formatStatusLabel(entry.application.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            approveAffiliate.mutate({
                              applicationId: entry.application.id,
                            })
                          }
                          disabled={approveAffiliate.isPending}
                          className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() =>
                            rejectAffiliate.mutate({
                              applicationId: entry.application.id,
                            })
                          }
                          disabled={rejectAffiliate.isPending}
                          className="h-8 rounded-sm bg-rose-600 px-3 text-[11px] text-white hover:brightness-110"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
                    No affiliate applications yet.
                  </div>
                )}
              </div>
            </div>
          </GrowthCardShell>

          <GrowthCardShell>
            <div className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <Users className="size-3.5 text-violet-300" />
                <p className="text-xs font-medium text-white">Waitlist queue</p>
              </div>
              <div className="space-y-2">
                {waitlistEntriesQuery.data?.length ? (
                  waitlistEntriesQuery.data.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-sm ring ring-white/5 bg-sidebar-accent p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-white">
                            {entry.email}
                          </p>
                          <p className="text-[10px] text-white/35">
                            Source: {entry.source || "root"} • Joined{" "}
                            {formatDate(entry.createdAt)}
                          </p>
                          {entry.notes ? (
                            <p className="mt-2 text-[11px] leading-5 text-white/40">
                              {entry.notes}
                            </p>
                          ) : null}
                        </div>
                        <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                          {formatStatusLabel(entry.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            handleWaitlistStatusUpdate(entry.id, "reviewing")
                          }
                          disabled={updateWaitlistEntry.isPending}
                          className="h-8 rounded-sm bg-sidebar px-3 text-[11px] text-white ring ring-white/5 hover:brightness-110"
                        >
                          Mark reviewing
                        </Button>
                        <Button
                          onClick={() =>
                            handleWaitlistStatusUpdate(entry.id, "invited")
                          }
                          disabled={updateWaitlistEntry.isPending}
                          className="h-8 rounded-sm bg-blue-600 px-3 text-[11px] text-white hover:brightness-110"
                        >
                          Mark invited
                        </Button>
                        <Button
                          onClick={() =>
                            handleWaitlistStatusUpdate(entry.id, "archived")
                          }
                          disabled={updateWaitlistEntry.isPending}
                          className="h-8 rounded-sm bg-white/10 px-3 text-[11px] text-white hover:bg-white/15"
                        >
                          Archive
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
                    No waitlist entries yet.
                  </div>
                )}
              </div>
            </div>
          </GrowthCardShell>
        </div>
      </div>
      </GrowthPageBody>
    </GrowthPageShell>
  );
}
