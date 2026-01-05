/**
 * Core wrap() function - creates a type-safe wrapper around any API client
 */

import type {
  WrapConfig,
  WrappedClient,
  PerCallOptions,
  Plugin,
  PluginContext,
} from './types';
import {
  runPluginsBefore,
  runPluginsAfter,
  runPluginsOnError,
} from './plugin';
import type { PluginExecution } from './plugin';
import { checkAccess } from './glob';
import { tryAcquire, decrementConcurrent } from './rate-limiter';
import { enqueue, getRunningCount, getQueueSize } from './queue';
import {
  createInitialState,
  createOn,
  createOff,
  emitEvent,
  updateStats,
} from './state';
import type { WrapperState } from './state';

type AnyFunction = (...args: unknown[]) => unknown;

function createWithOptions(state: WrapperState, client: object) {
  return function withOptions(opts: PerCallOptions): object {
    const newState: WrapperState = { ...state, perCallOptions: opts };
    const ctx: ProxyContext = { state: newState, rootClient: client, path: '' };
    return createDeepProxy(client, ctx);
  };
}

function createUse(state: WrapperState, client: object) {
  return function use<TContext>(plugin: Plugin<TContext>): object {
    const newState: WrapperState = {
      ...state,
      plugins: [...state.plugins, plugin as Plugin],
    };
    const ctx: ProxyContext = { state: newState, rootClient: client, path: '' };
    return createDeepProxy(client, ctx);
  };
}

type WrapperPropertyHandler = (state: WrapperState, client: object) => unknown;

const wrapperPropertyHandlers: Record<string, WrapperPropertyHandler> = {
  on: (state) => createOn(state),
  off: (state) => createOff(state),
  withOptions: (state, client) => createWithOptions(state, client),
  use: (state, client) => createUse(state, client),
  stats: (state) => state.stats,
  queue: (state) => state.queueControl,
};

function handleWrapperProperty(
  prop: string | symbol,
  state: WrapperState,
  rootClient: object,
): unknown {
  if (typeof prop !== 'string') return undefined;
  const handler = wrapperPropertyHandlers[prop];
  return handler?.(state, rootClient);
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

interface ExecuteCoreParams {
  fn: AnyFunction;
  target: object;
  args: unknown[];
  hookCtx: HookContext;
}

async function runMethodWithPlugins(
  params: ExecuteCoreParams,
  pluginExecutions: PluginExecution[],
): Promise<unknown> {
  const { fn, target, args, hookCtx } = params;
  const { state, methodPath } = hookCtx;
  const hooks = state.config?.hooks;

  const execCtx: ExecutionContext = { fn, target, args, methodPath };

  try {
    const result = await Promise.resolve(fn.apply(target, args));
    const afterCtx: PluginContext = { method: methodPath, args, result };
    await runPluginsAfter(pluginExecutions, afterCtx);
    return await runAfterHook(hooks, methodPath, result);
  } catch (error) {
    if (error instanceof Error) {
      const errorCtx: PluginContext = { method: methodPath, args };
      await runPluginsOnError(pluginExecutions, errorCtx, error);
    }
    return handleError(hooks, execCtx, error);
  }
}

function emitCompletion(state: WrapperState, methodPath: string, startTime: number): void {
  const latencyMs = Date.now() - startTime;
  updateStats(state, latencyMs);
  emitEvent(state, 'completed', { method: methodPath, duration: latencyMs });

  if (state.rateLimiter) {
    decrementConcurrent(state.rateLimiter, methodPath);
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
  const concurrent = state.queueState ? getRunningCount(state.queueState) : 1;
  emitEvent(state, 'executing', { method: methodPath, concurrent });

  try {
    await waitForRateLimit(hookCtx);
    const finalArgs = await runBeforeHook(state.config?.hooks, methodPath, args);
    const pluginCtx: PluginContext = { method: methodPath, args: finalArgs };
    const pluginExecutions = await runPluginsBefore(state.plugins, pluginCtx);
    const params: ExecuteCoreParams = { fn, target, args: finalArgs, hookCtx };
    return await runMethodWithPlugins(params, pluginExecutions);
  } finally {
    emitCompletion(state, methodPath, startTime);
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
