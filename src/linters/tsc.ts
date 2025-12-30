import { parse, type GrammarItem } from '@aivenio/tsc-output-parser';
import path from 'node:path';
import type { Linter, LinterOptions, LinterResult, Issue } from './interface.js';
import { exec } from '../utils/exec.js';

function isGlobPattern(pattern: string): boolean {
  return /[*?{[]/.test(pattern);
}

/**
 * Filter issues to only those matching requested patterns.
 * Matches exact file paths, directory prefixes, or glob patterns.
 * Patterns and issue.path are both relative to cwd.
 */
export function filterByPatterns(issues: Issue[], patterns: string[]): Issue[] {
  if (patterns.length === 0) return issues; // No filter = all issues

  // Normalize patterns: remove trailing slashes, treat './' as '.'
  const normalized = patterns.map(p => p.replace(/\/+$/, '').replace(/^\.\//, '.'));

  // '.' means "current directory" = match everything
  if (normalized.includes('.')) return issues;

  // Glob patterns mean files were already filtered by resolveFiles - return all
  if (normalized.some(isGlobPattern)) return issues;

  return issues.filter(issue =>
    normalized.some(pattern =>
      issue.path === pattern || issue.path.startsWith(pattern + path.sep)
    )
  );
}

export class TscAdapter implements Linter {
  readonly name = 'tsc' as const;

  private getTsgoPath(cwd: string): string {
    return path.join(cwd, 'node_modules', '.bin', 'tsgo');
  }

  private getTscPath(cwd: string): string {
    return path.join(cwd, 'node_modules', '.bin', 'tsc');
  }

  private async findBinary(cwd: string): Promise<{ bin: string; isTsgo: boolean } | null> {
    // Try tsgo first
    const tsgoResult = await exec(this.getTsgoPath(cwd), ['--version'], {
      timeout: 10000,
      cwd,
    });
    if (tsgoResult.exitCode === 0) {
      return { bin: this.getTsgoPath(cwd), isTsgo: true };
    }

    // Fall back to tsc
    const tscResult = await exec(this.getTscPath(cwd), ['--version'], {
      timeout: 10000,
      cwd,
    });
    if (tscResult.exitCode === 0) {
      return { bin: this.getTscPath(cwd), isTsgo: false };
    }

    return null;
  }

  async isAvailable(): Promise<boolean> {
    const binary = await this.findBinary(process.cwd());
    return binary !== null;
  }

  async getVersion(): Promise<string> {
    const binary = await this.findBinary(process.cwd());
    if (!binary) return 'not found';

    const result = await exec(binary.bin, ['--version'], {
      timeout: 10000,
      cwd: process.cwd(),
    });
    const version = result.stdout.trim();
    return binary.isTsgo ? `tsgo ${version}` : version;
  }

  async run(options: LinterOptions): Promise<LinterResult> {
    const startTime = Date.now();

    const binary = await this.findBinary(options.cwd);
    if (!binary) {
      return {
        success: false,
        error: new Error('Neither tsgo nor tsc found in node_modules/.bin'),
        issues: [],
        filesProcessed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // tsc/tsgo must run on whole project, we filter results after
    const args = ['--noEmit', '--pretty', 'false'];

    if (options.verbose) {
      console.error(`lintmesh: [tsc] ${binary.bin} ${args.join(' ')}`);
    }
    const result = await exec(binary.bin, args, {
      timeout: options.timeout,
      cwd: options.cwd,
    });

    if (result.timedOut) {
      return {
        success: false,
        error: new Error(`TypeScript check timed out after ${options.timeout}ms`),
        issues: [],
        filesProcessed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // Combine stdout and stderr as tsc outputs to both
      const output = result.stdout + '\n' + result.stderr;
      const allIssues = this.parseOutput(output, options.cwd);

      // Filter to only requested files/directories
      const issues = filterByPatterns(allIssues, options.patterns);

      return {
        success: true,
        issues,
        filesProcessed: options.files.length,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        issues: [],
        filesProcessed: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  parseOutput(output: string, cwd: string): Issue[] {
    if (!output.trim()) {
      return [];
    }

    try {
      const parsed = parse(output);
      return parsed.map((item: GrammarItem) => {
        const absPath = path.isAbsolute(item.value.path.value)
          ? item.value.path.value
          : path.resolve(cwd, item.value.path.value);

        return {
          path: path.relative(cwd, absPath),
          line: item.value.cursor.value.line,
          column: item.value.cursor.value.col,
          endLine: item.value.cursor.value.line,
          endColumn: item.value.cursor.value.col,
          severity: item.value.tsError.value.type === 'error' ? 'error' : 'warning',
          ruleId: `tsc/${item.value.tsError.value.errorString}`,
          message: item.value.message.value.trim(),
          source: 'tsc' as const,
        };
      });
    } catch {
      // If parsing fails, return empty (might be clean output)
      return [];
    }
  }
}
