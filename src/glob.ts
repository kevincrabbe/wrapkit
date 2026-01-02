/**
 * Glob pattern matching for method paths
 *
 * Patterns:
 * - `chat.completions.create` - exact match
 * - `chat.*` - shallow match (single segment)
 * - `chat.**` - deep match (one or more segments)
 * - `*.create` - any single segment followed by .create
 * - `**.create` - any segments followed by .create
 */

interface MatchResult {
  isMatch: boolean;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern: string): RegExp {
  const parts = pattern.split('.');
  const regexParts: string[] = [];

  for (const part of parts) {
    if (part === '**') {
      regexParts.push('.+');
    } else if (part === '*') {
      regexParts.push('[^.]+');
    } else {
      regexParts.push(escapeRegex(part));
    }
  }

  return new RegExp(`^${regexParts.join('\\.')}$`);
}

export function matchPattern(methodPath: string, pattern: string): MatchResult {
  const regex = patternToRegex(pattern);
  return { isMatch: regex.test(methodPath) };
}

export function matchesAnyPattern(
  methodPath: string,
  patterns: string[],
): boolean {
  return patterns.some((pattern) => matchPattern(methodPath, pattern).isMatch);
}

interface AccessCheckResult {
  isAllowed: boolean;
  reason: string | undefined;
}

interface AccessCheckOptions {
  methodPath: string;
  allowlist: string[] | undefined;
  blocklist: string[] | undefined;
}

export function checkAccess(options: AccessCheckOptions): AccessCheckResult {
  const { methodPath, allowlist, blocklist } = options;

  if (blocklist && matchesAnyPattern(methodPath, blocklist)) {
    return {
      isAllowed: false,
      reason: `Method "${methodPath}" is blocked`,
    };
  }

  if (allowlist && !matchesAnyPattern(methodPath, allowlist)) {
    return {
      isAllowed: false,
      reason: `Method "${methodPath}" is not allowed`,
    };
  }

  return { isAllowed: true, reason: undefined };
}
