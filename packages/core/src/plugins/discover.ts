import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { McpPluginFactory } from "./interface.js";

export interface DiscoveredPlugin {
  id: string;
  path: string;
}

/**
 * Discover plugin directories under PLUGINS_DIR.
 * Skips folders starting with `_` (templates).
 * Expects each plugin to export a default class or named *Plugin class.
 */
export function resolvePluginsDir(): string {
  if (process.env.PLUGINS_DIR) {
    return resolve(process.env.PLUGINS_DIR);
  }
  // monorepo: packages/core -> ../../plugins
  // docker: /app/plugins
  const candidates = [
    resolve(process.cwd(), "plugins"),
    resolve(process.cwd(), "../plugins"),
    resolve(process.cwd(), "../../plugins"),
    resolve("/app/plugins"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

export function listPluginDirs(pluginsDir: string): DiscoveredPlugin[] {
  if (!existsSync(pluginsDir)) return [];

  const entries = readdirSync(pluginsDir);
  const found: DiscoveredPlugin[] = [];

  for (const name of entries) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const dir = join(pluginsDir, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }

    let id = name;
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          name?: string;
          mcpPluginId?: string;
        };
        if (pkg.mcpPluginId) id = pkg.mcpPluginId;
        else if (pkg.name?.includes("plugin-")) {
          id = pkg.name.split("plugin-").pop() || name;
        }
      } catch {
        /* ignore */
      }
    }

    const entry =
      ["index.js", "index.mjs", "index.ts", "dist/index.js"]
        .map((f) => join(dir, f))
        .find((p) => existsSync(p)) ?? null;

    if (!entry) continue;
    found.push({ id, path: entry });
  }

  return found;
}

export async function buildDiscoveredFactories(
  pluginsDir?: string
): Promise<Record<string, McpPluginFactory>> {
  const dir = pluginsDir ?? resolvePluginsDir();
  const discovered = listPluginDirs(dir);
  const factories: Record<string, McpPluginFactory> = {};

  for (const item of discovered) {
    const fileUrl = pathToFileURL(item.path).href;
    factories[item.id] = async () => {
      const mod = (await import(fileUrl)) as Record<string, unknown>;
      const Candidate =
        (mod.default as new () => unknown) ||
        (Object.values(mod).find(
          (v) => typeof v === "function" && /Plugin$/.test((v as { name?: string }).name || "")
        ) as new () => unknown | undefined);

      if (!Candidate) {
        throw new Error(`Plugin ${item.id} has no exportable class at ${item.path}`);
      }
      return new Candidate() as Awaited<ReturnType<McpPluginFactory>>;
    };
  }

  return factories;
}
