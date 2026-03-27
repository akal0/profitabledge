"use client";

import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Sun,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { WidgetWrapper } from "./widget-wrapper";
import { formatSignedCurrencyValue } from "@/features/dashboard/widgets/lib/widget-shared";
import { WidgetShareButton } from "@/features/dashboard/widgets/components/widget-share-button";
import { useTabAttentionActivity } from "@/hooks/use-tab-attention-activity";

const WIDGET_CONTENT_SEPARATOR_CLASS = "-mx-3.5 shrink-0 self-stretch";

function getOrdinalSuffix(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatBriefingDate(value: string | Date | null | undefined) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
  });
  const month = date.toLocaleDateString("en-GB", {
    month: "long",
  });
  const day = date.getDate();
  const year = date.toLocaleDateString("en-GB", {
    year: "2-digit",
  });

  return `${weekday} ${day}${getOrdinalSuffix(day)} ${month} '${year}`;
}

function getSessionTone(session: string) {
  const normalized = session.toLowerCase();

  if (normalized.includes("london")) return TRADE_IDENTIFIER_TONES.info;
  if (
    normalized.includes("new york") ||
    normalized.includes("newyork") ||
    normalized.includes("ny")
  ) {
    return TRADE_IDENTIFIER_TONES.live;
  }
  if (
    normalized.includes("asia") ||
    normalized.includes("asian") ||
    normalized.includes("tokyo") ||
    normalized.includes("sydney")
  ) {
    return TRADE_IDENTIFIER_TONES.amber;
  }

  return TRADE_IDENTIFIER_TONES.neutral;
}

