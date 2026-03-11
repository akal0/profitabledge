export { analytics, default as analyticsLib } from "../analytics";
export type {
  TradeInput,
  TradeStats,
  SessionStats,
  SymbolStats,
  HourlyStats,
  RRBucketStats,
  DrawdownResult,
  StreakInfo,
} from "../analytics";

export { eventBus, subscribe, publish, publishSync, createEventBatch } from "../event-bus";
export type {
  EventType,
  EventPayloadMap,
  EventHandler,
  EventMetadata,
  Event,
} from "../event-bus";

export {
  notificationHub,
  createNotification,
  createNotificationBatch,
  queueNotification,
  default as notificationHubLib,
} from "../notification-hub";
export type {
  NotificationType as HubNotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationPreferences as HubNotificationPreferences,
  NotificationInput,
  NotificationResult,
} from "../notification-hub";

export {
  webhookManager,
  registerWebhook,
  triggerWebhook,
  triggerWebhooksForUser,
  default as webhookManagerLib,
} from "../webhook-manager";
export type {
  WebhookEvent,
  WebhookStatus,
  WebhookConfig,
  WebhookPayload,
  WebhookDelivery,
} from "../webhook-manager";

export {
  enhancedCache,
  cacheKeys,
  CacheTTL,
  cacheNamespaces,
  createCachedFunction,
  memoize,
  default as enhancedCacheLib,
} from "../enhanced-cache";
export type {
  CacheTier,
  CacheOptions,
  CacheStats,
  CacheEntry,
  CacheKeyBuilder,
} from "../enhanced-cache";
