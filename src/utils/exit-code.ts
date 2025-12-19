import type { Severity, VibelintOutput } from '../types.js';

const SEVERITY_ORDER: Severity[] = ['info', 'warning', 'error'];

/**
 * Compute the exit code based on issues and threshold
 * @returns 0 = no issues at/above threshold, 1 = issues found, 2 = all linters failed
 */
export function computeExitCode(
  output: VibelintOutput,
  failOn: Severity,
  allLintersFailed: boolean
): number {
  if (allLintersFailed) {
    return 2;
  }

  const threshold = SEVERITY_ORDER.indexOf(failOn);

  const hasIssuesAtOrAbove = output.issues.some(
    issue => SEVERITY_ORDER.indexOf(issue.severity) >= threshold
  );

  return hasIssuesAtOrAbove ? 1 : 0;
}
