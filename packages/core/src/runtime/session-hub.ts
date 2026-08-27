import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { logger } from "../logger.js";

/**
 * Tracks active MCP servers so catalog changes can fan-out
 * notifications/tools/list_changed without restarting sessions.
 */
class SessionHub {
  private servers = new Set<Server>();

  register(server: Server): void {
    this.servers.add(server);
  }

  unregister(server: Server): void {
    this.servers.delete(server);
  }

  get size(): number {
    return this.servers.size;
  }

  async notifyToolsListChanged(): Promise<void> {
    const payload = { method: "notifications/tools/list_changed" as const };
    const tasks: Promise<void>[] = [];

    for (const server of this.servers) {
      tasks.push(
        (async () => {
          try {
            // SDK Server exposes notification via connection; try common APIs
            const s = server as Server & {
              notification?: (n: { method: string }) => Promise<void>;
              sendToolListChanged?: () => Promise<void>;
            };
            if (typeof s.sendToolListChanged === "function") {
              await s.sendToolListChanged();
            } else if (typeof s.notification === "function") {
              await s.notification(payload);
            } else {
              // Fallback: protocol-level request handler path
              const anyServer = server as unknown as {
                _transport?: { send?: (msg: unknown) => Promise<void> };
                transport?: { send?: (msg: unknown) => Promise<void> };
              };
              const t = anyServer._transport || anyServer.transport;
              if (t?.send) {
                await t.send({
                  jsonrpc: "2.0",
                  method: "notifications/tools/list_changed",
                });
              }
            }
          } catch (err) {
            logger.warn("list_changed notify failed", { error: String(err) });
          }
        })()
      );
    }

    await Promise.all(tasks);
    logger.info("tools/list_changed fanout", { sessions: this.servers.size });
  }
}

export const sessionHub = new SessionHub();
