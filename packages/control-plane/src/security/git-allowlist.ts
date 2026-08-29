import { isIP } from "node:net";

/**
 * GIT_ALLOW_HOSTS=github.com,gitlab.com
 * Empty allow list = any https host except private IPs (GIT_BLOCK_PRIVATE default true)
 */
export function assertGitRefAllowed(ref: string): void {
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    throw new Error("Invalid git URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) git URLs are allowed");
  }

  if (process.env.GIT_ALLOW_HTTP !== "true" && url.protocol === "http:") {
    throw new Error("HTTP git URLs disabled (set GIT_ALLOW_HTTP=true to enable)");
  }

  const host = url.hostname.toLowerCase();
  const allow = (process.env.GIT_ALLOW_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allow.length > 0 && !allow.includes(host)) {
    throw new Error(`Git host not allowed: ${host}`);
  }

  const blockPrivate = process.env.GIT_BLOCK_PRIVATE !== "false";
  if (blockPrivate && isPrivateHost(host)) {
    throw new Error("Private / loopback git hosts are blocked");
  }
}

function isPrivateHost(host: string): boolean {
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (!isIP(host)) return false;
  const parts = host.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd"))
    return true;
  return false;
}
