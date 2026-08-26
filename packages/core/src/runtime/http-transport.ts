import type {
  RuntimeCallRequest,
  RuntimeCallResult,
  RuntimeManifest,
} from "./types.js";
import { logger } from "../logger.js";

const DEFAULT_TIMEOUT = Number(process.env.PLUGIN_RPC_TIMEOUT_MS ?? 15_000);

export class HttpPluginTransport {
  constructor(
    public readonly endpoint: string,
    private timeoutMs = DEFAULT_TIMEOUT
  ) {}

  private url(path: string): string {
    return `${this.endpoint.replace(/\/$/, "")}${path}`;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(this.url("/health"), {
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 3000)),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async manifest(): Promise<RuntimeManifest> {
    const res = await fetch(this.url("/manifest"), {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`manifest failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as RuntimeManifest;
  }

  async callTool(req: RuntimeCallRequest): Promise<RuntimeCallResult> {
    const res = await fetch(this.url("/tools/call"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn("remote tool call failed", {
        endpoint: this.endpoint,
        name: req.name,
        status: res.status,
      });
      return {
        content: [{ type: "text", text: text || `HTTP ${res.status}` }],
        isError: true,
      };
    }
    return (await res.json()) as RuntimeCallResult;
  }
}
