# Configuration

All configuration options for `wrap()`.

## WrapConfig

```typescript
interface WrapConfig {
  hooks?: WrapHooks;
  rateLimit?: RateLimitConfig | PerMethodRateLimitConfig;
  queue?: QueueConfig;
  allowlist?: string[];
  blocklist?: string[];
}
```

## Hooks

Lifecycle hooks for intercepting method calls.

```typescript
interface WrapHooks {
  before?: BeforeHook;
  after?: AfterHook;
  onError?: ErrorHook;
}
```

### before

Called before the method executes. Can modify arguments.

```typescript
type BeforeHook = (
  method: string,
  args: unknown[],
) => unknown[] | undefined | Promise<unknown[] | undefined>;
```

**Example:**
```typescript
hooks: {
  before: (method, args) => {
    console.log(`Calling ${method} with`, args);
    // Return modified args or undefined to use original
    return args;
  },
}
```

### after

Called after successful execution. Can modify the result.

```typescript
type AfterHook = (method: string, result: unknown) => unknown;
```

**Example:**
```typescript
hooks: {
  after: (method, result) => {
    console.log(`${method} returned`, result);
    return result; // or return modified result
  },
}
```

### onError

Called when an error occurs. Can return a fallback value or rethrow.

```typescript
type ErrorHook = (
  method: string,
  error: Error,
  helpers: { retry: () => Promise<unknown> },
) => unknown;
```

**Example:**
```typescript
hooks: {
  onError: (method, error, { retry }) => {
    if (error.message.includes('rate limit')) {
      return retry(); // Retry the request
    }
    throw error; // Rethrow other errors
  },
}
```

## Rate Limiting

Control request rates to avoid API limits.

```typescript
interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  concurrency?: number;
}
```

### Simple Rate Limit

```typescript
rateLimit: {
  requestsPerSecond: 10,
  concurrency: 5,
}
```

### Per-Method Rate Limits

```typescript
rateLimit: {
  default: { requestsPerSecond: 10 },
  perMethod: {
    'chat.completions.create': { requestsPerSecond: 5 },
    'embeddings.create': { requestsPerSecond: 20 },
  },
}
```

## Queue

Manage concurrent requests with a priority queue.

```typescript
interface QueueConfig {
  concurrency?: number;  // Max concurrent requests (default: 1)
  timeout?: number;      // Per-request timeout in ms
  maxSize?: number;      // Max queue size (rejects when full)
}
```

**Example:**
```typescript
queue: {
  concurrency: 3,
  timeout: 30000,
  maxSize: 100,
}
```

## Access Control

Restrict which methods can be called.

### Allowlist

Only allow specific methods. Uses glob patterns.

```typescript
allowlist: [
  'chat.completions.create',  // Exact match
  'models.*',                  // Shallow glob (models.list, models.get)
  'files.**',                  // Deep glob (files.create, files.content.get)
]
```

### Blocklist

Block specific methods. Uses glob patterns.

```typescript
blocklist: [
  'files.delete',
  'fine_tuning.**',
]
```

> **Note:** `allowlist` and `blocklist` are mutually exclusive. Using both throws an error.

### Glob Patterns

| Pattern | Matches |
|---------|---------|
| `*` | Single segment (shallow) |
| `**` | Multiple segments (deep) |
| `*.create` | Any namespace with `.create` |
| `**.create` | Any depth with `.create` |

## Per-Call Options

Override settings for individual calls using `.withOptions()`.

```typescript
interface PerCallOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  skipQueue?: boolean;
}
```

**Example:**
```typescript
// Urgent request with high priority
await client
  .withOptions({ priority: 'critical', timeout: 5000 })
  .chat.completions.create({ model: 'gpt-4', messages: [] });

// Skip the queue entirely
await client
  .withOptions({ skipQueue: true })
  .models.list();
```
