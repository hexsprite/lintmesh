import { z } from 'zod';

/**
 * All linters that lintmesh can run
 */
export const LINTER_IDS = ['eslint', 'oxlint', 'biome', 'tsc'] as const;
export type LinterId = (typeof LINTER_IDS)[number];

/**
 * Per-linter configuration
 */
export const LinterConfigSchema = z.object({
  /** Whether to run this linter */
  enabled: z.boolean().default(true),
  /**
   * Binary path resolution:
   * - null/undefined: auto-resolve (node_modules/.bin → PATH)
   * - string: explicit path or command name
   */
  bin: z.string().nullable().optional(),
  /** Extra arguments to append to linter command */
  args: z.array(z.string()).optional(),
});

export type LinterConfig = z.infer<typeof LinterConfigSchema>;

/**
 * Full lintmesh configuration file schema
 */
export const ConfigSchema = z.object({
  /** JSON schema URL for IDE support */
  $schema: z.string().optional(),

  /** Linter configurations keyed by linter ID */
  linters: z.record(
    z.enum(LINTER_IDS),
    LinterConfigSchema
  ).optional(),

  /** Glob patterns for files to include */
  include: z.array(z.string()).optional(),

  /** Glob patterns for files to exclude */
  exclude: z.array(z.string()).optional(),

  /** Per-linter timeout in milliseconds */
  timeout: z.number().int().positive().optional(),

  /** Exit code threshold */
  failOn: z.enum(['error', 'warning', 'info']).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Resolved linter configuration with all defaults applied
 */
export interface ResolvedLinterConfig {
  enabled: boolean;
  bin: string | null;
  args: string[];
  /** Resolved binary path (after auto-detection) */
  resolvedBin?: string;
  /** Detected version */
  version?: string;
}

/**
 * Fully resolved configuration ready for runtime
 */
export interface ResolvedConfig {
  linters: Record<LinterId, ResolvedLinterConfig>;
  include: string[];
  exclude: string[];
  timeout: number;
  failOn: 'error' | 'warning' | 'info';
}

/**
 * Default configuration values
 */
export const CONFIG_DEFAULTS = {
  include: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
  timeout: 30000,
  failOn: 'error' as const,
} satisfies Partial<ResolvedConfig>;

/**
 * Config file names to search for (in order of preference)
 */
export const CONFIG_FILES = [
  'lintmesh.jsonc',
  'lintmesh.json',
  '.config/lintmesh.jsonc',
  '.config/lintmesh.json',
] as const;
