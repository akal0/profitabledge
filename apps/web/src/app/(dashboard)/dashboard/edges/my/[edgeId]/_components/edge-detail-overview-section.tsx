"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";

import { EdgeAccountFitSection, type EdgeAccountFitData } from "@/components/edges/edge-account-fit-section";
import { EdgeLineageGraph, type EdgeLineageData } from "@/components/edges/edge-lineage-graph";
import { EdgeReadinessSection, type EdgeReadinessData } from "@/components/edges/edge-readiness-section";
import { EdgeBreakdownBarCard, EdgeEquityCurveCard, EdgeRMultipleSpreadCard } from "@/components/edges/edge-overview-charts";
import { EdgeMetricCard } from "@/components/edges/edge-page-primitives";
import { Button } from "@/components/ui/button";
import {
  EDGE_OVERVIEW_ENTRIES_PAGE_SIZE,
  formatDate,
  formatEntryTypeLabel,
  getOverviewGridClass,
  type EdgeDetailResponse,
} from "../_lib/edge-detail-page";

type MetricCard = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
};

export function EdgeDetailOverviewSection({
  detail,
  canShowStats,
  canShowPrivateActivity,
  metrics,
  overviewMetricCards,
  edgeProfileCards,
  resolvedReadiness,
  resolvedAccountFit,
  resolvedLineageGraph,
  overviewEntries,
  overviewEntriesPageCount,
  clampedOverviewEntriesPage,
  setOverviewEntriesPage,
}: {
  detail: EdgeDetailResponse;
  canShowStats: boolean;
  canShowPrivateActivity: boolean;
  metrics: NonNullable<EdgeDetailResponse["edge"]["metrics"]> | null;
  overviewMetricCards: MetricCard[];
  edgeProfileCards: MetricCard[];
  resolvedReadiness: EdgeReadinessData | null;
  resolvedAccountFit: EdgeAccountFitData | null;
  resolvedLineageGraph: EdgeLineageData | null;
  overviewEntries: EdgeDetailResponse["entries"];
  overviewEntriesPageCount: number;
  clampedOverviewEntriesPage: number;
  setOverviewEntriesPage: Dispatch<SetStateAction<number>>;
}) {
  const router = useRouter();
  const overviewEntriesStart =
    clampedOverviewEntriesPage * EDGE_OVERVIEW_ENTRIES_PAGE_SIZE + 1;
  const overviewEntriesEnd = Math.min(
    (clampedOverviewEntriesPage + 1) * EDGE_OVERVIEW_ENTRIES_PAGE_SIZE,
    detail.entries.length
  );

  return (
    <div className="w-full space-y-6">
      {canShowStats ? (
        <>
          <div className={getOverviewGridClass(overviewMetricCards.length)}>
            {overviewMetricCards.map((card) => (
              <EdgeMetricCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                detail={card.detail}
              />
            ))}
          </div>

          <div className="space-y-6">
            <EdgeEquityCurveCard
              className="w-full"
              points={metrics!.charts.equityCurve}
            />

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-white/72">
                  Edge profile
                </p>
                <p className="text-sm text-white/40">
                  The current operating characteristics of this Edge.
                </p>
              </div>

              <div className={getOverviewGridClass(edgeProfileCards.length)}>
                {edgeProfileCards.map((card) => (
                  <EdgeMetricCard
                    key={card.label}
                    icon={card.icon}
                    label={card.label}
                    value={card.value}
                    detail={card.detail}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <EdgeBreakdownBarCard
              title="Outcome mix"
              items={metrics!.charts.outcomeBreakdown}
              emptyLabel="No outcome breakdown yet."
            />
            <EdgeBreakdownBarCard
              title="Session mix"
              items={metrics!.charts.sessionBreakdown}
              emptyLabel="Session data will appear after assignments."
            />
            <EdgeRMultipleSpreadCard items={metrics!.charts.rDistribution} />
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-5 py-6 text-xs text-white/48">
          This creator chose to hide public Library stats for this Edge. Featured Edges always show their public performance metrics.
        </div>
      )}

      <EdgeReadinessSection readiness={resolvedReadiness} />
      <EdgeAccountFitSection accountFit={resolvedAccountFit} />
      <EdgeLineageGraph lineage={resolvedLineageGraph} />

      {canShowPrivateActivity ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/72">
                Linked entries
              </p>
              <p className="text-sm text-white/40">
                Edge-linked reflections, reviews, and notes.
              </p>
            </div>
            <p className="text-xs text-white/34">{detail.entries.length} total entries</p>
          </div>

          {detail.entries.length > 0 ? (
            <>
              <div className="overflow-hidden border border-white/5 bg-sidebar/45">
                <table className="min-w-full text-xs">
                  <thead className="border-b border-white/5 bg-sidebar-accent">
                    <tr>
                      <th className="px-6 py-4 text-left font-medium text-white/70">
                        Entry
                      </th>
                      <th className="px-6 py-4 text-left font-medium text-white/70">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left font-medium text-white/70">
                        Journal date
                      </th>
                      <th className="px-6 py-4 text-left font-medium text-white/70">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03] last:border-b-0"
                        onClick={() => router.push(`/dashboard/journal?entryId=${entry.id}`)}
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashboard/journal?entryId=${entry.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="font-medium text-white transition-colors hover:text-teal-300"
                          >
                            {entry.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-white/55">
                          {formatEntryTypeLabel(entry.entryType ?? "entry")}
                        </td>
                        <td className="px-6 py-4 text-white/55">
                          {formatDate(entry.journalDate)}
                        </td>
                        <td className="px-6 py-4 text-white/55">
                          {formatDate(entry.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-white/38">
                  Showing {overviewEntriesStart}-{overviewEntriesEnd} of {detail.entries.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-xs text-white/72 hover:bg-white/10"
                    disabled={clampedOverviewEntriesPage === 0}
                    onClick={() =>
                      setOverviewEntriesPage((currentPage) => Math.max(currentPage - 1, 0))
                    }
                  >
                    Previous
                  </Button>
                  <div className="text-xs text-white/48">
                    Page {clampedOverviewEntriesPage + 1} of {overviewEntriesPageCount}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-xs text-white/72 hover:bg-white/10"
                    disabled={clampedOverviewEntriesPage >= overviewEntriesPageCount - 1}
                    onClick={() =>
                      setOverviewEntriesPage((currentPage) =>
                        Math.min(currentPage + 1, Math.max(overviewEntriesPageCount - 1, 0))
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-5 py-6 text-sm text-white/45">
              No linked entries yet.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
