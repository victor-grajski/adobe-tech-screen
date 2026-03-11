type LogLevel = "info" | "warn" | "error" | "debug";

const colors: Record<LogLevel, string> = {
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[90m",
};

const reset = "\x1b[0m";

function log(level: LogLevel, stage: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 23);
  const color = colors[level];
  console.log(`${color}[${timestamp}] [${level.toUpperCase()}] [${stage}]${reset} ${message}`);
}

export const logger = {
  info: (stage: string, message: string) => log("info", stage, message),
  warn: (stage: string, message: string) => log("warn", stage, message),
  error: (stage: string, message: string) => log("error", stage, message),
  debug: (stage: string, message: string) => log("debug", stage, message),
};
