import type { CliOptions, LinterRun, VibelintOutput, Issue, Summary, LinterName } from './types.js';
import { resolveFiles } from './utils/files.js';
import { ESLintAdapter } from './linters/eslint.js';
import { OxlintAdapter } from './linters/oxlint.js';
import { TsgoAdapter } from './linters/tsgo.js';
import type { Linter } from './linters/interface.js';

/**
 * Create adapter instances for requested linters
 */
function createAdapters(linterNames: LinterName[]): Linter[] {
  const adapters: Linter[] = [];

  for (const name of linterNames) {
    switch (name) {
      case 'eslint':
        adapters.push(new ESLintAdapter());
        break;
      case 'oxlint':
        adapters.push(new OxlintAdapter());
        break;
      case 'tsgo':
        adapters.push(new TsgoAdapter());
        break;
    }
  }

  return adapters;
}

/**
 * Compute summary statistics from issues
 */
function computeSummary(issues: Issue[]): Summary {
  return {
    total: issues.length,
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
    fixable: issues.filter(i => i.fix !== undefined).length,
  };
}

/**
 * Sort issues by file path, then line, then column
 */
function sortIssues(issues: Issue[]): Issue[] {
  return issues.sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) return pathCmp;

    const lineCmp = a.line - b.line;
    if (lineCmp !== 0) return lineCmp;

    return a.column - b.column;
  });
}

/**
 * Run all requested linters in parallel and aggregate results
 */
export async function runLinters(options: CliOptions): Promise<VibelintOutput> {
  const startTime = Date.now();

  // Resolve files
  const files = await resolveFiles(options.files, options.cwd);

  if (files.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      cwd: options.cwd,
      durationMs: Date.now() - startTime,
      linters: [],
      issues: [],
      summary: { total: 0, errors: 0, warnings: 0, info: 0, fixable: 0 },
    };
  }

  // Create adapters
  const adapters = createAdapters(options.linters);

  // Filter to available linters
  const availabilityChecks = await Promise.all(
    adapters.map(async adapter => ({
      adapter,
      available: await adapter.isAvailable(),
    }))
  );

  const availableAdapters = availabilityChecks
    .filter(check => check.available)
    .map(check => check.adapter);

  if (!options.quiet && availableAdapters.length < adapters.length) {
    const unavailable = adapters
      .filter(a => !availableAdapters.includes(a))
      .map(a => a.name);
    console.error(`lintmesh: skipping unavailable linters: ${unavailable.join(', ')}`);
  }

  // Run linters in parallel
  const linterResults = await Promise.all(
    availableAdapters.map(async adapter => {
      const linterStart = Date.now();

      if (!options.quiet) {
        console.error(`lintmesh: running ${adapter.name}...`);
      }

      try {
        const version = await adapter.getVersion();
        const result = await adapter.run({
          files,
          patterns: options.files, // Original CLI patterns for filtering
          cwd: options.cwd,
          timeout: options.timeout,
        });

        const run: LinterRun = {
          name: adapter.name,
          version,
          success: result.success,
          error: result.error?.message,
          durationMs: result.durationMs,
          filesProcessed: result.filesProcessed,
        };

        if (!options.quiet) {
          console.error(
            `lintmesh: ${adapter.name} complete (${result.issues.length} issues in ${result.durationMs}ms)`
          );
        }

        return { run, issues: result.issues };
      } catch (error) {
        const run: LinterRun = {
          name: adapter.name,
          version: 'unknown',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - linterStart,
          filesProcessed: 0,
        };

        if (!options.quiet) {
          console.error(`lintmesh: ${adapter.name} failed: ${run.error}`);
        }

        return { run, issues: [] };
      }
    })
  );

  // Aggregate results
  const linters = linterResults.map(r => r.run);
  const allIssues = linterResults.flatMap(r => r.issues);
  const sortedIssues = sortIssues(allIssues);

  return {
    timestamp: new Date().toISOString(),
    cwd: options.cwd,
    durationMs: Date.now() - startTime,
    linters,
    issues: sortedIssues,
    summary: computeSummary(sortedIssues),
  };
}
