import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ToolCallResult } from "./interface.js";
import { logger } from "../logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, "sandbox-worker.js");

export interface SandboxOptions {
  pluginPath: string;
  config?: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * Runs plugin tool calls inside a Worker thread (process isolation lite).
 * Enable with SANDBOX_PLUGINS=true.
 */
export class PluginSandbox {
  private worker: Worker | null = null;
  private ready = false;
  private seq = 0;
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();

  constructor(private opts: SandboxOptions) {}

  async start(): Promise<void> {
    if (this.worker) return;
    this.worker = new Worker(WORKER_PATH, {
      workerData: {
        pluginPath: this.opts.pluginPath,
        config: this.opts.config ?? {},
      },
    });

    this.worker.on("message", (msg: {
      type: string;
      id?: string;
      result?: unknown;
      error?: string;
    }) => {
      if (msg.type === "ready") {
        this.ready = true;
        return;
      }
      if (!msg.id) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      if (msg.type === "error") p.reject(new Error(msg.error || "sandbox error"));
      else p.resolve(msg.result);
    });

    this.worker.on("error", (err) => {
      logger.error("sandbox worker error", { error: String(err) });
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(err);
      }
      this.pending.clear();
    });

    // wait briefly for ready
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => resolve(), 2000);
      const check = setInterval(() => {
        if (this.ready) {
          clearInterval(check);
          clearTimeout(t);
          resolve();
        }
      }, 50);
      this.worker?.once("error", (e) => {
        clearInterval(check);
        clearTimeout(t);
        reject(e);
      });
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    if (!this.worker) await this.start();
    const id = String(++this.seq);
    const timeout = this.opts.timeoutMs ?? 15_000;

    return new Promise<ToolCallResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Sandbox tool timeout: ${name}`));
      }, timeout);

      this.pending.set(id, {
        resolve: (v) => resolve(v as ToolCallResult),
        reject,
        timer,
      });

      this.worker!.postMessage({
        type: "call",
        id,
        name,
        arguments: args,
      });
    });
  }

  async shutdown(): Promise<void> {
    if (!this.worker) return;
    try {
      this.worker.postMessage({ type: "shutdown" });
    } catch {
      /* ignore */
    }
    await this.worker.terminate();
    this.worker = null;
    this.ready = false;
  }
}

export function sandboxEnabled(): boolean {
  return process.env.SANDBOX_PLUGINS === "true" || process.env.SANDBOX_PLUGINS === "1";
}
