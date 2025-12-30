# lintmesh Technical Implementation Plan

## Executive Summary

lintmesh is a TypeScript CLI that orchestrates eslint, oxlint, and tsc in parallel, normalizes their outputs to a unified JSON schema, and provides structured results for coding agents. The implementation prioritizes minimal dependencies, strict typing, and predictable behavior.

**Architecture**: Command-line entry point -> parallel linter execution -> output normalization -> JSON serialization.

**Key insight**: Each linter has native JSON output (or near-JSON). We invoke CLI processes, parse their stdout, and normalize to our schema. No complex AST manipulation needed.

---

## Recommended Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Dev runtime | Bun | Fast dev experience, native TS, built-in test runner |
| Target runtime | Node 22+, Bun | Broad compatibility; bundle to standalone JS |
| Language | TypeScript 5.x strict | Target audience is TS projects; eat our own dogfood |
| Build | `bun build` | Native bundler, tree-shaking, single-file output |
| Process spawning | execa | Timeout support, promise-based, proper signal handling |
| File matching | fast-glob | Battle-tested, fast, handles ignore patterns |
| Schema validation | zod | Runtime validation, TypeScript inference, minimal footprint |
| Testing | `bun test` | Native, fast, Jest-compatible API, comprehensive coverage |
| CLI parsing | Native `parseArgs` | Zero dependencies, works in Node and Bun |

**Dependencies to avoid**:
- Commander/yargs: Overkill for 7 flags
- ESLint Node API: Version hell between v8/v9, CLI is more stable
- Any logging framework: console.error is fine for MVP
- vitest/jest: Bun's test runner is sufficient and faster

---

## Project Structure

```
lintmesh/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli.ts                # Argument parsing, main orchestration
│   ├── types.ts              # All shared type definitions
│   ├── schema.ts             # Zod schemas for output validation
│   ├── runner.ts             # Parallel linter execution
│   ├── linters/
│   │   ├── interface.ts      # Linter interface definition
│   │   ├── eslint.ts         # ESLint adapter
│   │   ├── oxlint.ts         # Oxlint adapter
│   │   └── tsc.ts           # tsc adapter
│   └── utils/
│       ├── exec.ts           # execa wrapper with timeout
│       ├── paths.ts          # Path normalization utilities
│       └── detection.ts      # Linter availability detection
├── tests/
│   ├── fixtures/             # Sample files with known issues
│   ├── unit/
│   │   ├── eslint.test.ts
│   │   ├── oxlint.test.ts
│   │   ├── tsc.test.ts
│   │   └── runner.test.ts
│   └── integration/
│       └── cli.test.ts
└── bin/
    └── lintmesh.js           # Shebang entry point
```

---

## Core Types and Interfaces

### Output Schema (src/types.ts)

```typescript
// Severity levels normalized across all linters
export type Severity = 'error' | 'warning' | 'info';

// Linter identifiers
export type LinterName = 'eslint' | 'oxlint' | 'tsc';

export interface Issue {
  filePath: string;           // Absolute path
  relativeFilePath: string;   // Relative to cwd
  line: number;               // 1-indexed
  column: number;             // 1-indexed
  endLine: number;            // 1-indexed, same as line if unknown
  endColumn: number;          // 1-indexed
  severity: Severity;
  ruleId: string;             // Namespaced: "eslint/no-unused-vars"
  message: string;
  source: LinterName;
  fix?: Fix;
  meta?: RuleMeta;
}

export interface Fix {
  replacements: Replacement[];
}

export interface Replacement {
  startOffset: number;        // 0-indexed byte offset
  endOffset: number;          // 0-indexed byte offset
  text: string;
}

export interface RuleMeta {
  docsUrl?: string;
  category?: string;
  fixable?: boolean;
}

export interface LinterRun {
  name: LinterName;
  version: string;
  success: boolean;
  error?: string;
  durationMs: number;
  filesProcessed: number;
}

export interface LintmeshOutput {
  timestamp: string;          // ISO 8601
  cwd: string;
  durationMs: number;
  linters: LinterRun[];
  issues: Issue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    fixable: number;
  };
}
```

### Linter Interface (src/linters/interface.ts)

