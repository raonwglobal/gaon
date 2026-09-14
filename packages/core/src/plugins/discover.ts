import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { McpPluginFactory } from "./interface.js";
import {
  PLUGIN_META_FILENAME,
  type ExternalPluginMeta,
} from "./external-meta.js";
import { ExternalMcpServerPlugin } from "./external-mcp-bridge.js";

export interface DiscoveredPlugin {
  id: string;
  path: string;
  kind: "class" | "stdio-meta";
  meta?: ExternalPluginMeta;
}

export function resolvePluginsDir(): string {
  if (process.env.PLUGINS_DIR) {
    return resolve(process.env.PLUGINS_DIR);
  }
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

function readMeta(dir: string, fallbackId: string): ExternalPluginMeta | null {
  const metaPath = join(dir, PLUGIN_META_FILENAME);
  if (!existsSync(metaPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(metaPath, "utf8")) as ExternalPluginMeta;
    if (!raw.id) raw.id = fallbackId;
    if (!raw.runtime) raw.runtime = "stdio";
    return raw;
  } catch {
    return null;
  }
}

/** Heuristic when meta is missing: Node dist or Python server.py */
function inferMeta(dir: string, id: string): ExternalPluginMeta | null {
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        main?: string;
        bin?: string | Record<string, string>;
      };
      const main =
        typeof pkg.main === "string"
          ? pkg.main
          : typeof pkg.bin === "string"
            ? pkg.bin
            : pkg.bin && typeof pkg.bin === "object"
              ? Object.values(pkg.bin)[0]
              : undefined;
      if (main && (main.endsWith(".js") || main.includes("dist"))) {
        const mainPath = join(dir, main);
        const distIndex = join(dir, "dist", "index.js");
        if (existsSync(mainPath) || existsSync(distIndex)) {
          const entry = existsSync(mainPath) ? main : "dist/index.js";
          return {
            id,
            runtime: "stdio",
            command: "node",
            args: [entry],
            description: `Inferred stdio MCP from package.json main=${entry}`,
          };
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (existsSync(join(dir, "server.py"))) {
    return {
      id,
      runtime: "stdio",
      command: process.env.PYTHON_BIN || "python3",
      args: ["server.py"],
      description: "Inferred Python MCP server.py",
    };
  }
  if (existsSync(join(dir, "dist", "index.js"))) {
    return {
      id,
      runtime: "stdio",
      command: "node",
      args: ["dist/index.js"],
      description: "Inferred node dist/index.js",
    };
  }
  return null;
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

    const meta = readMeta(dir, id) || inferMeta(dir, id);
    if (meta && meta.runtime === "stdio") {
      found.push({ id: meta.id || id, path: dir, kind: "stdio-meta", meta });
      continue;
    }

    const entry =
      ["index.js", "index.mjs", "dist/index.js"]
        .map((f) => join(dir, f))
        .find((p) => existsSync(p)) ?? null;

    if (entry) {
      found.push({ id, path: entry, kind: "class" });
      continue;
    }

    if (existsSync(join(dir, "index.ts"))) {
      found.push({ id, path: join(dir, "index.ts"), kind: "class" });
    }
  }

  return found;
}

export async function buildDiscoveredFactories(
  pluginsDir?: string,
  generation: number = Date.now()
): Promise<Record<string, McpPluginFactory>> {
  const dir = pluginsDir ?? resolvePluginsDir();
  const discovered = listPluginDirs(dir);
  const factories: Record<string, McpPluginFactory> = {};

  for (const item of discovered) {
    if (item.kind === "stdio-meta" && item.meta) {
      const meta = item.meta;
      const pluginDir = item.path;
      factories[item.id] = async () =>
        new ExternalMcpServerPlugin(meta, pluginDir);
      continue;
    }

    const fileUrl = pathToFileURL(item.path).href;
    const gen = generation;
    factories[item.id] = async () => {
      const mod = (await import(`${fileUrl}?v=${gen}`)) as Record<
        string,
        unknown
      >;
      const Candidate =
        (mod.default as new () => unknown) ||
        (Object.values(mod).find(
          (v) =>
            typeof v === "function" &&
            /Plugin$/.test((v as { name?: string }).name || "")
        ) as new () => unknown | undefined);

      if (!Candidate) {
        throw new Error(
          `Plugin ${item.id} has no exportable class at ${item.path}. ` +
            `If this is a full MCP server, add ${PLUGIN_META_FILENAME} with runtime=stdio.`
        );
      }
      return new Candidate() as Awaited<ReturnType<McpPluginFactory>>;
    };
  }

  return factories;
}
