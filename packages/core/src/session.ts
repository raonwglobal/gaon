import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { PluginManager } from "./plugins/manager.js";
import { RemotePluginManager } from "./runtime/remote-plugin-manager.js";
import { getPluginRuntimeMode } from "./runtime/mode.js";
import {
  clearSecrets,
  createSessionSecrets,
  type SecretMap,
} from "./session-secrets.js";
import { logger } from "./logger.js";

export interface SessionInitOptions {
  plugins: string[];
  configs?: Record<string, Record<string, unknown>>;
  subject?: string;
  secrets?: Record<string, string>;
  explicitScope?: string[] | null;
}

export class McpSession {
  public readonly id: string;
  public readonly server: Server;
  public readonly createdAt: number;
  public subject?: string;

  private _transport: SSEServerTransport | null = null;
  private _isInitialized = false;
  private _isShuttingDown = false;
  private inprocessManager: PluginManager | null = null;
  private remoteManager: RemotePluginManager | null = null;
  private secrets: SecretMap = createSessionSecrets();
  private activePluginIds: string[] = [];
  private explicitScope: string[] | null = null;

  constructor(sessionId: string) {
    this.id = sessionId;
    this.createdAt = Date.now();
    this.server = new Server(
      { name: "mcp-sse-core", version: "0.8.0" },
      { capabilities: { tools: {} } }
    );
  }

  get transport(): SSEServerTransport | null {
    return this._transport;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get pluginIds(): string[] {
    return [...this.activePluginIds];
  }

  get scopeFilter(): string[] | null {
    return this.explicitScope ? [...this.explicitScope] : null;
  }

  async initialize(
    transport: SSEServerTransport,
    options: SessionInitOptions | string[],
    configsLegacy?: Record<string, Record<string, unknown>>
  ): Promise<void> {
    if (this._isInitialized) {
      throw new Error(`Session ${this.id} is already initialized`);
    }

    const opts: SessionInitOptions = Array.isArray(options)
      ? { plugins: options, configs: configsLegacy }
      : options;

    this._transport = transport;
    this.subject = opts.subject;
    this.secrets = createSessionSecrets(opts.secrets);
    this.activePluginIds = [...opts.plugins];
    this.explicitScope =
      opts.explicitScope === undefined ? null : opts.explicitScope;
    const mode = getPluginRuntimeMode();

    if (mode === "container") {
      this.remoteManager = new RemotePluginManager();
      await this.remoteManager.attachToServer(this.server);
    } else {
      this.inprocessManager = new PluginManager({
        sessionId: this.id,
        subject: this.subject,
        secrets: this.secrets,
      });
      await this.inprocessManager.loadPlugins(
        opts.plugins,
        opts.configs ?? {}
      );
      await this.inprocessManager.registerToolsToServer(this.server);
    }

    await this.server.connect(transport);
    this._isInitialized = true;
  }

  async reloadPlugins(
    pluginIds: string[],
    configs: Record<string, Record<string, unknown>> = {}
  ): Promise<{ tools: string[]; notified: boolean }> {
    if (!this._isInitialized || this._isShuttingDown) {
      return { tools: [], notified: false };
    }
    if (!this.inprocessManager) {
      return { tools: [], notified: false };
    }

    this.activePluginIds = [...pluginIds];
    const result = await this.inprocessManager.reload(pluginIds, configs);
    await this.inprocessManager.registerToolsToServer(this.server);

    const notified = await this.notifyToolsListChanged();
    logger.info("session tools reloaded", {
      sessionId: this.id,
      subject: this.subject,
      plugins: pluginIds,
      tools: result.tools,
      notified,
    });
    return { tools: result.tools, notified };
  }

  private async notifyToolsListChanged(): Promise<boolean> {
    try {
      const server = this.server as unknown as {
        notification?: (n: {
          method: string;
          params?: Record<string, unknown>;
        }) => Promise<void>;
        sendNotification?: (n: {
          method: string;
          params?: Record<string, unknown>;
        }) => Promise<void>;
      };
      if (typeof server.notification === "function") {
        await server.notification({
          method: "notifications/tools/list_changed",
        });
        return true;
      }
      if (typeof server.sendNotification === "function") {
        await server.sendNotification({
          method: "notifications/tools/list_changed",
        });
        return true;
      }
    } catch (err) {
      logger.warn("tools/list_changed notification failed", {
        sessionId: this.id,
        error: String(err),
      });
    }
    return false;
  }

  async shutdown(): Promise<void> {
    if (this._isShuttingDown) return;
    this._isShuttingDown = true;

    try {
      await this.inprocessManager?.shutdownAll();
      await this.remoteManager?.shutdown();
    } finally {
      clearSecrets(this.secrets);
      this._transport = null;
      this._isInitialized = false;
    }
  }
}
