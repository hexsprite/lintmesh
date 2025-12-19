import { describe, it, expect } from 'bun:test';
import { ESLintAdapter } from '../../../src/linters/eslint.js';
import fs from 'node:fs';
import path from 'node:path';

const mockOutput = fs.readFileSync(
  path.join(import.meta.dir, '../../fixtures/mock-eslint-output.json'),
  'utf-8'
);

describe('ESLintAdapter', () => {
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
