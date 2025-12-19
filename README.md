# lintmesh

Lightweight linter aggregator with JSON output for coding agents.

Runs eslint, oxlint, and tsgo/tsc in parallel using your project's local installations, outputs unified JSON.

## Install

```bash
npm install -g lintmesh
# or
bun link  # from repo
```

## Usage

```bash
lintmesh src/                     # lint directory
lintmesh src/foo.ts src/bar.ts    # lint specific files
lintmesh --linters=eslint,tsgo    # select linters
lintmesh --quiet                  # suppress progress to stderr
lintmesh --pretty                 # pretty-print JSON
```

## Output

```json
{
  "cwd": "/project",
  "durationMs": 5207,
  "linters": [
    {"name": "eslint", "version": "9.39.2", "success": true, "durationMs": 4944},
    {"name": "oxlint", "version": "0.16.6", "success": true, "durationMs": 48},
    {"name": "tsgo", "version": "7.0.0-dev", "success": true, "durationMs": 1839}
  ],
  "issues": [
    {
      "path": "src/foo.ts",
      "line": 10,
      "column": 5,
      "severity": "error",
      "ruleId": "eslint/no-unused-vars",
      "message": "'x' is defined but never used.",
      "source": "eslint"
    }
  ],
  "summary": {"total": 1, "errors": 1, "warnings": 0, "fixable": 0}
}
```

`path` is relative to `cwd`. Combine with `cwd` for absolute path if needed.

## Requirements

- Node 22+ or Bun
- Project must have linters installed locally (eslint, oxlint, typescript)

## Exit codes

- `0` - no issues at or above `--fail-on` threshold
- `1` - issues found
- `2` - execution error
