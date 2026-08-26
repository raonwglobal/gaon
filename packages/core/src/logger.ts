export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const MAX = Number(process.env.LOG_BUFFER_SIZE ?? 500);
const buffer: LogEntry[] = [];

function push(entry: LogEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  const line = JSON.stringify(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    push({ ts: Date.now(), level: "debug", message, context });
  },
  info(message: string, context?: Record<string, unknown>) {
    push({ ts: Date.now(), level: "info", message, context });
  },
  warn(message: string, context?: Record<string, unknown>) {
    push({ ts: Date.now(), level: "warn", message, context });
  },
  error(message: string, context?: Record<string, unknown>) {
    push({ ts: Date.now(), level: "error", message, context });
  },
  list(opts?: { level?: LogLevel; limit?: number }): LogEntry[] {
    let items = buffer.slice();
    if (opts?.level) items = items.filter((e) => e.level === opts.level);
    const limit = opts?.limit ?? 100;
    return items.slice(-limit);
  },
  clear() {
    buffer.length = 0;
  },
};
