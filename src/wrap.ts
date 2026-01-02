/**
 * Core wrap() function - creates a type-safe wrapper around any API client
 */

import type {
  WrapConfig,
  WrappedClient,
  WrapkitEvents,
  WrapkitEventName,
  WrapkitStats,
  QueueControl,
  PerCallOptions,
} from './types';
import { checkAccess } from './glob';
import {
  createRateLimiter,
  tryAcquire,
  decrementConcurrent,
} from './rate-limiter';
import type { RateLimiterState } from './rate-limiter';
import {
  createQueue,
  enqueue,
  pauseQueue,
  resumeQueue,
  clearQueue,
  getQueueSize,
  getRunningCount,
} from './queue';
import type { QueueState } from './queue';

interface WrapperState {
  stats: WrapkitStats;
  queueControl: QueueControl;
  queueState: QueueState | undefined;
  listeners: Map<WrapkitEventName, Set<EventHandler>>;
  config: WrapConfig | undefined;
  rateLimiter: RateLimiterState | undefined;
  latencies: number[];
  perCallOptions: PerCallOptions | undefined;
}

type EventHandler = (data: unknown) => void;
type AnyFunction = (...args: unknown[]) => unknown;

function createInitialState(config: WrapConfig | undefined): WrapperState {
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
  };

  if (queueState) {
    state.queueControl = createQueueControl(state);
  }

  return state;
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

