export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
  private prefix: string;

  constructor(prefix = 'StartupScout') {
    this.prefix = prefix;
  }

  private format(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    let metaStr = '';
    if (meta) {
      try {
        // Redact any possible secrets from meta
        const cleaned = JSON.stringify(meta, (k, v) => {
          if (typeof k === 'string' && (k.toLowerCase().includes('key') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token'))) {
            return '***REDACTED***';
          }
          return v;
        });
        metaStr = ` ${cleaned}`;
      } catch {
        metaStr = '';
      }
    }
    return `[${timestamp}] [${level}] [${this.prefix}] ${message}${metaStr}`;
  }

  public info(message: string, meta?: any) {
    console.log(this.format('INFO', message, meta));
  }

  public warn(message: string, meta?: any) {
    console.warn(this.format('WARN', message, meta));
  }

  public error(message: string, meta?: any) {
    console.error(this.format('ERROR', message, meta));
  }

  public debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      console.debug(this.format('DEBUG', message, meta));
    }
  }
}

export const logger = new Logger('Backend');
