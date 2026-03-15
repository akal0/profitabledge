"use client";

import { Badge } from "@/components/ui/badge";

type FlagMap = Record<string, boolean>;

const LABELS: Record<string, string> = {
  aiAssistant: "AI assistant",
  community: "Community",
  connections: "Connections",
  backtest: "Backtest",
  feedback: "Feedback",
  supportDiagnostics: "Support diagnostics",
  scheduledSync: "Scheduled sync",
  mt5Ingestion: "MT5 ingestion",
};

export function SupportFlagGrid({ flags }: { flags: FlagMap }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Alpha flags</h2>
        <p className="mt-1 text-xs text-white/45">
          These kill switches define which alpha surfaces are currently open.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(flags).map(([key, enabled]) => (
          <div
            key={key}
            className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">
                  {LABELS[key] ?? key}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-white/35">
                  {key}
                </div>
              </div>
              <Badge
                className={
                  enabled
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/30 bg-amber-400/10 text-amber-200"
                }
              >
                {enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
