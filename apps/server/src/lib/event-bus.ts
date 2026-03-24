export type EventType =
  | "trade:opened"
  | "trade:closed"
  | "trade:updated"
  | "trade:imported"
  | "account:created"
  | "account:updated"
  | "account:synced"
  | "goal:created"
  | "goal:achieved"
  | "goal:progress"
  | "alert:triggered"
  | "webhook:received"
  | "notification:created"
  | "journal:entry_created"
  | "leaderboard:updated"
  | "prop:phase_advanced"
  | "prop:rule_violated"
  | "cache:invalidated";

export type EventPayloadMap = {
  "trade:opened": {
    tradeId: string;
    accountId: string;
    userId: string;
    symbol: string;
    tradeType: string;
    volume: number;
    openPrice: number;
  };
  "trade:closed": {
    tradeId: string;
    accountId: string;
    userId: string;
    symbol: string;
    tradeType: string;
    profit: number;
    rr: number | null;
  };
  "trade:updated": {
    tradeId: string;
    accountId: string;
    userId: string;
    changes: Record<string, unknown>;
  };
  "trade:imported": {
    accountId: string;
    userId: string;
    count: number;
    source: string;
  };
  "account:created": {
    accountId: string;
    userId: string;
    name: string;
    broker: string;
  };
  "account:updated": {
    accountId: string;
    userId: string;
    changes: Record<string, unknown>;
  };
  "account:synced": {
    accountId: string;
    userId: string;
    balance: number;
    equity: number;
    openTrades: number;
  };
  "goal:created": {
    goalId: string;
    userId: string;
    type: string;
    target: number;
  };
  "goal:achieved": {
    goalId: string;
    userId: string;
    type: string;
    value: number;
    target: number;
  };
  "goal:progress": {
    goalId: string;
    userId: string;
    progress: number;
    current: number;
    target: number;
  };
  "alert:triggered": {
    alertId: string;
    userId: string;
    type: string;
    message: string;
    value: number;
    threshold: number;
  };
  "webhook:received": {
    webhookType: string;
    userId: string;
    accountId?: string;
    data: Record<string, unknown>;
  };
  "notification:created": {
    notificationId: string;
    userId: string;
    type: string;
    title: string;
  };
  "journal:entry_created": {
    entryId: string;
    userId: string;
    accountId?: string;
    tradeId?: string;
  };
  "leaderboard:updated": {
    category: string;
    period: string;
    entriesCount: number;
  };
  "prop:phase_advanced": {
    accountId: string;
    userId: string;
    fromPhase: number;
    toPhase: number;
    firmName: string;
  };
  "prop:rule_violated": {
    accountId: string;
    userId: string;
    ruleType: string;
    currentValue: number;
    limit: number;
  };
  "cache:invalidated": {
    pattern: string;
    keys: string[];
  };
};

export type EventHandler<T extends EventType> = (
  payload: EventPayloadMap[T],
  metadata: EventMetadata
) => Promise<void> | void;

export type EventMetadata = {
  timestamp: Date;
  eventId: string;
  source: string;
  correlationId?: string;
};

export type Event<T extends EventType> = {
  type: T;
  payload: EventPayloadMap[T];
  metadata: EventMetadata;
};

type HandlerEntry = {
  handler: EventHandler<any>;
  priority: number;
};

class EventEmitter {
  private handlers: Map<EventType, HandlerEntry[]> = new Map();
  private eventLog: Event<any>[] = [];
  private maxLogSize = 1000;
  private debug = false;

  enableDebug(enabled: boolean = true): void {
    this.debug = enabled;
  }

