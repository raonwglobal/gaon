import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { PluginManager } from "./plugins/manager.js";

export class McpSession {
  public readonly id: string;
  public readonly server: Server;
  public readonly pluginManager: PluginManager;
  public readonly createdAt: number;

  private _transport: SSEServerTransport | null = null;
  private _isInitialized = false;
  private _isShuttingDown = false;

  constructor(sessionId: string) {
    this.id = sessionId;
    this.createdAt = Date.now();
    this.server = new Server(
      { name: "mcp-sse-core", version: "0.2.1" },
      { capabilities: { tools: {} } }
    );
    this.pluginManager = new PluginManager();
  }

  get transport(): SSEServerTransport | null {
    return this._transport;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(
    transport: SSEServerTransport,
    plugins: string[],
    configs: Record<string, Record<string, unknown>> = {}
  ): Promise<void> {
    if (this._isInitialized) {
      throw new Error(`Session ${this.id} is already initialized`);
    }

    this._transport = transport;
    await this.pluginManager.loadPlugins(plugins, configs);
    await this.pluginManager.registerToolsToServer(this.server);
    await this.server.connect(transport);
    this._isInitialized = true;
  }

  async shutdown(): Promise<void> {
    if (this._isShuttingDown) return;
    this._isShuttingDown = true;

    try {
      await this.pluginManager.shutdownAll();
    } finally {
      this._transport = null;
      this._isInitialized = false;
    }
  }
}
