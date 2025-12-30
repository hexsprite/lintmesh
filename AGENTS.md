# Lintmesh Agent Instructions

Use `lintmesh` to run multiple linters in parallel and get unified JSON output. It's designed for AI agents - one command, structured output, all issues in one place.

## Quick Start

```bash
# Lint everything (uses eslint + oxlint + tsc by default)
lintmesh

# Lint specific files or directories
lintmesh src/
lintmesh src/utils/files.ts src/runner.ts

# Quiet mode (no stderr progress, just JSON on stdout)
lintmesh --quiet
```

## Output Format

JSON to stdout. Always valid JSON, even on failure.

### Root Object

```typescript
{
  timestamp: string;        // ISO 8601, e.g. "2025-01-15T10:30:00.000Z"
  cwd: string;              // Absolute path to working directory
  durationMs: number;       // Total wall-clock time in milliseconds
  linters: LinterRun[];     // Info about each linter that ran (may be empty)
  issues: Issue[];          // All problems found, sorted by path → line → column
  summary: Summary;         // Aggregate counts
}
```

### LinterRun

One entry per linter that was attempted:

```typescript
{
  name: string;             // "eslint" | "oxlint" | "tsgo" | "biome" | "tsc"
  version: string;          // e.g. "9.15.0", "unknown" if detection failed
  success: boolean;         // false if linter crashed or timed out
  error?: string;           // Present only if success=false
  durationMs: number;       // This linter's execution time
  filesProcessed: number;   // How many files it checked
}
```

### Issue

Each problem found. Sorted by `path`, then `line`, then `column`:

```typescript
{
  // Location (all 1-indexed)
  path: string;             // Relative to cwd, e.g. "src/utils/files.ts"
  line: number;             // Start line, 1-indexed
  column: number;           // Start column, 1-indexed
  endLine: number;          // End line (same as line if single-point)
  endColumn: number;        // End column

  // Classification
  severity: "error" | "warning" | "info";
  ruleId: string;           // Format: "linter/rule-name"
                            // Examples: "eslint/no-unused-vars"
                            //           "oxlint/no-debugger"
                            //           "tsc/TS2322" (type errors use TS codes)
  message: string;          // Human-readable, e.g. "'foo' is defined but never used"
  source: string;           // Which linter: "eslint", "oxlint", "tsc", "biome"

  // Optional fields
  fix?: Fix;                // Present if autofix available
  meta?: RuleMeta;          // Present if rule metadata available
}
```

### Fix (optional)

Present only when the linter provides an autofix. Apply replacements in reverse offset order to avoid invalidating positions:

```typescript
{
  replacements: Array<{
    startOffset: number;    // 0-indexed byte offset from file start
    endOffset: number;      // Exclusive end offset
    text: string;           // Replacement text (empty string = deletion)
  }>;
}
```

### RuleMeta (optional)

Additional rule information when available:

```typescript
{
  docsUrl?: string;         // Link to rule documentation
  category?: string;        // e.g. "best-practices", "stylistic", "correctness"
  fixable?: boolean;        // true if rule supports autofix
}
```

### Summary

Aggregate counts for quick checks:

```typescript
{
  total: number;            // Total issues (errors + warnings + info)
  errors: number;           // Severity = "error"
  warnings: number;         // Severity = "warning"
  info: number;             // Severity = "info"
  fixable: number;          // Issues with fix field present
}
```

### Edge Cases

| Scenario | Result |
|----------|--------|
| No files match patterns | `issues: []`, `summary.total: 0`, exit 0 |
| Linter not installed | Skipped, warning on stderr, not in `linters` array |
| Linter crashes | `success: false`, `error` field set, its issues omitted |
| All linters fail | Exit 2 (tool error) |
| Timeout | Treated as linter failure |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, no issues above threshold |
| 1 | Issues found at or above `--fail-on` level |
| 2 | Tool error (invalid args, all linters failed, etc.) |

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--linters <list>` | `eslint,oxlint,tsc` | Comma-separated linters to run |
| `--fail-on <level>` | `error` | Exit 1 threshold: `error`, `warning`, `info` |
| `--timeout <ms>` | `30000` | Per-linter timeout |
| `--quiet` | `false` | Suppress stderr progress |
| `--pretty` | `false` | Pretty-print JSON |
| `--cwd <path>` | `.` | Working directory |

## Agent Patterns

### Run after code changes

```bash
# After editing files, check for new issues
lintmesh --quiet src/
```

### Parse in shell

```bash
# Get error count
lintmesh --quiet | jq '.summary.errors'

# List files with issues
lintmesh --quiet | jq -r '.issues[].path' | sort -u

# Get first 5 issues
lintmesh --quiet | jq '.issues[:5]'
```

### Fix workflow

1. Run lintmesh to get issues
2. Issues with `fix` field are autofixable
3. Apply fixes using byte offsets (or use linter's native fix)
4. Re-run to verify

### Common filters

```bash
# Only errors (ignore warnings)
lintmesh --quiet | jq '.issues | map(select(.severity == "error"))'

# Issues in specific file
lintmesh --quiet | jq '.issues | map(select(.path | contains("runner.ts")))'

# Group by file
lintmesh --quiet | jq '.issues | group_by(.path)'
```

## Supported Linters

| Linter | What it catches |
|--------|-----------------|
| `eslint` | JS/TS lint rules, code quality |
| `oxlint` | Fast Rust-based linter, subset of eslint rules |
| `tsc` | TypeScript compiler errors |
| `biome` | Fast Rust-based formatter + linter |

Linters must be installed separately. Lintmesh skips unavailable ones with a warning.

## When to Use

- After writing/editing code: catch issues early
- Before committing: verify no regressions
- Debugging CI failures: reproduce locally with same output format
- Batch fixing: get all issues across all linters in one pass
