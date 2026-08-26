import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerConfig } from "../config.js";

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig
): boolean {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = config.rateLimitPerMin;

  let entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    hits.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    res.writeHead(429, {
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
    });
    res.end(JSON.stringify({ error: "Too many requests" }));
    return false;
  }

  return true;
}
