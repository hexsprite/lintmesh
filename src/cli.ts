import { parseArgs } from 'node:util';
import type { CliOptions, LinterName, Severity } from './types.js';

const VERSION = '0.1.0';

const HELP = `
lintmesh - Unified linter runner with JSON output for coding agents

USAGE:
  lintmesh [options] [files...]

OPTIONS:
  --json              Output as JSON (default: true)
  --pretty            Pretty-print JSON output
  --linters <list>    Comma-separated linters: eslint,oxlint,tsgo (default: all)
  --fail-on <level>   Exit non-zero threshold: error|warning|info (default: error)
  --timeout <ms>      Per-linter timeout in milliseconds (default: 30000)
  --cwd <path>        Working directory (default: current directory)
  --quiet             Suppress stderr progress messages
  -h, --help          Show this help message
  -v, --version       Show version

EXAMPLES:
  lintmesh                        # Lint all TS/JS files with all linters
  lintmesh src/                   # Lint specific directory
  lintmesh --linters=eslint src/  # Use only ESLint
  lintmesh --pretty               # Pretty-print JSON output

OUTPUT:
  JSON with unified schema containing all issues from all linters.
  Exit code 0 = no issues, 1 = issues found, 2 = execution error.
`.trim();

const VALID_LINTERS: LinterName[] = ['eslint', 'oxlint', 'tsgo'];
const VALID_SEVERITIES: Severity[] = ['error', 'warning', 'info'];

/**
 * Parse command-line arguments into structured options
 */
export function parseCliArgs(args: string[]): CliOptions | { help: true } | { version: true } {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: true },
      pretty: { type: 'boolean', default: false },
      linters: { type: 'string', default: 'eslint,oxlint,tsgo' },
      'fail-on': { type: 'string', default: 'error' },
      timeout: { type: 'string', default: '30000' },
      cwd: { type: 'string', default: process.cwd() },
      quiet: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  });

  if (values.help) {
    return { help: true };
  }

  if (values.version) {
    return { version: true };
  }

  // Parse and validate linters
  const linterList = (values.linters as string).split(',').map(s => s.trim().toLowerCase());
  const invalidLinters = linterList.filter(l => !VALID_LINTERS.includes(l as LinterName));
  if (invalidLinters.length > 0) {
    throw new Error(`Invalid linter(s): ${invalidLinters.join(', ')}. Valid: ${VALID_LINTERS.join(', ')}`);
  }

  // Validate fail-on
  const failOn = values['fail-on'] as string;
  if (!VALID_SEVERITIES.includes(failOn as Severity)) {
    throw new Error(`Invalid --fail-on value: ${failOn}. Valid: ${VALID_SEVERITIES.join(', ')}`);
  }

  // Parse timeout
  const timeout = parseInt(values.timeout as string, 10);
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error(`Invalid --timeout value: ${values.timeout}. Must be positive integer.`);
  }

  return {
    files: positionals,
    json: values.json as boolean,
    pretty: values.pretty as boolean,
    linters: linterList as LinterName[],
    failOn: failOn as Severity,
    timeout,
    cwd: values.cwd as string,
    quiet: values.quiet as boolean,
  };
}

/**
 * Print help message to stdout
 */
export function printHelp(): void {
  console.log(HELP);
}

/**
 * Print version to stdout
 */
export function printVersion(): void {
  console.log(`lintmesh v${VERSION}`);
}
