# Wrapkit Documentation

> Type-safe wrapper for API clients with hooks, rate limiting, queueing, and access control.

## Installation

```bash
npm install wrapkit
```

## Quick Start

```typescript
import { wrap } from 'wrapkit';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Wrap with rate limiting
const client = wrap(openai, {
  rateLimit: { requestsPerSecond: 10 },
});

// Use exactly like the original client - full type safety preserved
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

---

## Configuration

### Basic Config Object

```typescript
const client = wrap(openai, {
  // Rate limiting
  rateLimit: {
    requestsPerSecond: 10,
    // OR
    requests: 100,
    per: 'minute',
    // OR
    concurrency: 5,
  },

  // Lifecycle hooks
  hooks: {
    before: (method, args) => {
      console.log(`Calling ${method}`);
      return args; // Can modify args
    },
    after: (method, result) => {
      console.log(`${method} completed`);
      return result; // Can modify result
    },
    onError: (method, error, { retry }) => {
      if (error.status === 429) {
        return retry({ delay: 1000 }); // Retry after 1s
      }
      throw error;
    },
  },

  // Access control (use ONE, not both)
  allowlist: ['chat.completions.create', 'embeddings.**'],
  // OR
  blocklist: ['files.delete', 'fine_tuning.**'],

  // Queue configuration
  queue: {
    concurrency: 5,
    timeout: 30000,
  },
});
```

### Fluent Builder (Advanced)

```typescript
import { wrap, rateLimit, retry, queue } from 'wrapkit';

const client = wrap(openai)
  .use(rateLimit({ requestsPerSecond: 10 }))
  .use(retry({ maxAttempts: 3, backoff: 'exponential' }))
  .use(queue({ concurrency: 5 }))
  .use(customPlugin)
  .allow('chat.completions.create')
  .allow('embeddings.**')
  .build();
```

---

## Hooks

### Hook Lifecycle

```
API Call
  -> before (can modify args)
  -> [rate limit check]
  -> [queue if needed]
  -> [actual API call]
  -> after (can modify result)
  -> return to caller

On Error:
  -> onError (can retry or throw)
```

### Hook Signatures

```typescript
hooks: {
  // Called before each API call
  before: (method: string, args: unknown[]) => unknown[] | void;

  // Called after successful API call
  after: (method: string, result: unknown) => unknown | void;

  // Called on error - can retry or rethrow
  onError: (
    method: string,
    error: Error,
    helpers: { retry: (opts?: { delay?: number }) => Promise<unknown> }
  ) => unknown | never;
}
```

### Example: Logging Hook

```typescript
const client = wrap(openai, {
  hooks: {
    before: (method, args) => {
      console.log(`[${new Date().toISOString()}] Calling ${method}`);
    },
    after: (method, result) => {
      console.log(`[${new Date().toISOString()}] ${method} completed`);
    },
  },
});
```

---

## Rate Limiting

### Simple Rate Limit

```typescript
const client = wrap(openai, {
  rateLimit: { requestsPerSecond: 10 },
});
```

### Advanced Rate Limit

```typescript
const client = wrap(openai, {
  rateLimit: {
    requests: 1000,
    per: 'minute',
    strategy: 'sliding-window', // or 'token-bucket', 'fixed-window'
  },
});
```

### Per-Method Rate Limits

```typescript
const client = wrap(openai, {
  rateLimit: {
    default: { requestsPerSecond: 10 },
    'chat.completions.create': { requestsPerSecond: 5 },
    'embeddings.create': { requestsPerSecond: 50 },
  },
});
```

---

## Queueing

```typescript
const client = wrap(openai, {
  queue: {
    concurrency: 5,        // Max concurrent requests
    timeout: 30000,        // Per-request timeout (ms)
    maxSize: 1000,         // Max queued items
  },
});

// Queue introspection
console.log(client.queue.size);     // Current queue size
console.log(client.queue.pending);  // Currently executing

