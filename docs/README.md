# Wrapkit Documentation

Type-safe wrapper for API clients with hooks, rate limiting, queueing, and plugins.

## Quick Start

```typescript
import { wrap } from 'wrapkit';
import OpenAI from 'openai';

const openai = new OpenAI();

const client = wrap(openai, {
  rateLimit: { requestsPerSecond: 10 },
  queue: { concurrency: 5 },
  hooks: {
    before: (method, args) => {
      console.log(`Calling ${method}`);
      return args;
    },
  },
});

// Use exactly like the original client - fully typed
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Features

- **Type Preservation** - Wrapped client has the same type as the original
- **Hooks** - Before/after/onError lifecycle hooks
- **Rate Limiting** - Token bucket with per-method overrides
- **Queueing** - Priority queue with pause/resume/clear
- **Access Control** - Allowlist/blocklist with glob patterns
- **Plugins** - Composable middleware with `.use()`
- **Per-call Options** - Override settings via `.withOptions()`

## Documentation

- [Configuration](./configuration.md) - All configuration options
- [Plugins](./plugins.md) - Writing and using plugins
- [API Reference](./api.md) - Complete API documentation

## Basic Usage

### With Configuration

```typescript
const client = wrap(openai, {
  // Rate limiting
  rateLimit: {
    requestsPerSecond: 10,
    concurrency: 5,
  },

  // Queueing
  queue: {
    concurrency: 3,
    timeout: 30000,
    maxSize: 100,
  },

  // Access control (mutually exclusive)
  allowlist: ['chat.completions.create', 'models.*'],
  // OR
  blocklist: ['files.**'],

  // Lifecycle hooks
  hooks: {
    before: (method, args) => args,
    after: (method, result) => result,
    onError: (method, error, { retry }) => retry(),
  },
});
```

### With Plugins

```typescript
import { wrap, definePlugin } from 'wrapkit';

const loggingPlugin = definePlugin({
  name: 'logging',
  before: ({ method, args }) => {
    console.log(`-> ${method}`, args);
    return { startTime: Date.now() };
  },
  after: ({ method, result, context }) => {
    console.log(`<- ${method} (${Date.now() - context.startTime}ms)`);
  },
});

const client = wrap(openai)
  .use(loggingPlugin)
  .use(retryPlugin)
  .use(metricsPlugin);
```

### Per-call Options

```typescript
// Set timeout for a specific call
await client
  .withOptions({ timeout: 5000 })
  .chat.completions.create({ model: 'gpt-4', messages: [] });

// Skip the queue for urgent requests
await client
  .withOptions({ skipQueue: true, priority: 'critical' })
  .chat.completions.create({ model: 'gpt-4', messages: [] });
```

### Events

```typescript
client.on('queued', ({ method, queueSize }) => {
  console.log(`Queued: ${method}, queue size: ${queueSize}`);
});

client.on('rateLimited', ({ method, retryAfter }) => {
  console.log(`Rate limited: ${method}, retry after ${retryAfter}ms`);
});

client.on('completed', ({ method, duration }) => {
  console.log(`Completed: ${method} in ${duration}ms`);
});
```

### Queue Control

```typescript
// Check queue status
console.log(client.queue.size);    // Items waiting
console.log(client.queue.pending); // Currently executing

// Control the queue
client.queue.pause();  // Stop processing
client.queue.resume(); // Resume processing
client.queue.clear();  // Clear all queued items
```

### Statistics

```typescript
console.log(client.stats.totalRequests);
console.log(client.stats.averageLatency);
console.log(client.stats.requestsPerMinute);
console.log(client.stats.errorRate);
```
