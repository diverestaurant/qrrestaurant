export type LogContext = { correlationId?: string; actorId?: string; branchId?: string; action?: string; [key: string]: string | number | boolean | undefined };

const sensitiveKey = /(authorization|cookie|email|join.?code|note|password|payment.?reference|qr.?token|secret|token)/i;

function sanitize(context: LogContext) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => {
    if (value === undefined) return [key, undefined];
    if (sensitiveKey.test(key)) return [key, "[REDACTED]"];
    if (typeof value === "string" && value.length > 200) return [key, `${value.slice(0, 197)}...`];
    return [key, value];
  }).filter(([, value]) => value !== undefined));
}

function write(level: "info" | "warn" | "error", message: string, context: LogContext = {}) {
  const payload = {
    level,
    message: message.slice(0, 300),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
    ...sanitize(context),
    timestamp: new Date().toISOString(),
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
}

export const logger = { info: (message: string, context?: LogContext) => write("info", message, context), warn: (message: string, context?: LogContext) => write("warn", message, context), error: (message: string, context?: LogContext) => write("error", message, context) };
