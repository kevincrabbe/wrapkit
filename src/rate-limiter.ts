/**
 * Token bucket rate limiter implementation
 */

import type { RateLimitConfig, PerMethodRateLimitConfig } from './types';

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
  tokensPerMs: number;
  maxTokens: number;
}

export interface RateLimiterState {
  buckets: Map<string, TokenBucket>;
  concurrentCount: Map<string, number>;
  config: RateLimitConfig | PerMethodRateLimitConfig;
}

interface AcquireResult {
  canProceed: boolean;
  delayMs: number;
}

function isPerMethodConfig(
  config: RateLimitConfig | PerMethodRateLimitConfig,
): config is PerMethodRateLimitConfig {
  return 'default' in config || 'perMethod' in config;
}

function getConfigForMethod(
  config: RateLimitConfig | PerMethodRateLimitConfig,
  methodPath: string,
): RateLimitConfig | undefined {
  if (!isPerMethodConfig(config)) {
    return config;
  }
  return config.perMethod?.[methodPath] ?? config.default;
}

function getRequestsPerSecond(config: RateLimitConfig): number {
  if (config.requestsPerSecond) {
    return config.requestsPerSecond;
  }
  if (config.requestsPerMinute) {
    return config.requestsPerMinute / 60;
  }
  return Infinity;
}

function createBucket(config: RateLimitConfig): TokenBucket {
  const rps = getRequestsPerSecond(config);
  const tokensPerMs = rps / 1000;
  const maxTokens = Math.max(1, Math.ceil(rps));

  return {
    tokens: maxTokens,
    lastRefill: Date.now(),
    tokensPerMs,
    maxTokens,
  };
}

function refillBucket(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const newTokens = elapsed * bucket.tokensPerMs;

  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + newTokens);
  bucket.lastRefill = now;
}

export function createRateLimiter(
  config: RateLimitConfig | PerMethodRateLimitConfig,
): RateLimiterState {
  return {
    buckets: new Map(),
    concurrentCount: new Map(),
    config,
  };
}

function getBucket(state: RateLimiterState, methodPath: string): TokenBucket {
  const methodConfig = getConfigForMethod(state.config, methodPath);
  if (!methodConfig) {
    return createBucket({ requestsPerSecond: Infinity });
  }

  let bucket = state.buckets.get(methodPath);
  if (!bucket) {
    bucket = createBucket(methodConfig);
    state.buckets.set(methodPath, bucket);
  }
  return bucket;
}

export function tryAcquire(
  state: RateLimiterState,
  methodPath: string,
): AcquireResult {
  const methodConfig = getConfigForMethod(state.config, methodPath);

  if (methodConfig?.concurrency) {
    const current = state.concurrentCount.get(methodPath) ?? 0;
    if (current >= methodConfig.concurrency) {
      return { canProceed: false, delayMs: 50 };
    }
  }

  const bucket = getBucket(state, methodPath);
  refillBucket(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    incrementConcurrent(state, methodPath);
    return { canProceed: true, delayMs: 0 };
  }

  const tokensNeeded = 1 - bucket.tokens;
  const delayMs = Math.ceil(tokensNeeded / bucket.tokensPerMs);

  return { canProceed: false, delayMs };
}

export function incrementConcurrent(
  state: RateLimiterState,
  methodPath: string,
): void {
  const current = state.concurrentCount.get(methodPath) ?? 0;
  state.concurrentCount.set(methodPath, current + 1);
}

export function decrementConcurrent(
  state: RateLimiterState,
  methodPath: string,
): void {
  const current = state.concurrentCount.get(methodPath) ?? 0;
  state.concurrentCount.set(methodPath, Math.max(0, current - 1));
}

export async function acquireWithDelay(
  state: RateLimiterState,
  methodPath: string,
): Promise<number> {
  const result = tryAcquire(state, methodPath);

  if (result.canProceed) {
    return 0;
  }

  await new Promise((resolve) => setTimeout(resolve, result.delayMs));
  return acquireWithDelay(state, methodPath);
}
