import type { IncomingMessage } from "node:http";
import { getPlatformConfig } from "../runtime-state.js";

export function authenticate(req: IncomingMessage): boolean {
  const token = getPlatformConfig().apiSecretToken;
  if (!token) return true;

  const header =
    req.headers["x-api-key"] ||
    (typeof req.headers["authorization"] === "string"
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "")
      : undefined);

  return header === token;
}
