import { describe, it, expect, beforeAll } from 'bun:test';
import { $ } from 'bun';
import path from 'node:path';

const fixturesDir = path.join(import.meta.dir, '../fixtures');

describe('lintmesh CLI integration', () => {
  beforeAll(async () => {
    // Ensure build is up to date
    await $`bun run build:bundle`.quiet();
  });

  describe('help and version', () => {
    it('shows help with --help', async () => {
      const result = await $`bun run dist/lintmesh.js --help`.quiet().nothrow();
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain('lintmesh');
      expect(result.stdout.toString()).toContain('Usage:');
    });

    it('shows version with --version', async () => {
      const result = await $`bun run dist/lintmesh.js --version`.quiet().nothrow();
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('JSON output structure', () => {
    it('outputs valid JSON with --json flag', async () => {
      const result = await $`bun run dist/lintmesh.js --json --quiet --linters=eslint ${fixturesDir}/clean.ts`.quiet().nothrow();
      expect(() => JSON.parse(result.stdout.toString())).not.toThrow();
    });

    it('includes required fields', async () => {
      const result = await $`bun run dist/lintmesh.js --json --quiet --linters=eslint ${fixturesDir}/clean.ts`.quiet().nothrow();
      const output = JSON.parse(result.stdout.toString());

      expect(output).toHaveProperty('timestamp');
      expect(output).toHaveProperty('cwd');
      expect(output).toHaveProperty('durationMs');
      expect(output).toHaveProperty('linters');
      expect(output).toHaveProperty('issues');
      expect(output).toHaveProperty('summary');
    });

    it('summary matches issues', async () => {
      const result = await $`bun run dist/lintmesh.js --json --quiet --linters=eslint ${fixturesDir}/eslint-errors.ts`.quiet().nothrow();
      const output = JSON.parse(result.stdout.toString());

      expect(output.summary.total).toBe(output.issues.length);
    });
  });

  describe('exit codes', () => {
    it('exits 0 on clean files', async () => {
      const result = await $`bun run dist/lintmesh.js --quiet --linters=eslint ${fixturesDir}/clean.ts`.quiet().nothrow();
      expect(result.exitCode).toBe(0);
    });

    it('exits 1 when issues found', async () => {
      const result = await $`bun run dist/lintmesh.js --quiet --linters=eslint ${fixturesDir}/eslint-errors.ts`.quiet().nothrow();
      expect(result.exitCode).toBe(1);
    });
  });

  describe('linter filtering', () => {
    it('only runs specified linters', async () => {
      const result = await $`bun run dist/lintmesh.js --json --quiet --linters=eslint ${fixturesDir}/clean.ts`.quiet().nothrow();
      const output = JSON.parse(result.stdout.toString());

      expect(output.linters.length).toBe(1);
      expect(output.linters[0].name).toBe('eslint');
    });
  });

  describe('issue structure', () => {
    it('issues have required fields', async () => {
      const result = await $`bun run dist/lintmesh.js --json --quiet --linters=eslint ${fixturesDir}/eslint-errors.ts`.quiet().nothrow();
      const output = JSON.parse(result.stdout.toString());

      if (output.issues.length > 0) {
        const issue = output.issues[0];
        expect(issue).toHaveProperty('path');
        expect(issue).toHaveProperty('line');
        expect(issue).toHaveProperty('column');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('ruleId');
        expect(issue).toHaveProperty('message');
        expect(issue).toHaveProperty('source');
      }
    });

    it('ruleId is namespaced', async () => {
      const result = await $`bun run dist/lintmesh.js --json --quiet --linters=eslint ${fixturesDir}/eslint-errors.ts`.quiet().nothrow();
      const output = JSON.parse(result.stdout.toString());

      if (output.issues.length > 0) {
        expect(output.issues[0].ruleId).toMatch(/^eslint\//);
      }
    });
  });

  describe('pretty output', () => {
    it('formats JSON when --pretty is used', async () => {
      const result = await $`bun run dist/lintmesh.js --json --quiet --pretty --linters=eslint ${fixturesDir}/clean.ts`.quiet().nothrow();
      const stdout = result.stdout.toString();

      // Pretty JSON has newlines
      expect(stdout.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('node runtime compatibility', () => {
    it('works with node', async () => {
      const result = await $`node dist/lintmesh.js --json --quiet --linters=eslint ${fixturesDir}/clean.ts`.quiet().nothrow();
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout.toString())).not.toThrow();
    });
  });

  describe('compact output (default)', () => {
    it('outputs human-readable format by default', async () => {
      const result = await $`bun run dist/lintmesh.js --quiet --linters=eslint ${fixturesDir}/eslint-errors.ts`.quiet().nothrow();
      const stdout = result.stdout.toString();

      // Compact format has path:line:col pattern
      expect(stdout).toMatch(/\.ts:\d+:\d+/);
      // And severity word
      expect(stdout).toMatch(/error|warning/);
    });

    it('shows summary line', async () => {
      const result = await $`bun run dist/lintmesh.js --quiet --linters=eslint ${fixturesDir}/clean.ts`.quiet().nothrow();
      const stdout = result.stdout.toString();

      expect(stdout).toContain('No issues found');
    });
  });
});
