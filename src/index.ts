/**
 * Wrapkit - Type-safe wrapper for API clients
 *
 * Features:
 * - Before/after hooks for function calls
 * - Rate limiting
 * - Queueing with priority
 * - Allowlist/blocklist for operations
 * - Full type safety (preserving wrapped client types)
 */

export { wrap } from './wrap';
export { definePlugin } from './plugin';

// Types
export type {
  WrapConfig,
  WrapHooks,
  RateLimitConfig,
  QueueConfig,
  WrappedClient,
  Plugin,
  PerCallOptions,
  WrapkitEvents,
  WrapkitStats,
} from './types';

// Built-in plugins will be exported here once implemented
// export { rateLimit } from './plugins/rate-limit';
// export { retry } from './plugins/retry';
// export { queue } from './plugins/queue';
