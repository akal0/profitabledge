"use client";

import { trpcClient } from "@/utils/trpc";

type TrackableMilestone =
  | "sign_up_completed"
  | "account_connected"
  | "trades_synced"
  | "journal_entry_created"
  | "replay_session_created"
  | "assistant_prompt_started"
  | "feedback_submitted";

interface TrackInput {
  pagePath?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function trackAlphaMilestone(
  key: TrackableMilestone,
  input: TrackInput = {}
) {
  try {
    await trpcClient.operations.trackMilestone.mutate({
      key,
      pagePath: input.pagePath ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.warn("[AlphaAnalytics] Failed to track milestone", key, error);
  }
}

export async function trackAlphaEvent(input: {
  category: "activation" | "navigation" | "usage" | "feedback";
  name: string;
  summary?: string | null;
  pagePath?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await trpcClient.operations.trackClientEvent.mutate({
      category: input.category,
      name: input.name,
      summary: input.summary ?? null,
      pagePath: input.pagePath ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.warn("[AlphaAnalytics] Failed to track event", input.name, error);
  }
}
