/**
 * Install plugins from git or npm into PLUGINS_DIR.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const execFileAsync = promisify(execFile);

export function resolveInstallDir(): string {
  if (process.env.PLUGINS_DIR) return resolve(process.env.PLUGINS_DIR);
  return resolve(process.cwd(), "plugins");
}

export interface InstallRequest {
  id: string;
  source: {
    type: "git" | "npm";
    /** git URL or npm package name */
    ref: string;
    /** optional git branch/tag or npm version */
    version?: string;
  };
}

export interface InstallResult {
  ok: boolean;
  path?: string;
  detail?: string;
}

async function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    cwd,
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env },
  });
  return (stdout || stderr || "").toString();
}

export async function installPlugin(req: InstallRequest): Promise<InstallResult> {
  const root = resolveInstallDir();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });

  const target = join(root, req.id);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }

  try {
    if (req.source.type === "git") {
      const args = ["clone", "--depth", "1"];
      if (req.source.version) args.push("--branch", req.source.version);
      args.push(req.source.ref, target);
      await run("git", args);
    } else if (req.source.type === "npm") {
      mkdirSync(target, { recursive: true });
      const pkg = req.source.version
        ? `${req.source.ref}@${req.source.version}`
        : req.source.ref;
      // npm pack into temp then extract — use npm install in folder
      writeFileSync(
        join(target, "package.json"),
        JSON.stringify(
          {
            name: `@mcp-sse/plugin-${req.id}`,
            private: true,
            type: "module",
            mcpPluginId: req.id,
            dependencies: { [req.source.ref]: req.source.version || "latest" },
          },
          null,
          2
        )
      );
      await run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], target);
      // shim index that re-exports package main
      const depName = req.source.ref;
      writeFileSync(
        join(target, "index.js"),
        `export { default } from ${JSON.stringify(depName)};
export * from ${JSON.stringify(depName)};
`
      );
    } else {
      return { ok: false, detail: "Unsupported source type" };
    }

    // ensure mcpPluginId in package.json if present
    const pkgPath = join(target, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
        if (!pkg.mcpPluginId) {
          pkg.mcpPluginId = req.id;
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        }
      } catch {
        /* ignore */
      }
    }

    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
