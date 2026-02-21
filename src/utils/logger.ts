import { config } from "../config/index.js";

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = LEVEL_MAP[config.logLevel] ?? LogLevel.INFO;
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private log(
    level: LogLevel,
    label: string,
    color: string,
    message: string,
    error?: Error,
  ): void {
    if (level < this.level) return;
    const ts = `${COLORS.gray}${this.timestamp()}${COLORS.reset}`;
    const tag = `${color}[${label}]${COLORS.reset}`;
    console.log(`${ts} ${tag} ${message}`);
    if (error?.stack) {
      console.log(`${COLORS.gray}${error.stack}${COLORS.reset}`);
    }
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, "DEBUG", COLORS.gray, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, "INFO", COLORS.cyan, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, "WARN", COLORS.yellow, message);
  }

  error(message: string, error?: Error): void {
    this.log(LogLevel.ERROR, "ERROR", COLORS.red, message, error);
  }
}

export const logger = new Logger();
