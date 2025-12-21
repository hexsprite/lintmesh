import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import stripJsonComments from 'strip-json-comments';
import { ConfigSchema, CONFIG_FILES, CONFIG_DEFAULTS, type Config, type LinterId } from '../config.js';

export interface LoadedConfig {
  /** Path to loaded config file, or null if using defaults */
  configPath: string | null;
  /** Parsed and validated config */
  config: Config;
  /** Which linters are enabled (from config or defaults) */
  enabledLinters: LinterId[];
}

/**
 * Find config file in project
 */
function findConfigFile(cwd: string): string | null {
  for (const file of CONFIG_FILES) {
    const filePath = path.join(cwd, file);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Parse JSONC file
 */
function parseJsonc(content: string): unknown {
  const stripped = stripJsonComments(content);
  return JSON.parse(stripped);
}

/**
 * Load config from file
 */
export function loadConfig(cwd: string): LoadedConfig {
  const configPath = findConfigFile(cwd);

  if (!configPath) {
    // No config - return empty (caller uses CLI defaults)
    return {
      configPath: null,
      config: {},
      enabledLinters: [],
    };
  }

  const content = readFileSync(configPath, 'utf-8');
  const parsed = parseJsonc(content);
  const result = ConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid config in ${configPath}: ${result.error.message}`);
  }

  const config = result.data;

  // Get enabled linters from config
  const enabledLinters: LinterId[] = [];
  if (config.linters) {
    for (const [id, linterConfig] of Object.entries(config.linters)) {
      if (linterConfig.enabled !== false) {
        enabledLinters.push(id as LinterId);
      }
    }
  }

  return {
    configPath,
    config,
    enabledLinters,
  };
}

/**
 * Get resolved config values with defaults applied
 */
export function getConfigWithDefaults(config: Config) {
  return {
    include: config.include || CONFIG_DEFAULTS.include,
    exclude: config.exclude || CONFIG_DEFAULTS.exclude,
    timeout: config.timeout || CONFIG_DEFAULTS.timeout,
    failOn: config.failOn || CONFIG_DEFAULTS.failOn,
  };
}
