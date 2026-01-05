# Wrapkit Development Todo

## Project Structure

```
wrapkit/
├── src/
│   ├── index.ts              # Main exports
│   ├── wrap.ts               # Core wrap() function
│   ├── types.ts              # TypeScript types
│   ├── plugin.ts             # Plugin system & pipeline
│   ├── state.ts              # Wrapper state management
│   ├── glob.ts               # Glob pattern matching
│   ├── rate-limiter.ts       # Rate limiting implementation
│   ├── queue.ts              # Queue system
│   ├── wrap.test.ts          # Core wrap tests
│   ├── hooks.test.ts         # Hook system tests
│   ├── access-control.test.ts # Allowlist/blocklist tests
│   ├── rate-limit.test.ts    # Rate limiting tests
│   ├── queue.test.ts         # Queue tests
│   ├── plugin.test.ts        # Plugin system tests
│   ├── openai.integration.test.ts  # OpenAI live API tests
│   └── integration/          # Type preservation tests
│       ├── openai.test-d.ts
│       ├── stripe.test-d.ts
│       └── twilio.test-d.ts
├── package.json
├── tsconfig.json
├── eslint.config.js
└── vitest.config.ts
```

## DX Decisions

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Define initialization pattern | P0 | Done | Hybrid: config object + fluent builder |
| 2 | Design hook system | P0 | Done | Named hooks + onion middleware for `.use()` |
| 3 | Design rate limiting config | P0 | Done | Descriptive object with per-method overrides |
| 4 | Design allowlist/blocklist syntax | P0 | Done | String arrays, mutually exclusive |
| 5 | Define glob pattern semantics | P1 | Done | `*` shallow, `**` deep (minimatch style) |
| 6 | Design per-call override API | P1 | Done | `.withOptions()` method |
| 7 | Design event system | P1 | Done | Built-in emitter: `client.on('event', fn)` |
| 8 | Define type preservation strategy | P0 | Done | Return original type, introspection via properties |

## Implementation

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Project setup (package.json, tsconfig, eslint) | P0 | Done | Vitest, ESLint strict, TypeScript strict |
| 2 | Core `wrap()` function with Proxy | P0 | Done | Deep proxy with path tracking (15 tests) |
| 3 | Type system for method path extraction | P0 | Done | `DeepMethodPaths<T>` in types.ts |
| 4 | Hook pipeline execution | P0 | Done | before -> execute -> after -> onError (8 tests) |
| 5 | Allowlist/blocklist with glob | P1 | Done | `*` shallow, `**` deep matching (13 tests) |
| 6 | Rate limiting | P1 | Done | Token bucket, concurrency, per-method (8 tests) |
| 7 | Queue system | P1 | Done | Priority queue, pause/resume/clear (9 tests) |
| 8 | Event emitter | P1 | Done | queued, executing, completed, rateLimited, error |
| 9 | `.withOptions()` implementation | P2 | Done | Priority, timeout, skipQueue (4 tests) |
| 10 | Plugin system `.use()` | P2 | Done | Fluent builder, onion model (13 tests) |
| 11 | Per-call timeout & skipQueue | P2 | Done | Integrated into `.withOptions()` |
| 12 | Export public API from index.ts | P2 | Pending | Clean exports |
| 13 | Documentation site | P3 | Pending | Docusaurus or similar |

## Test Coverage

### Unit Tests

| File | Tests | Status |
|------|-------|--------|
| wrap.test.ts | 19 | ✅ |
| hooks.test.ts | 8 | ✅ |
| access-control.test.ts | 13 | ✅ |
| rate-limit.test.ts | 8 | ✅ |
| queue.test.ts | 9 | ✅ |
| plugin.test.ts | 13 | ✅ |
| **Subtotal** | **70** | ✅ |

### Integration Tests

| File | Tests | Status |
|------|-------|--------|
| openai.integration.test.ts | 3 | ✅ |
| **Subtotal** | **3** | ✅ |

### Type Tests (.test-d.ts)

| File | Status | Notes |
|------|--------|-------|
| integration/openai.test-d.ts | ✅ | Type preservation verification |
| integration/stripe.test-d.ts | ✅ | Type preservation verification |
| integration/twilio.test-d.ts | ✅ | Type preservation verification |

### Total: 73 runtime tests

Integration test scenarios:
- ✅ Type preservation (autocomplete works after wrapping)
- ✅ Hook execution on real API calls (OpenAI)
- Rate limiting with actual API rate limits
- Error handling and retry with real errors
- Queue priority with concurrent requests

### Pending Integration Tests

| # | SDK | Priority | Status | Notes |
|---|-----|----------|--------|-------|
| 1 | Airtable | P2 | Pending | Test with bases, tables, records |
| 2 | Resend | P2 | Pending | Test with emails, domains |

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P0 | Critical - Must have for MVP |
| P1 | High - Core functionality |
| P2 | Medium - Important but not blocking |
| P3 | Low - Nice to have |
