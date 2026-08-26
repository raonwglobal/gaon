import type { McpSession } from "./session.js";
import { getPlatformConfig } from "./runtime-state.js";
import { metrics } from "./metrics.js";

export interface SessionListItem {
  id: string;
  createdAt: number;
  lastActivity: number;
}

export class SessionManager {
  private sessions = new Map<string, { session: McpSession; lastActivity: number }>();
  private readonly idleTimeoutMs: number;
  private readonly maxSessionsFallback: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts?: { idleTimeoutMs?: number; maxSessions?: number }) {
    this.idleTimeoutMs = opts?.idleTimeoutMs ?? 1_800_000;
    this.maxSessionsFallback = opts?.maxSessions ?? 1000;
    this.timer = setInterval(() => void this.cleanupIdle(), 60_000);
    if (typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  get maxSessions(): number {
    return getPlatformConfig().maxSessions || this.maxSessionsFallback;
  }

  get size(): number {
    return this.sessions.size;
  }

  canAcceptNewSession(): boolean {
    return this.sessions.size < this.maxSessions;
  }

  add(session: McpSession): void {
    this.sessions.set(session.id, { session, lastActivity: Date.now() });
    metrics.recordSessionCreated();
  }

  get(id: string): McpSession | undefined {
    const entry = this.sessions.get(id);
    if (!entry) return undefined;
    entry.lastActivity = Date.now();
    return entry.session;
  }

  async remove(id: string): Promise<void> {
    const entry = this.sessions.get(id);
    if (!entry) return;
    this.sessions.delete(id);
    metrics.recordSessionClosed();
    await entry.session.shutdown();
  }

  list(): SessionListItem[] {
    return [...this.sessions.entries()].map(([id, e]) => ({
      id,
      createdAt: e.session.createdAt,
      lastActivity: e.lastActivity,
    }));
  }

  private async cleanupIdle(): Promise<void> {
    const timeout = getPlatformConfig().sessionIdleTimeoutMs || this.idleTimeoutMs;
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastActivity > timeout) {
        console.log(`[SessionManager] Idle timeout: ${id}`);
        await this.remove(id);
      }
    }
  }

  async shutdownAll(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    const ids = [...this.sessions.keys()];
    await Promise.all(ids.map((id) => this.remove(id)));
  }
}
