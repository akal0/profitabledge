"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronRight,
  Trophy,
} from "lucide-react";

import { AccountCardActionsMenu } from "@/features/accounts/components/account-card-actions-menu";
import { DeleteAccountButton } from "@/features/accounts/components/delete-account-button";
import { RemovePropAccountButton } from "@/features/accounts/components/remove-prop-account-button";
import { ManualPropAccountDialog } from "@/features/accounts/components/manual-prop-account-dialog";
import {
  getAccountImage,
  getAccountSourceBadge,
} from "@/features/accounts/lib/account-metadata";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { WIDGET_CONTENT_SEPARATOR_CLASS } from "@/features/dashboard/widgets/lib/widget-shared";
import { PropAccountStatusBadges } from "@/components/prop-account-status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";
import {
  AccountWidgetFrame,
  BrokerAccountAvatar,
  HEADER_BADGE_CLASS,
  PropFirmAvatar,
  formatUsd,
  getAccountBalance,
  getAccountEquity,
  type PropFirmOption,
} from "./account-section-shell";
import type { AccountRecord } from "./account-section-shell";

export function isCurrentPropStageAccount(account: AccountRecord) {
  return account.isPropAccount && account.propIsCurrentChallengeStage !== false;
}

function AccountTagList({ account }: { account: AccountRecord }) {
  const tags = Array.isArray(account.tags) ? account.tags : [];

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.slice(0, 6).map((tag: string) => (
        <span
          key={tag}
          className="rounded-sm border border-white/10 bg-sidebar px-2 py-0.5 text-[10px] font-medium text-white/65"
        >
          {tag}
        </span>
      ))}
      {tags.length > 6 ? (
        <span className="rounded-sm border border-white/10 bg-sidebar px-2 py-0.5 text-[10px] font-medium text-white/40">
          +{tags.length - 6}
        </span>
      ) : null}
    </div>
  );
}

export function ArchivedAccountCard({ account }: { account: AccountRecord }) {
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
      className="ring-1 ring-white/10"
      contentClassName="justify-between"
      headerRight={
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              HEADER_BADGE_CLASS,
              "ring-1 ring-white/10 text-[10px] text-white/45"
            )}
          >
            Archived
          </Badge>
          <DeleteAccountButton account={account} />
        </div>
      }
    >
      <div>
        <p className="text-xs text-white/40">{account.broker}</p>
        <p className="mt-2 text-lg font-semibold text-white/75">
          {formatUsd(balance)}
        </p>
        <AccountTagList account={account} />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-sm ring-1 ring-white/8 px-3 text-xs text-white/65 hover:bg-sidebar hover:text-white"
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

