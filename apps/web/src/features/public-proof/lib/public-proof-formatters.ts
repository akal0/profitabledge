"use client";

const PUBLIC_PROOF_LOCALE = "en-GB";
const PUBLIC_PROOF_TIME_ZONE = "UTC";

export function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatR(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export function formatTimestamp(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(PUBLIC_PROOF_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PUBLIC_PROOF_TIME_ZONE,
  });
}

export function formatShortDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(PUBLIC_PROOF_LOCALE, {
    month: "short",
    day: "numeric",
    timeZone: PUBLIC_PROOF_TIME_ZONE,
  });
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
