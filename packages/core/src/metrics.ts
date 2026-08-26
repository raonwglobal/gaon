/**
 * Lightweight in-process observability counters.
 */
export interface ToolMetric {
  calls: number;
  errors: number;
  lastCalledAt?: number;
}

export interface MetricsSnapshot {
  startedAt: number;
  uptimeSec: number;
  http: {
    requests: number;
    errors: number;
    byPath: Record<string, number>;
  };
  sessions: {
    created: number;
    closed: number;
    active: number;
  };
  tools: Record<string, ToolMetric>;
  rateLimited: number;
}

const startedAt = Date.now();

const state = {
  httpRequests: 0,
  httpErrors: 0,
  byPath: {} as Record<string, number>,
  sessionsCreated: 0,
  sessionsClosed: 0,
  rateLimited: 0,
  tools: {} as Record<string, ToolMetric>,
};

export const metrics = {
  recordHttp(path: string, isError = false): void {
    state.httpRequests += 1;
    if (isError) state.httpErrors += 1;
    const key = path.split("?")[0] || path;
    state.byPath[key] = (state.byPath[key] ?? 0) + 1;
  },

  recordRateLimited(): void {
    state.rateLimited += 1;
  },

  recordSessionCreated(): void {
    state.sessionsCreated += 1;
  },

  recordSessionClosed(): void {
    state.sessionsClosed += 1;
  },

  recordToolCall(name: string, isError = false): void {
    const cur = state.tools[name] ?? { calls: 0, errors: 0 };
    cur.calls += 1;
    if (isError) cur.errors += 1;
    cur.lastCalledAt = Date.now();
    state.tools[name] = cur;
  },

  snapshot(activeSessions: number): MetricsSnapshot {
    return {
      startedAt,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      http: {
        requests: state.httpRequests,
        errors: state.httpErrors,
        byPath: { ...state.byPath },
      },
      sessions: {
        created: state.sessionsCreated,
        closed: state.sessionsClosed,
        active: activeSessions,
      },
      tools: { ...state.tools },
      rateLimited: state.rateLimited,
    };
  },

  /** test helper */
  _resetForTests(): void {
    state.httpRequests = 0;
    state.httpErrors = 0;
    state.byPath = {};
    state.sessionsCreated = 0;
    state.sessionsClosed = 0;
    state.rateLimited = 0;
    state.tools = {};
  },
};
