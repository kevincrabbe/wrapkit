# API Reference

Complete API documentation for wrapkit.

## Functions

### wrap

Creates a type-safe wrapper around an API client.

```typescript
function wrap<T extends object>(client: T, config?: WrapConfig): WrappedClient<T>
```

**Parameters:**
- `client` - The API client to wrap
- `config` - Optional configuration (see [Configuration](./configuration.md))

**Returns:** `WrappedClient<T>` - The wrapped client with the same type as the original, plus additional methods.

**Example:**
```typescript
const wrapped = wrap(openai, {
  rateLimit: { requestsPerSecond: 10 },
});
```

### definePlugin

Helper function to define a type-safe plugin.

```typescript
function definePlugin<TContext = void>(plugin: Plugin<TContext>): Plugin<TContext>
```

**Parameters:**
- `plugin` - Plugin definition object

**Returns:** The same plugin object (for type inference)

**Example:**
```typescript
const myPlugin = definePlugin<{ startTime: number }>({
  name: 'timing',
  before: () => ({ startTime: Date.now() }),
  after: ({ context }) => console.log(`Took ${Date.now() - context.startTime}ms`),
});
```

## WrappedClient<T>

The wrapped client type extends the original client type `T` with additional methods and properties.

### Methods

#### on

Subscribe to events.

```typescript
on<E extends WrapkitEventName>(event: E, handler: (data: WrapkitEvents[E]) => void): void
```

**Events:**
- `queued` - Request added to queue
- `executing` - Request started executing
- `completed` - Request completed successfully
- `rateLimited` - Request was rate limited
- `error` - Request failed

**Example:**
```typescript
client.on('completed', ({ method, duration }) => {
  console.log(`${method} completed in ${duration}ms`);
});
```

#### off

Unsubscribe from events.

```typescript
off<E extends WrapkitEventName>(event: E, handler: (data: WrapkitEvents[E]) => void): void
```

#### withOptions

Create a client with per-call option overrides.

```typescript
withOptions(opts: PerCallOptions): T
```

**Options:**
- `timeout?: number` - Request timeout in ms
- `priority?: 'low' | 'normal' | 'high' | 'critical'` - Queue priority
- `skipQueue?: boolean` - Bypass the queue

**Example:**
```typescript
await client
  .withOptions({ timeout: 5000, priority: 'high' })
  .chat.completions.create({ model: 'gpt-4', messages: [] });
```

#### use

Add a plugin to the client.

```typescript
use<TContext>(plugin: Plugin<TContext>): WrappedClient<T>
```

**Example:**
```typescript
const enhanced = client.use(loggingPlugin).use(metricsPlugin);
```

### Properties

#### stats

Request statistics.

```typescript
stats: WrapkitStats
```

```typescript
interface WrapkitStats {
  requestsPerMinute: number;
  averageLatency: number;
  errorRate: number;
  totalRequests: number;
}
```

#### queue

Queue control interface.

```typescript
queue: QueueControl
```

```typescript
interface QueueControl {
  size: number;     // Items waiting in queue
  pending: number;  // Currently executing
  pause(): void;    // Pause processing
  resume(): void;   // Resume processing
  clear(): void;    // Clear all queued items
}
```

## Types

### WrapConfig

Main configuration object.

```typescript
interface WrapConfig {
  hooks?: WrapHooks;
  rateLimit?: RateLimitConfig | PerMethodRateLimitConfig;
  queue?: QueueConfig;
  allowlist?: string[];
  blocklist?: string[];
}
```

### WrapHooks

Lifecycle hooks.

```typescript
interface WrapHooks {
  before?: BeforeHook;
  after?: AfterHook;
  onError?: ErrorHook;
}

type BeforeHook = (method: string, args: unknown[]) => unknown[] | undefined | Promise<unknown[] | undefined>;
type AfterHook = (method: string, result: unknown) => unknown;
type ErrorHook = (method: string, error: Error, helpers: RetryHelper) => unknown;
```

### RateLimitConfig

Rate limiting options.

```typescript
interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  concurrency?: number;
}

interface PerMethodRateLimitConfig {
  default?: RateLimitConfig;
  perMethod?: Record<string, RateLimitConfig>;
}
```

### QueueConfig

Queue options.

```typescript
interface QueueConfig {
  concurrency?: number;
  timeout?: number;
  maxSize?: number;
}
```

### Plugin

Plugin definition.

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
  result?: unknown;
}
```

### WrapkitEvents

Event payloads.

```typescript
interface WrapkitEvents {
  queued: { method: string; queueSize: number };
  executing: { method: string; concurrent: number };
  completed: { method: string; duration: number };
  rateLimited: { method: string; retryAfter: number };
  error: { method: string; error: Error; willRetry: boolean };
}

type WrapkitEventName = keyof WrapkitEvents;
```

### PerCallOptions

Per-call override options.

```typescript
interface PerCallOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  skipQueue?: boolean;
}
```
