/**
 * Wrapper state management
 */

import type {
  WrapConfig,
  WrapkitEvents,
  WrapkitEventName,
  WrapkitStats,
  QueueControl,
  PerCallOptions,
  Plugin,
} from './types';
import { createRateLimiter } from './rate-limiter';
import type { RateLimiterState } from './rate-limiter';
import {
  createQueue,
  pauseQueue,
  resumeQueue,
  clearQueue,
  getQueueSize,
  getRunningCount,
} from './queue';
import type { QueueState } from './queue';

export type EventHandler = (data: unknown) => void;

export interface WrapperState {
  stats: WrapkitStats;
  queueControl: QueueControl;
  queueState: QueueState | undefined;
  listeners: Map<WrapkitEventName, Set<EventHandler>>;
  config: WrapConfig | undefined;
  rateLimiter: RateLimiterState | undefined;
  latencies: number[];
  perCallOptions: PerCallOptions | undefined;
  plugins: Plugin[];
}

function createQueueControl(state: WrapperState): QueueControl {
  return {
    get size() {
      return state.queueState ? getQueueSize(state.queueState) : 0;
    },
    get pending() {
      return state.queueState ? getRunningCount(state.queueState) : 0;
    },
    pause: () => {
      if (state.queueState) pauseQueue(state.queueState);
    },
    resume: () => {
      if (state.queueState) resumeQueue(state.queueState);
    },
    clear: () => {
      if (state.queueState) clearQueue(state.queueState);
    },
  };
}

export function createInitialState(config: WrapConfig | undefined): WrapperState {
  const rateLimiter = config?.rateLimit
    ? createRateLimiter(config.rateLimit)
    : undefined;

  const queueState = config?.queue ? createQueue(config.queue) : undefined;

  const state: WrapperState = {
    stats: {
      requestsPerMinute: 0,
      averageLatency: 0,
      errorRate: 0,
      totalRequests: 0,
    },
    queueControl: {
      size: 0,
      pending: 0,
      pause: () => undefined,
      resume: () => undefined,
      clear: () => undefined,
    },
    queueState,
    listeners: new Map(),
    config,
    rateLimiter,
    latencies: [],
    perCallOptions: undefined,
    plugins: [],
  };

  if (queueState) {
    state.queueControl = createQueueControl(state);
  }

  return state;
}

export function createOn(state: WrapperState) {
  return <E extends WrapkitEventName>(
    event: E,
    handler: (data: WrapkitEvents[E]) => void,
  ) => {
    if (!state.listeners.has(event)) {
      state.listeners.set(event, new Set());
    }
    state.listeners.get(event)?.add(handler as EventHandler);
  };
}

export function createOff(state: WrapperState) {
  return <E extends WrapkitEventName>(
    event: E,
    handler: (data: WrapkitEvents[E]) => void,
  ) => {
    state.listeners.get(event)?.delete(handler as EventHandler);
  };
}

export function emitEvent<E extends WrapkitEventName>(
  state: WrapperState,
  event: E,
  data: WrapkitEvents[E],
): void {
  const handlers = state.listeners.get(event);
  if (handlers) {
    for (const handler of handlers) {
      handler(data);
    }
  }
}

export function updateStats(state: WrapperState, latencyMs: number): void {
  state.latencies.push(latencyMs);
  state.stats.totalRequests += 1;

  const sum = state.latencies.reduce((a, b) => a + b, 0);
  state.stats.averageLatency = sum / state.latencies.length;
}
