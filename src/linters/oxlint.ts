import path from 'node:path';
import type { Linter, LinterOptions, LinterResult, Issue, Severity } from './interface.js';
import { exec } from '../utils/exec.js';

interface OxlintLabel {
  label?: string;
  span: {
    offset: number;
    length: number;
    line: number;
    column: number;
  };
}

interface OxlintDiagnostic {
  message: string;
  code: string;
  severity: string;
  causes: string[];
  url: string;
  help: string;
  filename: string;
  labels: OxlintLabel[];
  related: unknown[];
}

interface OxlintOutput {
  diagnostics: OxlintDiagnostic[];
  number_of_files: number;
  number_of_rules: number;
  threads_count: number;
  start_time: number;
}

export class OxlintAdapter implements Linter {
  readonly name = 'oxlint' as const;

  private getBinPath(cwd: string): string {
    return path.join(cwd, 'node_modules', '.bin', 'oxlint');
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
    // Output is like "oxlint version 0.x.x"
    const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : result.stdout.trim();
  }

  async run(options: LinterOptions): Promise<LinterResult> {
    const startTime = Date.now();

    const args = [
      '--format', 'json',
      ...options.files,
    ];

    const result = await exec(this.getBinPath(options.cwd), args, {
      timeout: options.timeout,
      cwd: options.cwd,
    });

    if (result.timedOut) {
      return {
        success: false,
        error: new Error(`Oxlint timed out after ${options.timeout}ms`),
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

    const output: OxlintOutput = JSON.parse(stdout);
    const issues: Issue[] = [];

    for (const diag of output.diagnostics) {
      const label = diag.labels[0];
      if (!label) continue;

      const filePath = path.isAbsolute(diag.filename)
        ? diag.filename
        : path.resolve(cwd, diag.filename);

      // Map severity string to our severity type
      let severity: Severity = 'warning';
      if (diag.severity === 'error') {
        severity = 'error';
      } else if (diag.severity === 'warning' || diag.severity === 'warn') {
        severity = 'warning';
      }

      const issue: Issue = {
        path: path.relative(cwd, filePath),
        line: label.span.line,
        column: label.span.column,
        endLine: label.span.line,
        endColumn: label.span.column + label.span.length,
        severity,
        ruleId: `oxlint/${diag.code}`,
        message: diag.message,
        source: 'oxlint',
        meta: {
          docsUrl: diag.url,
        },
      };

      issues.push(issue);
    }

    return issues;
  }
}