export function BrokerAccountCard({ account }: { account: AccountRecord }) {
  const balance = getAccountBalance(account);
  const equity = getAccountEquity(account);
  const sourceBadge = getAccountSourceBadge(account);
  const brokerLabel = account.broker || "Broker account";
  const detectedPropFirmLabel =
    String(account.propDetectedFirmId || "").toLowerCase() === "ftmo"
      ? "FTMO"
      : "a prop firm";

  return (
    <AccountWidgetFrame
      icon={Building2}
      title={account.name}
      headerRight={
        <div className="flex items-center gap-1.5">
          <ManualPropAccountDialog account={account} />
          <Badge
            variant="outline"
            className={cn(HEADER_BADGE_CLASS, sourceBadge.className)}
          >
            {sourceBadge.label}
          </Badge>
          <AccountCardActionsMenu account={account} />
        </div>
      }
      contentClassName="justify-between"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={getAccountImage(account)}
            alt={brokerLabel}
            className="size-8 object-contain"
          />
          <div>
            <p className="text-sm font-semibold text-white">{brokerLabel}</p>
            <p className="mt-0.5 text-xs font-medium text-white/50 truncate max-w-[180px]">
              {account.name}
            </p>
            <AccountTagList account={account} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-white/45">Balance</p>
          <p className="mt-0.5 text-lg font-medium tracking-tight text-teal-400">
            {formatUsd(balance)}
          </p>
        </div>
      </div>

      <Separator
        className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
      />

      <div className="flex flex-wrap items-start justify-between gap-y-4">
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Balance</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {formatUsd(balance)}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Equity</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {equity !== null ? formatUsd(equity) : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Broker</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {brokerLabel}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Prop match</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {account.propDetectedFirmId ? detectedPropFirmLabel : "None"}
          </p>
        </div>
      </div>

      <Link href={`/dashboard?accountId=${account.id}`} className="mt-5 block">
        <Button
          className={getPropAssignActionButtonClassName({
            tone: "teal",
            size: "sm",
            className: "w-full gap-0.5",
          })}
        >
          View dashboard
          <ChevronRight className="size-3" />
        </Button>
      </Link>
    </AccountWidgetFrame>
  );
}

export function PropAccountCard({ account }: { account: AccountRecord }) {
  const { data: dashboard } = useQuery({
    ...trpcOptions.propFirms.getTrackerDashboard.queryOptions({
      accountId: account.id,
    }),
    enabled: !!account.isPropAccount,
  });

  const balance = getAccountBalance(account);
  const propFirm: PropFirmOption = {
    id: account.propFirmId || "",
    displayName:
      dashboard?.propFirm?.displayName || account.broker || "Prop firm",
    description: dashboard?.propFirm?.description,
  };
  const currentProfitPercent =
    dashboard?.ruleCheck?.metrics?.currentProfitPercent ??
    parseFloat(account.propPhaseCurrentProfitPercent || "0");
  const tradingDays =
    dashboard?.ruleCheck?.metrics?.tradingDays ??
    account.propPhaseTradingDays ??
    0;
  const minTradingDays = dashboard?.currentPhase?.minTradingDays || 0;
  const hasPhase =
    account.propCurrentPhase !== null && account.propCurrentPhase !== undefined;
  const phaseLabel =
    account.propCurrentPhase === 0
      ? "Funded"
      : dashboard?.currentPhase?.name ||
        `Phase ${account.propCurrentPhase || 1}`;
  const phaseTarget = dashboard?.currentPhase?.profitTarget || 10;

  return (
    <AccountWidgetFrame
      icon={Trophy}
      title={propFirm.displayName || "Prop firm"}
      headerRight={
        <div className="flex items-center gap-1.5">
          <PropAccountStatusBadges
            account={account}
            dashboard={dashboard}
            badgeClassName={HEADER_BADGE_CLASS}
          />
          <RemovePropAccountButton
            accountId={account.id}
            accountName={account.name}
          />
          <AccountCardActionsMenu account={account} />
        </div>
      }
      contentClassName="justify-between"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropFirmAvatar
            firm={propFirm}
            className="size-12 shrink-0 rounded-full!"
          />
          <div>
            <p className="text-sm font-semibold text-white">
              {propFirm.displayName}
            </p>
            <p className="mt-0.5 text-xs font-medium text-white/50 truncate max-w-[180px]">
              {account.name}
            </p>
            <AccountTagList account={account} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/50">Balance</p>
          <p className="mt-0.5 text-lg font-medium tracking-tight text-teal-400">
            {formatUsd(balance)}
          </p>
        </div>
      </div>

      <Separator
        className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
      />

      {hasPhase ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mt-1 text-sm font-semibold text-white">
                {phaseLabel}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  currentProfitPercent >= 0 ? "text-teal-400" : "text-red-400"
                )}
              >
                {currentProfitPercent >= 0 ? "+" : ""}
                {currentProfitPercent.toFixed(2)}%
              </p>
            </div>
          </div>

          <Separator
            className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-y-4">
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Trading days</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {tradingDays}
            {minTradingDays > 0 ? ` / ${minTradingDays}` : ""}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Max DD</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {dashboard?.ruleCheck
              ? `${dashboard.ruleCheck.metrics.maxDrawdownPercent.toFixed(2)}%`
              : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Daily DD</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {dashboard?.ruleCheck
              ? `${dashboard.ruleCheck.metrics.dailyDrawdownPercent.toFixed(
                  2
                )}%`
              : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Target</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {phaseTarget}%
          </p>
        </div>
      </div>

      <Link
        href={`/dashboard/prop-tracker/${account.id}`}
        className="mt-5 block"
      >
        <Button
          className={getPropAssignActionButtonClassName({
            tone: "teal",
            size: "sm",
            className: "w-full gap-0.5",
          })}
        >
          View tracker
          <ChevronRight className="size-3" />
        </Button>
      </Link>
    </AccountWidgetFrame>
  );
}
