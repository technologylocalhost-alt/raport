/**
 * Structured Logging Utility
 * Production-ready logger dengan level dan formatting
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name: string;
  };
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private formatLog(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Pretty format untuk development
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      };
      return `${emoji[entry.level]} [${entry.level.toUpperCase()}] ${entry.timestamp} - ${entry.message}`;
    }
    
    // JSON format untuk production (easy to parse by log aggregators)
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name,
      };
    }

    const formattedLog = this.formatLog(entry);

    switch (level) {
      case 'debug':
        if (this.isDevelopment) console.debug(formattedLog);
        break;
      case 'info':
        console.info(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'error':
        console.error(formattedLog);
        break;
    }

    // Di production, bisa tambahkan integration dengan logging service
    // seperti Sentry, DataDog, New Relic, etc.
    if (this.isProduction && level === 'error') {
      // TODO: Send to error tracking service
      // Example: Sentry.captureException(error);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, context, error);
  }

  // Specialized logging methods
  apiRequest(method: string, path: string, context?: Record<string, any>) {
    this.info(`API Request: ${method} ${path}`, context);
  }

  apiResponse(method: string, path: string, statusCode: number, duration: number) {
    this.info(`API Response: ${method} ${path}`, { statusCode, duration });
  }

  apiError(method: string, path: string, error: Error, context?: Record<string, any>) {
    this.error(`API Error: ${method} ${path}`, error, context);
  }

  dbQuery(query: string, duration: number) {
    if (this.isDevelopment) {
      this.debug(`DB Query executed`, { query, duration });
    }
  }

  authEvent(event: string, userId?: string, context?: Record<string, any>) {
    this.info(`Auth Event: ${event}`, { userId, ...context });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for extension
export type { LogLevel, LogEntry };
