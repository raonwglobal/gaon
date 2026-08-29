/**
 * Install plugins from git or npm into PLUGINS_DIR.
 * Prefer install-worker when INSTALL_WORKER_URL is set.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { installViaWorker } from "./install-worker-client.js";

const execFileAsync = promisify(execFile);

export function resolveInstallDir(): string {
  if (process.env.PLUGINS_DIR) return resolve(process.env.PLUGINS_DIR);
  return resolve(process.cwd(), "plugins");
}

export interface InstallRequest {
  id: string;
  source: {
    type: "git" | "npm";
    ref: string;
    version?: string;
  };
}

export interface InstallResult {
  ok: boolean;
  path?: string;
  detail?: string;
  signatureOk?: boolean;
}

function formatExecError(err: unknown, cmd: string): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    message?: string;
    code?: string | number;
    stderr?: string | Buffer;
    stdout?: string | Buffer;
  };
  const stderr = e.stderr ? String(e.stderr).trim() : "";
  const stdout = e.stdout ? String(e.stdout).trim() : "";
  const parts = [
    e.message || `${cmd} failed`,
    stderr && `stderr: ${stderr}`,
    stdout && `stdout: ${stdout}`,
    e.code != null && `code: ${e.code}`,
  ].filter(Boolean);
  return parts.join(" | ");
}

async function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    });
    return (stdout || stderr || "").toString();
  } catch (err) {
    throw new Error(formatExecError(err, `${cmd} ${args.join(" ")}`));
  }
}

function assertWritable(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
  } catch (err) {
    throw new Error(
      `PLUGINS_DIR is not writable: ${dir} (${err instanceof Error ? err.message : String(err)}). ` +
        `Mount ./plugins as read-write on control-plane (not :ro).`
    );
  }
}

export async function installPlugin(
  req: InstallRequest
): Promise<InstallResult> {
  const remote = await installViaWorker(req);
  if (remote) return remote;

  const id = req.id.trim();
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return {
      ok: false,
      detail: "id must be alphanumeric, hyphen, or underscore",
    };
  }

  const root = resolveInstallDir();
  try {
    assertWritable(root);
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const target = join(root, id);
  if (existsSync(target)) {
    try {
      rmSync(target, { recursive: true, force: true });
    } catch (err) {
      return {
        ok: false,
        detail: `Cannot remove existing ${target}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    if (req.source.type === "git") {
      try {
        await run("git", ["--version"]);
      } catch {
        return {
          ok: false,
          detail:
            "git is not installed. Set INSTALL_WORKER_URL or rebuild control-plane with git.",
        };
      }

      const ref = req.source.ref.trim();
      if (!ref) return { ok: false, detail: "source.ref (git URL) is required" };

      const args = ["clone", "--depth", "1"];
      if (req.source.version) {
        args.push("--branch", req.source.version.trim());
      }
      args.push(ref, target);
      await run("git", args);
    } else if (req.source.type === "npm") {
      mkdirSync(target, { recursive: true });
      const depName = req.source.ref.trim();
      if (!depName)
        return { ok: false, detail: "source.ref (npm package) is required" };

      writeFileSync(
        join(target, "package.json"),
        JSON.stringify(
          {
            name: `@mcp-sse/plugin-${id}`,
            private: true,
            type: "module",
            mcpPluginId: id,
            dependencies: { [depName]: req.source.version || "latest" },
          },
          null,
          2
        )
      );
      await run(
        "npm",
        ["install", "--omit=dev", "--no-audit", "--no-fund"],
        target
      );
      writeFileSync(
        join(target, "index.js"),
        `export { default } from ${JSON.stringify(depName)};\n` +
          `export * from ${JSON.stringify(depName)};\n`
      );
    } else {
      return { ok: false, detail: "Unsupported source type (use git or npm)" };
    }

    const pkgPath = join(target, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<
          string,
          unknown
        >;
        if (!pkg.mcpPluginId) {
          pkg.mcpPluginId = id;
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        }
      } catch {
        /* ignore */
      }
    }

    return { ok: true, path: target };
  } catch (err) {
    try {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
