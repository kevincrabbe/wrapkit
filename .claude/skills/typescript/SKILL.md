---
name: typescript
description: TypeScript guidelines covering type safety, RORO pattern, complexity limits, and error handling patterns. Use when writing TypeScript code.
---

# TypeScript Development

Apply these guidelines when working with TypeScript code.

## Types

### Avoid using 'any'

Never use the `any` type. Always provide proper types.

### Do not define inline object types

Do not define object/record types inline in parameter lists or return types. Create a named type/interface (or import an existing one) and use that name in the signature. Do the same for return shapes (e.g. `Promise<Result>` not `Promise<{…}>`).

```typescript
// Bad
async execute(args: { sessionId: string; voiceId: string }): Promise<{ sessionAudioId: string }> { … }

// Good
export type ExecuteArgs = {
  sessionId: string;
  voiceId: string;
};

export type ExecuteResult = {
  sessionAudioId: string;
};

export async function execute(args: ExecuteArgs): Promise<ExecuteResult> {
  …
}
```

### Use 'is' and 'has' prefixes for booleans

Boolean variables and functions should use `is` or `has` prefixes (e.g., `isActive`, `hasPermission`).

## Functions

### Use the RORO pattern

Receive an object, return an object.

## Complexity

### Keep cyclomatic complexity below 6

If you have a large switch case, consider strategy pattern/dispatch table.

### Do not chain more than 2 array iteration methods

Store as variable and continue on next line if more processing is needed.

### Do not nest blocks more than 3 levels deep

Keep nesting shallow for better readability.
