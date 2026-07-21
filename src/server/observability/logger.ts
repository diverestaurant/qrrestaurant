type LogContext = { correlationId?: string; actorId?: string; branchId?: string; action?: string; [key: string]: string | undefined };

function write(level: "info" | "warn" | "error", message: string, context: LogContext = {}) {
  const payload = { level, message, ...context, timestamp: new Date().toISOString() };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
}

export const logger = { info: (message: string, context?: LogContext) => write("info", message, context), warn: (message: string, context?: LogContext) => write("warn", message, context), error: (message: string, context?: LogContext) => write("error", message, context) };
