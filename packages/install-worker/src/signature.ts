/**
 * Optional plugin signature check.
 * package.json: mcpPluginSignature = HMAC-SHA256 hex
 * Payload: `${mcpPluginId}|${version}|${filesHash}`
 * Secret: PLUGIN_SIGNING_KEY
 */
import { createHmac, createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function hashTree(dir: string, base = dir): string {
  const h = createHash("sha256");
  const entries = readdirSync(dir).sort();
  for (const name of entries) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      h.update(hashTree(full, base));
    } else if (st.isFile()) {
      const rel = full.slice(base.length + 1).replace(/\\/g, "/");
      h.update(rel);
      h.update(readFileSync(full));
    }
  }
  return h.digest("hex");
}

export function verifyPluginSignature(pluginDir: string): boolean {
  const key = process.env.PLUGIN_SIGNING_KEY || "";
  const required = process.env.PLUGIN_SIGNATURE_REQUIRED === "true";
  const pkgPath = join(pluginDir, "package.json");

  if (!existsSync(pkgPath)) {
    if (required) throw new Error("package.json missing for signature check");
    return true;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    mcpPluginId?: string;
    version?: string;
    mcpPluginSignature?: string;
  };

  if (!key) {
    if (required)
      throw new Error(
        "PLUGIN_SIGNING_KEY not set but PLUGIN_SIGNATURE_REQUIRED=true"
      );
    return true;
  }

  const sig = pkg.mcpPluginSignature;
  if (!sig) {
    if (required) throw new Error("mcpPluginSignature missing in package.json");
    return false;
  }

  const id = pkg.mcpPluginId || "";
  const version = pkg.version || "0.0.0";
  const filesHash = hashTree(pluginDir);
  const payload = `${id}|${version}|${filesHash}`;
  const expected = createHmac("sha256", key).update(payload).digest("hex");

  if (sig !== expected) {
    throw new Error("Plugin signature mismatch");
  }
  return true;
}

export function computePluginSignature(pluginDir: string, key: string): string {
  const pkgPath = join(pluginDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    mcpPluginId?: string;
    version?: string;
  };
  const id = pkg.mcpPluginId || "";
  const version = pkg.version || "0.0.0";
  const filesHash = hashTree(pluginDir);
  const payload = `${id}|${version}|${filesHash}`;
  return createHmac("sha256", key).update(payload).digest("hex");
}