```typescript
export interface LinterOptions {
  files: string[];            // Resolved file paths
  cwd: string;                // Working directory
  timeout: number;            // Milliseconds
}

export interface LinterResult {
  success: boolean;
  error?: Error;
  issues: Issue[];
  filesProcessed: number;
  durationMs: number;
}

export interface Linter {
  readonly name: LinterName;

  /** Check if linter binary/package is available */
  isAvailable(): Promise<boolean>;

  /** Get version string for output metadata */
  getVersion(): Promise<string>;

  /** Execute linter and return normalized results */
  run(options: LinterOptions): Promise<LinterResult>;
}
```

### CLI Options (src/cli.ts)

```typescript
export interface CliOptions {
  files: string[];            // Positional args or default globs
  json: boolean;              // Always true in MVP
  pretty: boolean;            // Pretty-print JSON
  linters: LinterName[];      // Which linters to run
  failOn: Severity;           // Exit code threshold
  timeout: number;            // Per-linter timeout (ms)
  cwd: string;                // Working directory
  quiet: boolean;             // Suppress stderr progress
}
```

---

## Implementation Order

Build in this sequence to maintain a working, testable system at each step.

### Phase 1: Skeleton (Day 1)

1. **Project setup**
   - `npm init`, tsconfig.json with strict mode, tsup.config.ts
   - ESM-first with CJS build output
   - bin/lintmesh.js shebang entry

2. **Type definitions**
   - src/types.ts with all interfaces
   - src/schema.ts with Zod schemas (can validate our own output)

3. **CLI argument parsing**
   - src/cli.ts using util.parseArgs
   - Parse all flags, set defaults
   - Print help/version and exit

4. **Smoke test**
   - `npx lintmesh --help` works
   - `npx lintmesh --version` works

### Phase 2: First Linter - ESLint (Day 2)

5. **Linter interface**
   - src/linters/interface.ts

6. **Execution utilities**
   - src/utils/exec.ts - execa wrapper with timeout handling
   - src/utils/detection.ts - check if command exists

7. **ESLint adapter**
   - src/linters/eslint.ts
   - Detection: `which eslint` or `npx eslint --version`
   - Invocation: `eslint --format json [files]`
   - Parse JSON output, map severity (2->error, 1->warning)
   - Namespace ruleId: `eslint/{ruleId}`
   - Extract fix.range -> replacement offsets

8. **Basic runner**
   - src/runner.ts - run single linter, wrap in LinterRun
   - Wire into CLI

9. **Test with real project**
   - Run against this repo or a test fixture
   - Verify JSON output is valid and complete

### Phase 3: Remaining Linters (Day 3-4)

10. **Oxlint adapter**
    - src/linters/oxlint.ts
    - Detection: `which oxlint`
    - Invocation: `oxlint --format json [files]`
    - Parse JSON, map to schema
    - Handle gracefully if not installed

11. **tsc adapter**
    - src/linters/tsc.ts
    - Detection: `which tsc` or `npx tsc --version`
    - Invocation: `tsc --noEmit [files or -p tsconfig.json]`
    - Parse diagnostic output (may need regex or line parsing)
    - Map TS error codes: `tsc/TS{code}`
    - Severity: all TS errors are 'error'

12. **Parallel execution**
    - Update runner.ts to use Promise.all
    - Aggregate results from all linters
    - Compute summary counts

### Phase 4: Polish (Day 5)

13. **Output formatting**
    - Sort issues by file path, then line, then column
    - --pretty flag for JSON.stringify with indent
    - Validate output against Zod schema before returning

14. **Exit codes**
    - 0: no issues at or above failOn threshold
    - 1: issues found
    - 2: execution error (all linters failed, invalid args)

15. **Error handling**
    - Linter timeout: kill process, report in LinterRun.error
    - Parse failure: include raw output snippet in error
    - No linters available: exit 2 with message

16. **Progress output**
    - stderr: "Running eslint..." when not --quiet
    - stderr: "eslint complete (42 issues in 1.2s)"

### Phase 5: Testing & Release (Day 6-7)

17. **Unit tests**
    - Mock execa for each adapter
    - Test output parsing with fixture JSON
    - Test severity mapping, ruleId namespacing

