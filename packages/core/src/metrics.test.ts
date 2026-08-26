import { describe, it, expect, beforeEach } from "vitest";
import { metrics } from "./metrics.js";

describe("metrics", () => {
  beforeEach(() => {
    metrics._resetForTests();
  });

  it("records http and tool calls", () => {
    metrics.recordHttp("/sse");
    metrics.recordHttp("/message", true);
    metrics.recordToolCall("weather_get_current");
    metrics.recordToolCall("weather_get_current", true);
    metrics.recordSessionCreated();
    metrics.recordSessionClosed();
    metrics.recordRateLimited();

    const snap = metrics.snapshot(1);
    expect(snap.http.requests).toBe(2);
    expect(snap.http.errors).toBe(1);
    expect(snap.tools.weather_get_current.calls).toBe(2);
    expect(snap.tools.weather_get_current.errors).toBe(1);
    expect(snap.sessions.created).toBe(1);
    expect(snap.sessions.closed).toBe(1);
    expect(snap.sessions.active).toBe(1);
    expect(snap.rateLimited).toBe(1);
  });
});
