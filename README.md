# lintmesh

[![npm version](https://img.shields.io/npm/v/lintmesh.svg)](https://www.npmjs.com/package/lintmesh)
[![license](https://img.shields.io/npm/l/lintmesh.svg)](https://github.com/hexsprite/lintmesh/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/lintmesh.svg)](https://nodejs.org)

**Run multiple linters in parallel. Get unified output.**

ESLint taking 15 seconds while oxlint finishes in 50ms? Run them simultaneously and save time. lintmesh orchestrates your linters and merges their output into a single, consistent format.

![lintmesh demo](https://raw.githubusercontent.com/hexsprite/lintmesh/master/demo.gif)

## Features

- **Parallel execution** - All linters run concurrently
- **Unified output** - Consistent format across eslint, oxlint, tsc, biome
- **Zero config** - Uses your existing linter configs
- **CI-friendly** - Clean output when piped, spinners when interactive
- **LLM-optimized** - Compact format perfect for AI coding assistants

## Installation

```bash
npm install -g lintmesh
```

Requires Node 22+ and your linters installed locally (eslint, oxlint, typescript, biome).

## Usage

```bash
lintmesh                          # lint project (uses config or defaults)
lintmesh src/                     # lint directory
lintmesh src/foo.ts src/bar.ts    # lint specific files
lintmesh --linters=eslint,tsc     # select linters
lintmesh --json                   # full JSON output
lintmesh --fix                    # auto-fix where possible
```

### Interactive Mode

When running in a terminal, lintmesh shows live progress with spinners:

```
✓ eslint (2.1s)
✓ oxlint 3 issues (48ms)
⠸ tsc...
```

When piped or in CI, output is clean with no progress noise.

## Output

Default compact format (great for humans and LLMs):

```
src/api/user.ts:42:5 error eslint/no-unused-vars: 'result' is defined but never used.
src/api/user.ts:87:12 warning tsc/TS6133: 'options' is declared but never used.

2 issues (1 error, 1 warning)
```

JSON format (`--json`) for tooling:

```json
{
  "cwd": "/project",
  "durationMs": 2847,
  "linters": [
    {"name": "eslint", "version": "9.39.2", "success": true, "durationMs": 2100},
    {"name": "oxlint", "version": "0.16.6", "success": true, "durationMs": 48},
    {"name": "tsc", "version": "5.7.2", "success": true, "durationMs": 890}
  ],
  "issues": [...],
  "summary": {"total": 2, "errors": 1, "warnings": 1, "fixable": 1}
}
```

## Configuration

Create `lintmesh.jsonc` in your project root:

```jsonc
{
  "linters": {
    "eslint": { "enabled": true },
    "oxlint": { "enabled": true },
    "tsc": { "enabled": true },
    "biome": { "enabled": false }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["**/*.test.ts", "**/node_modules/**"],
  "failOn": "error",
  "timeout": 30000
}
```

Generate config automatically:

```bash
lintmesh init
```

## Why lintmesh?

| Scenario | Without lintmesh | With lintmesh |
|----------|------------------|---------------|
| Run 3 linters | Sequential: 15s + 3s + 2s = **20s** | Parallel: **15s** |
| Parse output | 3 different formats | 1 unified format |
| CI logs | Mixed progress/errors | Clean, parseable |
| LLM context | Send 3 outputs | Send 1 output |

## Options

```
--json              Output full JSON (default: compact format)
--pretty            Pretty-print JSON
--fix               Auto-fix issues where possible
--linters <list>    Comma-separated: eslint,oxlint,tsc,biome
--fail-on <level>   Exit threshold: error|warning|info (default: error)
--timeout <ms>      Per-linter timeout (default: 30000)
--quiet             Suppress all progress output
--verbose           Show config file path and commands
```

## Exit Codes

- `0` - No issues at or above `--fail-on` threshold
- `1` - Issues found
- `2` - Execution error

## License

MIT
