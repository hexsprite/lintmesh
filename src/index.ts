#!/usr/bin/env node

import { program } from 'commander';
import { createRequire } from 'node:module';
import { runLinters } from './runner.js';
import { computeExitCode } from './utils/exit-code.js';
import { init, printInitSummary } from './init.js';
import { loadConfig, getConfigWithDefaults } from './utils/config-loader.js';
import { createColors } from './utils/colors.js';
import type { LinterName, Severity, LinterConfigArgs } from './types.js';
import type { LinterId } from './config.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

const VALID_LINTERS = ['eslint', 'oxlint', 'tsc', 'biome'] as const;

/** Map LinterId from config to LinterName used by adapters */
function linterIdToName(id: LinterId): LinterName {
  return id;
}

program
  .name('lintmesh')
  .description('Unified linter runner with JSON output for coding agents')
  .version(VERSION);

program
  .command('init')
  .description('Generate lintmesh.jsonc by detecting installed linters')
  .option('--force', 'Overwrite existing config', false)
  .action(async (opts) => {
    try {
      const result = await init({ cwd: process.cwd(), force: opts.force });
      printInitSummary(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lintmesh: ${message}`);
      process.exit(2);
    }
  });

program
  .argument('[files...]', 'Files or globs to lint')
  .option('--json', 'Output full JSON (default: compact LLM format)', false)
  .option('--pretty', 'Pretty-print JSON output', false)
  .option('--fix', 'Auto-fix issues where possible', false)
  .option('--linters <list>', 'Comma-separated linters: eslint,oxlint,tsc,biome', 'eslint,oxlint,tsc')
  .option('--fail-on <level>', 'Exit non-zero threshold: error|warning|info', 'error')
  .option('--timeout <ms>', 'Per-linter timeout in milliseconds', '30000')
  .option('--cwd <path>', 'Working directory', process.cwd())
  .option('--quiet', 'Suppress stderr progress messages', false)
  .option('--verbose', 'Show command lines being executed', false)
  .action(async (files, opts) => {
    try {
      // Load config file if present
      const loadedConfig = loadConfig(opts.cwd);
      const configDefaults = getConfigWithDefaults(loadedConfig.config);

      // Determine linters: CLI override > config > default
      let linterList: LinterName[];
      const cliLintersProvided = opts.linters !== 'eslint,oxlint,tsc'; // Check if user provided --linters

      if (cliLintersProvided) {
        // CLI explicitly specified linters
        const parsed = opts.linters.split(',').map((s: string) => s.trim().toLowerCase());
        const invalid = parsed.filter((l: string) => !VALID_LINTERS.includes(l as typeof VALID_LINTERS[number]));
        if (invalid.length > 0) {
          console.error(`Invalid linter(s): ${invalid.join(', ')}. Valid: ${VALID_LINTERS.join(', ')}`);
          process.exit(2);
        }
        linterList = parsed as LinterName[];
      } else if (loadedConfig.enabledLinters.length > 0) {
        // Use linters from config
        linterList = loadedConfig.enabledLinters.map(linterIdToName);
        if (opts.verbose) {
          console.error(`lintmesh: using config from ${loadedConfig.configPath}`);
        }
      } else {
        // Fall back to default
        linterList = ['eslint', 'oxlint', 'tsc'];
      }

      // Validate fail-on
      const failOn = opts.failOn || configDefaults.failOn;
      if (!['error', 'warning', 'info'].includes(failOn)) {
        console.error(`Invalid --fail-on value: ${failOn}. Valid: error, warning, info`);
        process.exit(2);
      }

      // Parse timeout
      const timeoutStr = opts.timeout;
      const timeout = timeoutStr === '30000' ? configDefaults.timeout : parseInt(timeoutStr, 10);
      if (isNaN(timeout) || timeout <= 0) {
        console.error(`Invalid --timeout value: ${timeoutStr}. Must be positive integer.`);
        process.exit(2);
      }

      // Use files from CLI if provided, otherwise use config include patterns
      const filesToLint = files.length > 0 ? files : configDefaults.include;

      // Interactive mode: TTY stderr, not quiet, not outputting JSON
      const interactive = process.stderr.isTTY && !opts.quiet && !opts.json;

      // Extract per-linter args from config
      const linterConfigs: Partial<Record<LinterName, LinterConfigArgs>> = {};
      if (loadedConfig.config.linters) {
        for (const [id, cfg] of Object.entries(loadedConfig.config.linters)) {
          if (cfg.args?.length) {
            linterConfigs[id as LinterName] = { args: cfg.args };
          }
        }
      }

      const options = {
        files: filesToLint,
        exclude: configDefaults.exclude,
        json: opts.json,
        pretty: opts.pretty,
        fix: opts.fix,
        linters: linterList,
        failOn: failOn as Severity,
        timeout,
        cwd: opts.cwd,
        quiet: opts.quiet,
        verbose: opts.verbose,
        interactive,
        linterConfigs,
      };

      const output = await runLinters(options);

      // Compute exit code
      const allFailed = output.linters.every(l => !l.success);
      const exitCode = computeExitCode(output, options.failOn, allFailed);

      // Format output
      let formattedOutput: string;
      if (options.json) {
        // Full JSON output
        formattedOutput = options.pretty
          ? JSON.stringify(output, null, 2)
          : JSON.stringify(output);
      } else {
        // Compact format: path:line:col severity ruleId: message
        const useColors = process.stdout.isTTY && !opts.quiet;
        const c = createColors(useColors);

        const lines: string[] = [];
        for (const issue of output.issues) {
          const loc = c.cyan(`${issue.path}:${issue.line}:${issue.column}`);
          const sev = issue.severity === 'error' ? c.red(issue.severity) : c.yellow(issue.severity);
          const rule = c.dim(issue.ruleId);
          lines.push(`${loc} ${sev} ${rule}: ${issue.message}`);
        }
        // Add summary line
        const { errors, warnings } = output.summary;
        if (output.summary.total > 0) {
          lines.push('');
          const errText = errors > 0 ? c.red(`${errors} errors`) : `${errors} errors`;
          const warnText = warnings > 0 ? c.yellow(`${warnings} warnings`) : `${warnings} warnings`;
          lines.push(`${output.summary.total} issues (${errText}, ${warnText})`);
        } else {
          lines.push(c.cyan('No issues found'));
        }
        formattedOutput = lines.join('\n');
      }

      // Write and exit
      process.stdout.write(formattedOutput + '\n', () => {
        process.exit(exitCode);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lintmesh: ${message}`);
      process.exit(2);
    }
  });

program.parse();
