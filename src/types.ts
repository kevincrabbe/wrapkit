/**
 * Core types for wrapkit
 */

/**
 * Extracts all method paths from a nested object type
 * e.g., { chat: { completions: { create: () => void } } }
 * becomes "chat.completions.create"
 */
export type DeepMethodPaths<T, Prefix extends string = ''> = {
  [K in keyof T]: K extends string
    ? T[K] extends (...args: unknown[]) => unknown
      ? `${Prefix}${K}`
      : T[K] extends object
        ? DeepMethodPaths<T[K], `${Prefix}${K}.`>
        : never
    : never;
}[keyof T];

/**
 * Retry helper passed to onError hook
 */
export interface RetryHelper {
  retry: (opts?: RetryOptions) => Promise<unknown>;
}

export interface RetryOptions {
  delay?: number;
}

/**
 * Hook signatures
 */
export interface WrapHooks {
  before?: BeforeHook;
  after?: AfterHook;
  onError?: ErrorHook;
}

/**
 * Before hook can return modified args or undefined to use original args
 */
export type BeforeHook = (
  method: string,
  args: unknown[],
) => unknown[] | undefined | Promise<unknown[] | undefined>;

/**
 * After hook can return modified result or undefined to use original result
 */
export type AfterHook = (
  method: string,
  result: unknown,
) => unknown;

/**
 * Error hook can return a fallback value or throw
 */
export type ErrorHook = (
  method: string,
  error: Error,
  helpers: RetryHelper,
) => unknown;

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Requests per second */
  requestsPerSecond?: number;
  /** Requests per minute */
  requestsPerMinute?: number;
  /** Number of requests allowed */
  requests?: number;
  /** Time period: 'second' | 'minute' | 'hour' */
  per?: 'second' | 'minute' | 'hour';
  /** Rate limiting strategy */
  strategy?: 'sliding-window' | 'token-bucket' | 'fixed-window';
  /** Max concurrent requests */
  concurrency?: number;
}

/**
 * Per-method rate limit configuration
 */
export interface PerMethodRateLimitConfig {
  default?: RateLimitConfig;
  perMethod?: Record<string, RateLimitConfig>;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum concurrent requests */
  concurrency?: number;
  /** Timeout per request in ms */
  timeout?: number;
  /** Maximum queue size */
  maxSize?: number;
}

/**
 * Main configuration for wrap()
 */
export interface WrapConfig {
  /** Lifecycle hooks */
  hooks?: WrapHooks;
  /** Rate limiting (simple or per-method) */
  rateLimit?: RateLimitConfig | PerMethodRateLimitConfig;
  /** Queue configuration */
  queue?: QueueConfig;
  /** Allowed methods (glob patterns supported) - mutually exclusive with blocklist */
  allowlist?: string[];
  /** Blocked methods (glob patterns supported) - mutually exclusive with allowlist */
  blocklist?: string[];
}

/**
 * Plugin definition
 */
export interface Plugin<TContext = unknown> {
  name: string;
  before?: (ctx: PluginContext) => TContext | Promise<TContext>;
  after?: (ctx: PluginContext & { context: TContext }) => void | Promise<void>;
  onError?: (
    ctx: PluginContext & { error: Error; context: TContext },
  ) => void | Promise<void>;
}

export interface PluginContext {
  method: string;
  args: unknown[];
  result?: unknown;
}

/**
 * Event types emitted by wrapped client
 */
export interface WrapkitEvents {
  queued: { method: string; queueSize: number };
  executing: { method: string; concurrent: number };
  completed: { method: string; duration: number };
  rateLimited: { method: string; retryAfter: number };
  error: { method: string; error: Error; willRetry: boolean };
}

export type WrapkitEventName = keyof WrapkitEvents;

/**
 * Statistics available on wrapped client
 */
export interface WrapkitStats {
  requestsPerMinute: number;
  averageLatency: number;
  errorRate: number;
  totalRequests: number;
}

/**
 * Queue control interface
 */
export interface QueueControl {
  size: number;
  pending: number;
  pause: () => void;
  resume: () => void;
  clear: () => void;
}

/**
 * The wrapped client type - preserves original type with additions
 */
export type WrappedClient<T> = T & {
  on: <E extends WrapkitEventName>(
    event: E,
    handler: (data: WrapkitEvents[E]) => void,
  ) => void;
  off: <E extends WrapkitEventName>(
    event: E,
    handler: (data: WrapkitEvents[E]) => void,
  ) => void;
  withOptions: (opts: PerCallOptions) => T;
  use: <TContext>(plugin: Plugin<TContext>) => WrappedClient<T>;
  stats: WrapkitStats;
  queue: QueueControl;
};

/**
 * Per-call override options
 */
export interface PerCallOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  skipQueue?: boolean;
}
