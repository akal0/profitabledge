import { publish } from "./event-bus";

export type CacheTier = "memory" | "redis";

export type CacheOptions = {
  ttl?: number;
  tier?: CacheTier;
  tags?: string[];
  compress?: boolean;
  namespace?: string;
};

export type CacheStats = {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
};

export type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  namespace: string;
  compressed: boolean;
  accessCount: number;
  lastAccessedAt: number;
};

export type CacheKeyBuilder = {
  prefix: string;
  parts: (string | number)[];
  tags?: string[];
};

export const CacheTTL = {
  REALTIME: 5000,
  SHORT: 30000,
  MEDIUM: 60000,
  LONG: 300000,
  HOURLY: 3600000,
  DAILY: 86400000,
} as const;

export const cacheNamespaces = {
  TRADES: "trades",
  ACCOUNTS: "accounts",
  METRICS: "metrics",
  LEADERBOARD: "leaderboard",
  ANALYTICS: "analytics",
  USER: "user",
  SESSION: "session",
  AI: "ai",
} as const;

class EnhancedCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private namespaceIndex: Map<string, Set<string>> = new Map();
  private stats = { hits: 0, misses: 0 };
  private maxMemorySize = 100 * 1024 * 1024;
  private maxEntries = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private debug = false;

  constructor() {
    this.startCleanupInterval();
  }

  enableDebug(enabled: boolean = true): void {
    this.debug = enabled;
  }

  buildKey(builder: CacheKeyBuilder): string {
    const key = `${builder.prefix}:${builder.parts.join(":")}`;
    return builder.tags ? key : key;
  }

  async get<T>(
    key: string,
    loader?: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T | null> {
    const entry = this.memoryCache.get(key);

    if (entry) {
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        this.removeFromIndexes(key, entry.tags, entry.namespace);
        this.stats.misses++;
      } else {
        entry.accessCount++;
        entry.lastAccessedAt = now;
        this.stats.hits++;

        if (this.debug) {
          console.log(`[Cache] HIT: ${key}`);
        }

        return entry.data as T;
      }
    } else {
      this.stats.misses++;
    }

    if (loader) {
      const data = await loader();
      if (data !== null && data !== undefined) {
        await this.set(key, data, options);
        return data;
      }
    }

    if (this.debug) {
      console.log(`[Cache] MISS: ${key}`);
    }

    return null;
  }

  async getOrLoad<T>(key: string, loader: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await loader();
    await this.set(key, data, options);
    return data;
  }

  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? CacheTTL.MEDIUM;
    const tags = options?.tags ?? [];
    const namespace = options?.namespace ?? "default";

    this.ensureCapacity();

    const existing = this.memoryCache.get(key);
    if (existing) {
      this.removeFromIndexes(key, existing.tags, existing.namespace);
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags,
      namespace,
      compressed: options?.compress ?? false,
      accessCount: 0,
      lastAccessedAt: Date.now(),
    };

    this.memoryCache.set(key, entry);
    this.addToIndexes(key, tags, namespace);

    if (this.debug) {
      console.log(`[Cache] SET: ${key} (TTL: ${ttl}ms, Tags: ${tags.join(", ")})`);
    }
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    this.memoryCache.delete(key);
    this.removeFromIndexes(key, entry.tags, entry.namespace);

    if (this.debug) {
      console.log(`[Cache] DELETE: ${key}`);
    }

    return true;
  }

  async invalidate(key: string): Promise<void> {
    await this.delete(key);
  }

  async invalidatePattern(pattern: RegExp): Promise<number> {
    let count = 0;

    for (const key of this.memoryCache.keys()) {
      if (pattern.test(key)) {
        await this.delete(key);
        count++;
      }
    }

    if (this.debug) {
      console.log(`[Cache] Invalidated ${count} entries matching pattern: ${pattern}`);
    }

    return count;
  }

  async invalidateByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    const keysToDelete = [...keys];
    for (const key of keysToDelete) {
      await this.delete(key);
    }

    if (this.debug) {
      console.log(`[Cache] Invalidated ${keysToDelete.length} entries with tag: ${tag}`);
    }

    return keysToDelete.length;
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) {
      total += await this.invalidateByTag(tag);
    }
    return total;
  }

  async invalidateByNamespace(namespace: string): Promise<number> {
    const keys = this.namespaceIndex.get(namespace);
    if (!keys) return 0;

    const keysToDelete = [...keys];
    for (const key of keysToDelete) {
      await this.delete(key);
    }

    if (this.debug) {
      console.log(`[Cache] Invalidated ${keysToDelete.length} entries in namespace: ${namespace}`);
    }

    return keysToDelete.length;
  }

  async invalidateAccount(accountId: string): Promise<void> {
    await this.invalidatePattern(new RegExp(`:${accountId}`));
    await this.invalidateByTag(`account:${accountId}`);

    await publish("cache:invalidated", {
      pattern: `account:${accountId}`,
      keys: [],
    });
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.tagIndex.clear();
    this.namespaceIndex.clear();

    if (this.debug) {
      console.log(`[Cache] Cleared all entries`);
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    let memoryUsage = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      memoryUsage += key.length * 2;
      memoryUsage += JSON.stringify(entry.data).length * 2;
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.memoryCache.size,
      memoryUsage,
    };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return false;
    }

    return true;
  }

  getRemainingTTL(key: string): number {
    const entry = this.memoryCache.get(key);
    if (!entry) return 0;

    const remaining = entry.ttl - (Date.now() - entry.timestamp);
    return Math.max(0, remaining);
  }

  touch(key: string, additionalTTL?: number): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    entry.timestamp = Date.now();
    if (additionalTTL) {
      entry.ttl += additionalTTL;
    }

    return true;
  }

  keys(): string[] {
    return [...this.memoryCache.keys()];
  }

  entries(): Array<{ key: string; entry: CacheEntry<any> }> {
    return [...this.memoryCache.entries()].map(([key, entry]) => ({ key, entry }));
  }

  private addToIndexes(key: string, tags: string[], namespace: string): void {
    for (const tag of tags) {
      const tagKeys = this.tagIndex.get(tag) || new Set();
      tagKeys.add(key);
      this.tagIndex.set(tag, tagKeys);
    }

    const nsKeys = this.namespaceIndex.get(namespace) || new Set();
    nsKeys.add(key);
    this.namespaceIndex.set(namespace, nsKeys);
  }

  private removeFromIndexes(key: string, tags: string[], namespace: string): void {
    for (const tag of tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    const nsKeys = this.namespaceIndex.get(namespace);
    if (nsKeys) {
      nsKeys.delete(key);
      if (nsKeys.size === 0) {
        this.namespaceIndex.delete(namespace);
      }
    }
  }

  private ensureCapacity(): void {
    if (this.memoryCache.size >= this.maxEntries) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    const entries = [...this.memoryCache.entries()]
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    const toEvict = entries.slice(0, Math.floor(this.maxEntries * 0.1));

    for (const [key, entry] of toEvict) {
      this.memoryCache.delete(key);
      this.removeFromIndexes(key, entry.tags, entry.namespace);
    }

    if (this.debug) {
      console.log(`[Cache] Evicted ${toEvict.length} LRU entries`);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        this.removeFromIndexes(key, entry.tags, entry.namespace);
        cleaned++;
      }
    }

    if (this.debug && cleaned > 0) {
      console.log(`[Cache] Cleanup removed ${cleaned} expired entries`);
    }

    return cleaned;
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const enhancedCache = new EnhancedCache();

export const cacheKeys = {
  liveMetrics: (accountId: string) => ({
    prefix: cacheNamespaces.METRICS,
    parts: ["live", accountId],
    tags: [`account:${accountId}`, "live"],
  }),

  accountStats: (accountId: string) => ({
    prefix: cacheNamespaces.ACCOUNTS,
    parts: ["stats", accountId],
    tags: [`account:${accountId}`],
  }),

  openTrades: (accountId: string) => ({
    prefix: cacheNamespaces.TRADES,
    parts: ["open", accountId],
    tags: [`account:${accountId}`, "trades"],
  }),

  closedTrades: (accountId: string, page: number) => ({
    prefix: cacheNamespaces.TRADES,
    parts: ["closed", accountId, page],
    tags: [`account:${accountId}`, "trades"],
  }),

  tradeAnalysis: (tradeId: string) => ({
    prefix: cacheNamespaces.ANALYTICS,
    parts: ["trade", tradeId],
    tags: [`trade:${tradeId}`],
  }),

  leaderboard: (category: string, period: string) => ({
    prefix: cacheNamespaces.LEADERBOARD,
    parts: [category, period],
    tags: ["leaderboard"],
  }),

  userPreferences: (userId: string) => ({
    prefix: cacheNamespaces.USER,
    parts: ["prefs", userId],
    tags: [`user:${userId}`],
  }),

  assistantPlan: (hash: string) => ({
    prefix: cacheNamespaces.AI,
    parts: ["plan", hash],
    tags: ["ai", "assistant"],
  }),

  sessionMetrics: (accountId: string, session: string) => ({
    prefix: cacheNamespaces.ANALYTICS,
    parts: ["session", accountId, session],
    tags: [`account:${accountId}`, "analytics"],
  }),

  dailyStats: (accountId: string, date: string) => ({
    prefix: cacheNamespaces.METRICS,
    parts: ["daily", accountId, date],
    tags: [`account:${accountId}`, "metrics"],
  }),
};

export function createCachedFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyBuilder: (...args: TArgs) => string,
  options?: CacheOptions
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const key = keyBuilder(...args);
    return enhancedCache.getOrLoad(key, () => fn(...args), options);
  };
}

export function memoize<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => TResult,
  options?: CacheOptions
): (...args: TArgs) => TResult {
  const cache = new Map<string, { value: TResult; timestamp: number }>();
  const ttl = options?.ttl ?? CacheTTL.MEDIUM;

  return (...args: TArgs): TResult => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  };
}

export default enhancedCache;
