"use client";

import { getActiveTradingSession } from "../lib/dashboard-greeting";

export function DashboardSessionBadge() {
  const session = getActiveTradingSession();

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${session.color}`}
    >
      {session.name} session
    </span>
  );
}
