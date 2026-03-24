export type AssistantSurface =
  | "dashboard"
  | "journal"
  | "prop-tracker"
  | "trades"
  | "settings"
  | "assistant"
  | "unknown";

export interface AssistantPageContextPayload {
  pathname?: string;
  surface?: AssistantSurface;
  propAccountId?: string | null;
  journalEntryId?: string | null;
  dashboardWidgetIds?: string[];
  dashboardChartWidgetIds?: string[];
  focusedWidgetId?: string | null;
  accountScope?: "single" | "all";
  source?: "floating-assistant" | "premium-assistant" | "dashboard-chat";
}

export function inferAssistantSurface(pathname?: string | null): AssistantSurface {
  if (!pathname) return "unknown";
  if (pathname === "/assistant") return "assistant";
  if (pathname.startsWith("/dashboard/prop-tracker")) return "prop-tracker";
  if (pathname.startsWith("/dashboard/journal")) return "journal";
  if (pathname.startsWith("/dashboard/trades")) return "trades";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "unknown";
}

export function buildContextFromPath(
  rawPath: string | undefined,
  rawSearchParams?: { toString(): string } | null,
  source?: AssistantPageContextPayload["source"]
): AssistantPageContextPayload {
  if (!rawPath) {
    return {
      pathname: undefined,
      surface: "unknown",
      source,
    };
  }

  let pathname = rawPath;
  let searchParams = rawSearchParams
    ? new URLSearchParams(rawSearchParams.toString())
    : new URLSearchParams();

  if (rawPath.startsWith("/")) {
    const [pathOnly, queryString] = rawPath.split("?");
    pathname = pathOnly || rawPath;
    if (queryString) {
      searchParams = new URLSearchParams(queryString);
    }
  }

  const surface = inferAssistantSurface(pathname);
  const segments = pathname.split("/").filter(Boolean);
  let propAccountId: string | null = null;
  let journalEntryId: string | null = null;

  if (surface === "prop-tracker") {
    const propIdx = segments.findIndex((segment) => segment === "prop-tracker");
    const maybeId = propIdx >= 0 ? segments[propIdx + 1] : null;
    if (maybeId && maybeId !== "simulator") {
      propAccountId = maybeId;
    }
  }

  if (surface === "journal") {
    journalEntryId = searchParams.get("entryId");
  }

  return {
    pathname,
    surface,
    propAccountId,
    journalEntryId,
    source,
  };
}
