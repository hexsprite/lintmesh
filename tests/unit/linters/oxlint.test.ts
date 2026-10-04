import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OxlintAdapter } from '../../../src/linters/oxlint.js';

function createOxlintStub() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lintmesh-oxlint-'));
  const binDir = path.join(cwd, 'node_modules', '.bin');
  const binPath = path.join(binDir, 'oxlint');
  const argsPath = path.join(binDir, 'args.txt');

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    binPath,
    [
      '#!/bin/sh',
      'printf \'%s\\n\' "$@" > "$(dirname "$0")/args.txt"',
      'printf \'%s\\n\' \'{"diagnostics":[],"number_of_files":1,"number_of_rules":0,"threads_count":1,"start_time":0}\'',
      '',
    ].join('\n'),
    { mode: 0o755 }
  );

  return { cwd, argsPath };
}

describe('OxlintAdapter fix arguments', () => {
  test('appends configured fixArgs only when autofix is enabled', async () => {
    const { cwd, argsPath } = createOxlintStub();
    const adapter = new OxlintAdapter();
    const commonOptions = {
      files: ['src/example.ts'],
      patterns: ['src/example.ts'],
      cwd,
      timeout: 1000,
      extraArgs: ['--type-check'],
      fixArgs: ['-A', 'typescript/no-unnecessary-type-assertion'],
    };

    try {
      await adapter.run({ ...commonOptions, fix: false });
      expect(fs.readFileSync(argsPath, 'utf-8').trim().split('\n')).toEqual([
        '--format',
        'json',
        '--type-aware',
        '--type-check',
        'src/example.ts',
      ]);

      await adapter.run({ ...commonOptions, fix: true });
      expect(fs.readFileSync(argsPath, 'utf-8').trim().split('\n')).toEqual([
        '--format',
        'json',
        '--type-aware',
        '--type-check',
        '--fix',
        '-A',
        'typescript/no-unnecessary-type-assertion',
        'src/example.ts',
      ]);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
