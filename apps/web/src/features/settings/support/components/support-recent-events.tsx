"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { AlertTriangle, Bug, Info, Lightbulb } from "lucide-react";
import type { AppRouter } from "@profitabledge/contracts/trpc";

import { Badge } from "@/components/ui/badge";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SupportSnapshot = RouterOutput["operations"]["getSupportSnapshot"];

function EventIcon({ category }: { category: string }) {
  switch (category) {
    case "feedback":
      return <Bug className="size-4 text-amber-300" />;
    case "activation":
      return <Lightbulb className="size-4 text-emerald-300" />;
    default:
      return <Info className="size-4 text-blue-300" />;
  }
}

export function SupportRecentEvents({
  snapshot,
}: {
  snapshot: SupportSnapshot;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Recent events</h2>
          <p className="mt-1 text-xs text-white/45">
            Latest recorded usage, activation, and operational events for this user.
          </p>
        </div>
        <div className="space-y-3">
          {snapshot.recentEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              No user-scoped events recorded yet.
            </div>
          ) : (
            snapshot.recentEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      <EventIcon category={event.category} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {event.summary || event.name}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {event.category} · {event.name}
                        {event.pagePath ? ` · ${event.pagePath}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-white/35">{event.createdAt}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Recent visible errors</h2>
          <p className="mt-1 text-xs text-white/45">
            Latest user-facing errors captured for this account and device footprint.
          </p>
        </div>
        <div className="space-y-3">
          {snapshot.recentErrors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              No user-visible errors recorded yet.
            </div>
          ) : (
            snapshot.recentErrors.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-red-400/15 bg-red-400/[0.04] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 size-4 text-red-200" />
                    <div>
                      <div className="text-sm font-medium text-white">
                        {event.summary || event.name}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {event.category} · {event.name}
                        {event.pagePath ? ` · ${event.pagePath}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-white/35">{event.createdAt}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Feedback history</h2>
          <p className="mt-1 text-xs text-white/45">
            Recent feedback items submitted from the app.
          </p>
        </div>
        <div className="space-y-3">
          {snapshot.feedback.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              No feedback submitted yet.
            </div>
          ) : (
            snapshot.feedback.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {item.subject}
                      </span>
                      <Badge className="border-white/15 bg-white/5 text-white/70">
                        {item.category}
                      </Badge>
                      <Badge className="border-white/15 bg-white/5 text-white/70">
                        {item.priority}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-white/55 line-clamp-3">
                      {item.message}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge className="border-emerald-400/20 bg-emerald-400/5 text-emerald-200">
                      {item.status}
                    </Badge>
                    <div className="mt-2 text-[11px] text-white/35">
                      {item.createdAt}
                    </div>
                  </div>
                </div>
                {item.pagePath ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
                    <AlertTriangle className="size-3.5" />
                    {item.pagePath}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
