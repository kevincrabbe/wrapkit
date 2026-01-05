/**
 * Wrapkit - Type-safe wrapper for API clients
 *
 * @example
 * ```typescript
 * import { wrap, definePlugin } from 'wrapkit';
 *
 * const client = wrap(openai, {
 *   rateLimit: { requestsPerSecond: 10 },
 *   queue: { concurrency: 5 },
 * });
 *
 * // Use plugins
 * const wrapped = client.use(loggingPlugin).use(metricsPlugin);
 *
 * // Per-call options
 * await wrapped.withOptions({ timeout: 5000 }).chat.completions.create({});
 * ```
 */

// Core functions
export { wrap } from './wrap';
export { definePlugin } from './plugin';

// Configuration types
export type {
  WrapConfig,
  WrapHooks,
  BeforeHook,
  AfterHook,
  ErrorHook,
  RetryHelper,
  RateLimitConfig,
  PerMethodRateLimitConfig,
  QueueConfig,
  PerCallOptions,
} from './types';

// Plugin types
export type { Plugin, PluginContext } from './types';

// Wrapped client types
export type {
  WrappedClient,
  WrapkitEvents,
  WrapkitEventName,
  WrapkitStats,
  QueueControl,
} from './types';
