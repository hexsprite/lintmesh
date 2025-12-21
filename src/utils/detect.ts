import { exec as execCmd } from './exec.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { LinterId } from '../config.js';

/**
 * Linter metadata for detection
 */
interface LinterMeta {
  /** Binary names to search for (first found wins) */
  binaries: string[];
  /** Config file patterns to check */
  configFiles: string[];
  /** Package names in devDependencies */
  packages: string[];
  /** Command to get version */
  versionArg: string;
}

const LINTER_META: Record<LinterId, LinterMeta> = {
  eslint: {
    binaries: ['eslint'],
    configFiles: [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.eslintrc.yaml',
      '.eslintrc',
    ],
    packages: ['eslint', '@eslint/js', 'typescript-eslint', '@typescript-eslint/eslint-plugin'],
    versionArg: '--version',
  },
  oxlint: {
    binaries: ['oxlint'],
    configFiles: ['oxlint.json', '.oxlintrc.json'],
    packages: ['oxlint'],
    versionArg: '--version',
  },
  biome: {
    binaries: ['biome'],
    configFiles: ['biome.json', 'biome.jsonc'],
    packages: ['@biomejs/biome'],
    versionArg: '--version',
  },
  tsc: {
    binaries: ['tsgo', 'tsc'],
    configFiles: ['tsconfig.json'],
    packages: ['typescript'],
    versionArg: '--version',
  },
};

export interface DetectionResult {
  linterId: LinterId;
  /** Whether linter is available to run */
  available: boolean;
  /** Resolved binary path (if found) */
  binPath?: string;
  /** Where binary was found */
  binSource?: 'local' | 'path';
  /** Version string */
  version?: string;
  /** Whether config file exists */
  hasConfig: boolean;
  /** Path to config file (if found) */
  configPath?: string;
  /** Whether in devDependencies */
  inDevDeps: boolean;
  /** Recommendation: enable by default? */
  recommended: boolean;
}

/**
 * Check if a binary exists in node_modules/.bin
 */
function findLocalBinary(cwd: string, binaries: string[]): string | undefined {
  for (const bin of binaries) {
    const localPath = path.join(cwd, 'node_modules', '.bin', bin);
    if (existsSync(localPath)) {
      return localPath;
    }
  }
  return undefined;
}

/**
 * Check if a binary exists on PATH
 */
async function findPathBinary(binaries: string[]): Promise<string | undefined> {
  for (const bin of binaries) {
    try {
      const result = await execCmd('which', [bin], { timeout: 5000, cwd: process.cwd() });
      if (result.exitCode === 0 && result.stdout.trim()) {
        return result.stdout.trim();
      }
    } catch {
      // not found, try next
    }
  }
  return undefined;
}

/**
 * Find config file for a linter
 */
function findConfigFile(cwd: string, configFiles: string[]): string | undefined {
  for (const file of configFiles) {
    const filePath = path.join(cwd, file);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return undefined;
}

/**
 * Check if packages are in devDependencies
 */
function checkDevDeps(cwd: string, packages: string[]): boolean {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (!existsSync(pkgPath)) return false;

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    return packages.some(p => p in deps);
  } catch {
    return false;
  }
}

/**
 * Get version from binary
 */
async function getVersion(binPath: string, versionArg: string): Promise<string | undefined> {
  try {
    const result = await execCmd(binPath, [versionArg], { timeout: 5000, cwd: process.cwd() });
    if (result.exitCode === 0) {
      // Extract version number from output (e.g., "v9.15.0" or "ESLint v9.15.0")
      const match = result.stdout.match(/v?(\d+\.\d+\.\d+)/);
      return match ? match[1] : result.stdout.trim();
    }
  } catch {
    // couldn't get version
  }
  return undefined;
}

/**
 * Detect a single linter
 */
export async function detectLinter(linterId: LinterId, cwd: string): Promise<DetectionResult> {
  const meta = LINTER_META[linterId];

  // Find binary
  const localBin = findLocalBinary(cwd, meta.binaries);
  const pathBin = localBin ? undefined : await findPathBinary(meta.binaries);
  const binPath = localBin || pathBin;
  const binSource = localBin ? 'local' : pathBin ? 'path' : undefined;

  // Get version if binary found
  const version = binPath ? await getVersion(binPath, meta.versionArg) : undefined;

  // Find config
  const configPath = findConfigFile(cwd, meta.configFiles);
  const hasConfig = !!configPath;

  // Check devDeps
  const inDevDeps = checkDevDeps(cwd, meta.packages);

  // Determine if available and recommended
  const available = !!binPath;
  const recommended = available && (hasConfig || inDevDeps);

  return {
    linterId,
    available,
    binPath,
    binSource,
    version,
    hasConfig,
    configPath,
    inDevDeps,
    recommended,
  };
}

/**
 * Detect all linters
 */
export async function detectAllLinters(cwd: string): Promise<DetectionResult[]> {
  const linterIds: LinterId[] = ['eslint', 'oxlint', 'biome', 'tsc'];
  return Promise.all(linterIds.map(id => detectLinter(id, cwd)));
}
