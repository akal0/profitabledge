"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Building2,
  ChevronRight,
  type LucideIcon,
  Plus,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { AddAccountSheet } from "@/components/dashboard/sidebar/add-account-sheet";
import {
  WidgetLoading,
  WidgetWrapper,
} from "@/components/dashboard/widget-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

type AccountRecord = any;

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function getAccountBalance(account: AccountRecord) {
  return parseFloat(account.liveBalance || account.initialBalance || "0");
}

function getAccountEquity(account: AccountRecord) {
  return account.liveEquity ? parseFloat(account.liveEquity) : null;
}

function SectionHeader({
  icon: Icon,
  label,
  count,
  action,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-3.5 text-white/45" />
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </h2>
      <Badge
        variant="outline"
        className="h-5 rounded-sm border-white/10 px-1.5 text-[10px] text-white/55"
      >
        {count}
      </Badge>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

function AccountsEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onAccountCreated,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onAccountCreated: () => void;
}) {
  return (
    <WidgetWrapper
      icon={Icon}
      title={title}
      showHeader
      className="h-auto"
      contentClassName="h-auto flex-col items-center justify-center px-6 py-10 text-center"
    >
      <Icon className="mb-4 size-8 text-white/20" />
      <p className="max-w-sm text-xs text-white/40">{description}</p>
      <div className="mt-5">
        <AddAccountSheet
          onAccountCreated={onAccountCreated}
          trigger={
            <Button className="h-8 rounded-sm border border-white/5 bg-sidebar text-xs text-white hover:bg-sidebar-accent hover:brightness-110">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {ctaLabel}
            </Button>
          }
        />
      </div>
    </WidgetWrapper>
  );
}

function AccountWidgetFrame({
  icon,
  title,
  headerRight,
  className,
  contentClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  headerRight?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <WidgetWrapper
      icon={icon}
      title={title}
      headerRight={headerRight}
      showHeader
      className={cn("h-auto", className)}
      contentClassName={cn("h-auto flex-col p-3.5", contentClassName)}
    >
      {children}
    </WidgetWrapper>
  );
}