// Queue control
client.queue.pause();   // Pause processing
client.queue.resume();  // Resume processing
client.queue.clear();   // Clear all queued items
```

---

## Allowlist / Blocklist

**Important**: Use `allowlist` OR `blocklist`, not both. Providing both throws an error.

### Allowlist (Whitelist)

Only specified methods are allowed:

```typescript
const client = wrap(openai, {
  allowlist: [
    'chat.completions.create',
    'embeddings.create',
    'models.list',
  ],
});
```

### Blocklist (Blacklist)

All methods allowed except specified:

```typescript
const client = wrap(openai, {
  blocklist: [
    'files.delete',
    'fine_tuning.**',
  ],
});
```

### Glob Patterns

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `chat.completions.create` | Exact method only | - |
| `chat.*` | `chat.foo`, `chat.bar` | `chat.completions.create` |
| `chat.**` | All nested: `chat.completions.create`, etc. | - |
| `*.create` | `embeddings.create`, `files.create` | `chat.completions.create` |
| `**.create` | All `.create` methods at any depth | - |

---

## Per-Call Overrides

Use `.withOptions()` to override config for a single call:

```typescript
// Override timeout and priority for this call only
await client
  .withOptions({
    timeout: 60000,
    priority: 'high',
    skipQueue: true,
  })
  .chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Important request' }],
  });
```

---

## Events

Subscribe to lifecycle events for monitoring and observability:

```typescript
// Request queued
client.on('queued', ({ method, queueSize }) => {
  console.log(`${method} queued. Queue size: ${queueSize}`);
});

// Request started executing
client.on('executing', ({ method, concurrent }) => {
  console.log(`${method} executing. Concurrent: ${concurrent}`);
});

// Request completed successfully
client.on('completed', ({ method, duration }) => {
  console.log(`${method} completed in ${duration}ms`);
});

// Rate limited (waiting to retry)
client.on('rateLimited', ({ method, retryAfter }) => {
  console.log(`${method} rate limited. Retry after ${retryAfter}ms`);
});

// Error occurred
client.on('error', ({ method, error, willRetry }) => {
  console.error(`${method} failed:`, error);
  if (willRetry) console.log('Will retry...');
});
```

---

## Statistics

Access runtime statistics:

```typescript
console.log(client.stats.requestsPerMinute);
console.log(client.stats.averageLatency);
console.log(client.stats.errorRate);
console.log(client.stats.totalRequests);
```

---

## Custom Plugins

Create reusable plugins with the fluent builder:

```typescript
import { definePlugin } from 'wrapkit';

const metricsPlugin = definePlugin({
  name: 'metrics',

  before({ method, args }) {
    return { startTime: Date.now() };
  },

  after({ method, result, context }) {
    const duration = Date.now() - context.startTime;
    metrics.record(method, duration);
  },

  onError({ method, error }) {
    metrics.recordError(method, error);
  },
});

// Use the plugin
const client = wrap(openai)
  .use(metricsPlugin)
  .build();
```

---

## TypeScript

Wrapkit preserves full type safety. The wrapped client has the exact same type as the original:

```typescript
const openai = new OpenAI({ apiKey: '...' });
const client = wrap(openai, { rateLimit: { rps: 10 } });

// Full autocomplete and type checking works
const response = await client.chat.completions.create({
  model: 'gpt-4',  // Autocompletes valid models
  messages: [{ role: 'user', content: 'Hello' }],
});

// response is typed as ChatCompletion
console.log(response.choices[0].message.content);
```

---

## Examples

### Wrap OpenAI with Full Features

```typescript
import { wrap } from 'wrapkit';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = wrap(openai, {
  rateLimit: {
    default: { requestsPerSecond: 10 },
    'chat.completions.create': { requestsPerSecond: 3 },
  },
  queue: { concurrency: 5 },
  hooks: {
    before: (method, args) => console.log(`-> ${method}`),
    after: (method) => console.log(`<- ${method}`),
    onError: (method, error, { retry }) => {
      if (error.status === 429) return retry({ delay: 2000 });
      throw error;
    },
  },
  allowlist: ['chat.completions.create', 'embeddings.**'],
});

// Monitor events
client.on('rateLimited', ({ method }) => {
  console.warn(`Rate limited: ${method}`);
});

// Use the client
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Wrap Airtable

```typescript
import { wrap } from 'wrapkit';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: '...' }).base('appXXX');

const client = wrap(base, {
  rateLimit: { requestsPerSecond: 5 }, // Airtable limit
  hooks: {
    onError: (method, error, { retry }) => {
      if (error.statusCode === 429) {
        return retry({ delay: 30000 }); // Airtable wants 30s
      }
      throw error;
    },
  },
});
```
