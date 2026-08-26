import { describe, it, expect, beforeAll } from "vitest";
import { PluginManager } from "./manager.js";
import { ensurePluginDiscovery, PLUGIN_FACTORIES } from "./index.js";
import type { McpPlugin, PluginToolDefinition } from "./interface.js";

class FakePlugin implements McpPlugin {
  readonly manifest = {
    id: "fake",
    name: "Fake",
    version: "1.0.0",
  };
  async initialize() {}
  async listTools(): Promise<PluginToolDefinition[]> {
    return [
      {
        name: "ping",
        description: "ping",
        inputSchema: { type: "object", properties: {} },
      },
    ];
  }
  async callTool() {
    return { content: [{ type: "text" as const, text: "pong" }] };
  }
  async shutdown() {}
}

describe("PluginManager tool prefix", () => {
  beforeAll(async () => {
    await ensurePluginDiscovery();
    PLUGIN_FACTORIES.fake = async () => new FakePlugin();
  });

  it("qualifies tool names with plugin id", async () => {
    const pm = new PluginManager();
    await pm.loadPlugins(["fake"]);

    // Minimal server stub
    const handlers = new Map<string, Function>();
    const server = {
      setRequestHandler(schema: { shape?: { method?: { value?: string } } } | string, fn: Function) {
        const method =
          typeof schema === "string"
            ? schema
            : (schema as { parse?: unknown })
            ? "tools/list"
            : "unknown";
        handlers.set(String(method), fn);
      },
    } as any;

    // Direct check via internal map after registerToolsToServer
    await pm.registerToolsToServer(server);
    const names = pm.getToolNames();
    expect(names).toContain("fake_ping");
  });
});
