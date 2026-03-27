type NotificationTargetInput = {
  type?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildJournalEntryUrl(metadata?: Record<string, unknown> | null) {
  const directUrl = getMetadataString(metadata, "url");
  if (directUrl?.startsWith("/dashboard/journal")) {
    return directUrl;
  }

  const journalEntryId = getMetadataString(metadata, "journalEntryId");
  return journalEntryId
    ? `/dashboard/journal?entryId=${journalEntryId}&entryType=trade_review`
    : "/dashboard/journal?entryType=trade_review";
}

function buildSettingsUpdatedUrl(metadata?: Record<string, unknown> | null) {
  if (getMetadataString(metadata, "alertType") || getMetadataString(metadata, "severity")) {
    return "/dashboard/settings/alerts";
  }

  if (typeof metadata?.ruleCount === "number") {
    return "/dashboard/settings/compliance";
  }

  if (Array.isArray(metadata?.updatedFields) && metadata.updatedFields.length > 0) {
    return "/dashboard/settings/metrics";
  }

  if (getMetadataString(metadata, "broker") || getMetadataString(metadata, "accountNumber")) {
    return "/dashboard/settings/connections";
  }

  return "/dashboard/settings";
}

export function resolveNotificationTargetUrl({
  type,
  metadata,
}: NotificationTargetInput) {
  const directUrl = getMetadataString(metadata, "url");
  if (directUrl) {
    return directUrl;
  }

  switch (type) {
    case "post_exit_ready":
      return buildJournalEntryUrl(metadata);
    case "trade_closed":
    case "trade_opened":
    case "trade_imported":
      return "/dashboard/trades";
    case "goal_achieved":
    case "goal_progress":
      return "/dashboard/goals";
    case "achievement_earned":
    case "leaderboard_update":
      return "/dashboard";
    case "prop_violation":
    case "prop_journey":
    case "prop_phase_advanced": {
      const accountId = getMetadataString(metadata, "accountId");
      return accountId
        ? `/dashboard/prop-tracker/${accountId}`
        : "/dashboard/prop-tracker";
    }
    case "alert_triggered":
      return "/dashboard/settings/alerts";
    case "journal_share_request":
    case "journal_share_invite":
    case "journal_share_accepted":
    case "journal_share_declined":
      return "/dashboard/journal?tab=shares";
    case "api_key":
      return "/dashboard/settings/api";
    case "webhook_sync":
      return "/dashboard/settings/connections";
    case "settings_updated":
      return buildSettingsUpdatedUrl(metadata);
    case "system_maintenance":
    case "system_update":
      return "/dashboard/settings/notifications";
    case "news_upcoming":
      return "/dashboard/economic-calendar";
    default:
      return null;
  }
}
