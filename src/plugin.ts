/**
 * Plugin system for wrapkit
 */

import type { Plugin } from './types';

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
