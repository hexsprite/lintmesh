import { execa, type ExecaError } from 'execa';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/**
 * Execute a command with timeout handling
 */
export async function exec(
  command: string,
  args: string[],
  options: { timeout: number; cwd: string }
): Promise<ExecResult> {
  try {
    const result = await execa(command, args, {
      timeout: options.timeout,
      cwd: options.cwd,
      reject: false,
    });

    // reject:false returns a timeout instead of throwing, so it is read here.
    return {
      stdout: result.stdout,
      stderr: result.timedOut
        ? `Process timed out after ${options.timeout}ms`
        : result.stderr,
      exitCode: result.exitCode ?? 1,
      timedOut: result.timedOut,
    };
  } catch (error) {
    const execaError = error as ExecaError & { killed?: boolean };

    if (execaError.timedOut) {
      return {
        stdout: '',
        stderr: `Process timed out after ${options.timeout}ms`,
        exitCode: -1,
        timedOut: true,
      };
    }

    if (execaError.killed) {
      return {
        stdout: '',
        stderr: 'Process was killed',
        exitCode: -1,
        timedOut: false,
      };
    }

    throw error;
  }
}
