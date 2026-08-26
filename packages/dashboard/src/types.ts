export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  config: Record<string, unknown>;
  source: { type: string; path?: string; [key: string]: unknown };
  createdAt: number;
  updatedAt: number;
}

export interface SessionInfo {
  id: string;
  createdAt: number;
  lastActivity: number;
}

export interface PlatformConfig {
  allowedOrigins: string[];
  rateLimitPerMin: number;
  apiSecretToken?: string;
  maxSessions: number;
}

export interface MetricsPayload {
  core?: {
    status?: string;
    sessions?: number;
    uptime?: number;
    plugins?: string[];
  };
  plugins?: {
    total?: number;
    enabled?: number;
  };
  uptime?: number;
}

export type Tab = "plugins" | "sessions" | "metrics" | "settings";
