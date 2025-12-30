import { describe, it, expect } from 'bun:test';
import { TscAdapter, filterByPatterns } from '../../../src/linters/tsc.js';
import type { Issue } from '../../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

const mockOutput = fs.readFileSync(
  path.join(import.meta.dir, '../../fixtures/mock-tsgo-output.txt'),
  'utf-8'
);

describe('TscAdapter', () => {
  describe('parseOutput', () => {
    it('parses tsc-style output correctly', () => {
      const adapter = new TscAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues.length).toBeGreaterThan(0);
    });

    it('extracts error codes as ruleId', () => {
      const adapter = new TscAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const ts2322 = issues.find(i => i.ruleId.includes('TS2322'));
      expect(ts2322).toBeDefined();
    });

    it('extracts line and column', () => {
      const adapter = new TscAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      if (issues.length > 0) {
        const first = issues[0];
        expect(first.line).toBeGreaterThan(0);
        expect(first.column).toBeGreaterThan(0);
      }
    });

    it('handles empty output', () => {
      const adapter = new TscAdapter();
      const issues = adapter.parseOutput('', '/project');

      expect(issues).toHaveLength(0);
    });

    it('sets source to tsc', () => {
      const adapter = new TscAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues.every(i => i.source === 'tsc')).toBe(true);
    });
  });

  describe('name', () => {
    it('returns tsc', () => {
      const adapter = new TscAdapter();
      expect(adapter.name).toBe('tsc');
    });
  });
});

describe('filterByPatterns', () => {
  function makeIssue(relativePath: string): Issue {
    return {
      path: relativePath,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      severity: 'error',
      ruleId: 'tsc/TS2322',
      message: 'test error',
      source: 'tsc',
    };
  }

  const issues: Issue[] = [
    makeIssue('src/index.ts'),
    makeIssue('src/utils/helpers.ts'),
    makeIssue('tests/index.test.ts'),
    makeIssue('lib/external.ts'),
  ];

  it('filters by exact file path', () => {
    const result = filterByPatterns(issues, ['src/index.ts']);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/index.ts');
  });

  it('filters by directory prefix', () => {
    const result = filterByPatterns(issues, ['src']);

    expect(result).toHaveLength(2);
    expect(result.every(i => i.path.startsWith('src/'))).toBe(true);
  });

  it('matches multiple patterns', () => {
    const result = filterByPatterns(issues, ['src', 'tests']);

    expect(result).toHaveLength(3);
    expect(result.some(i => i.path.startsWith('src/'))).toBe(true);
    expect(result.some(i => i.path.startsWith('tests/'))).toBe(true);
  });

  it('returns all issues when no patterns provided', () => {
    const result = filterByPatterns(issues, []);

    expect(result).toHaveLength(4);
  });

  it('handles nested directory patterns', () => {
    const result = filterByPatterns(issues, ['src/utils']);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/utils/helpers.ts');
  });

  it('returns empty array when no matches', () => {
    const result = filterByPatterns(issues, ['nonexistent']);

    expect(result).toHaveLength(0);
  });

  it('handles trailing slashes in patterns', () => {
    const result = filterByPatterns(issues, ['lib/']);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('lib/external.ts');
  });

  it('returns all issues when pattern is "."', () => {
    const result = filterByPatterns(issues, ['.']);

    expect(result).toHaveLength(4);
  });

  it('returns all issues when pattern is "./"', () => {
    const result = filterByPatterns(issues, ['./']);

    expect(result).toHaveLength(4);
  });

  it('returns all issues when pattern is "./."', () => {
    const result = filterByPatterns(issues, ['./src', '.']);

    expect(result).toHaveLength(4);
  });
});
