import { describe, it, expect } from 'bun:test';
import { exec } from '../../../src/utils/exec.js';

describe('exec', () => {
  // Symptom: execa runs with reject:false, so a deadline does not throw; it
  // returns timedOut:true. exec reported timedOut:false, every adapter's
  // timeout check missed it, and the empty output read as "No issues found".
  it('reports timedOut when the child outlives the deadline', async () => {
    const result = await exec('sleep', ['5'], { timeout: 100, cwd: process.cwd() });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  it('does not report timedOut for a child that finishes in time', async () => {
    const result = await exec('echo', ['ok'], { timeout: 5000, cwd: process.cwd() });

    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('ok');
  });
});
