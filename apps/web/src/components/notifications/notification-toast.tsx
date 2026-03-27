"use client";

import { buildNotificationPresentation } from "@profitabledge/platform";
import { toast } from "sonner";

import {
  NotificationSurface,
  type NotificationSurfaceAction,
} from "@/components/notifications/notification-surface";

type NotificationToastInput = {
  title?: string | null;
  body?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | string | null;
  readAt?: Date | string | null;
  toastId?: string;
  action?: NotificationSurfaceAction;
  duration?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function buildNotificationToastId(input: {
  title?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
  fallbackId?: string | null;
}) {
  const metadata = asRecord(input.metadata);
  const kind = asString(metadata?.kind);
  const accountId = asString(metadata?.accountId);
  const accountName = asString(metadata?.accountName);
  const broker = asString(metadata?.broker);
  const parserId = asString(metadata?.parserId);
  const reportType = asString(metadata?.reportType);

  if (
    kind === "demo_workspace_generating" ||
    kind === "demo_workspace_ready" ||
    kind === "demo_workspace_failed"
  ) {
    const scope = accountName ?? accountId ?? broker ?? "workspace";
    return `notification-toast:${kind}:${scope}`;
  }

  if (kind === "trade_import_processing") {
    const scope = accountName ?? broker ?? "import";
    return `notification-toast:${kind}:${scope}`;
  }

  if (input.type === "trade_imported") {
    const scope = accountId ?? accountName ?? broker ?? "import";
    const variant = parserId ?? reportType ?? "default";
    return `notification-toast:trade_imported:${scope}:${variant}`;
  }

  if (input.fallbackId) {
    return `notification-toast:${input.fallbackId}`;
  }

  return undefined;
}

export function showAppNotificationToast(input: NotificationToastInput) {
  const presentation = buildNotificationPresentation({
    title: input.title,
    body: input.body,
    type: input.type,
    metadata: input.metadata,
  });

  const resolvedId =
    input.toastId ??
    buildNotificationToastId({
      title: input.title,
      type: input.type,
      metadata: input.metadata,
    });

  toast.custom(
    (toastId) => (
      <NotificationSurface
        presentation={presentation}
        timestamp={
          input.createdAt
            ? typeof input.createdAt === "string" ||
              input.createdAt instanceof Date
              ? String(input.createdAt)
              : null
            : null
        }
        unread={!input.readAt}
        action={
          input.action ??
          ({
            kind: "dismiss",
            label: "Dismiss notification",
            onClick: () => toast.dismiss(toastId),
          } satisfies NotificationSurfaceAction)
        }
      />
    ),
    {
      id: resolvedId,
      duration:
        input.duration ??
        (presentation.isProcessing
          ? 10_000
          : presentation.requireInteraction
            ? 12_000
            : 8_000),
    }
  );

  return resolvedId;
}
