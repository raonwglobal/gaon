import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  clearManifestCache,
  getCachedManifest,
  runtimeCatalog,
  setCachedManifest,
} from "./catalog.js";
import { HttpPluginTransport } from "./http-transport.js";
import { metrics } from "../metrics.js";
import { logger } from "../logger.js";
import type { RuntimeToolDefinition } from "./types.js";
import { sessionHub } from "./session-hub.js";

export class RemotePluginManager {
  private unsub: (() => void) | null = null;
  private server: Server | null = null;

  async attachToServer(server: Server): Promise<void> {
    this.server = server;
    sessionHub.register(server);

    const buildTools = async (): Promise<
      Array<RuntimeToolDefinition & { qualifiedName: string; pluginId: string }>
    > => {
      const epoch = runtimeCatalog.getEpoch();
      const out: Array<
        RuntimeToolDefinition & { qualifiedName: string; pluginId: string }
      > = [];

      for (const rt of runtimeCatalog.readyPlugins()) {
        try {
          let manifest = getCachedManifest(rt.id, epoch);
          if (!manifest) {
            const transport = new HttpPluginTransport(rt.endpoint);
            manifest = await transport.manifest();
            setCachedManifest(rt.id, epoch, manifest);
          }
          for (const tool of manifest.tools) {
            const qualifiedName = tool.name.startsWith(`${rt.id}_`)
              ? tool.name
              : `${rt.id}_${tool.name}`;
            out.push({
              ...tool,
              name: tool.name,
              qualifiedName,
              pluginId: rt.id,
            });
          }
        } catch (err) {
          logger.warn("failed to load manifest", {
            id: rt.id,
            error: String(err),
          });
        }
      }
      return out;
    };

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await buildTools();
      return {
        tools: tools.map((t) => ({
          name: t.qualifiedName,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    });

    server.setRequestHandler(
      CallToolRequestSchema,
      (async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
        const qualified = request.params.name;
        const args = (request.params.arguments ?? {}) as Record<string, unknown>;

        const ready = runtimeCatalog.readyPlugins();
        let pluginId: string | null = null;
        let localName = qualified;

        for (const rt of ready) {
          const prefix = `${rt.id}_`;
          if (qualified.startsWith(prefix)) {
            pluginId = rt.id;
            localName = qualified.slice(prefix.length);
            break;
          }
          if (qualified === rt.id) {
            pluginId = rt.id;
            break;
          }
        }

        if (!pluginId) {
          metrics.recordToolCall(qualified, true);
          return {
            content: [{ type: "text" as const, text: `Unknown tool: ${qualified}` }],
            isError: true,
          };
        }

        const rt = runtimeCatalog.get(pluginId);
        if (!rt || rt.status !== "ready") {
          metrics.recordToolCall(qualified, true);
          return {
            content: [{ type: "text" as const, text: `Plugin ${pluginId} is not ready` }],
            isError: true,
          };
        }

        try {
          const transport = new HttpPluginTransport(rt.endpoint);
          const result = await transport.callTool({
            name: localName,
            arguments: args,
          });
          metrics.recordToolCall(qualified, Boolean(result.isError));
          return result;
        } catch (err) {
          metrics.recordToolCall(qualified, true);
          return {
            content: [
              {
                type: "text" as const,
                text: err instanceof Error ? err.message : String(err),
              },
            ],
            isError: true,
          };
        }
      }) as never
    );

    this.unsub = runtimeCatalog.onChange(() => {
      clearManifestCache();
      logger.debug("catalog changed — manifest cache cleared");
      void sessionHub.notifyToolsListChanged();
    });
  }

  async shutdown(): Promise<void> {
    this.unsub?.();
    this.unsub = null;
    if (this.server) {
      sessionHub.unregister(this.server);
      this.server = null;
    }
  }
}
