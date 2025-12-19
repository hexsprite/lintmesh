#!/usr/bin/env node

import { parseCliArgs, printHelp, printVersion } from './cli.js';
import { runLinters } from './runner.js';
import { computeExitCode } from './utils/exit-code.js';

async function main(): Promise<void> {
  try {
    const parsed = parseCliArgs(process.argv.slice(2));

    if ('help' in parsed) {
      printHelp();
      process.exit(0);
    }

    if ('version' in parsed) {
      printVersion();
      process.exit(0);
    }

    const options = parsed;
    const output = await runLinters(options);

    // Output JSON - wait for stdout to flush before exiting
    const json = options.pretty
      ? JSON.stringify(output, null, 2)
      : JSON.stringify(output);

    // Compute exit code
    const allFailed = output.linters.every(l => !l.success);
    const exitCode = computeExitCode(output, options.failOn, allFailed);

    // Write and wait for flush before exiting
    process.stdout.write(json + '\n', () => {
      process.exit(exitCode);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`lintmesh: ${message}`);
    process.exit(2);
  }
}

main();
