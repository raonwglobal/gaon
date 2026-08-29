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
import {
  fetchVaultSecretsForUser,
  resolveUserIdForSession,
} from "./vault-client.js";

function extractCredential(req: IncomingMessage): string | undefined {
  const key = req.headers["x-api-key"];
  if (typeof key === "string" && key.trim()) return key.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  return undefined;
}

export async function initializeScopedSession(
  session: McpSession,
  transport: SSEServerTransport,
  req: IncomingMessage,
  subject?: string
): Promise<string[]> {
  const scope = parsePluginScopeHeader(req.headers["x-enabled-plugins"]);
  const headerSecrets = parseSessionSecretsHeader(
    req.headers["x-session-secrets"]
  );

  const userId = resolveUserIdForSession(
    req,
    subject,
    extractCredential(req)
  );
  const vaultSecrets = userId
    ? await fetchVaultSecretsForUser(userId)
    : {};

  // Header secrets override vault (explicit session wins)
  const secrets = { ...vaultSecrets, ...headerSecrets };

  const effectiveSubject = userId || subject;
  const sessionPlugins = resolveSessionPlugins(scope, effectiveSubject);

  logger.info("session plugins resolved", {
    sessionId: session.id,
    subject: effectiveSubject,
    userId,
    plugins: sessionPlugins,
    vaultSecretCount: Object.keys(vaultSecrets).length,
    headerSecretCount: Object.keys(headerSecrets).length,
    mode: getPluginRuntimeMode(),
  });

  await session.initialize(transport, {
    plugins: sessionPlugins,
    configs: runtimeState.pluginConfigs,
    subject: effectiveSubject,
    secrets,
  });

  return sessionPlugins;
}
