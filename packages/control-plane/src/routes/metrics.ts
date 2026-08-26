import type { IncomingMessage, ServerResponse } from "node:http";
import { registry } from "../registry.js";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";
const startedAt = Date.now();

function coreHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (INTERNAL_TOKEN) h["X-Internal-Token"] = INTERNAL_TOKEN;
  return h;
}

export async function handleMetrics(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (req.method === "GET" && (pathname === "/api/metrics" || pathname === "/api/health")) {
    const plugins = registry.list();
    let core: Record<string, unknown> | null = null;
    let coreMetrics: Record<string, unknown> | null = null;

    try {
      const healthRes = await fetch(`${CORE_URL}/health`);
      if (healthRes.ok) core = (await healthRes.json()) as Record<string, unknown>;
    } catch {
      core = null;
    }

    try {
      const mRes = await fetch(`${CORE_URL}/internal/metrics`, {
        headers: coreHeaders(),
      });
      if (mRes.ok) coreMetrics = (await mRes.json()) as Record<string, unknown>;
    } catch {
      coreMetrics = null;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        plugins: {
          total: plugins.length,
          enabled: plugins.filter((p) => p.enabled).length,
        },
        core: core
          ? {
              status: core.status,
              sessions: core.sessions,
              uptime: core.uptime,
              plugins: core.plugins,
            }
          : { status: "unreachable" },
        observability: coreMetrics,
      })
    );
    return true;
  }

  return false;
}
