import { describe, expect, test } from 'bun:test';
import { detectLinter, detectAllLinters } from '../../../src/utils/detect.js';

describe('detectLinter', () => {
  test('detects eslint in current project', async () => {
    const result = await detectLinter('eslint', process.cwd());

    // This project has eslint installed
    expect(result.linterId).toBe('eslint');
    expect(result.available).toBe(true);
    expect(result.binPath).toContain('eslint');
    expect(result.binSource).toBe('local');
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.hasConfig).toBe(true); // eslint.config.js exists
    expect(result.inDevDeps).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('detects tsc in current project', async () => {
    const result = await detectLinter('tsc', process.cwd());

    expect(result.linterId).toBe('tsc');
    expect(result.available).toBe(true);
    expect(result.hasConfig).toBe(true); // tsconfig.json exists
    expect(result.inDevDeps).toBe(true); // typescript in devDeps
  });

  test('biome not installed in this project', async () => {
    const result = await detectLinter('biome', process.cwd());

    expect(result.linterId).toBe('biome');
    expect(result.hasConfig).toBe(false);
    expect(result.inDevDeps).toBe(false);
    // available depends on whether biome is on PATH
  });
});

describe('detectAllLinters', () => {
  test('returns results for all linters', async () => {
    const results = await detectAllLinters(process.cwd());

    expect(results.length).toBe(4);
    expect(results.map(r => r.linterId)).toContain('eslint');
    expect(results.map(r => r.linterId)).toContain('oxlint');
    expect(results.map(r => r.linterId)).toContain('biome');
    expect(results.map(r => r.linterId)).toContain('tsc');
  });
});
