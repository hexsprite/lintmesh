import path from 'node:path';
import type { Linter, LinterOptions, LinterResult, Issue } from './interface.js';
import { exec } from '../utils/exec.js';

interface ESLintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
  suggestions?: Array<{
    desc: string;
    fix: { range: [number, number]; text: string };
  }>;
}

interface ESLintFileResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
}

export class ESLintAdapter implements Linter {
  readonly name = 'eslint' as const;

  private getBinPath(cwd: string): string {
    return path.join(cwd, 'node_modules', '.bin', 'eslint');
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
    return result.stdout.trim().replace(/^v/, '');
  }

  async run(options: LinterOptions): Promise<LinterResult> {
    const startTime = Date.now();
    const bin = this.getBinPath(options.cwd);

    const args = [
      '--format', 'json',
      '--no-error-on-unmatched-pattern',
    ];

    if (options.fix) {
      args.push('--fix');
    }

    args.push(...options.files);

    if (options.verbose) {
      console.error(`lintmesh: [eslint] ${bin} ${args.join(' ')}`);
    }

    const result = await exec(bin, args, {
      timeout: options.timeout,
      cwd: options.cwd,
    });

    if (result.timedOut) {
      return {
        success: false,
        error: new Error(`ESLint timed out after ${options.timeout}ms`),
        issues: [],
        filesProcessed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // ESLint exits with 1 when there are lint errors, which is expected
    // Exit code 2 indicates a config or execution error
    if (result.exitCode === 2 && !result.stdout.trim().startsWith('[')) {
      return {
        success: false,
        error: new Error(result.stderr || 'ESLint configuration error'),
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

    const results: ESLintFileResult[] = JSON.parse(stdout);
    const issues: Issue[] = [];

    for (const file of results) {
      for (const msg of file.messages) {
        const issue: Issue = {
          path: path.relative(cwd, file.filePath),
          line: msg.line,
          column: msg.column,
          endLine: msg.endLine ?? msg.line,
          endColumn: msg.endColumn ?? msg.column,
          severity: msg.severity === 2 ? 'error' : 'warning',
          ruleId: `eslint/${msg.ruleId ?? 'parse-error'}`,
          message: msg.message,
          source: 'eslint',
        };

        // Add fix if available
        if (msg.fix) {
          issue.fix = {
            replacements: [
              {
                startOffset: msg.fix.range[0],
                endOffset: msg.fix.range[1],
                text: msg.fix.text,
              },
            ],
          };
        } else if (msg.suggestions && msg.suggestions.length > 0) {
          // Use first suggestion if no primary fix
          const suggestion = msg.suggestions[0];
          issue.fix = {
            replacements: [
              {
                startOffset: suggestion.fix.range[0],
                endOffset: suggestion.fix.range[1],
                text: suggestion.fix.text,
              },
            ],
          };
        }

        issues.push(issue);
      }
    }

    return issues;
  }
}
