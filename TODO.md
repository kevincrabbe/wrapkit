# Wrapkit Development Todo

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
| 9 | `.withOptions()` implementation | P2 | Done | Priority override working, timeout pending |
| 10 | Plugin system `.use()` | P2 | Pending | Fluent builder pattern |
| 11 | Per-call timeout & skipQueue | P2 | Pending | Extend `.withOptions()` |
| 12 | Export public API from index.ts | P2 | Pending | Clean exports |
| 13 | Documentation site | P3 | Pending | Docusaurus or similar |

## Test Coverage

### Unit Tests

| File | Tests | Status |
|------|-------|--------|
| wrap.test.ts | 15 | ✅ |
| hooks.test.ts | 8 | ✅ |
| access-control.test.ts | 13 | ✅ |
| rate-limit.test.ts | 8 | ✅ |
| queue.test.ts | 9 | ✅ |
| **Total** | **53** | ✅ |

### Integration Tests

| # | SDK | Priority | Status | Notes |
|---|-----|----------|--------|-------|
| 1 | OpenAI | P1 | Done | Type preservation tests (6 tests) |
| 2 | Stripe | P1 | Done | Type preservation tests (6 tests) |
| 3 | Twilio | P1 | Done | Type preservation tests (6 tests) |
| 4 | Airtable | P2 | Pending | Test with bases, tables, records |
| 5 | Resend | P2 | Pending | Test with emails, domains |

Integration test scenarios:
- ✅ Type preservation (autocomplete works after wrapping)
- Hook execution on real API calls
- Rate limiting with actual API rate limits
- Error handling and retry with real errors
- Queue priority with concurrent requests

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P0 | Critical - Must have for MVP |
| P1 | High - Core functionality |
| P2 | Medium - Important but not blocking |
| P3 | Low - Nice to have |
