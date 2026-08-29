import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const auditPath =
  process.env.AUDIT_LOG_PATH ||
  join(process.cwd(), "data", "audit.log");

export interface AuditEvent {
  ts: number;
  actorId?: string;
  actorName?: string;
  action: string;
  resource?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}

export function audit(event: Omit<AuditEvent, "ts"> & { ts?: number }): void {
  try {
    mkdirSync(dirname(auditPath), { recursive: true });
    const line = JSON.stringify({ ...event, ts: event.ts ?? Date.now() });
    appendFileSync(auditPath, line + "\n", "utf8");
  } catch (err) {
    console.error("[audit] write failed:", err);
  }
}

export function readAudit(limit = 100): AuditEvent[] {
  try {
    if (!existsSync(auditPath)) return [];
    const lines = readFileSync(auditPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as AuditEvent)
      .reverse();
  } catch {
    return [];
  }
}