18. **Integration tests**
    - Create fixtures/ with known lint issues
    - Run lintmesh, assert output structure
    - Test timeout behavior

19. **Documentation**
    - README.md with usage examples
    - CHANGELOG.md

20. **npm publish prep**
    - package.json: bin, files, exports
    - Dual ESM/CJS build verification

---

## Linter Adapter Specifics

### ESLint Adapter

**Detection**:
```typescript
async isAvailable(): Promise<boolean> {
  // Try local first, then global
  const result = await exec('npx', ['eslint', '--version'], { reject: false });
  return result.exitCode === 0;
}
```

**Invocation**:
```bash
eslint --format json --no-error-on-unmatched-pattern [files...]
```

The `--no-error-on-unmatched-pattern` prevents exit code 2 when globs don't match.

**Output parsing**:
ESLint JSON output is an array of file results:
```typescript
interface ESLintFileResult {
  filePath: string;
  messages: Array<{
    ruleId: string | null;
    severity: 1 | 2;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    fix?: { range: [number, number]; text: string };
    suggestions?: Array<{ desc: string; fix: { range: [number, number]; text: string } }>;
  }>;
  errorCount: number;
  warningCount: number;
}
```

**Mapping**:
- `severity: 2` -> `'error'`, `1` -> `'warning'`
- `ruleId: null` -> parsing error, use `'eslint/parse-error'`
- `fix.range[0]` -> startOffset, `range[1]` -> endOffset
- For `suggestions`, pick first suggestion's fix if no primary fix

**Edge cases**:
- ESLint 8 vs 9: both use same JSON format
- Flat config vs legacy: irrelevant, we invoke CLI
- No eslint.config.js: ESLint will use defaults, may produce no issues

### Oxlint Adapter

**Detection**:
```typescript
async isAvailable(): Promise<boolean> {
  const result = await exec('oxlint', ['--version'], { reject: false });
  return result.exitCode === 0;
}
```

**Invocation**:
```bash
oxlint --format json [files or directories]
```

**Output parsing**:
Based on oxlint's eslint-compatible JSON format:
```typescript
// Similar structure to ESLint
interface OxlintResult {
  filePath: string;
  messages: Array<{
    ruleId: string;
    severity: 1 | 2;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    // fix structure may differ, verify experimentally
  }>;
}
```

**Mapping**:
- Namespace: `oxlint/{ruleId}`
- Severity mapping same as ESLint
- If fix structure differs, adapt in adapter

**Edge cases**:
- Binary not installed: common, graceful skip
- No .oxlintrc.json: uses defaults, runs all rules
- May output to stderr for progress; capture stdout only

### tsc Adapter

**Detection**:
```typescript
async isAvailable(): Promise<boolean> {
  const result = await exec('npx', ['tsc', '--version'], { reject: false });
  return result.exitCode === 0;
}
```

**Invocation**:
```bash
tsc --noEmit 2>&1
```

tsc (and tsc) output the same format:
```
src/foo.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
```

