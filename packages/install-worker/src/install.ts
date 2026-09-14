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
import { assertGitRefAllowed } from "./git-allowlist.js";
import { verifyPluginSignature } from "./signature.js";

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
  meta?: Record<string, unknown>;
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
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return (stdout || stderr || "").toString();
  } catch (err) {
    throw new Error(formatExecError(err, `${cmd} ${args.join(" ")}`));
  }
}

function assertWritable(dir: string): void {
  mkdirSync(dir, { recursive: true });
  accessSync(dir, constants.W_OK);
}

/**
 * After clone/npm: install deps, build if needed, write plugin.meta.json for Core stdio bridge.
 * Python plugins use a local .venv (PEP 668 forbids system pip).
 */
async function prepareExternalRuntime(
  id: string,
  target: string
): Promise<Record<string, unknown>> {
  const pkgPath = join(target, "package.json");
  const hasPkg = existsSync(pkgPath);
  const hasServerPy = existsSync(join(target, "server.py"));
  const reqPath = join(target, "requirements.txt");

  if (hasPkg) {
    try {
      await run("npm", ["install", "--no-audit", "--no-fund"], target);
    } catch (err) {
      console.warn("[install] npm install:", err);
    }
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        scripts?: Record<string, string>;
      };
      if (pkg.scripts?.build) {
        await run("npm", ["run", "build"], target);
      }
    } catch (err) {
      console.warn("[install] npm run build:", err);
    }
  }

  if (hasServerPy) {
    const venvDir = join(target, ".venv");
    const venvPython = join(venvDir, "bin", "python");
    const py = process.env.PYTHON_BIN || "python3";
    try {
      if (!existsSync(venvPython)) {
        await run(py, ["-m", "venv", venvDir]);
      }
      await run(venvPython, ["-m", "pip", "install", "-U", "pip"]);
      if (existsSync(reqPath)) {
        await run(venvPython, ["-m", "pip", "install", "-r", reqPath]);
      }
    } catch (err) {
      console.warn("[install] python venv:", err);
    }
    const command = existsSync(venvPython) ? venvPython : py;
    const meta = {
      id,
      runtime: "stdio",
      command,
      args: ["server.py"],
      description: "Python MCP server (stdio/venv)",
    };
    writeFileSync(join(target, "plugin.meta.json"), JSON.stringify(meta, null, 2));
    return meta;
  }

  if (hasPkg) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      main?: string;
      bin?: string | Record<string, string>;
    };
    let entry =
      typeof pkg.main === "string"
        ? pkg.main
        : typeof pkg.bin === "string"
          ? pkg.bin
          : pkg.bin && typeof pkg.bin === "object"
            ? Object.values(pkg.bin)[0]
            : undefined;
    if (!entry || !existsSync(join(target, entry))) {
      if (existsSync(join(target, "dist", "index.js"))) entry = "dist/index.js";
      else if (existsSync(join(target, "index.js"))) entry = "index.js";
    }
    if (entry && existsSync(join(target, entry))) {
      const meta = {
        id,
        runtime: "stdio",
        command: "node",
        args: [entry],
        description: `Node MCP server (stdio) entry=${entry}`,
      };
      writeFileSync(
        join(target, "plugin.meta.json"),
        JSON.stringify(meta, null, 2)
      );
      return meta;
    }
  }

  return { id, runtime: "inprocess" };
}

export async function installPlugin(
  req: InstallRequest
): Promise<InstallResult> {
  const id = req.id.trim();
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { ok: false, detail: "id must be alphanumeric with _ or -" };
  }

  const root = resolveInstallDir();
  try {
    assertWritable(root);
  } catch (err) {
    return {
      ok: false,
      detail: `PLUGINS_DIR not writable: ${root} (${err instanceof Error ? err.message : String(err)})`,
    };
  }

  const target = join(root, id);
  if (existsSync(target)) {
    try {
      rmSync(target, { recursive: true, force: true });
    } catch (err) {
      return {
        ok: false,
        detail: `Cannot clear existing plugin dir: ${err instanceof Error ? err.message : String(err)}`,
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
          detail: "git is not installed in install-worker image",
        };
      }

      const ref = req.source.ref.trim();
      if (!ref) return { ok: false, detail: "source.ref (git URL) is required" };
      try {
        assertGitRefAllowed(ref);
      } catch (err) {
        return {
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        };
      }

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

    const meta = await prepareExternalRuntime(id, target);

    let signatureOk: boolean | undefined;
    try {
      signatureOk = verifyPluginSignature(target);
    } catch (err) {
      if (process.env.PLUGIN_SIGNATURE_REQUIRED === "true") {
        try {
          rmSync(target, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
          signatureOk: false,
        };
      }
      signatureOk = false;
    }

    return { ok: true, path: target, signatureOk, meta };
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
