/**
 * Analysis Panel Skeletons
 *
 * Shimmer skeletons that match the actual analysis blocks.
 */

import { cn } from "@/lib/utils";
import { TextShimmer } from "@/components/ui/text-shimmer";

export function CoverageSkeleton() {
  return (
    <div className="w-full space-y-3 p-4 border border-white/5 bg-dashboard-background rounded-sm">
      <div className="h-5 w-28 bg-white/5 shimmer" />
      <div className="flex items-baseline gap-2">
        <div className="h-8 w-16 bg-white/5 shimmer" />
        <div className="h-4 w-24 bg-white/5 shimmer" />
      </div>
      <div className="h-4 w-48 bg-white/5 shimmer" />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="w-full space-y-3 p-4 border border-white/5 bg-dashboard-background rounded-sm">
      <div className="h-5 w-40 bg-white/5  shimmer" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-4 w-40 bg-white/5  shimmer" />
            <div className="h-4 w-24 bg-white/5  shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BreakdownTableSkeleton() {
  return (
    <div className="w-full space-y-3 p-4 border border-white/5 bg-dashboard-background rounded-sm">
      <div className="h-5 w-36 bg-white/5  shimmer" />
      <div className="space-y-2">
        {/* Header */}
        <div className="flex gap-2">
          <div className="h-4 w-32 bg-white/5  shimmer" />
          <div className="h-4 w-24 bg-white/5  shimmer" />
          <div className="h-4 w-20 bg-white/5  shimmer" />
        </div>
        {/* Rows */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-2">
            <div className="h-4 w-32 bg-white/5  shimmer" />
            <div className="h-4 w-24 bg-white/5  shimmer" />
            <div className="h-4 w-20 bg-white/5  shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TradePreviewSkeleton() {
  return (
    <div className="w-full space-y-3 p-4 border border-white/5 bg-dashboard-background rounded-sm">
      <div className="flex justify-between items-center">
        <div className="h-5 w-44 bg-white/5  shimmer" />
        <div className="h-8 w-32 bg-white/5  shimmer" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2">
            <div className="h-4 w-20 bg-white/5  shimmer" />
            <div className="h-4 w-16 bg-white/5  shimmer" />
            <div className="h-4 w-24 bg-white/5  shimmer" />
            <div className="h-4 w-20 bg-white/5  shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalysisPanelSkeleton({ stage }: { stage?: string }) {
  return (
    <div className="space-y-4 w-full">
      {/* Stage indicator */}
      {stage && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <div className="h-2 w-2 -full bg-purple-500 animate-pulse" />
          <TextShimmer
            as="span"
            className="text-sm [--base-color:rgba(255,255,255,0.4)] [--base-gradient-color:rgba(255,255,255,0.9)]"
          >
            {stage}
          </TextShimmer>
        </div>
      )}

      {/* Skeletons */}
      <StatsSkeleton />
      <BreakdownTableSkeleton />
      <TradePreviewSkeleton />
      <CoverageSkeleton />
    </div>
  );
}

/**
 * Add shimmer animation to globals if not already there
 */
export const shimmerStyles = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
  animation: shimmer 1.2s infinite;
}

.shimmer-once {
  position: relative;
  overflow: hidden;
}

.shimmer-once::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  animation: shimmer-sweep 0.8s ease-out;
}

@keyframes shimmer-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`;
