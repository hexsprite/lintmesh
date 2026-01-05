/**
 * Minimal ANSI color utilities for terminal output
 * Only applies colors when enabled (interactive mode)
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

type ColorFn = (text: string) => string;

interface Colors {
  red: ColorFn;
  yellow: ColorFn;
  cyan: ColorFn;
  gray: ColorFn;
  dim: ColorFn;
  bold: ColorFn;
}

function createColors(enabled: boolean): Colors {
  if (!enabled) {
    const identity: ColorFn = (text) => text;
    return {
      red: identity,
      yellow: identity,
      cyan: identity,
      gray: identity,
      dim: identity,
      bold: identity,
    };
  }

  return {
    red: (text) => `${RED}${text}${RESET}`,
    yellow: (text) => `${YELLOW}${text}${RESET}`,
    cyan: (text) => `${CYAN}${text}${RESET}`,
    gray: (text) => `${GRAY}${text}${RESET}`,
    dim: (text) => `${DIM}${text}${RESET}`,
    bold: (text) => `${BOLD}${text}${RESET}`,
  };
}

export { createColors, type Colors };
