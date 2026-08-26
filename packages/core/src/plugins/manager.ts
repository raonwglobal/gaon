import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { McpPlugin } from "./interface.js";
import { PLUGIN_FACTORIES } from "./index.js";

export class PluginManager {
  private plugins: McpPlugin[] = [];

  async loadPlugins(names: string[]): Promise<void> {
    for (const name of names) {
      const factory = PLUGIN_FACTORIES[name];
      if (!factory) {
        console.warn(`[PluginManager] Unknown plugin: ${name}`);
        continue;
      }

      const plugin = await factory();
      await plugin.initialize({});
      this.plugins.push(plugin);
      console.log(`[PluginManager] Loaded plugin: ${plugin.manifest.id}@${plugin.manifest.version}`);
    }
  }

  async registerToolsToServer(server: Server): Promise<void> {
    for (const plugin of this.plugins) {
      // Plugins register their own tools; prefixing can be done inside plugin or here via wrapper.
      await plugin.registerTools(server);
    }
  }

  async shutdownAll(): Promise<void> {
    await Promise.all(
      this.plugins.map(async (p) => {
        try {
          await p.shutdown();
        } catch (err) {
          console.error(`[PluginManager] Shutdown error for ${p.manifest.id}:`, err);
        }
      })
    );
    this.plugins = [];
  }

  async healthCheckAll(): Promise<
    Array<{ id: string; status: "ok" | "degraded" | "error"; message?: string }>
  > {
    const results = [];
    for (const plugin of this.plugins) {
      if (plugin.healthCheck) {
        const result = await plugin.healthCheck();
        results.push({ id: plugin.manifest.id, ...result });
      } else {
        results.push({ id: plugin.manifest.id, status: "ok" as const });
      }
    }
    return results;
  }

  get loaded(): string[] {
    return this.plugins.map((p) => p.manifest.id);
  }
}
