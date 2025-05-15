/**
 * Simple logger utility for consistent logging across the application
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

// Default minimum log level
let globalMinLevel: LogLevel = "debug";

// Set the minimum log level for all loggers
export const setLogLevel = (level: LogLevel): void => {
  globalMinLevel = level;
};

// Create a logger with a specific module name
export const createLogger = (module: string): Logger => {
  const levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  const shouldLog = (level: LogLevel): boolean => {
    return levelPriority[level] >= levelPriority[globalMinLevel];
  };

  const formatMessage = (level: LogLevel, message: string): string => {
    return `[${level.toUpperCase()}] [${module}] ${message}`;
  };

  return {
    debug: (message: string, ...args: any[]): void => {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", message), ...args);
      }
    },
    info: (message: string, ...args: any[]): void => {
      if (shouldLog("info")) {
        console.info(formatMessage("info", message), ...args);
      }
    },
    warn: (message: string, ...args: any[]): void => {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", message), ...args);
      }
    },
    error: (message: string, ...args: any[]): void => {
      if (shouldLog("error")) {
        console.error(formatMessage("error", message), ...args);
      }
    },
  };
};