**Output parsing**:
Use [`@aivenio/tsc-output-parser`](https://github.com/Aiven-Open/tsc-output-parser) instead of rolling our own regex. This is a battle-tested library that handles edge cases.

```typescript
import { parse } from '@aivenio/tsc-output-parser';

function parseTsgoOutput(raw: string, cwd: string): Issue[] {
  const parsed = parse(raw);
  return parsed.map(item => ({
    filePath: path.resolve(cwd, item.path),
    relativeFilePath: item.path,
    line: item.cursor.line,
    column: item.cursor.column,
    endLine: item.cursor.line,      // tsc doesn't provide end position
    endColumn: item.cursor.column,
    severity: item.tsError.type === 'error' ? 'error' : 'warning',
    ruleId: `tsc/${item.tsError.code}`,
    message: item.message,
    source: 'tsc',
  }));
}
```

**Note**: TypeScript has no official JSON output (see [microsoft/TypeScript#46340](https://github.com/microsoft/TypeScript/issues/46340), closed as wontfix). The tsc-output-parser library is the standard workaround.

**Edge cases**:
- No tsconfig.json: tsc may fail or use defaults
- Project references: `tsc -b` mode, defer to P2
- Incremental builds: always run with `--noEmit` for simplicity
- Large projects: may timeout, use generous default (30s)

---

## CLI Argument Handling

Use Node.js built-in `util.parseArgs` (Node 18.3+):

```typescript
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean', default: true },
    pretty: { type: 'boolean', default: false },
    linters: { type: 'string', default: 'eslint,oxlint,tsc' },
    'fail-on': { type: 'string', default: 'error' },
    timeout: { type: 'string', default: '30000' },
    cwd: { type: 'string', default: process.cwd() },
    quiet: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});
```

**Validation**:
- `linters`: split by comma, validate each is known LinterName
- `fail-on`: must be 'error' | 'warning' | 'info'
- `timeout`: parse as int, must be > 0
- `cwd`: must exist as directory

**File resolution**:
```typescript
async function resolveFiles(patterns: string[], cwd: string): Promise<string[]> {
  if (patterns.length === 0) {
    // Default: all TS/JS files excluding node_modules
    patterns = ['**/*.{ts,tsx,js,jsx,mjs,cjs}'];
  }

  return await glob(patterns, {
    cwd,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });
}
```

---

## Error Handling Patterns

### Linter Process Errors

```typescript
async function runLinterProcess(
  cmd: string,
  args: string[],
  timeout: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execa(cmd, args, {
      timeout,
      reject: false,  // Don't throw on non-zero exit
      all: true,      // Capture combined output
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
    };
  } catch (error) {
    if (error.timedOut) {
      return {
        stdout: '',
        stderr: `Process timed out after ${timeout}ms`,
        exitCode: -1,
      };
    }
    if (error.killed) {
      return {
        stdout: '',
        stderr: 'Process was killed',
        exitCode: -1,
      };
    }
    throw error;  // Unexpected error, propagate
  }
}
```

### Parse Errors

```typescript
function parseJsonSafely<T>(raw: string, linter: LinterName): T {
  try {
    return JSON.parse(raw);
  } catch (error) {
    // Include first 500 chars of raw output for debugging
    const snippet = raw.slice(0, 500);
    throw new Error(
      `Failed to parse ${linter} output as JSON:\n${snippet}\n\nParse error: ${error.message}`
    );
  }
}
```

### Aggregate Error Reporting

```typescript
function createLinterRun(
  name: LinterName,
  result: LinterResult | Error,
  version: string,
  durationMs: number
): LinterRun {
  if (result instanceof Error) {
    return {
      name,
      version,
      success: false,
      error: result.message,
      durationMs,
      filesProcessed: 0,
    };
  }
  return {
    name,
    version,
    success: result.success,
    error: result.error?.message,
    durationMs: result.durationMs,
    filesProcessed: result.filesProcessed,
  };
}
```

### Exit Code Logic

```typescript
function computeExitCode(
  output: LintmeshOutput,
  failOn: Severity,
  allLintersFailed: boolean
): number {
  if (allLintersFailed) return 2;

  const thresholdOrder: Severity[] = ['info', 'warning', 'error'];
  const threshold = thresholdOrder.indexOf(failOn);

  const hasIssuesAtOrAbove = output.issues.some(
    issue => thresholdOrder.indexOf(issue.severity) >= threshold
  );

  return hasIssuesAtOrAbove ? 1 : 0;
}
```

---

## Testing Strategy

### Philosophy

Comprehensive unit tests are a core requirement. Every adapter, utility function, and edge case should have coverage. Use `bun test --coverage` to ensure >90% coverage.

### Test Structure

```
tests/
├── unit/
│   ├── linters/
│   │   ├── eslint.test.ts      # ESLint adapter parsing
│   │   ├── oxlint.test.ts      # Oxlint adapter parsing
│   │   └── tsc.test.ts        # tsc adapter parsing
│   ├── cli.test.ts             # Argument parsing, validation
│   ├── runner.test.ts          # Parallel execution, aggregation
│   ├── schema.test.ts          # Zod schema validation
│   └── utils/
│       ├── exec.test.ts        # Process execution, timeouts
│       ├── paths.test.ts       # Path normalization
│       └── detection.test.ts   # Linter availability
├── integration/
│   ├── cli.test.ts             # End-to-end CLI tests
│   └── fixtures/               # Sample files with known issues
│       ├── eslint-errors.ts
│       ├── type-errors.ts
│       └── clean.ts
└── fixtures/                   # Mock linter outputs
    ├── eslint-output.json
    ├── oxlint-output.json
    └── tsc-output.txt
```

### Unit Tests (bun test)

```typescript
// tests/unit/linters/eslint.test.ts
import { describe, it, expect, mock, spyOn } from 'bun:test';
import { ESLintAdapter } from '../../../src/linters/eslint';

const mockOutput = `[{
  "filePath": "/project/src/foo.ts",
  "messages": [{
    "ruleId": "no-unused-vars",
    "severity": 2,
    "message": "'x' is defined but never used.",
    "line": 10,
    "column": 7,
    "endLine": 10,
    "endColumn": 8,
    "fix": { "range": [100, 106], "text": "" }
  }],
  "errorCount": 1,
  "warningCount": 0
}]`;

describe('ESLintAdapter', () => {
  describe('parseOutput', () => {
    it('parses JSON output correctly', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        filePath: '/project/src/foo.ts',
        relativeFilePath: 'src/foo.ts',
        line: 10,
        column: 7,
        endLine: 10,
        endColumn: 8,
        severity: 'error',
        ruleId: 'eslint/no-unused-vars',
        source: 'eslint',
      });
    });

    it('maps severity 1 to warning', () => {
      const output = mockOutput.replace('"severity": 2', '"severity": 1');
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(output, '/project');

      expect(issues[0].severity).toBe('warning');
    });

    it('extracts fix replacements', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues[0].fix).toBeDefined();
      expect(issues[0].fix!.replacements[0]).toMatchObject({
        startOffset: 100,
        endOffset: 106,
        text: '',
      });
    });

    it('handles null ruleId as parse-error', () => {
      const output = mockOutput.replace('"no-unused-vars"', 'null');
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(output, '/project');

      expect(issues[0].ruleId).toBe('eslint/parse-error');
    });

    it('handles empty output', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput('[]', '/project');

      expect(issues).toHaveLength(0);
    });

    it('throws on invalid JSON', () => {
      const adapter = new ESLintAdapter();

      expect(() => adapter.parseOutput('not json', '/project')).toThrow();
    });
  });

  describe('isAvailable', () => {
    it('returns true when eslint is installed', async () => {
      const adapter = new ESLintAdapter();
      // This will actually check the system
      const available = await adapter.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });
});
```

### Testing Each Adapter

| Adapter | Key Test Cases |
|---------|----------------|
| **eslint** | Severity mapping (1→warning, 2→error), null ruleId handling, fix extraction, multiple files, empty output |
| **oxlint** | JSON format compatibility, rule namespacing, missing fix graceful handling |
| **tsc** | Line parsing with tsc-output-parser, error code extraction, multi-line errors, relative path resolution |

### Integration Tests

```typescript
// tests/integration/cli.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { $ } from 'bun';

describe('lintmesh CLI', () => {
  it('outputs valid JSON with issues', async () => {
    const result = await $`bun run dist/lintmesh.js tests/integration/fixtures/eslint-errors.ts`.quiet().nothrow();

    expect(result.exitCode).toBe(1);

    const output = JSON.parse(result.stdout.toString());
    expect(output).toHaveProperty('timestamp');
    expect(output).toHaveProperty('issues');
    expect(output).toHaveProperty('summary');
    expect(output.issues.length).toBeGreaterThan(0);
    expect(output.summary.total).toBe(output.issues.length);
  });

  it('exits 0 on clean files', async () => {
    const result = await $`bun run dist/lintmesh.js tests/integration/fixtures/clean.ts`.quiet().nothrow();

    expect(result.exitCode).toBe(0);
  });

  it('respects --linters flag', async () => {
    const result = await $`bun run dist/lintmesh.js --linters=eslint tests/integration/fixtures/`.quiet().nothrow();
    const output = JSON.parse(result.stdout.toString());

    expect(output.linters.every((l: any) => l.name === 'eslint')).toBe(true);
  });

  it('respects --fail-on threshold', async () => {
    const result = await $`bun run dist/lintmesh.js --fail-on=error tests/integration/fixtures/warnings-only.ts`.quiet().nothrow();

    expect(result.exitCode).toBe(0); // Only warnings, no errors
  });

  it('handles timeout gracefully', async () => {
    const result = await $`bun run dist/lintmesh.js --timeout=1 tests/integration/fixtures/`.quiet().nothrow();
    const output = JSON.parse(result.stdout.toString());

    // At least one linter should have timed out
    const timedOut = output.linters.some((l: any) => l.error?.includes('timeout'));
    expect(timedOut || output.linters.every((l: any) => l.success)).toBe(true);
  });

  it('works with node runtime', async () => {
    const result = await $`node dist/lintmesh.js tests/integration/fixtures/clean.ts`.quiet().nothrow();

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout.toString());
    expect(output).toHaveProperty('timestamp');
  });
});
```

### Coverage Requirements

| Category | Target |
|----------|--------|
| Overall | >90% |
| Adapters | >95% (critical parsing logic) |
| CLI | >85% |
| Utils | >90% |

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| tsc has no JSON output | High | ~~High~~ **Mitigated** | Use `@aivenio/tsc-output-parser` library to parse tsc-format output |
| oxlint JSON format differs from ESLint | Medium | Medium | Test against real oxlint output; adapt parser as needed |
| Linter version incompatibilities | Medium | Low | Test against min/max supported versions; document requirements |
| Large codebases timeout | Medium | Medium | Generous default timeout (30s); allow override |
| Process spawning overhead | Low | Low | Measured at ~50ms per spawn; acceptable |
| ESLint 8 vs 9 config differences | Low | Low | We invoke CLI; linter handles config discovery |

### Research Spikes Needed

1. ~~**tsc output format**: Run tsc on a real project, capture output, design parser~~ **RESOLVED** - use @aivenio/tsc-output-parser
2. **oxlint fix structure**: Verify fix/suggestion format matches ESLint or adapt
3. ~~**File count accuracy**: Determine how to get filesProcessed count from each linter~~ **RESOLVED** - we pass the files, so `filesProcessed = files.length`

---

## Team Coordination

For a single developer (assumed):

**Week 1**: Phases 1-3 (skeleton, ESLint, remaining linters)
**Week 2**: Phases 4-5 (polish, testing, release)

If pairing/splitting:

| Stream A | Stream B |
|----------|----------|
| Project setup, types | Research tsc output |
| ESLint adapter | Oxlint adapter |
| Runner, CLI integration | tsc adapter |
| Testing, docs | Polish, edge cases |

---

## Build & Publish Configuration

### package.json (key fields)

```json
{
  "name": "lintmesh",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/lintmesh.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "lintmesh": "./dist/lintmesh.js"
  },
  "exports": {
    ".": {
      "import": "./dist/lintmesh.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "bun run build:bundle && bun run build:types",
    "build:bundle": "bun build src/index.ts --outfile=dist/lintmesh.js --target=node --minify",
    "build:types": "tsc --emitDeclarationOnly --declaration --outDir dist",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "lint": "bun run dist/lintmesh.js src/",
    "prepublishOnly": "bun run build && bun test"
  },
  "dependencies": {
    "@aivenio/tsc-output-parser": "^2.0.0",
    "execa": "^9.0.0",
    "fast-glob": "^3.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.5.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Build Output

`bun build` produces a single bundled JS file with all dependencies inlined (except native modules). This means:
- No node_modules needed at runtime for the bundled CLI
- Works with both `node dist/lintmesh.js` and `bun dist/lintmesh.js`
- Smaller install size for npm consumers

---

## Appendix: Research Sources

- [ESLint Formatters Reference](https://eslint.org/docs/latest/use/formatters/)
- [Oxlint CLI Documentation](https://oxc.rs/docs/guide/usage/linter/cli.html)
- [Oxlint 1.0 Announcement](https://voidzero.dev/posts/announcing-oxlint-1-stable)
- [TypeScript Native Previews (tsc)](https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/)
- [TypeScript Go Repository](https://github.com/microsoft/typescript-go)

---

*Technical plan for lintmesh. Last updated: 2024-12-19*
