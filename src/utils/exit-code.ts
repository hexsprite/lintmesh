import type { Severity, VibelintOutput } from '../types.js';

const SEVERITY_ORDER: Severity[] = ['info', 'warning', 'error'];

/**
 * Compute the exit code based on issues and threshold
 * @returns 0 = no issues at/above threshold, 1 = issues found, 2 = a linter failed
 *
 * A linter that failed to run (config crash, timeout, parse error) performed
 * ZERO checks. Treating that as "clean" gives false confidence that linting
 * passed when it never ran — so any linter failure is a hard failure (2), even
 * if it produced no parsed issues and other linters succeeded.
 */
export function computeExitCode(
  output: VibelintOutput,
  failOn: Severity,
  anyLinterFailed: boolean
): number {
  if (anyLinterFailed) {
    return 2;
  }

  const threshold = SEVERITY_ORDER.indexOf(failOn);

  const hasIssuesAtOrAbove = output.issues.some(
    issue => SEVERITY_ORDER.indexOf(issue.severity) >= threshold
  );

  return hasIssuesAtOrAbove ? 1 : 0;
}
