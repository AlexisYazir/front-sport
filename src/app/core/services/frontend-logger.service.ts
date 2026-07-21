export type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface FrontendLogEntry {
  level: FrontendLogLevel;
  message: string;
  timestamp: string;
  detail?: unknown;
}

class FrontendLoggerService {
  private readonly maxEntries = 100;
  private readonly entries: FrontendLogEntry[] = [];

  debug(message: string, detail?: unknown): void {
    this.push('debug', message, detail);
  }

  info(message: string, detail?: unknown): void {
    this.push('info', message, detail);
  }

  warn(message: string, detail?: unknown): void {
    this.push('warn', message, detail);
  }

  error(message: string, detail?: unknown): void {
    this.push('error', message, detail);
  }

  critical(message: string, detail?: unknown): void {
    this.push('critical', message, detail);
  }

  getEntries(): FrontendLogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
  }

  private push(level: FrontendLogLevel, message: string, detail?: unknown): void {
    this.entries.push({
      level,
      message,
      detail,
      timestamp: new Date().toISOString(),
    });

    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }
}

export const frontendLogger = new FrontendLoggerService();
