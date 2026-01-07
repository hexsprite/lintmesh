/**
 * Severity levels normalized across all linters
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Supported linter identifiers
 */
export type LinterName = 'eslint' | 'oxlint' | 'tsc' | 'biome';

/**
 * A single replacement operation for an autofix
 */
export interface Replacement {
  /** Start offset in file (0-indexed bytes) */
  startOffset: number;
  /** End offset in file (0-indexed bytes) */
  endOffset: number;
  /** Text to insert at the range */
  text: string;
}

/**
 * Autofix information for an issue
 */
export interface Fix {
  /** Replacement operations to apply */
  replacements: Replacement[];
}

/**
 * Metadata about a lint rule
 */
export interface RuleMeta {
  /** URL to rule documentation */
  docsUrl?: string;
  /** Rule category (e.g., "best-practices", "stylistic") */
  category?: string;
  /** Whether rule supports autofix */
  fixable?: boolean;
}

/**
 * A single lint issue found by a linter
 */
export interface Issue {
  /** Path relative to cwd */
  path: string;
  /** 1-indexed start line */
  line: number;
  /** 1-indexed start column */
  column: number;
  /** 1-indexed end line (same as line if unknown) */
  endLine: number;
  /** 1-indexed end column */
  endColumn: number;
  /** Issue severity */
  severity: Severity;
  /** Namespaced rule identifier (e.g., "eslint/no-unused-vars") */
  ruleId: string;
  /** Human-readable message */
  message: string;
  /** Which linter found this issue */
  source: LinterName;
  /** Optional autofix suggestion */
  fix?: Fix;
  /** Optional rule metadata */
  meta?: RuleMeta;
}

/**
 * Information about a single linter's execution
 */
export interface LinterRun {
  /** Linter identifier */
  name: LinterName;
  /** Linter version string */
  version: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Number of files that were linted */
  filesProcessed: number;
}

/**
 * Summary counts of issues found
 */
export interface Summary {
  /** Total number of issues */
  total: number;
  /** Number of error-level issues */
  errors: number;
  /** Number of warning-level issues */
  warnings: number;
  /** Number of info-level issues */
  info: number;
  /** Number of issues with available autofixes */
  fixable: number;
}

/**
 * Complete output structure from lintmesh
 */
export interface VibelintOutput {
  /** ISO 8601 timestamp of the run */
  timestamp: string;
  /** Working directory */
  cwd: string;
  /** Total execution duration in milliseconds */
  durationMs: number;
  /** Information about each linter that ran */
  linters: LinterRun[];
  /** All issues found, sorted by file then line */
  issues: Issue[];
  /** Summary counts */
  summary: Summary;
}

/**
 * Options passed to a linter adapter
 */
export interface LinterOptions {
  /** Resolved file paths to lint */
  files: string[];
  /** Original patterns before expansion (for filtering) */
  patterns: string[];
  /** Working directory */
  cwd: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Show command lines being executed */
  verbose?: boolean;
  /** Auto-fix issues where possible */
  fix?: boolean;
  /** Extra arguments from config to append to linter command */
  extraArgs?: string[];
}

/**
 * Result from running a linter
 */
export interface LinterResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Error if failed */
  error?: Error;
  /** Issues found (normalized to common schema) */
  issues: Issue[];
  /** Number of files processed */
  filesProcessed: number;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Interface that all linter adapters must implement
 */
export interface Linter {
  /** Unique linter identifier */
  readonly name: LinterName;

  /** Check if linter is available on the system */
  isAvailable(): Promise<boolean>;

  /** Get the linter's version string */
  getVersion(): Promise<string>;

  /** Execute the linter and return normalized results */
  run(options: LinterOptions): Promise<LinterResult>;
}

/**
 * Per-linter configuration from config file
 */
export interface LinterConfigArgs {
  /** Extra arguments to append to linter command */
  args?: string[];
}

/**
 * CLI options parsed from command line arguments
 */
export interface CliOptions {
  /** Files or globs to lint */
  files: string[];
  /** Patterns to exclude from linting */
  exclude: string[];
  /** Output as JSON (default: false, compact output) */
  json: boolean;
  /** Pretty-print JSON output */
  pretty: boolean;
  /** Which linters to run */
  linters: LinterName[];
  /** Exit code threshold */
  failOn: Severity;
  /** Per-linter timeout in milliseconds */
  timeout: number;
  /** Working directory */
  cwd: string;
  /** Suppress stderr progress */
  quiet: boolean;
  /** Show command lines being executed */
  verbose: boolean;
  /** Running in interactive terminal (TTY) */
  interactive: boolean;
  /** Auto-fix issues where possible */
  fix: boolean;
  /** Per-linter configuration from config file */
  linterConfigs?: Partial<Record<LinterName, LinterConfigArgs>>;
}
