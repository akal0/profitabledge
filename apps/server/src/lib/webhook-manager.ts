import { nanoid } from "nanoid";
import { createHash, createHmac } from "crypto";
import { eventBus, subscribe, EventType, EventPayloadMap } from "./event-bus";

export type WebhookEvent =
  | "trade.opened"
  | "trade.closed"
  | "trade.imported"
  | "account.synced"
  | "goal.achieved"
  | "alert.triggered"
  | "prop.violation"
  | "prop.phase_advanced"
  | "leaderboard.updated";

export type WebhookStatus = "active" | "paused" | "disabled";

export type WebhookConfig = {
  id: string;
  userId: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
  lastFailureAt?: Date;
  lastFailureReason?: string;
};

export type WebhookPayload<T extends WebhookEvent> = {
  id: string;
  event: T;
  timestamp: string;
  data: T extends keyof EventMapping ? EventMapping[T] : unknown;
  signature: string;
};

type EventMapping = {
  "trade.opened": {
    tradeId: string;
    accountId: string;
    symbol: string;
    tradeType: string;
    volume: number;
    openPrice: number;
    openTime: string;
  };
  "trade.closed": {
    tradeId: string;
    accountId: string;
    symbol: string;
    tradeType: string;
    volume: number;
    profit: number;
    rr: number | null;
    openTime: string;
    closeTime: string;
  };
  "trade.imported": {
    accountId: string;
    count: number;
    source: string;
    importedAt: string;
  };
  "account.synced": {
    accountId: string;
    balance: number;
    equity: number;
    openTrades: number;
    syncedAt: string;
  };
  "goal.achieved": {
    goalId: string;
    type: string;
    value: number;
    target: number;
    achievedAt: string;
  };
  "alert.triggered": {
    alertId: string;
    type: string;
    message: string;
    value: number;
    threshold: number;
    triggeredAt: string;
  };
  "prop.violation": {
    accountId: string;
    ruleType: string;
    currentValue: number;
    limit: number;
    violatedAt: string;
  };
  "prop.phase_advanced": {
    accountId: string;
    fromPhase: number;
    toPhase: number;
    firmName: string;
    advancedAt: string;
  };
  "leaderboard.updated": {
    category: string;
    period: string;
    entriesCount: number;
    updatedAt: string;
  };
};

export type WebhookDelivery = {
  id: string;
  webhookId: string;
  eventId: string;
  event: WebhookEvent;
  status: "pending" | "success" | "failed" | "retrying";
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  responseCode?: number;
  responseBody?: string;
  error?: string;
  createdAt: Date;
};

type WebhookSubscription = {
  webhookId: string;
  event: WebhookEvent;
};

class WebhookManager {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private userWebhooks: Map<string, Set<string>> = new Map();
  private subscriptions: WebhookSubscription[] = [];
  private deliveryQueue: WebhookDelivery[] = [];
  private maxRetries = 3;
  private retryDelayMs = 60000;
  private timeout = 10000;

  async registerWebhook(
    userId: string,
    config: Omit<WebhookConfig, "id" | "userId" | "secret" | "createdAt" | "updatedAt" | "failureCount">
  ): Promise<WebhookConfig> {
    const id = nanoid();
    const secret = this.generateSecret();

    const webhook: WebhookConfig = {
      ...config,
      id,
      userId,
      secret,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
    };

    this.webhooks.set(id, webhook);

    const userWebhookIds = this.userWebhooks.get(userId) || new Set();
    userWebhookIds.add(id);
    this.userWebhooks.set(userId, userWebhookIds);

    for (const event of config.events) {
      this.subscriptions.push({ webhookId: id, event });
    }

    return webhook;
  }

  async updateWebhook(
    webhookId: string,
    updates: Partial<Pick<WebhookConfig, "name" | "url" | "events" | "status">>
  ): Promise<WebhookConfig | null> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;

    const updated: WebhookConfig = {
      ...webhook,
      ...updates,
      updatedAt: new Date(),
    };

    this.webhooks.set(webhookId, updated);

    if (updates.events) {
      this.subscriptions = this.subscriptions.filter((s) => s.webhookId !== webhookId);
      for (const event of updates.events) {
        this.subscriptions.push({ webhookId, event });
      }
    }

    return updated;
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return false;

    this.webhooks.delete(webhookId);
    this.subscriptions = this.subscriptions.filter((s) => s.webhookId !== webhookId);

    const userWebhookIds = this.userWebhooks.get(webhook.userId);
    if (userWebhookIds) {
      userWebhookIds.delete(webhookId);
    }

