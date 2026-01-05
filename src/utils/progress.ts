/**
 * Simple multi-line progress display for interactive terminals
 * Shows one line per task with spinner, updates in place
 */

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const CHECK = '✓';
const CROSS = '✗';

// ANSI codes
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_LINE = '\x1b[2K';
const MOVE_UP = '\x1b[F';

export type TaskStatus = 'pending' | 'running' | 'success' | 'error';

interface Task {
  name: string;
  status: TaskStatus;
  message?: string;
  durationMs?: number;
}

export class ProgressDisplay {
  private tasks: Map<string, Task> = new Map();
  private taskOrder: string[] = [];
  private spinnerFrame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lineCount = 0;
  private stream: NodeJS.WriteStream;

  constructor(stream: NodeJS.WriteStream = process.stderr) {
    this.stream = stream;
  }

  /** Add a task to track */
  addTask(name: string): void {
    this.tasks.set(name, { name, status: 'pending' });
    this.taskOrder.push(name);
  }

  /** Start the progress display */
  start(): void {
    this.stream.write(HIDE_CURSOR);
    this.render();
    this.interval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 80);
  }

  /** Update a task's status */
  update(name: string, status: TaskStatus, message?: string, durationMs?: number): void {
    const task = this.tasks.get(name);
    if (task) {
      task.status = status;
      task.message = message;
      task.durationMs = durationMs;
    }
  }

  /** Stop and clear the progress display */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.clearLines();
    this.stream.write(SHOW_CURSOR);
  }

  private clearLines(): void {
    for (let i = 0; i < this.lineCount; i++) {
      this.stream.write(MOVE_UP + CLEAR_LINE);
    }
    this.lineCount = 0;
  }

  private render(): void {
    // Move cursor up to overwrite previous lines
    this.clearLines();

    const lines: string[] = [];
    for (const name of this.taskOrder) {
      const task = this.tasks.get(name)!;
      lines.push(this.formatTask(task));
    }

    const output = lines.join('\n') + '\n';
    this.stream.write(output);
    this.lineCount = lines.length;
  }

  private formatTask(task: Task): string {
    const duration = task.durationMs !== undefined
      ? `${DIM}(${this.formatDuration(task.durationMs)})${RESET}`
      : '';

    switch (task.status) {
      case 'pending':
        return `${DIM}○${RESET} ${task.name}`;
      case 'running':
        return `${CYAN}${SPINNER_FRAMES[this.spinnerFrame]}${RESET} ${task.name}...`;
      case 'success':
        const msg = task.message ? ` ${DIM}${task.message}${RESET}` : '';
        return `${GREEN}${CHECK}${RESET} ${task.name}${msg} ${duration}`;
      case 'error':
        const err = task.message ? ` ${DIM}${task.message}${RESET}` : '';
        return `${RED}${CROSS}${RESET} ${task.name}${err} ${duration}`;
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
}