export default function AccountsPage() {
  const { data: accounts, isLoading } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  );
  const { data: archivedData } = useQuery(
    trpcOptions.accounts.getArchivedIds.queryOptions()
  );
  const [showArchived, setShowArchived] = useState(false);

  const archivedIds = new Set<string>(archivedData?.archivedAccounts || []);
  const allBrokerAccounts =
    accounts?.filter((account: AccountRecord) => !account.isPropAccount) || [];
  const allPropAccounts =
    accounts?.filter((account: AccountRecord) => account.isPropAccount) || [];

  const brokerAccounts = allBrokerAccounts.filter(
    (account: AccountRecord) => !archivedIds.has(account.id)
  );
  const propAccounts = allPropAccounts.filter(
    (account: AccountRecord) => !archivedIds.has(account.id)
  );
  const archivedAccounts = (accounts || []).filter((account: AccountRecord) =>
    archivedIds.has(account.id)
  );

  const handleAccountCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  if (isLoading) {
    return (
      <main className="space-y-5 p-6 py-4">
        <div className="flex justify-end">
          <div className="h-9 w-32 animate-pulse rounded-sm border border-white/5 bg-sidebar" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <WidgetLoading key={key} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-5 p-6 py-4">
      <div className="flex justify-end">
        <AddAccountSheet
          onAccountCreated={handleAccountCreated}
          trigger={
            <Button className="h-9 rounded-sm border border-white/5 bg-sidebar text-xs text-white hover:bg-sidebar-accent hover:brightness-110">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Account
            </Button>
          }
        />
      </div>

      <section className="space-y-3">
        <SectionHeader
          icon={Building2}
          label="Broker Accounts"
          count={brokerAccounts.length}
        />

        {brokerAccounts.length === 0 ? (
          <AccountsEmptyState
            icon={Building2}
            title="No broker accounts"
            description="Add your first broker account to start tracking balances, syncs, and trade history."
            ctaLabel="Add Broker Account"
            onAccountCreated={handleAccountCreated}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {brokerAccounts.map((account: AccountRecord) => (
              <BrokerAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          icon={Trophy}
          label="Prop Accounts"
          count={propAccounts.length}
        />

        {propAccounts.length === 0 ? (
          <AccountsEmptyState
            icon={Trophy}
            title="No prop accounts"
            description="Recognized prop brokers now classify automatically. Add one to start challenge tracking."
            ctaLabel="Add Prop Account"
            onAccountCreated={handleAccountCreated}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {propAccounts.map((account: AccountRecord) => (
              <PropAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      {archivedAccounts.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            icon={Archive}
            label="Archived"
            count={archivedAccounts.length}
            action={
              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
                className="text-[11px] text-white/35 transition-colors hover:text-white/70"
              >
                {showArchived ? "Hide" : "Show"}
              </button>
            }
          />

          {showArchived ? (
            <div className="grid gap-3 opacity-70 md:grid-cols-2 xl:grid-cols-3">
              {archivedAccounts.map((account: AccountRecord) => (
                <ArchivedAccountCard key={account.id} account={account} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function ArchivedAccountCard({ account }: { account: AccountRecord }) {
  const balance = getAccountBalance(account);
  const unarchiveMutation = useMutation({
    mutationFn: (input: { accountId: string; archive: boolean }) =>
      trpcClient.accounts.toggleArchive.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return (
    <AccountWidgetFrame
      icon={Archive}
      title={account.name}
      className="border-dashed border-white/10"
      contentClassName="justify-between"
      headerRight={
        <Badge
          variant="outline"
          className="h-5 rounded-sm border-white/10 px-1.5 text-[10px] text-white/45"
        >
          Archived
        </Badge>
      }
    >
      <div>
        <p className="text-xs text-white/40">{account.broker}</p>
        <p className="mt-2 text-lg font-semibold text-white/75">
          {formatUsd(balance)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-sm border-white/10 px-3 text-xs text-white/65 hover:bg-sidebar hover:text-white"
        onClick={() =>
          unarchiveMutation.mutate({
            accountId: account.id,
            archive: false,
          })
        }
        disabled={unarchiveMutation.isPending}
      >
        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
        Restore
      </Button>
    </AccountWidgetFrame>
  );
}

function BrokerAccountCard({ account }: { account: AccountRecord }) {
  const balance = getAccountBalance(account);
  const equity = getAccountEquity(account);
  const isVerified = account.isVerified === 1;
  const archiveMutation = useMutation({
    mutationFn: (input: { accountId: string; archive: boolean }) =>
      trpcClient.accounts.toggleArchive.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const trackRecordMutation = useMutation({
    mutationFn: (input: { accountId: string }) =>
      trpcClient.accounts.generateTrackRecord.mutate(input),
    onSuccess: (data: any) => {
      const url = `${window.location.origin}/verified/${data.shareId}`;
      navigator.clipboard.writeText(url);
      toast.success("Track record generated. Link copied to clipboard.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate track record");
    },
  });

  return (
    <AccountWidgetFrame
      icon={Building2}
      title={account.name}
      headerRight={
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "h-5 rounded-sm px-1.5 text-[10px] font-medium",
              isVerified
                ? "border-teal-500/30 bg-teal-500/15 text-teal-400"
                : "border-white/10 bg-sidebar text-white/50"
            )}
          >
            {isVerified ? "EA Synced" : "Manual"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-sm border-white/10 bg-sidebar px-2 text-xs text-white/35 hover:bg-sidebar hover:text-emerald-400"
            onClick={() =>
              trackRecordMutation.mutate({ accountId: account.id })
            }
            disabled={trackRecordMutation.isPending}
            title="Generate verified track record"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-sm border-white/10 bg-sidebar px-2 text-xs text-white/35 hover:bg-sidebar hover:text-white"
            onClick={() =>
              archiveMutation.mutate({ accountId: account.id, archive: true })
            }
            disabled={archiveMutation.isPending}
            title="Archive account"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
      contentClassName="justify-between"
    >
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
          Broker
        </p>
        <p className="mt-1 text-sm text-white/75">{account.broker}</p>
      </div>

      {account.propDetectedFirmId ? (
        <div className="mt-4 rounded-sm border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">
                Prop firm detected
              </p>
              <p className="mt-1 text-xs text-amber-100/70">
                Broker details matched a prop firm pattern but still need
                review.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
            Balance
          </p>
          <p className="mt-1 text-2xl font-medium text-teal-400">
            {formatUsd(balance)}
          </p>
        </div>

        {equity !== null ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Equity
            </p>
            <p className="mt-1 text-lg font-medium text-white/85">
              {formatUsd(equity)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="pt-5">
        <Link href={`/dashboard?accountId=${account.id}`} className="block">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full rounded-sm border-white/10 bg-sidebar text-xs text-white/70 hover:bg-sidebar hover:text-white"
          >
            View Dashboard
            <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </AccountWidgetFrame>
  );
}

function PropAccountCard({ account }: { account: AccountRecord }) {
  const { data: dashboard } = useQuery({
    ...trpcOptions.propFirms.getTrackerDashboard.queryOptions({
      accountId: account.id,
    }),
    enabled: !!account.isPropAccount,
  });

  const balance = getAccountBalance(account);
  const currentProfitPercent = parseFloat(
    account.propPhaseCurrentProfitPercent || "0"
  );

  const statusInfo = (() => {
    switch (account.propPhaseStatus) {
      case "active":
        return {
          label: "Active",
          className: "border-blue-500/30 bg-blue-500/15 text-blue-400",
        };
      case "passed":
        return {
          label: "Passed",
          className: "border-teal-500/30 bg-teal-500/15 text-teal-400",
        };
      case "failed":
        return {
          label: "Failed",
          className: "border-red-500/30 bg-red-500/15 text-red-400",
        };
      default:
        return {
          label: "Unknown",
          className:
            "border-white/10 bg-black/10 text-white/50 dark:bg-sidebar",
        };
    }
  })();

  const phaseTarget = dashboard?.currentPhase?.profitTarget || 10;
  const progressPercent = Math.min(
    Math.max((currentProfitPercent / phaseTarget) * 100, 0),
    100
  );

  return (
    <AccountWidgetFrame
      icon={Trophy}
      title={dashboard?.propFirm?.displayName || account.broker || "Prop Firm"}
      headerRight={
        <Badge
          variant="outline"
          className={cn(
            "h-5 rounded-sm px-1.5 text-[10px] font-medium",
            statusInfo.className
          )}
        >
          {statusInfo.label}
        </Badge>
      }
      contentClassName="justify-between"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
            Account
          </p>
          <p className="mt-1 text-sm text-white/75">{account.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
            Balance
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatUsd(balance)}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-sm border border-white/5 bg-sidebar p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/35">
          <span>
            Phase {account.propCurrentPhase || 1}
            {account.propCurrentPhase === 0 ? " Funded" : ""}
          </span>
          <span>Target {phaseTarget}%</span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-white/40">Progress</p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold",
                currentProfitPercent >= 0 ? "text-teal-400" : "text-red-400"
              )}
            >
              {currentProfitPercent >= 0 ? "+" : ""}
              {currentProfitPercent.toFixed(2)}%
            </p>
          </div>
          <p className="text-xs text-white/40">
            {dashboard?.ruleCheck?.metrics?.tradingDays ??
              account.propPhaseTradingDays ??
              0}{" "}
            days
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-black/20">
          <div
            className={cn(
              "h-full transition-all",
              currentProfitPercent >= 0 ? "bg-teal-500" : "bg-red-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {dashboard?.ruleCheck ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-sm border border-white/5 bg-sidebar p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Trading Days
            </p>
            <p className="mt-2 text-sm font-semibold text-white/80">
              {account.propPhaseTradingDays || 0} /{" "}
              {dashboard.currentPhase?.minTradingDays || 0}
            </p>
          </div>
          <div className="rounded-sm border border-white/5 bg-sidebar p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Max DD
            </p>
            <p className="mt-2 text-sm font-semibold text-white/80">
              {dashboard.ruleCheck.metrics.maxDrawdownPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      ) : null}

      <Link
        href={`/dashboard/prop-tracker/${account.id}`}
        className="mt-auto pt-5"
      >
        <Button className="h-8 w-full rounded-sm bg-teal-600 text-xs text-white hover:bg-teal-500">
          View Tracker
          <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </Link>
    </AccountWidgetFrame>
  );
}
