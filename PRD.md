# lintmesh PRD

## Executive Summary

lintmesh is a TypeScript CLI tool that unifies multiple JavaScript/TypeScript linters behind a common interface, producing structured JSON output optimized for consumption by coding agents (LLMs). Instead of parsing inconsistent human-readable output from eslint, oxlint, and tsc, agents get a single predictable schema regardless of which linter found the issue.

**Core value proposition**: One command, multiple linters, one JSON schema. Agents parse once, act on everything.

## Problem Statement

Coding agents need to understand linting errors to fix code. Current pain points:

1. **Output fragmentation** - Each linter has its own output format (eslint's formatters, oxlint's ANSI-colored text, tsc's diagnostic output). Agents must parse each differently.

2. **Missing context** - Human-readable output often truncates details useful for automated fixes (rule documentation URLs, fix suggestions, related locations).

3. **Orchestration overhead** - Running multiple linters means multiple commands, multiple parsers, multiple failure modes. Agents waste context window on boilerplate.

4. **Inconsistent severity mapping** - "warning" vs "warn" vs severity level 1. Agents need normalization.

**Success looks like**: An agent runs `lintmesh --json` and gets back a single array of issues, each with enough context to understand and fix the problem without additional tool calls.

## Target Users

### Primary: Coding Agents (LLMs)

Automated code assistants that:
- Fix linting errors as part of code generation workflows
- Validate code changes before committing
- Provide explanations of what's wrong and why

**What they need**:
- Machine-parseable output (JSON)
- Consistent schema across all linters
- Rich context (rule docs, fix suggestions, affected ranges)
- Fast execution (don't burn tokens waiting)
- Predictable exit codes

### Secondary: Developers building agent tooling

Humans who:
- Build MCP servers or tool integrations
- Create IDE extensions that consume linter output
- Write CI/CD pipelines with structured error reporting

## MVP Goals

### Must Have (P0)

1. **CLI that runs linters and outputs JSON**
   - Single entry point: `lintmesh [files/globs]`
   - Unified JSON output schema
   - Non-zero exit on errors (configurable threshold)

2. **Three backend linters**
   - eslint (most common, richest ecosystem)
   - oxlint (fast, Rust-based)
   - tsc (TypeScript-native type checking as linting)

3. **Common Linter interface**
   - Each backend implements the same contract
   - Adapters normalize output to common schema
   - Backend detection (which linters are available?)

4. **Rich issue schema**
   - File path (absolute and relative)
   - Line/column (1-indexed, start and end)
   - Severity (error, warning, info)
   - Rule ID (linter-namespaced: `eslint/no-unused-vars`)
   - Message (human-readable description)
   - Linter source (which backend found this)

### Should Have (P1)

5. **Fix suggestions**
   - Include autofix text when linter provides it
   - Structured as replacements (range + new text)

6. **Rule metadata**
   - Documentation URL
   - Rule category/type
   - Whether rule is autofixable

7. **Parallel execution**
   - Run all linters concurrently
   - Stream results as they complete (optional)

### Could Have (P2)

8. **Configuration file**
   - `.lintmeshrc.json` for default options
   - Per-linter config passthrough

9. **Caching**
   - Skip unchanged files
   - Store results for incremental runs

10. **Custom backends**
    - Plugin interface for adding new linters

### Won't Have (MVP)

- IDE integration (consumers build this)
- Fix application (agents do this themselves)
- Rule configuration UI
- Historical trending/analytics
- Remote execution

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Parse success rate | 100% | Output must always be valid JSON |
| Schema consistency | 100% | Same fields present for all issues |
| Execution overhead | <500ms | Time added vs running linters directly |
| Backend coverage | 3 linters | eslint, oxlint, tsc working |
| Agent integration test | Pass | Claude Code can consume and act on output |

## Feature Requirements

### FR-1: CLI Interface

**Command structure**:
```bash
lintmesh [options] [files...]
```

**Options**:
| Flag | Description | Default |
|------|-------------|---------|
| `--json` | JSON output (default, explicit for clarity) | true |
| `--pretty` | Pretty-print JSON | false |
| `--linters <list>` | Comma-separated linter names | all available |
| `--fail-on <severity>` | Exit non-zero threshold | error |
| `--timeout <ms>` | Per-linter timeout | 30000 |
| `--cwd <path>` | Working directory | process.cwd() |
| `--quiet` | Suppress stderr progress | false |

**Exit codes**:
| Code | Meaning |
|------|---------|
| 0 | No issues at or above fail threshold |
| 1 | Issues found at or above fail threshold |
| 2 | Execution error (linter crashed, invalid config) |

### FR-2: Output Schema

```typescript
interface LintmeshOutput {
  /** Timestamp of run */
  timestamp: string;

  /** Working directory */
  cwd: string;

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Which linters ran */
  linters: LinterRun[];

  /** All issues found, sorted by file then line */
  issues: Issue[];

  /** Summary counts */
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    fixable: number;
  };
}

interface LinterRun {
  /** Linter identifier */
  name: 'eslint' | 'oxlint' | 'tsc';

  /** Linter version */
  version: string;

  /** Whether it ran successfully */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Duration in milliseconds */
  durationMs: number;

  /** Number of files processed */
  filesProcessed: number;
}

interface Issue {
  /** Absolute path to file */
  filePath: string;

  /** Path relative to cwd */
  relativeFilePath: string;

  /** 1-indexed start line */
  line: number;

  /** 1-indexed start column */
  column: number;

  /** 1-indexed end line (same as line if single-line) */
  endLine: number;

  /** 1-indexed end column */
  endColumn: number;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';

  /** Namespaced rule identifier */
  ruleId: string;

  /** Human-readable message */
  message: string;

  /** Which linter found this */
  source: 'eslint' | 'oxlint' | 'tsc';

  /** Optional fix suggestion */
  fix?: Fix;

  /** Optional rule metadata */
  meta?: RuleMeta;
}

interface Fix {
  /** Replacement operations to apply */
  replacements: Replacement[];
}

interface Replacement {
  /** Start offset in file (0-indexed bytes) */
  startOffset: number;

  /** End offset in file (0-indexed bytes) */
  endOffset: number;

  /** Text to insert */
  text: string;
}

interface RuleMeta {
  /** URL to rule documentation */
  docsUrl?: string;

  /** Rule category */
  category?: string;

  /** Whether rule supports autofix */
  fixable?: boolean;
}
```

### FR-3: Linter Interface

```typescript
interface Linter {
  /** Unique identifier */
  readonly name: string;

  /** Check if linter is available */
  isAvailable(): Promise<boolean>;

  /** Get version string */
  getVersion(): Promise<string>;

  /** Run linter on files */
  run(options: LinterOptions): Promise<LinterResult>;
}

interface LinterOptions {
  /** Files or globs to lint */
  files: string[];

  /** Working directory */
  cwd: string;

  /** Timeout in milliseconds */
  timeout: number;

  /** Additional linter-specific options */
  extra?: Record<string, unknown>;
}

interface LinterResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Error if failed */
  error?: Error;

  /** Raw issues from linter (normalized to common schema) */
  issues: Issue[];

  /** Files that were processed */
  filesProcessed: number;

  /** Execution time */
  durationMs: number;
}
```

### FR-4: Backend Implementations

#### eslint

- Invoke via Node API (`ESLint` class) when possible, CLI fallback
- Parse JSON formatter output
- Map severity: 2 = error, 1 = warning
- Preserve `fix` and `suggestions` arrays
- Handle flat config and legacy config

#### oxlint

- Invoke via CLI (Rust binary)
- Use `--format json` flag
- Map severity from string
- Handle missing rule metadata gracefully

#### tsc

- Invoke via CLI
- Parse JSON diagnostic output
- Map TS error codes to rule IDs (`tsc/TS2322`)
- Severity: errors are errors, others are warnings

## User Flows

### Flow 1: Agent runs lintmesh on a file

```
Agent                         lintmesh                    Backends
  |                              |                           |
  |-- lintmesh src/foo.ts ------>|                           |
  |                              |-- detect available ------>|
  |                              |<-- eslint, oxlint --------|
  |                              |                           |
  |                              |-- run eslint ------------>|
  |                              |-- run oxlint ------------>|
  |                              |<-- eslint results --------|
  |                              |<-- oxlint results --------|
  |                              |                           |
  |                              |-- normalize & merge ----->|
  |                              |-- dedupe by location ---->|
  |                              |-- sort by file/line ----->|
  |                              |                           |
  |<-- JSON output --------------|                           |
  |                              |                           |
  |-- parse JSON                 |                           |
  |-- for each issue: fix        |                           |
```

### Flow 2: Agent checks if code is clean

```
Agent                         lintmesh
  |                              |
  |-- lintmesh --quiet src/ ---->|
  |                              |
  |<-- exit code 0 --------------|  (clean)
  |                              |
  |-- lintmesh --quiet src/ ---->|
  |                              |
  |<-- exit code 1, JSON --------|  (issues found)
  |                              |
  |-- parse, count errors        |
  |-- decide whether to fix      |
```

### Flow 3: Selective linter execution

```
Agent                         lintmesh
  |                              |
  |-- lintmesh --linters=tsc -->|  (only type checking)
  |                              |
  |<-- JSON with TS errors ------|
  |                              |
  |-- fix type errors            |
  |                              |
  |-- lintmesh --linters=eslint->|  (now style)
  |                              |
  |<-- JSON with style issues ---|
```

## Wireframe Descriptions

Not applicable - CLI tool with JSON output. No UI components.

## Technical Considerations

### Runtime

- **Dev**: Bun (fast iteration, native TS, built-in test runner)
- **Target**: Node 22+, Bun (broad compatibility)
- TypeScript 5.x with strict mode
- Ship as bundled ESM (single file via `bun build`)

### Dependencies (minimal)

- `@aivenio/tsc-output-parser` - Parse tsc/tsc output
- `execa` - Process spawning with timeout
- `fast-glob` - File matching
- `zod` - Schema validation (output contracts)

### Testing

- `bun test` for all tests (unit + integration)
- >90% coverage requirement
- Comprehensive adapter parsing tests

### Backend detection

Each linter adapter checks availability:
- eslint: `require.resolve('eslint')` or `npx eslint --version`
- oxlint: `which oxlint` or `npx oxlint --version`
- tsc: `which tsc` or `npx tsc --version`

Skip unavailable linters gracefully, report in output.

### Performance

- Run linters in parallel (`Promise.all`)
- Stream output when possible (future enhancement)
- Cache detection results for session

### Error handling

- Linter crash: continue with others, report error in output
- Parse failure: include raw output in error, fail that linter
- Timeout: kill process, report timeout error
- No linters available: exit 2 with helpful message

## Assumptions & Validation Plan

### Assumptions

| Assumption | Risk | Validation |
|------------|------|------------|
| eslint JSON output is stable | Low | Well-documented, test against multiple versions |
| oxlint has JSON output | Medium | Verify in docs, may need `--format` flag |
| tsc outputs parseable diagnostics | Medium | Check output format, may need wrapper |
| Agents can handle merged output | Low | Test with Claude Code |
| Deduplication by location is sufficient | Medium | May need smarter heuristics |

### Validation methods

1. **Integration test suite**: Run against real codebases with known issues
2. **Agent smoke test**: Claude Code consumes output and fixes issues
3. **Version matrix**: Test with eslint 8.x and 9.x, oxlint latest, tsc latest

## Out-of-Scope Items

Explicitly not building:

- **IDE plugins** - lintmesh outputs JSON, IDEs consume it
- **Fix application** - Agents apply fixes themselves using file edit tools
- **Rule configuration** - Use each linter's native config
- **Watch mode** - Agents run on-demand, not continuously
- **Custom reporters** - JSON only, pretty-print optional
- **Diff mode** - Compare against baseline (future)
- **Monorepo awareness** - Run from correct cwd, lintmesh doesn't traverse

## Timeline & Milestones

### Week 1: Foundation

- [ ] Project setup (tsconfig, package.json, build)
- [ ] CLI argument parsing
- [ ] Output schema types (Zod)
- [ ] Linter interface definition
- [ ] Basic eslint adapter

### Week 2: Backends

- [ ] oxlint adapter
- [ ] tsc adapter
- [ ] Parallel execution
- [ ] Error handling & timeouts

### Week 3: Polish

- [ ] Deduplication logic
- [ ] Fix suggestion normalization
- [ ] Integration tests
- [ ] Agent smoke test (Claude Code)
- [ ] Documentation

### Week 4: Release

- [ ] npm publish
- [ ] Usage examples
- [ ] Version 1.0.0

## Design Decisions

1. **Deduplication**: Deferred. MVP keeps all issues from all linters. Agents or future versions can dedupe.

2. **tsc scope**: Include ALL diagnostics (type errors, unused code, suggestions, deprecated warnings). Agents need type errors - they're often the most critical. Filter by severity if needed.

3. **Config passthrough**: None. Each linter uses its native config discovery (eslint.config.js, oxlint config, tsconfig.json). lintmesh doesn't mediate.

4. **Monorepo**: Caller's responsibility. lintmesh runs from `--cwd` or `process.cwd()`. For monorepos, run lintmesh per-package or let linters handle workspace configs.

---

*PRD authored for lintmesh MVP. Last updated: 2024-12-19*
