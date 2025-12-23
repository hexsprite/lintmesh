import { describe, it, expect } from 'bun:test';
import { BiomeAdapter } from '../../../src/linters/biome.js';
import fs from 'node:fs';
import path from 'node:path';

const mockOutput = fs.readFileSync(
  path.join(import.meta.dir, '../../fixtures/mock-biome-output.json'),
  'utf-8'
);

describe('BiomeAdapter', () => {
  describe('parseOutput', () => {
    it('parses JSON output correctly', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues).toHaveLength(2);
    });

    it('maps severity warning correctly', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const warning = issues.find(i => i.ruleId === 'biome/noUnusedVariables');
      expect(warning?.severity).toBe('warning');
    });

    it('maps severity error correctly', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      const error = issues.find(i => i.ruleId === 'biome/noExplicitAny');
      expect(error?.severity).toBe('error');
    });

    it('extracts relative file paths', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues[0].path).toBe('src/foo.ts');
    });

    it('handles absolute file paths', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      // Second diagnostic has absolute path /project/src/bar.ts
      expect(issues[1].path).toBe('src/bar.ts');
    });

    it('converts byte offsets to line/column', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      // First issue: span [50, 59] in sourceCode
      // sourceCode: "// Comment line 1\n// Comment line 2\nconst unusedVar = 42;\n"
      // Line 1: 18 chars, Line 2: 18 chars = 36 offset at line 3 start
      // offset 50 = 36 + 14 = column 15 on line 3
      const first = issues[0];
      expect(first.line).toBe(3);
      expect(first.column).toBe(15);
    });

    it('namespaces rule IDs with biome/', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues[0].ruleId).toBe('biome/noUnusedVariables');
      expect(issues[1].ruleId).toBe('biome/noExplicitAny');
    });

    it('generates correct docs URLs', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues[0].meta?.docsUrl).toBe('https://biomejs.dev/linter/rules/no-unused-variables');
      expect(issues[1].meta?.docsUrl).toBe('https://biomejs.dev/linter/rules/no-explicit-any');
    });

    it('detects fixable issues', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues[0].meta?.fixable).toBe(true);
      expect(issues[1].meta?.fixable).toBe(false);
    });

    it('handles empty output', () => {
      const adapter = new BiomeAdapter();
      const emptyOutput = JSON.stringify({ summary: {}, diagnostics: [], command: 'lint' });
      const issues = adapter.parseOutput(emptyOutput, '/project');

      expect(issues).toHaveLength(0);
    });

    it('handles blank output', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput('', '/project');

      expect(issues).toHaveLength(0);
    });

    it('throws on invalid JSON', () => {
      const adapter = new BiomeAdapter();

      expect(() => adapter.parseOutput('not json', '/project')).toThrow();
    });

    it('sets source to biome', () => {
      const adapter = new BiomeAdapter();
      const issues = adapter.parseOutput(mockOutput, '/project');

      expect(issues.every(i => i.source === 'biome')).toBe(true);
    });
  });

  describe('name', () => {
    it('returns biome', () => {
      const adapter = new BiomeAdapter();
      expect(adapter.name).toBe('biome');
    });
  });
});
