import { McpSession } from "./session.js";

export interface SessionManagerOptions {
  idleTimeoutMs?: number;
  maxSessions?: number;
  cleanupIntervalMs?: number;
}

export class SessionManager {
  private sessions = new Map<string, McpSession>();
  private lastActivity = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private readonly idleTimeoutMs: number;
  private readonly maxSessions: number;

  constructor(options: SessionManagerOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60 * 1000;
    this.maxSessions = options.maxSessions ?? 1000;

    const interval = options.cleanupIntervalMs ?? 60 * 1000;
    this.cleanupTimer = setInterval(() => {
      void this.cleanupIdleSessions();
    }, interval);
  }

  canAcceptNewSession(): boolean {
    return this.sessions.size < this.maxSessions;
  }

  add(session: McpSession): void {
    this.sessions.set(session.id, session);
    this.touch(session.id);
  }

  get(sessionId: string): McpSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) this.touch(sessionId);
    return session;
  }

  list(): Array<{ id: string; createdAt: number; lastActivity: number }> {
    return [...this.sessions.values()].map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      lastActivity: this.lastActivity.get(s.id) ?? s.createdAt,
    }));
  }

  async remove(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);
    this.lastActivity.delete(sessionId);
    await session.shutdown();
  }

  touch(sessionId: string): void {
    this.lastActivity.set(sessionId, Date.now());
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, last] of this.lastActivity) {
      if (now - last > this.idleTimeoutMs) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      await this.remove(id);
    }
  }

  async shutdownAll(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const ids = [...this.sessions.keys()];
    await Promise.all(ids.map((id) => this.remove(id)));
  }

  get size(): number {
    return this.sessions.size;
  }
}
