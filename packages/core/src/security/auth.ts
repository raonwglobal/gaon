import type { IncomingMessage } from "node:http";
import type { ServerConfig } from "../config.js";

export function authenticate(req: IncomingMessage, config: ServerConfig): boolean {
  if (!config.apiSecretToken) return true;

  const apiKey = req.headers["x-api-key"];
  const authHeader = req.headers["authorization"];
  const bearer =
    typeof authHeader === "string"
      ? authHeader.replace(/^Bearer\s+/i, "")
      : undefined;

  const token = (typeof apiKey === "string" ? apiKey : undefined) || bearer;
  return token === config.apiSecretToken;
}
