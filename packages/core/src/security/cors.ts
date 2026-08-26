import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerConfig } from "../config.js";

export function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig
): void {
  const origin = req.headers.origin;
  const allowed = config.allowedOrigins;

  if (allowed.includes("*") || (origin && allowed.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-API-Key"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}
