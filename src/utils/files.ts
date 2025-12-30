import fg from 'fast-glob';
import fs from 'node:fs';
import path from 'node:path';

const FILE_EXTENSIONS = '*.{ts,tsx,js,jsx,mjs,cjs}';
const DEFAULT_PATTERNS = [`**/${FILE_EXTENSIONS}`];
const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];

/**
 * Expand a pattern to include file extensions if it's a directory
 */
function expandPattern(pattern: string, cwd: string): string {
  // If pattern contains glob characters, use as-is
  if (pattern.includes('*') || pattern.includes('?') || pattern.includes('{')) {
    return pattern;
  }

  // Check if it's a directory
  const fullPath = path.isAbsolute(pattern) ? pattern : path.join(cwd, pattern);
  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Expand to include all matching files in directory
      return path.join(pattern, '**', FILE_EXTENSIONS);
    }
  } catch {
    // Path doesn't exist, might be a glob pattern - use as-is
  }

  return pattern;
}

/**
 * Resolve file patterns to absolute paths
 */
export async function resolveFiles(patterns: string[], cwd: string, exclude?: string[]): Promise<string[]> {
  let effectivePatterns: string[];

  if (patterns.length === 0) {
    effectivePatterns = DEFAULT_PATTERNS;
  } else {
    effectivePatterns = patterns.map(p => expandPattern(p, cwd));
  }

  // Merge default ignore patterns with user-provided exclude
  const ignore = exclude ? [...DEFAULT_IGNORE, ...exclude] : DEFAULT_IGNORE;

  return await fg(effectivePatterns, {
    cwd,
    absolute: true,
    ignore,
    onlyFiles: true,
  });
}
