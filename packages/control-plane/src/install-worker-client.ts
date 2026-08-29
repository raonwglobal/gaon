import type { InstallRequest, InstallResult } from "./plugin-installer.js";

/**
 * Prefer isolated install-worker when INSTALL_WORKER_URL is set.
 * Returns null when worker is not configured (caller should install in-process).
 */
export async function installViaWorker(
  req: InstallRequest
): Promise<InstallResult | null> {
  const base = (process.env.INSTALL_WORKER_URL || "").replace(/\/$/, "");
  if (!base) return null;

  const token = process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";
  if (!token) {
    return {
      ok: false,
      detail: "INSTALL_WORKER_URL set but INTERNAL_TOKEN missing",
    };
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 200_000);
    const res = await fetch(`${base}/install`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": token,
      },
      body: JSON.stringify(req),
      signal: ac.signal,
    }).finally(() => clearTimeout(timer));

    const data = (await res.json()) as InstallResult;
    if (!res.ok && !data.detail) {
      return { ok: false, detail: `install-worker HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    return {
      ok: false,
      detail: `install-worker unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
