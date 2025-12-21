import { describe, expect, test } from 'bun:test';
import { ConfigSchema, LINTER_IDS, CONFIG_DEFAULTS, CONFIG_FILES } from '../../src/config.js';

describe('ConfigSchema', () => {
  test('validates minimal config', () => {
    const config = {};
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test('validates full config', () => {
    const config = {
      $schema: 'https://example.com/schema.json',
      linters: {
        eslint: { enabled: true, bin: null, args: ['--fix'] },
        oxlint: { enabled: true },
        biome: { enabled: false },
        tsc: { enabled: true, bin: '/usr/local/bin/tsc' },
      },
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      timeout: 60000,
      failOn: 'warning',
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test('rejects invalid linter id', () => {
    const config = {
      linters: {
        notareallinter: { enabled: true },
      },
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  test('rejects invalid failOn value', () => {
    const config = {
      failOn: 'critical',
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  test('rejects negative timeout', () => {
    const config = {
      timeout: -1000,
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

describe('LINTER_IDS', () => {
  test('includes expected linters', () => {
    expect(LINTER_IDS).toContain('eslint');
    expect(LINTER_IDS).toContain('oxlint');
    expect(LINTER_IDS).toContain('biome');
    expect(LINTER_IDS).toContain('tsc');
  });
});

describe('CONFIG_DEFAULTS', () => {
  test('has sensible defaults', () => {
    expect(CONFIG_DEFAULTS.timeout).toBe(30000);
    expect(CONFIG_DEFAULTS.failOn).toBe('error');
    expect(CONFIG_DEFAULTS.include).toContain('**/*.{ts,tsx,js,jsx,mjs,cjs}');
    expect(CONFIG_DEFAULTS.exclude).toContain('**/node_modules/**');
  });
});

describe('CONFIG_FILES', () => {
  test('lists config file locations', () => {
    expect(CONFIG_FILES.length).toBeGreaterThan(0);
    expect(CONFIG_FILES).toContain('lintmesh.config.jsonc');
    expect(CONFIG_FILES).toContain('.config/lintmesh.jsonc');
  });
});
