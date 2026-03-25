"use client";

import { useState, type MouseEvent, type RefObject } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isAllAccountsScope } from "@/stores/account";
import { useUploadThing } from "@/utils/uploadthing";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";
import {
  createWidgetShareSnapshotFile,
  exportWidgetAsPng,
} from "@/features/dashboard/widgets/lib/widget-share";
import {
  inferWidgetVerificationSurface,
  type WidgetVerificationSurface,
} from "@/features/dashboard/widgets/lib/widget-verification-surface";
import { useWidgetShareScope } from "@/features/dashboard/widgets/lib/widget-share-scope";
import { useDateRangeStore } from "@/stores/date-range";

export function WidgetShareButton({
  targetRef,
  title,
  accountId,
  verificationSurface,
  className,
  successMessage = "Widget PNG downloaded",
  errorMessage = "Failed to export widget PNG",
  tooltipLabel = "Share",
  buttonLabel,
}: {
  targetRef: RefObject<HTMLElement | null>;
  title: string;
  accountId?: string;
  verificationSurface?: WidgetVerificationSurface | null;
  className?: string;
  successMessage?: string;
  errorMessage?: string;
  tooltipLabel?: string;
  buttonLabel?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const { startUpload, isUploading } = useUploadThing(
    (router) => router.widgetSnapshotUploader
  );
  const resolvedAccountId = useWidgetShareScope(accountId);
  const shouldCreateWidgetShare =
    Boolean(resolvedAccountId) && !isAllAccountsScope(resolvedAccountId);
  const rangeStart = useDateRangeStore((state) => state.start);
  const rangeEnd = useDateRangeStore((state) => state.end);
  const resolvedVerificationSurface =
    verificationSurface ??
    inferWidgetVerificationSurface({
      title,
      start: rangeStart,
      end: rangeEnd,
    });

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();

    const target = targetRef.current;
    if (isExporting || isUploading || !target) {
      return;
    }

    try {
      setIsExporting(true);
      let verificationUrl: string | null = null;
      let verificationIdentity:
        | {
            username?: string | null;
            name?: string | null;
            imageUrl?: string | null;
          }
        | null = null;

      if (shouldCreateWidgetShare && resolvedAccountId) {
        try {
          const [stats, liveMetricsResult, currentUser, widgetSnapshotFile] =
            await Promise.all([
              queryClient.fetchQuery({
                ...trpcOptions.accounts.stats.queryOptions({
                  accountId: resolvedAccountId,
                }),
                staleTime: 0,
              }),
              queryClient
                .fetchQuery({
                  ...trpcOptions.accounts.liveMetrics.queryOptions({
                    accountId: resolvedAccountId,
                  }),
                  staleTime: 0,
                })
                .catch(() => null),
              queryClient.fetchQuery({
                ...trpcOptions.users.me.queryOptions(),
                staleTime: 0,
              }),
              createWidgetShareSnapshotFile({
                node: target,
                title,
              }),
            ]);
          const liveMetrics = liveMetricsResult as
            | {
                totalFloatingPL?: number | null;
                openTradesCount?: number | null;
              }
            | null;
          verificationIdentity = {
            username: currentUser.username ?? null,
            name: currentUser.displayName ?? currentUser.name ?? null,
            imageUrl: currentUser.image ?? null,
          };

          const uploadResult = await startUpload([widgetSnapshotFile]);
          const snapshotKey = uploadResult?.[0]?.key ?? null;

          if (snapshotKey) {
            const totalTrades =
              Number(stats.wins ?? 0) +
              Number(stats.losses ?? 0) +
              Number(stats.breakeven ?? 0);
            const verification =
              await trpcClient.verification.issueWidgetShare.mutate({
                accountId: resolvedAccountId,
                title,
                snapshotKey,
                surface: resolvedVerificationSurface ?? null,
                summary: {
                  currencyCode: stats.currencyCode ?? null,
                  initialBalance: stats.initialBalance ?? null,
                  accountBalance: stats.accountBalance ?? null,
                  totalPnl: stats.totalProfit ?? null,
                  floatingPnl:
                    liveMetrics?.totalFloatingPL ??
                    (stats.liveEquity != null && stats.accountBalance != null
                      ? stats.liveEquity - stats.accountBalance
                      : null),
                  winRate: stats.winrate ?? null,
                  totalTrades,
                  openTradesCount: liveMetrics?.openTradesCount ?? null,
                  profitFactor: stats.profitFactor ?? null,
                },
              });

            verificationUrl = `${window.location.origin}${verification.path}`;
          }
        } catch (verificationError) {
          console.error(verificationError);
        }
      }

      await exportWidgetAsPng({
        node: target,
        title,
        verificationUrl,
        verificationIdentity,
      });
      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size={buttonLabel ? "default" : "icon"}
          data-widget-share-ignore="true"
          className={cn(
            buttonLabel
              ? "h-9 w-max shrink-0 gap-2 rounded-sm ring ring-white/5 bg-sidebar px-4 text-xs text-white/70 transition-all duration-250 hover:bg-sidebar-accent hover:text-white"
              : "size-7 shrink-0 rounded-sm ring ring-white/5 bg-sidebar/85 text-white/65 backdrop-blur-sm transition-all duration-250 hover:bg-sidebar-accent hover:text-white",
            className
          )}
          disabled={isExporting || isUploading}
          onClick={handleClick}
        >
          <Download className="size-3.5" />
          {buttonLabel ? <span>{buttonLabel}</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        <p>{tooltipLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
