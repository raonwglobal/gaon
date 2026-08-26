import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _resetRateLimitForTests } from "./rate-limit.js";
import { setPlatformConfig } from "../runtime-state.js";
import type { IncomingMessage, ServerResponse } from "node:http";

function mockReq(): IncomingMessage {
  return {
    socket: { remoteAddress: "127.0.0.1" },
  } as IncomingMessage;
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    writeHead(code: number, headers?: Record<string, string>) {
      res.statusCode = code;
      if (headers) Object.assign(res.headers, headers);
    },
    end() {},
  };
  return res as unknown as ServerResponse & { statusCode: number };
}

describe("rateLimit", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    setPlatformConfig({ rateLimitPerMin: 3 });
  });

  it("allows under limit and blocks over", () => {
    const req = mockReq();
    expect(rateLimit(req, mockRes())).toBe(true);
    expect(rateLimit(req, mockRes())).toBe(true);
    expect(rateLimit(req, mockRes())).toBe(true);
    const blocked = mockRes();
    expect(rateLimit(req, blocked)).toBe(false);
    expect(blocked.statusCode).toBe(429);
  });
});
