# Wrapkit - Claude Code Instructions

## Project Overview

Wrapkit is a TypeScript npm package that wraps API clients (like OpenAI, Airtable) to provide:
- Before/after hooks for function calls
- Rate limiting
- Queueing with priority
- Allowlist/blocklist for operations
- Full type safety (preserving wrapped client types)

## Project Structure

```
wrapkit/
├── src/
│   ├── index.ts          # Main exports
│   ├── wrap.ts           # Core wrap() function
│   ├── types.ts          # TypeScript types
│   ├── plugin.ts         # Plugin system
│   └── plugins/          # Built-in plugins
│       ├── rate-limit.ts
│       ├── retry.ts
│       └── queue.ts
├── package.json
├── tsconfig.json
├── eslint.config.js
└── vitest.config.ts
```

## Development Workflow

1. After implementing something, always run `npm run lint` to check for errors
2. Run `npm run typecheck` to verify types
3. Run `npm test` to run tests

## Code Style

- Use TypeScript strict mode
- Follow the eslint rules in eslint.config.js
- Keep functions under 75 lines
- Keep cyclomatic complexity under 6
- Use named types/interfaces, not inline object literals
- Use RORO pattern (Receive Object, Return Object)
- Comments explain WHY, not WHAT

## Key Design Decisions

- Glob patterns: `*` = shallow match, `**` = deep match
- Allowlist and blocklist are mutually exclusive (throws if both provided)
- Per-call overrides via `.withOptions()` method
- Built-in event emitter for observability
- Type preservation: wrapped client has same type as original
