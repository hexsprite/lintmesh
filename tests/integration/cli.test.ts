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

  // Regression: a linter that fails to RUN (e.g. eslint.config.mjs imports a
  // missing package and crashes with exit 2) must surface as a hard failure —
  // even when OTHER linters succeed. Previously lintmesh required ALL linters
  // to fail before exiting non-zero, so one crashed linter (eslint) was masked
  // by a passing one (biome) and reported "No issues found" — a silent CI blind
  // spot where a broken config passes review. We run eslint+biome from inside
  // the fixture dir: eslint's config import crashes, biome passes cleanly.
  describe('a linter failing to run is not masked by a passing linter', () => {
    const brokenDir = path.join(fixturesDir, 'broken-eslint-config');
    const distPath = path.join(import.meta.dir, '../../dist/lintmesh.js');

    beforeAll(async () => {
      // Symlink node_modules so eslint + biome binaries resolve when process
      // cwd is the fixture dir (adapters look for <cwd>/node_modules/.bin/*).
      const link = path.join(brokenDir, 'node_modules');
      const target = path.join(import.meta.dir, '../../node_modules');
      await $`rm -rf ${link}`.quiet().nothrow();
      await $`ln -s ${target} ${link}`.quiet().nothrow();
    });

    it('exits 2 when eslint config crashes but biome passes', async () => {
      const result = await $`bun run ${distPath} --quiet --linters=eslint,biome sample.ts`
        .cwd(brokenDir)
        .quiet()
        .nothrow();
      expect(result.exitCode).toBe(2);
    });

    it('reports the failure instead of "No issues found"', async () => {
      const result = await $`bun run ${distPath} --quiet --linters=eslint,biome sample.ts`
        .cwd(brokenDir)
        .quiet()
        .nothrow();
      const out = result.stdout.toString();
      expect(out).not.toContain('No issues found');
      expect(out.toLowerCase()).toContain('failed to run');
    });

    it('marks the crashed linter as not successful while the other succeeds', async () => {
      const result = await $`bun run ${distPath} --json --quiet --linters=eslint,biome sample.ts`
        .cwd(brokenDir)
        .quiet()
        .nothrow();
      const output = JSON.parse(result.stdout.toString());
      const eslint = output.linters.find((l: { name: string }) => l.name === 'eslint');
      const biome = output.linters.find((l: { name: string }) => l.name === 'biome');
      expect(eslint?.success).toBe(false);
      expect(biome?.success).toBe(true);
      expect(result.exitCode).toBe(2);
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