export function DailyBriefingCard({
  accountId,
  isEditing = false,
  className,
  currencyCode,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
  currencyCode?: string;
}) {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || selectedAccountId;
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    data: briefing,
    isLoading,
    refetch,
  } = trpc.ai.getLatestBriefing.useQuery(
    { accountId: effectiveAccountId ?? "" },
    { enabled: !!effectiveAccountId }
  );

  const generateMutation = trpc.ai.generateBriefing.useMutation({
    onSuccess: () => refetch(),
  });
  useTabAttentionActivity("daily-briefing", generateMutation.isPending);

  const content = briefing?.content as any;
  const reviewSnapshot = (briefing as any)?.reviewSnapshot as
    | {
        tradeCount?: number;
        winRate?: number;
        pnl?: number;
        reviewedAt?: string;
        reviewLabel?: string;
        edgeMatches?: number;
      }
    | undefined;
  const review = reviewSnapshot ?? content?.review;
  const hasBriefing = !!content;
  const focusMessage =
    content?.focusItem?.message ?? content?.focusItem?.description ?? null;
  const reviewTradeCount =
    review?.tradeCount ?? review?.tradesToday ?? review?.trades ?? 0;
  const reviewWinRate = review?.winRate;
  const reviewPnl = review?.pnl ?? 0;
  const reviewLabel = review?.reviewLabel ?? review?.label ?? "Latest review";
  const reviewDateLabel = review?.reviewedAt
    ? formatBriefingDate(review.reviewedAt)
    : null;
  const progressSummary =
    content?.progress?.summary ??
    (content?.progress
      ? `${Math.round(
          content.progress.weeklyWinRate ?? 0
        )}% weekly win rate and ${formatSignedCurrencyValue(
          content.progress.weeklyPnL ?? 0,
          currencyCode,
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }
        )} P&L.`
      : "Steady performance");
  const hasReview = Boolean(review);
  const hasFocus = Boolean(content?.focusItem && focusMessage);
  const recommendedSessions: string[] =
    content?.outlook?.recommendedSessions ?? [];

  return (
    <>
      <WidgetWrapper
        rootRef={widgetRef}
        isEditing={isEditing}
        className={className}
        icon={Sun}
        title="Daily briefing"
        showHeader
        onClick={() => setSheetOpen(true)}
        contentClassName="flex-col justify-end p-3.5"
        headerRight={
          <>
            <span className="text-[10px] text-white/30">
              {formatBriefingDate(briefing?.createdAt)}
            </span>
            {!isEditing ? (
              <WidgetShareButton targetRef={widgetRef} title="Daily briefing" />
            ) : null}
          </>
        }
      >
        {isLoading ? (
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : !hasBriefing ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Sun className="h-8 w-8 text-white/20 mb-2" />
            <p className="text-xs text-white/50 mb-3">No briefing yet today</p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs ring-white/10 h-7"
              onClick={(e) => {
                e.stopPropagation();
                if (effectiveAccountId) {
                  generateMutation.mutate({ accountId: effectiveAccountId });
                }
              }}
              disabled={generateMutation.isPending}
            >
              <RefreshCw
                className={cn(
                  "size-3",
                  generateMutation.isPending && "animate-spin"
                )}
              />
              Generate
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col justify-end">
            {hasReview && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-white/90">
                    {reviewTradeCount}
                  </p>
                  <p className="text-[10px] text-white/40">Trades</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white/90">
                    {reviewTradeCount > 0 && typeof reviewWinRate === "number"
                      ? `${Math.round(reviewWinRate)}%`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-white/40">Win Rate</p>
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "text-lg font-bold",
                      reviewPnl >= 0 ? "text-teal-400" : "text-rose-400"
                    )}
                  >
                    {reviewTradeCount > 0
                      ? formatSignedCurrencyValue(reviewPnl, currencyCode, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })
                      : "—"}
                  </p>
                  <p className="text-[10px] text-white/40">P&L</p>
                </div>
              </div>
            )}

            {hasReview && !hasFocus && recommendedSessions.length > 0 ? (
              <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
            ) : null}

            {hasFocus && (
              <div className="flex items-start gap-2 py-3">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-400">
                    Today's Focus
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/70 line-clamp-2">
                    {focusMessage}
                  </p>
                </div>
              </div>
            )}

            {hasFocus && recommendedSessions.length > 0 ? (
              <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
            ) : null}

            {recommendedSessions.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-3">
                <p className="text-[10px] text-white/40 mb-1">
                  Recommended sessions
                </p>
                <div className="flex gap-1 flex-wrap">
                  {recommendedSessions.slice(0, 3).map((s: string) => (
                    <span
                      key={s}
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getSessionTone(s)
                      )}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </WidgetWrapper>

      {/* Full briefing sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[440px] sm:w-[500px] bg-sidebar border-white/5 overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-medium flex items-center gap-2">
                <Sun className="h-4 w-4 text-yellow-400" />
                Daily briefing
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  if (effectiveAccountId) {
                    generateMutation.mutate({ accountId: effectiveAccountId });
                  }
                }}
                disabled={generateMutation.isPending}
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    generateMutation.isPending && "animate-spin"
                  )}
                />
              </Button>
            </div>
            <SheetDescription className="text-xs">
              {briefing?.createdAt
                ? `Generated ${formatBriefingDate(briefing.createdAt)}`
                : "Your personalized trading briefing"}
            </SheetDescription>
          </SheetHeader>

          {!hasBriefing ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Sun className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm font-medium">No briefing available</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  if (effectiveAccountId) {
                    generateMutation.mutate({ accountId: effectiveAccountId });
                  }
                }}
                disabled={generateMutation.isPending}
              >
                Generate Now
              </Button>
            </div>
          ) : (
            <div className="space-y-5 pb-6">
              {/* Focus Item */}
              {content?.focusItem && focusMessage && (
                <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-teal-400" />
                    <h3 className="text-sm font-semibold text-teal-400">
                      Today&apos;s Focus
                    </h3>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {focusMessage}
                  </p>
                  {content.focusItem.metric && (
                    <p className="text-xs text-teal-400/70 mt-2 italic">
                      Target: {content.focusItem.metric}
                    </p>
                  )}
                </div>
              )}

              {/* Yesterday Review */}
              {hasReview && (
                <>
                  <Separator className="bg-white/10" />
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                        {reviewLabel}
                      </h3>
                      {reviewDateLabel ? (
                        <span className="text-[10px] text-white/35">
                          {reviewDateLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white/3 p-3">
                        <p className="text-[10px] text-white/40 uppercase">
                          Trades
                        </p>
                        <p className="text-xl font-bold">{reviewTradeCount}</p>
                      </div>
                      <div className="rounded-lg bg-white/3 p-3">
                        <p className="text-[10px] text-white/40 uppercase">
                          Win Rate
                        </p>
                        <p className="text-xl font-bold">
                          {reviewTradeCount > 0 &&
                          typeof reviewWinRate === "number"
                            ? `${Math.round(reviewWinRate)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/3 p-3">
                        <p className="text-[10px] text-white/40 uppercase">
                          P&L
                        </p>
                        <p
                          className={cn(
                            "text-xl font-bold",
                            reviewPnl >= 0 ? "text-teal-400" : "text-rose-400"
                          )}
                        >
                          {reviewTradeCount > 0
                            ? formatSignedCurrencyValue(
                                reviewPnl,
                                currencyCode,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/3 p-3">
                        <p className="text-[10px] text-white/40 uppercase">
                          Edge Matches
                        </p>
                        <p className="text-xl font-bold text-teal-400">
                          {review?.edgeMatches ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Today's Outlook */}
              {content?.outlook && (
                <>
                  <Separator className="bg-white/10" />
                  <div>
                    <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                      Today&apos;s Outlook
                    </h3>
                    <div className="space-y-3">
                      {content.outlook.recommendedSessions?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-white/40 mb-1.5 flex items-center gap-1">
                            <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
                            Recommended Sessions
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            {content.outlook.recommendedSessions.map(
                              (s: string) => (
                                <span
                                  key={s}
                                  className={cn(
                                    TRADE_IDENTIFIER_PILL_CLASS,
                                    getSessionTone(s)
                                  )}
                                >
                                  {s}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {content.outlook.avoidSessions?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-white/40 mb-1.5 flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                            Avoid Sessions
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            {content.outlook.avoidSessions.map((s: string) => (
                              <span
                                key={s}
                                className={cn(
                                  TRADE_IDENTIFIER_PILL_CLASS,
                                  TRADE_IDENTIFIER_TONES.warning
                                )}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {content.outlook.focusSymbols?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-white/40 mb-1.5 flex items-center gap-1">
                            <Target className="h-2.5 w-2.5 text-teal-400" />
                            Focus Symbols
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            {content.outlook.focusSymbols.map((s: string) => (
                              <span
                                key={s}
                                className={cn(
                                  TRADE_IDENTIFIER_PILL_CLASS,
                                  TRADE_IDENTIFIER_TONES.positive
                                )}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Weekly Progress */}
              {content?.progress && (
                <>
                  <Separator className="bg-white/10" />
                  <div>
                    <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                      Weekly Progress
                    </h3>
                    <div className="flex items-center gap-2">
                      {content.progress.trend === "improving" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      ) : content.progress.trend === "declining" ? (
                        <TrendingDown className="h-4 w-4 text-rose-400" />
                      ) : (
                        <Calendar className="h-4 w-4 text-white/40" />
                      )}
                      <p className="text-sm text-white/70">{progressSummary}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Narrative */}
              {content?.narrative && (
                <>
                  <Separator className="bg-white/10" />
                  <div className="rounded-lg bg-white/3 p-4">
                    <p className="text-sm text-white/70 leading-relaxed italic">
                      &ldquo;{content.narrative}&rdquo;
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
