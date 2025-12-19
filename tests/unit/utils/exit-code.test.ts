import { describe, it, expect } from 'bun:test';
import { computeExitCode } from '../../../src/utils/exit-code.js';
import type { VibelintOutput } from '../../../src/types.js';

function makeOutput(issues: Array<{ severity: 'error' | 'warning' | 'info' }>): VibelintOutput {
  return {
    timestamp: new Date().toISOString(),
    cwd: '/project',
    durationMs: 100,
    linters: [],
    issues: issues.map((i, idx) => ({
      path: `file${idx}.ts`,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      severity: i.severity,
      ruleId: 'test/rule',
      message: 'Test message',
      source: 'eslint' as const,
    })),
    summary: {
      total: issues.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
      fixable: 0,
    },
  };
}

describe('computeExitCode', () => {
  describe('when all linters failed', () => {
    it('returns 2', () => {
      const output = makeOutput([]);
      expect(computeExitCode(output, 'error', true)).toBe(2);
    });
  });

  describe('with failOn = error', () => {
    it('returns 0 when no issues', () => {
      const output = makeOutput([]);
      expect(computeExitCode(output, 'error', false)).toBe(0);
    });

    it('returns 1 when has errors', () => {
      const output = makeOutput([{ severity: 'error' }]);
      expect(computeExitCode(output, 'error', false)).toBe(1);
    });

    it('returns 0 when only warnings', () => {
      const output = makeOutput([{ severity: 'warning' }]);
      expect(computeExitCode(output, 'error', false)).toBe(0);
    });

    it('returns 0 when only info', () => {
      const output = makeOutput([{ severity: 'info' }]);
      expect(computeExitCode(output, 'error', false)).toBe(0);
    });
  });

  describe('with failOn = warning', () => {
    it('returns 1 when has warnings', () => {
      const output = makeOutput([{ severity: 'warning' }]);
      expect(computeExitCode(output, 'warning', false)).toBe(1);
    });

    it('returns 1 when has errors', () => {
      const output = makeOutput([{ severity: 'error' }]);
      expect(computeExitCode(output, 'warning', false)).toBe(1);
    });

    it('returns 0 when only info', () => {
      const output = makeOutput([{ severity: 'info' }]);
      expect(computeExitCode(output, 'warning', false)).toBe(0);
    });
  });

  describe('with failOn = info', () => {
    it('returns 1 when has any issues', () => {
      const output = makeOutput([{ severity: 'info' }]);
      expect(computeExitCode(output, 'info', false)).toBe(1);
    });
  });
});
