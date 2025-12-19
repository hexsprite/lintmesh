import { describe, it, expect } from 'bun:test';
import { parseCliArgs } from '../../src/cli.js';

describe('parseCliArgs', () => {
  describe('help and version', () => {
    it('returns help flag for --help', () => {
      const result = parseCliArgs(['--help']);
      expect(result).toEqual({ help: true });
    });

    it('returns help flag for -h', () => {
      const result = parseCliArgs(['-h']);
      expect(result).toEqual({ help: true });
    });

    it('returns version flag for --version', () => {
      const result = parseCliArgs(['--version']);
      expect(result).toEqual({ version: true });
    });

    it('returns version flag for -v', () => {
      const result = parseCliArgs(['-v']);
      expect(result).toEqual({ version: true });
    });
  });

  describe('defaults', () => {
    it('has default linters', () => {
      const result = parseCliArgs([]);
      if ('linters' in result) {
        expect(result.linters).toEqual(['eslint', 'oxlint', 'tsgo']);
      }
    });

    it('has default failOn', () => {
      const result = parseCliArgs([]);
      if ('failOn' in result) {
        expect(result.failOn).toBe('error');
      }
    });

    it('has default timeout', () => {
      const result = parseCliArgs([]);
      if ('timeout' in result) {
        expect(result.timeout).toBe(30000);
      }
    });

    it('has empty files by default', () => {
      const result = parseCliArgs([]);
      if ('files' in result) {
        expect(result.files).toEqual([]);
      }
    });
  });

  describe('linters option', () => {
    it('parses single linter', () => {
      const result = parseCliArgs(['--linters=eslint']);
      if ('linters' in result) {
        expect(result.linters).toEqual(['eslint']);
      }
    });

    it('parses multiple linters', () => {
      const result = parseCliArgs(['--linters=eslint,oxlint']);
      if ('linters' in result) {
        expect(result.linters).toEqual(['eslint', 'oxlint']);
      }
    });

    it('throws on invalid linter', () => {
      expect(() => parseCliArgs(['--linters=invalid'])).toThrow(/Invalid linter/);
    });
  });

  describe('fail-on option', () => {
    it('accepts error', () => {
      const result = parseCliArgs(['--fail-on=error']);
      if ('failOn' in result) {
        expect(result.failOn).toBe('error');
      }
    });

    it('accepts warning', () => {
      const result = parseCliArgs(['--fail-on=warning']);
      if ('failOn' in result) {
        expect(result.failOn).toBe('warning');
      }
    });

    it('accepts info', () => {
      const result = parseCliArgs(['--fail-on=info']);
      if ('failOn' in result) {
        expect(result.failOn).toBe('info');
      }
    });

    it('throws on invalid value', () => {
      expect(() => parseCliArgs(['--fail-on=invalid'])).toThrow(/Invalid --fail-on/);
    });
  });

  describe('timeout option', () => {
    it('parses numeric timeout', () => {
      const result = parseCliArgs(['--timeout=5000']);
      if ('timeout' in result) {
        expect(result.timeout).toBe(5000);
      }
    });

    it('throws on non-numeric timeout', () => {
      expect(() => parseCliArgs(['--timeout=abc'])).toThrow(/Invalid --timeout/);
    });

    it('throws on zero timeout', () => {
      expect(() => parseCliArgs(['--timeout=0'])).toThrow(/Invalid --timeout/);
    });
  });

  describe('positional arguments', () => {
    it('captures file paths', () => {
      const result = parseCliArgs(['src/', 'lib/']);
      if ('files' in result) {
        expect(result.files).toEqual(['src/', 'lib/']);
      }
    });

    it('captures file paths with options', () => {
      const result = parseCliArgs(['--linters=eslint', 'src/', '--pretty']);
      if ('files' in result) {
        expect(result.files).toEqual(['src/']);
        expect(result.pretty).toBe(true);
      }
    });
  });

  describe('boolean flags', () => {
    it('parses pretty', () => {
      const result = parseCliArgs(['--pretty']);
      if ('pretty' in result) {
        expect(result.pretty).toBe(true);
      }
    });

    it('parses quiet', () => {
      const result = parseCliArgs(['--quiet']);
      if ('quiet' in result) {
        expect(result.quiet).toBe(true);
      }
    });
  });
});
