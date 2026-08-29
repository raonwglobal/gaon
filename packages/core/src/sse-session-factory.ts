import type { IncomingMessage } from "node:http";
import type { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpSession } from "./session.js";
import { runtimeState, resolveSessionPlugins } from "./runtime-state.js";
import {
  parsePluginScopeHeader,
  parseSessionSecretsHeader,
} from "./session-secrets.js";
import { logger } from "./logger.js";
import { getPluginRuntimeMode } from "./runtime/mode.js";

export async function initializeScopedSession(
  session: McpSession,
  transport: SSEServerTransport,
  req: IncomingMessage,
  subject?: string
): Promise<string[]> {
  const scope = parsePluginScopeHeader(req.headers["x-enabled-plugins"]);
  const secrets = parseSessionSecretsHeader(req.headers["x-session-secrets"]);
  const sessionPlugins = resolveSessionPlugins(scope, subject);

  logger.info("session plugins resolved", {
    sessionId: session.id,
    subject,
    plugins: sessionPlugins,
    mode: getPluginRuntimeMode(),
  });

  await session.initialize(transport, {
    plugins: sessionPlugins,
    configs: runtimeState.pluginConfigs,
    subject,
    secrets,
  });

  return sessionPlugins;
}
