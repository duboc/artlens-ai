type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function format(level: LogLevel, tag: string, message: string, meta?: Record<string, unknown>): string {
  const color = COLORS[level];
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `${color}${timestamp()} [${level.toUpperCase()}]${RESET} ${BOLD}${tag}${RESET} ${message}${metaStr}`;
}

export const log = {
  info: (tag: string, message: string, meta?: Record<string, unknown>) =>
    console.log(format('info', tag, message, meta)),

  warn: (tag: string, message: string, meta?: Record<string, unknown>) =>
    console.warn(format('warn', tag, message, meta)),

  error: (tag: string, message: string, meta?: Record<string, unknown>) =>
    console.error(format('error', tag, message, meta)),

  debug: (tag: string, message: string, meta?: Record<string, unknown>) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(format('debug', tag, message, meta));
    }
  },

  // Log an HTTP request/response cycle
  req: (method: string, path: string, status: number, durationMs: number, meta?: Record<string, unknown>) => {
    const color = status >= 500 ? COLORS.error : status >= 400 ? COLORS.warn : COLORS.info;
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    console.log(
      `${color}${timestamp()} [HTTP]${RESET} ${BOLD}${method} ${path}${RESET} → ${color}${status}${RESET} ${durationMs}ms${metaStr}`
    );
  },
};
