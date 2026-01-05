# Plugins

Plugins provide a composable way to extend wrapped clients with reusable functionality.

## Using Plugins

Chain plugins with the `.use()` method:

```typescript
import { wrap, definePlugin } from 'wrapkit';

const client = wrap(openai)
  .use(loggingPlugin)
  .use(metricsPlugin)
  .use(retryPlugin);
```

Each `.use()` call returns a new wrapped client with the plugin added.

## Writing Plugins

Use `definePlugin()` for type-safe plugin definitions:

```typescript
import { definePlugin } from 'wrapkit';

const myPlugin = definePlugin({
  name: 'my-plugin',
  before: (ctx) => { /* ... */ },
  after: (ctx) => { /* ... */ },
  onError: (ctx) => { /* ... */ },
});
```

## Plugin Interface

```typescript
interface Plugin<TContext = unknown> {
  name: string;
  before?: (ctx: PluginContext) => TContext | Promise<TContext>;
  after?: (ctx: PluginContext & { context: TContext }) => void | Promise<void>;
  onError?: (ctx: PluginContext & { error: Error; context: TContext }) => void | Promise<void>;
}

interface PluginContext {
  method: string;
  args: unknown[];
  result?: unknown;  // Only in after hook
}
```

## Context Passing

The `before` hook can return a context object that gets passed to `after` and `onError`:

```typescript
interface TimingContext {
  startTime: number;
}

const timingPlugin = definePlugin<TimingContext>({
  name: 'timing',
  before: ({ method }) => {
    return { startTime: Date.now() };
  },
  after: ({ method, context }) => {
    const duration = Date.now() - context.startTime;
    console.log(`${method} took ${duration}ms`);
  },
  onError: ({ method, error, context }) => {
    const duration = Date.now() - context.startTime;
    console.error(`${method} failed after ${duration}ms:`, error);
  },
});
```

## Execution Order (Onion Model)

Plugins follow an "onion" execution model:

```
→ plugin1.before
  → plugin2.before
    → plugin3.before
      → METHOD EXECUTION
    ← plugin3.after
  ← plugin2.after
← plugin1.after
```

- `before` hooks run in registration order (first to last)
- `after` hooks run in reverse order (last to first)
- `onError` hooks run in reverse order (last to first)

## Example Plugins

### Logging Plugin

```typescript
const loggingPlugin = definePlugin({
  name: 'logging',
  before: ({ method, args }) => {
    console.log(`→ ${method}`, args);
  },
  after: ({ method, result }) => {
    console.log(`← ${method}`, result);
  },
  onError: ({ method, error }) => {
    console.error(`✕ ${method}`, error);
  },
});
```

### Metrics Plugin

```typescript
interface MetricsContext {
  startTime: number;
}

const metricsPlugin = definePlugin<MetricsContext>({
  name: 'metrics',
  before: ({ method }) => {
    metrics.increment(`api.${method}.calls`);
    return { startTime: Date.now() };
  },
  after: ({ method, context }) => {
    const duration = Date.now() - context.startTime;
    metrics.timing(`api.${method}.duration`, duration);
    metrics.increment(`api.${method}.success`);
  },
  onError: ({ method, context }) => {
    const duration = Date.now() - context.startTime;
    metrics.timing(`api.${method}.duration`, duration);
    metrics.increment(`api.${method}.error`);
  },
});
```

### Retry Plugin

```typescript
interface RetryContext {
  attempts: number;
}

const retryPlugin = definePlugin<RetryContext>({
  name: 'retry',
  before: () => ({ attempts: 0 }),
  onError: ({ error, context }) => {
    context.attempts++;
    if (context.attempts < 3 && isRetryable(error)) {
      // Note: actual retry logic would need additional implementation
      console.log(`Retry attempt ${context.attempts}`);
    }
  },
});
```

### Cache Plugin

```typescript
const cache = new Map<string, unknown>();

const cachePlugin = definePlugin({
  name: 'cache',
  before: ({ method, args }) => {
    const key = `${method}:${JSON.stringify(args)}`;
    if (cache.has(key)) {
      // Return cached value by throwing a special marker
      // (Real implementation would need a different approach)
    }
    return { key };
  },
  after: ({ result, context }) => {
    cache.set(context.key, result);
  },
});
```

## Combining with Config Hooks

Plugins work alongside config hooks. Config hooks run first:

```
→ config.before
  → plugins.before (in order)
    → METHOD
  ← plugins.after (reverse order)
← config.after
```

```typescript
const client = wrap(openai, {
  hooks: {
    before: (method, args) => {
      // Runs first
      return args;
    },
  },
}).use(plugin1).use(plugin2);
```