function createOn(state: WrapperState) {
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

function createOff(state: WrapperState) {
  return <E extends WrapkitEventName>(
    event: E,
    handler: (data: WrapkitEvents[E]) => void,
  ) => {
    state.listeners.get(event)?.delete(handler as EventHandler);
  };
}

function createWithOptions(state: WrapperState, client: object) {
  return function withOptions(opts: PerCallOptions): object {
    const newState: WrapperState = { ...state, perCallOptions: opts };
    const ctx: ProxyContext = { state: newState, rootClient: client, path: '' };
    return createDeepProxy(client, ctx);
  };
}

function handleWrapperProperty(
  prop: string | symbol,
  state: WrapperState,
  rootClient: object,
): unknown {
  if (prop === 'on') return createOn(state);
  if (prop === 'off') return createOff(state);
  if (prop === 'withOptions') return createWithOptions(state, rootClient);
  if (prop === 'stats') return state.stats;
  if (prop === 'queue') return state.queueControl;
  return undefined;
}

interface HookContext {
  state: WrapperState;
  methodPath: string;
}

interface ExecutionContext {
  fn: AnyFunction;
  target: object;
  args: unknown[];
  methodPath: string;
}

async function runBeforeHook(
  hooks: WrapConfig['hooks'],
  methodPath: string,
  args: unknown[],
): Promise<unknown[]> {
  if (!hooks?.before) return args;
  const result = await Promise.resolve(hooks.before(methodPath, args));
  return result ?? args;
}

async function runAfterHook(
  hooks: WrapConfig['hooks'],
  methodPath: string,
  result: unknown,
): Promise<unknown> {
  if (!hooks?.after) return result;
  const modified = await Promise.resolve(hooks.after(methodPath, result));
  return modified ?? result;
}

function createRetryHelper(execCtx: ExecutionContext) {
  return {
    retry: () => Promise.resolve(execCtx.fn.apply(execCtx.target, execCtx.args)),
  };
}

function handleError(
  hooks: WrapConfig['hooks'],
  execCtx: ExecutionContext,
  error: unknown,
): unknown {
  if (hooks?.onError && error instanceof Error) {
    return hooks.onError(execCtx.methodPath, error, createRetryHelper(execCtx));
  }
  throw error;
}

function checkMethodAccess(hookCtx: HookContext): void {
  const config = hookCtx.state.config;
  const result = checkAccess({
    methodPath: hookCtx.methodPath,
    allowlist: config?.allowlist,
    blocklist: config?.blocklist,
  });

  if (!result.isAllowed) {
    throw new Error(result.reason);
  }
}

function emitEvent<E extends WrapkitEventName>(
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

function updateStats(state: WrapperState, latencyMs: number): void {
  state.latencies.push(latencyMs);
  state.stats.totalRequests += 1;

  const sum = state.latencies.reduce((a, b) => a + b, 0);
  state.stats.averageLatency = sum / state.latencies.length;
}

async function waitForRateLimit(hookCtx: HookContext): Promise<void> {
  const { state, methodPath } = hookCtx;
  if (!state.rateLimiter) return;

  let result = tryAcquire(state.rateLimiter, methodPath);

  while (!result.canProceed) {
    emitEvent(state, 'rateLimited', {
      method: methodPath,
      retryAfter: result.delayMs,
    });
    await new Promise((resolve) => setTimeout(resolve, result.delayMs));
    result = tryAcquire(state.rateLimiter, methodPath);
  }
}

async function executeCore(
  fn: AnyFunction,
  target: object,
  args: unknown[],
  hookCtx: HookContext,
): Promise<unknown> {
  const { state, methodPath } = hookCtx;
  const startTime = Date.now();

  emitEvent(state, 'executing', {
    method: methodPath,
    concurrent: state.queueState ? getRunningCount(state.queueState) : 1,
  });

  try {
    await waitForRateLimit(hookCtx);

    const hooks = state.config?.hooks;
    const finalArgs = await runBeforeHook(hooks, methodPath, args);
    const execCtx: ExecutionContext = {
      fn,
      target,
      args: finalArgs,
      methodPath,
    };

    try {
      const result = await Promise.resolve(fn.apply(target, finalArgs));
      return await runAfterHook(hooks, methodPath, result);
    } catch (error) {
      return handleError(hooks, execCtx, error);
    }
  } finally {
    const latencyMs = Date.now() - startTime;
    updateStats(state, latencyMs);

    emitEvent(state, 'completed', {
      method: methodPath,
      duration: latencyMs,
    });

    if (state.rateLimiter) {
      decrementConcurrent(state.rateLimiter, methodPath);
    }
  }
}

async function executeWithHooks(
  fn: AnyFunction,
  target: object,
  args: unknown[],
  hookCtx: HookContext,
): Promise<unknown> {
  checkMethodAccess(hookCtx);

  const { state, methodPath } = hookCtx;
  const priority = state.perCallOptions?.priority ?? 'normal';

  if (state.queueState) {
    emitEvent(state, 'queued', {
      method: methodPath,
      queueSize: getQueueSize(state.queueState) + 1,
    });

    return enqueue(state.queueState, {
      methodPath,
      priority,
      execute: () => executeCore(fn, target, args, hookCtx),
    });
  }

  return executeCore(fn, target, args, hookCtx);
}

function wrapFunction(
  fn: AnyFunction,
  context: object,
  hookCtx: HookContext,
): AnyFunction {
  return (...args: unknown[]) => {
    return executeWithHooks(fn, context, args, hookCtx);
  };
}

interface ProxyContext {
  state: WrapperState;
  rootClient: object;
  path: string;
}

function createProxyHandler(ctx: ProxyContext): ProxyHandler<object> {
  return {
    get(target: object, prop: string | symbol): unknown {
      const wrapperProp = handleWrapperProperty(prop, ctx.state, ctx.rootClient);
      if (wrapperProp !== undefined) return wrapperProp;

      const value: unknown = Reflect.get(target, prop);
      const propName = String(prop);
      const newPath = ctx.path ? `${ctx.path}.${propName}` : propName;

      if (value !== null && typeof value === 'object') {
        return createDeepProxy(value, { ...ctx, path: newPath });
      }

      if (typeof value === 'function') {
        const hookCtx: HookContext = { state: ctx.state, methodPath: newPath };
        return wrapFunction(value as AnyFunction, target, hookCtx);
      }

      return value;
    },
  };
}

function createDeepProxy(target: object, ctx: ProxyContext): object {
  return new Proxy(target, createProxyHandler(ctx));
}

function validateConfig(config?: WrapConfig): void {
  if (!config) return;

  if (config.allowlist && config.blocklist) {
    throw new Error(
      'Cannot specify both allowlist and blocklist. Use one or the other.',
    );
  }
}

/**
 * Wraps an API client with hooks, rate limiting, queueing, and access control.
 */
export function wrap<T extends object>(
  client: T,
  config?: WrapConfig,
): WrappedClient<T> {
  validateConfig(config);

  const state = createInitialState(config);
  const ctx: ProxyContext = { state, rootClient: client, path: '' };

  return createDeepProxy(client, ctx) as WrappedClient<T>;
}