  on<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>,
    options?: { priority?: number }
  ): () => void {
    const priority = options?.priority ?? 0;
    const handlers = this.handlers.get(eventType) || [];
    const entry: HandlerEntry = { handler, priority };

    handlers.push(entry);
    handlers.sort((a, b) => b.priority - a.priority);

    this.handlers.set(eventType, handlers);

    if (this.debug) {
      console.log(`[EventBus] Registered handler for ${eventType}`);
    }

    return () => {
      const currentHandlers = this.handlers.get(eventType) || [];
      const index = currentHandlers.findIndex((h) => h.handler === handler);
      if (index !== -1) {
        currentHandlers.splice(index, 1);
        this.handlers.set(eventType, currentHandlers);
      }
    };
  }

  async emit<T extends EventType>(
    eventType: T,
    payload: EventPayloadMap[T],
    options?: { source?: string; correlationId?: string }
  ): Promise<void> {
    const eventId = this.generateId();
    const metadata: EventMetadata = {
      timestamp: new Date(),
      eventId,
      source: options?.source ?? "unknown",
      correlationId: options?.correlationId,
    };

    const event: Event<T> = {
      type: eventType,
      payload,
      metadata,
    };

    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    if (this.debug) {
      console.log(`[EventBus] Emitting ${eventType}:`, payload);
    }

    const handlers = this.handlers.get(eventType) || [];
    const errors: Error[] = [];

    for (const { handler } of handlers) {
      try {
        await handler(payload, metadata);
      } catch (error) {
        errors.push(error as Error);
        console.error(`[EventBus] Handler error for ${eventType}:`, error);
      }
    }

    if (errors.length > 0 && this.debug) {
      console.error(`[EventBus] ${errors.length} handler(s) failed for ${eventType}`);
    }
  }

  emitSync<T extends EventType>(
    eventType: T,
    payload: EventPayloadMap[T],
    options?: { source?: string; correlationId?: string }
  ): void {
    const eventId = this.generateId();
    const metadata: EventMetadata = {
      timestamp: new Date(),
      eventId,
      source: options?.source ?? "unknown",
      correlationId: options?.correlationId,
    };

    const event: Event<T> = {
      type: eventType,
      payload,
      metadata,
    };

    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    const handlers = this.handlers.get(eventType) || [];

    for (const { handler } of handlers) {
      try {
        handler(payload, metadata);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${eventType}:`, error);
      }
    }
  }

  getEventLog(limit?: number): Event<any>[] {
    const log = [...this.eventLog].reverse();
    return limit ? log.slice(0, limit) : log;
  }

  getEventLogByType<T extends EventType>(
    eventType: T,
    limit?: number
  ): Event<T>[] {
    const filtered = this.eventLog.filter((e) => e.type === eventType) as Event<T>[];
    const reversed = [...filtered].reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }

  clearHandlers(eventType?: EventType): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  handlerCount(eventType?: EventType): number {
    if (eventType) {
      return this.handlers.get(eventType)?.length ?? 0;
    }
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.length;
    }
    return total;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const eventBus = new EventEmitter();

export function subscribe<T extends EventType>(
  eventType: T,
  handler: EventHandler<T>,
  options?: { priority?: number }
): () => void {
  return eventBus.on(eventType, handler, options);
}

export function publish<T extends EventType>(
  eventType: T,
  payload: EventPayloadMap[T],
  options?: { source?: string; correlationId?: string }
): Promise<void> {
  return eventBus.emit(eventType, payload, options);
}

export function publishSync<T extends EventType>(
  eventType: T,
  payload: EventPayloadMap[T],
  options?: { source?: string; correlationId?: string }
): void {
  return eventBus.emitSync(eventType, payload, options);
}

function generateCorrelationId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createEventBatch(): {
  add<T extends EventType>(eventType: T, payload: EventPayloadMap[T]): void;
  execute(options?: { source?: string; correlationId?: string }): Promise<void>;
} {
  const events: Array<{ type: EventType; payload: unknown }> = [];

  return {
    add<T extends EventType>(eventType: T, payload: EventPayloadMap[T]): void {
      events.push({ type: eventType, payload });
    },
    async execute(options?: { source?: string; correlationId?: string }): Promise<void> {
      const correlationId = options?.correlationId ?? generateCorrelationId();
      for (const event of events) {
        await eventBus.emit(event.type as any, event.payload as any, {
          ...options,
          correlationId,
        });
      }
    },
  };
}

export default eventBus;
