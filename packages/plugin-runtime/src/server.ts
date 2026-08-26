/**
 * Generic Tool Runtime HTTP server.
 * Load a plugin module via PLUGIN_MODULE path or use built-in echo.
 *
 * Env:
 *   PORT=8080
 *   PLUGIN_MODULE=./path/to/plugin.js  (default export class)
 *   PLUGIN_ID=echo
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface PluginLike {
  manifest: {
    id: string;
    name: string;
    version: string;
    description?: string;
  };
  initialize(config: Record<string, unknown>): Promise<void>;
  listTools(): Promise<ToolDef[]>;
  callTool(ctx: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;
  shutdown(): Promise<void>;
}

class BuiltinEchoPlugin implements PluginLike {
  manifest = {
    id: process.env.PLUGIN_ID || "echo",
    name: "Echo Runtime",
    version: "1.0.0",
    description: "Built-in echo for container runtime demos",
  };
  async initialize() {}
  async listTools(): Promise<ToolDef[]> {
    return [
      {
        name: "echo",
        description: "Echo message",
        inputSchema: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
        },
      },
    ];
  }
  async callTool(ctx: { name: string; arguments: Record<string, unknown> }) {
    if (ctx.name !== "echo") {
      return {
        content: [{ type: "text" as const, text: `Unknown: ${ctx.name}` }],
        isError: true,
      };
    }
    const message = String(ctx.arguments.message ?? "");
    return { content: [{ type: "text" as const, text: message }] };
  }
  async shutdown() {}
}

async function loadPlugin(): Promise<PluginLike> {
  const modPath = process.env.PLUGIN_MODULE;
  if (!modPath) return new BuiltinEchoPlugin();

  const abs = resolve(modPath);
  const mod = (await import(pathToFileURL(abs).href)) as Record<string, unknown>;
  const Candidate =
    (mod.default as new () => PluginLike) ||
    (Object.values(mod).find(
      (v) => typeof v === "function" && /Plugin$/.test((v as { name?: string }).name || "")
    ) as new () => PluginLike);

  if (!Candidate) throw new Error(`No plugin export in ${abs}`);
  const plugin = new Candidate();
  await plugin.initialize({});
  return plugin;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const plugin = await loadPlugin();
  const port = Number(process.env.PORT ?? 8080);

  const server = createServer(async (req, res: ServerResponse) => {
    const url = req.url || "/";

    if (req.method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", id: plugin.manifest.id }));
      return;
    }

    if (req.method === "GET" && url === "/manifest") {
      const tools = await plugin.listTools();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: plugin.manifest.id,
          name: plugin.manifest.name,
          version: plugin.manifest.version,
          description: plugin.manifest.description,
          tools,
        })
      );
      return;
    }

    if (req.method === "POST" && url === "/tools/call") {
      try {
        const body = JSON.parse(await readBody(req)) as {
          name: string;
          arguments?: Record<string, unknown>;
        };
        const result = await plugin.callTool({
          name: body.name,
          arguments: body.arguments ?? {},
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: err instanceof Error ? err.message : String(err),
              },
            ],
            isError: true,
          })
        );
      }
      return;
    }

    if (req.method === "POST" && url === "/shutdown") {
      await plugin.shutdown();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      setTimeout(() => process.exit(0), 100);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    console.log(
      JSON.stringify({
        msg: "plugin-runtime listening",
        port,
        id: plugin.manifest.id,
        version: plugin.manifest.version,
      })
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
