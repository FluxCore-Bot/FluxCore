import { config } from "@fluxcore/config";

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

const REDACTED = "[REDACTED]";

// Order matters: webhook URLs and structured tokens before generic
// query-param redaction so we don't double-mangle.
const REDACTION_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  replacement: string;
}> = [
  // Bearer tokens (Authorization header style)
  {
    pattern: /(Bearer\s+)[A-Za-z0-9._\-+/=]+/gi,
    replacement: `$1${REDACTED}`,
  },
  // Basic auth headers
  {
    pattern: /(Basic\s+)[A-Za-z0-9+/=]+/gi,
    replacement: `$1${REDACTED}`,
  },
  // Discord webhook URLs: keep prefix, drop the id+token suffix
  {
    pattern:
      /https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/[^\s"'<>]+/gi,
    replacement: `https://discord.com/api/webhooks/${REDACTED}`,
  },
  // Discord bot tokens: 3 base64url segments separated by `.`
  {
    pattern: /[MN][A-Za-z\d]{23,28}\.[\w-]{6,7}\.[\w-]{27,}/g,
    replacement: REDACTED,
  },
  // Sensitive query parameters
  {
    pattern:
      /([?&](?:code|token|access_token|refresh_token|client_secret|api[_-]?key|secret|password)=)[^&\s"'<>]+/gi,
    replacement: `$1${REDACTED}`,
  },
];

export function redactSensitive(value: string): string {
  if (!value) return value;
  let out = value;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

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
    console.log(`${ts} ${tag} ${redactSensitive(message)}`);
    if (error?.stack) {
      console.log(`${COLORS.gray}${redactSensitive(error.stack)}${COLORS.reset}`);
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
