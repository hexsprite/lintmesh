import { describe, it, expect } from 'bun:test';
import { ESLintAdapter } from '../../../src/linters/eslint.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mockOutput = fs.readFileSync(
  path.join(import.meta.dir, '../../fixtures/mock-eslint-output.json'),
  'utf-8'
);

function createEslintStub() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lintmesh-eslint-'));
  const binDir = path.join(cwd, 'node_modules', '.bin');
  const binPath = path.join(binDir, 'eslint');
  const argsPath = path.join(binDir, 'args.txt');

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    binPath,
    [
      '#!/bin/sh',
      'printf \'%s\\n\' "$@" > "$(dirname "$0")/args.txt"',
      'printf \'%s\\n\' \'[]\'',
      '',
    ].join('\n'),
    { mode: 0o755 }
  );

  return { cwd, argsPath };
}

describe('ESLintAdapter', () => {
  describe('fix arguments', () => {
    it('appends configured fixArgs only when autofix is enabled', async () => {
      const { cwd, argsPath } = createEslintStub();
      const adapter = new ESLintAdapter();
      const commonOptions = {
        files: ['src/example.ts'],
        patterns: ['src/example.ts'],
        cwd,
        timeout: 1000,
        fixArgs: ['--rule', 'no-console:error'],
      };

      try {
        await adapter.run({ ...commonOptions, fix: false });
        expect(fs.readFileSync(argsPath, 'utf-8').trim().split('\n')).toEqual([
          '--format',
          'json',
          '--no-error-on-unmatched-pattern',
          'src/example.ts',
        ]);

        await adapter.run({ ...commonOptions, fix: true });
        expect(fs.readFileSync(argsPath, 'utf-8').trim().split('\n')).toEqual([
          '--format',
          'json',
          '--no-error-on-unmatched-pattern',
          '--fix',
          '--rule',
          'no-console:error',
          'src/example.ts',
        ]);
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    });
  });

  describe('parseOutput', () => {
    it('parses JSON output correctly', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues).toHaveLength(3);
    });

    it('maps severity 2 to error', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const error = issues.find(i => i.ruleId === 'eslint/no-unused-vars');
      expect(error?.severity).toBe('error');
    });

    it('maps severity 1 to warning', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const warning = issues.find(i => i.ruleId === 'eslint/semi');
      expect(warning?.severity).toBe('warning');
    });

    it('extracts file paths correctly', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues[0].path).toBe('src/foo.ts');
    });

    it('extracts line and column', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const first = issues[0];
      expect(first.line).toBe(10);
      expect(first.column).toBe(7);
      expect(first.endLine).toBe(10);
      expect(first.endColumn).toBe(8);
    });

    it('namespaces rule IDs', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues[0].ruleId).toBe('eslint/no-unused-vars');
      expect(issues[1].ruleId).toBe('eslint/semi');
    });

    it('handles null ruleId as parse-error', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const parseError = issues.find(i => i.ruleId === 'eslint/parse-error');
      expect(parseError).toBeDefined();
      expect(parseError?.message).toBe('Parsing error: Unexpected token');
    });

    it('extracts fix replacements', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const withFix = issues.find(i => i.ruleId === 'eslint/no-unused-vars');
      expect(withFix?.fix).toBeDefined();
      expect(withFix?.fix?.replacements[0]).toEqual({
        startOffset: 100,
        endOffset: 106,
        text: '',
      });
    });

    it('handles empty output', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput('[]', '/project');

      expect(issues).toHaveLength(0);
    });

    it('handles blank output', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput('', '/project');

      expect(issues).toHaveLength(0);
    });

    it('throws on invalid JSON', () => {
      const adapter = new ESLintAdapter();

      expect(() => adapter.parseOutput('not json', '/project')).toThrow();
    });

    it('sets source to eslint', () => {
      const adapter = new ESLintAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues.every(i => i.source === 'eslint')).toBe(true);
    });
  });

  describe('name', () => {
    it('returns eslint', () => {
      const adapter = new ESLintAdapter();
      expect(adapter.name).toBe('eslint');
    });
  });
});
