/**
 * Plugin system for wrapkit
 */

import type { Plugin, PluginContext } from './types';

/**
 * Helper function to define a type-safe plugin
 *
 * @example
 * ```typescript
 * const metricsPlugin = definePlugin({
 *   name: 'metrics',
 *   before({ method }) {
 *     return { startTime: Date.now() };
 *   },
 *   after({ method, context }) {
 *     console.log(`${method} took ${Date.now() - context.startTime}ms`);
 *   },
 * });
 * ```
 */
export function definePlugin<TContext = void>(
  plugin: Plugin<TContext>,
): Plugin<TContext> {
  return plugin;
}

export interface PluginExecution {
  plugin: Plugin;
  context: unknown;
}

export async function runPluginsBefore(
  plugins: Plugin[],
  ctx: PluginContext,
): Promise<PluginExecution[]> {
  const executions: PluginExecution[] = [];

  for (const plugin of plugins) {
    if (plugin.before) {
      const context = await Promise.resolve(plugin.before(ctx));
      executions.push({ plugin, context });
    } else {
      executions.push({ plugin, context: undefined });
    }
  }

  return executions;
}

export async function runPluginsAfter(
  executions: PluginExecution[],
  ctx: PluginContext,
): Promise<void> {
  const reversed = [...executions].reverse();
  for (const { plugin, context } of reversed) {
    if (plugin.after) {
      await Promise.resolve(plugin.after({ ...ctx, context }));
    }
  }
}

export async function runPluginsOnError(
  executions: PluginExecution[],
  ctx: PluginContext,
  error: Error,
): Promise<void> {
  const reversed = [...executions].reverse();
  for (const { plugin, context } of reversed) {
    if (plugin.onError) {
      await Promise.resolve(plugin.onError({ ...ctx, context, error }));
    }
  }
}
