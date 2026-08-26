export interface ServerConfig {
  port: number;
  enabledPlugins: string[];
  apiSecretToken?: string;
  allowedOrigins: string[];
  rateLimitPerMin: number;
  sessionIdleTimeoutMs: number;
  maxSessions: number;
  /** Shared secret for Control Plane -> Core admin calls */
  internalToken?: string;
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  if (!value || value.trim() === "") return fallback;
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    enabledPlugins: parseList(process.env.ENABLED_PLUGINS, ["weather", "echo"]),
    apiSecretToken: process.env.API_SECRET_TOKEN || undefined,
    allowedOrigins: parseList(process.env.ALLOWED_ORIGINS, ["*"]),
    rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN ?? 60),
    sessionIdleTimeoutMs: Number(process.env.SESSION_IDLE_TIMEOUT_MS ?? 1_800_000),
    maxSessions: Number(process.env.MAX_SESSIONS ?? 1000),
    internalToken: process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || undefined,
  };
}