    return true;
  }

  async getWebhook(webhookId: string): Promise<WebhookConfig | null> {
    return this.webhooks.get(webhookId) || null;
  }

  async getWebhooksForUser(userId: string): Promise<WebhookConfig[]> {
    const webhookIds = this.userWebhooks.get(userId);
    if (!webhookIds) return [];

    return Array.from(webhookIds)
      .map((id) => this.webhooks.get(id))
      .filter((w): w is WebhookConfig => w !== undefined);
  }

  async triggerWebhook<T extends WebhookEvent>(
    webhookId: string,
    event: T,
    data: EventMapping[T]
  ): Promise<WebhookDelivery> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const eventId = nanoid();
    const timestamp = new Date().toISOString();

    const payload: WebhookPayload<T> = {
      id: eventId,
      event,
      timestamp,
      data: data as any,
      signature: this.generateSignature(webhook.secret, { id: eventId, event, timestamp, data }),
    };

    const delivery: WebhookDelivery = {
      id: nanoid(),
      webhookId,
      eventId,
      event,
      status: "pending",
      attempts: 0,
      maxAttempts: this.maxRetries,
      createdAt: new Date(),
    };

    this.deliveryQueue.push(delivery);
    await this.processDelivery(delivery, webhook, payload);

    return delivery;
  }

  async triggerForUser<T extends WebhookEvent>(
    userId: string,
    event: T,
    data: EventMapping[T]
  ): Promise<WebhookDelivery[]> {
    const webhookIds = this.subscriptions
      .filter((s) => s.event === event)
      .map((s) => s.webhookId);

    const userWebhookIds = this.userWebhooks.get(userId);
    if (!userWebhookIds) return [];

    const validWebhookIds = webhookIds.filter((id) => userWebhookIds.has(id));
    const deliveries: WebhookDelivery[] = [];

    for (const webhookId of validWebhookIds) {
      const webhook = this.webhooks.get(webhookId);
      if (webhook && webhook.status === "active") {
        const delivery = await this.triggerWebhook(webhookId, event, data);
        deliveries.push(delivery);
      }
    }

    return deliveries;
  }

  async processDelivery<T extends WebhookEvent>(
    delivery: WebhookDelivery,
    webhook: WebhookConfig,
    payload: WebhookPayload<T>
  ): Promise<void> {
    delivery.attempts++;
    delivery.lastAttemptAt = new Date();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-ID": webhook.id,
          "X-Webhook-Event": payload.event,
          "X-Webhook-Signature": payload.signature,
          "X-Webhook-Timestamp": payload.timestamp,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      delivery.responseCode = response.status;
      delivery.responseBody = await response.text().catch(() => "");

      if (response.ok) {
        delivery.status = "success";
        webhook.lastTriggeredAt = new Date();
        webhook.failureCount = 0;
      } else {
        throw new Error(`HTTP ${response.status}: ${delivery.responseBody}`);
      }
    } catch (error) {
      delivery.error = error instanceof Error ? error.message : String(error);

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = "failed";
        webhook.failureCount++;
        webhook.lastFailureAt = new Date();
        webhook.lastFailureReason = delivery.error;

        if (webhook.failureCount >= 5) {
          webhook.status = "disabled";
        }
      } else {
        delivery.status = "retrying";
        delivery.nextRetryAt = new Date(Date.now() + this.retryDelayMs * delivery.attempts);
      }
    }

    this.webhooks.set(webhook.id, webhook);
  }

  async retryFailed(): Promise<number> {
    const now = new Date();
    let retried = 0;

    for (const delivery of this.deliveryQueue) {
      if (delivery.status === "retrying" && delivery.nextRetryAt && delivery.nextRetryAt <= now) {
        const webhook = this.webhooks.get(delivery.webhookId);
        if (webhook) {
          await this.processDelivery(delivery, webhook, {} as any);
          retried++;
        }
      }
    }

    return retried;
  }

  getDeliveryLog(limit?: number): WebhookDelivery[] {
    const log = [...this.deliveryQueue].reverse();
    return limit ? log.slice(0, limit) : log;
  }

  getDeliveriesForWebhook(webhookId: string, limit?: number): WebhookDelivery[] {
    const deliveries = this.deliveryQueue
      .filter((d) => d.webhookId === webhookId)
      .reverse();
    return limit ? deliveries.slice(0, limit) : deliveries;
  }

  private generateSecret(): string {
    return `whsec_${nanoid(32)}`;
  }

  private generateSignature(secret: string, payload: unknown): string {
    const hmac = createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest("hex")}`;
  }

  verifySignature(secret: string, payload: string, signature: string): boolean {
    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    const provided = signature.replace("sha256=", "");
    return expected === provided;
  }

  setupEventListeners(): () => void {
    const eventMapping: Partial<Record<EventType, WebhookEvent>> = {
      "trade:opened": "trade.opened",
      "trade:closed": "trade.closed",
      "trade:imported": "trade.imported",
      "account:synced": "account.synced",
      "goal:achieved": "goal.achieved",
      "alert:triggered": "alert.triggered",
      "prop:rule_violated": "prop.violation",
      "prop:phase_advanced": "prop.phase_advanced",
      "leaderboard:updated": "leaderboard.updated",
    };

    const unsubscribers: Array<() => void> = [];

    for (const [eventType, webhookEvent] of Object.entries(eventMapping)) {
      const unsub = subscribe(eventType as EventType, async (payload: any) => {
        await this.triggerForUser(payload.userId, webhookEvent!, payload);
      });
      unsubscribers.push(unsub);
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }
}

export const webhookManager = new WebhookManager();

export async function registerWebhook(
  userId: string,
  config: Omit<WebhookConfig, "id" | "userId" | "secret" | "createdAt" | "updatedAt" | "failureCount">
): Promise<WebhookConfig> {
  return webhookManager.registerWebhook(userId, config);
}

export async function triggerWebhook<T extends WebhookEvent>(
  webhookId: string,
  event: T,
  data: EventMapping[T]
): Promise<WebhookDelivery> {
  return webhookManager.triggerWebhook(webhookId, event, data);
}

export async function triggerWebhooksForUser<T extends WebhookEvent>(
  userId: string,
  event: T,
  data: EventMapping[T]
): Promise<WebhookDelivery[]> {
  return webhookManager.triggerForUser(userId, event, data);
}

export default webhookManager;
