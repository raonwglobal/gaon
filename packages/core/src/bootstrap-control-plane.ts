import { logger } from "./logger.js";

const CONTROL_URL = (
  process.env.CONTROL_URL ||
  process.env.CONTROL_PLANE_URL ||
  process.env.CONTROL_API_BASE ||
  ""
).replace(/\/$/, "");

const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

export interface BootstrapResult {
  attempted: boolean;
  ok: boolean;
  detail?: string;
}

/**
 * Ask Control Plane to push registry (plugins + config) into this Core.
 * Retries so Core can start before/while Control Plane is still coming up.
 */
export async function bootstrapFromControlPlane(options?: {
  retries?: number;
  delayMs?: number;
}): Promise<BootstrapResult> {
  const disabled =
    process.env.BOOTSTRAP_FROM_CONTROL === "false" ||
    process.env.BOOTSTRAP_FROM_CONTROL === "0";
  if (disabled) {
    logger.info("control-plane bootstrap skipped (BOOTSTRAP_FROM_CONTROL=false)");
    return { attempted: false, ok: false, detail: "disabled" };
  }

  if (!CONTROL_URL) {
    logger.info(
      "control-plane bootstrap skipped (CONTROL_URL / CONTROL_PLANE_URL not set)"
    );
    return { attempted: false, ok: false, detail: "no CONTROL_URL" };
  }

  const retries = options?.retries ?? Number(process.env.BOOTSTRAP_RETRIES ?? 12);
  const delayMs =
    options?.delayMs ?? Number(process.env.BOOTSTRAP_DELAY_MS ?? 2000);
  const url = `${CONTROL_URL}/internal/sync`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (INTERNAL_TOKEN) headers["X-Internal-Token"] = INTERNAL_TOKEN;

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8_000);
      const res = await fetch(url, {
        method: "POST",
        headers,
        signal: ac.signal,
      }).finally(() => clearTimeout(timer));

      const body = await res.text();
      if (res.ok) {
        logger.info("control-plane bootstrap ok", {
          attempt,
          url,
          body: body.slice(0, 500),
        });
        return { attempted: true, ok: true, detail: body.slice(0, 500) };
      }

      logger.warn("control-plane bootstrap non-ok", {
        attempt,
        status: res.status,
        body: body.slice(0, 300),
      });
    } catch (err) {
      logger.warn("control-plane bootstrap error", {
        attempt,
        error: err instanceof Error ? err.message : String(err),
        url,
      });
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  logger.error("control-plane bootstrap failed after retries", {
    retries,
    url,
  });
  return {
    attempted: true,
    ok: false,
    detail: `failed after ${retries} attempts`,
  };
}
