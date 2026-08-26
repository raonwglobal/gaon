import type { IncomingMessage, ServerResponse } from "node:http";
import { registry } from "../registry.js";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";

export async function handleMetrics(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (req.method === "GET" && pathname === "/api/metrics") {
    let coreHealth: Record<string, unknown> = {};
    try {
      const r = await fetch(`${CORE_URL}/health`);
      coreHealth = (await r.json()) as Record<string, unknown>;
    } catch {
      coreHealth = { status: "unreachable" };
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        core: coreHealth,
        plugins: {
          total: registry.list().length,
          enabled: registry.enabledIds().length,
        },
        uptime: process.uptime(),
      })
    );
    return true;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "control-plane" }));
    return true;
  }

  return false;
}
