import path from 'node:path';
import type { Linter, LinterOptions, LinterResult, Issue, Severity } from './interface.js';
import { exec } from '../utils/exec.js';

interface BiomeDiagnostic {
  category: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  message: Array<{ elements: string[]; content: string }>;
  location: {
    path: { file: string };
    span: [number, number]; // byte offsets [start, end]
    sourceCode: string;
  };
  tags: string[];
}

interface BiomeOutput {
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  diagnostics: BiomeDiagnostic[];
  command: string;
}

/**
 * Convert byte offset to line/column using source code
 */
function offsetToLineColumn(
  sourceCode: string,
  offset: number
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  let currentOffset = 0;

  for (const char of sourceCode) {
    if (currentOffset >= offset) break;
    if (char === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    currentOffset++;
  }

  return { line, column };
}

export class BiomeAdapter implements Linter {
  readonly name = 'biome' as const;

  private getBinPath(cwd: string): string {
    return path.join(cwd, 'node_modules', '.bin', 'biome');
  }

  async isAvailable(): Promise<boolean> {
    const result = await exec(this.getBinPath(process.cwd()), ['--version'], {
      timeout: 10000,
      cwd: process.cwd(),
    });
    return result.exitCode === 0;
  }

  async getVersion(): Promise<string> {
    const result = await exec(this.getBinPath(process.cwd()), ['--version'], {
      timeout: 10000,
      cwd: process.cwd(),
    });
    // Output is like "Version: 1.x.x" or just "1.x.x"
    const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : result.stdout.trim();
  }

  async run(options: LinterOptions): Promise<LinterResult> {
    const startTime = Date.now();

    const args = ['lint', '--reporter=json', ...options.files];

    const result = await exec(this.getBinPath(options.cwd), args, {
      timeout: options.timeout,
      cwd: options.cwd,
    });

    if (result.timedOut) {
      return {
        success: false,
        error: new Error(`Biome timed out after ${options.timeout}ms`),
        issues: [],
        filesProcessed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const issues = this.parseOutput(result.stdout, options.cwd);
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

  parseOutput(stdout: string, cwd: string): Issue[] {
    if (!stdout.trim()) {
      return [];
    }

    const output: BiomeOutput = JSON.parse(stdout);
    const issues: Issue[] = [];

    for (const diag of output.diagnostics) {
      const loc = diag.location;
      if (!loc?.sourceCode || !loc.span) continue;

      const [startOffset, endOffset] = loc.span;
      const start = offsetToLineColumn(loc.sourceCode, startOffset);
      const end = offsetToLineColumn(loc.sourceCode, endOffset);

      const filePath = path.isAbsolute(loc.path.file)
        ? loc.path.file
        : path.resolve(cwd, loc.path.file);

      // Map severity
      let severity: Severity = 'warning';
      if (diag.severity === 'error') {
        severity = 'error';
      } else if (diag.severity === 'info') {
        severity = 'info';
      }

      // Extract rule from category (e.g., "lint/correctness/noUnusedVariables" -> "noUnusedVariables")
      const ruleParts = diag.category.split('/');
      const ruleShort = ruleParts[ruleParts.length - 1];

      const issue: Issue = {
        path: path.relative(cwd, filePath),
        line: start.line,
        column: start.column,
        endLine: end.line,
        endColumn: end.column,
        severity,
        ruleId: `biome/${ruleShort}`,
        message: diag.description,
        source: 'biome',
        meta: {
          docsUrl: `https://biomejs.dev/linter/rules/${ruleShort.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
          fixable: diag.tags?.includes('fixable'),
        },
      };

      issues.push(issue);
    }

    return issues;
  }
}
