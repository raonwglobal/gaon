# 📘 MCP SSE 서버 코어 구현 가이드 (Improved)

이 문서는 MCP over SSE (Server-Sent Events) 서버 기능을 독립적으로 구축, 재구축 또는 다른 프로젝트에 이식할 수 있도록 설계된 기술 명세서입니다.

> **버전**: 0.2.0 (2026-08-26)  
> **이전 버전 대비 주요 변경**: 타입 안정성 개선, 세션 타임아웃, 보안 인터페이스, transport 접근 제어 수정, 에러 처리 개선

## 1. 개요 (Overview)

본 모듈은 표준 MCP 프로토콜을 HTTP/SSE 전송 계층 위에서 동작하도록 구현한 서버 코어입니다. 기존의 stdio 방식과 달리, 네트워크 기반의 다중 클라이언트 연결, 세션 격리, 동적 플러그인 로딩을 지원합니다.

### 주요 특징

- **전송 계층**: HTTP POST (Client→Server) + SSE (Server→Client)
- **아키텍처**: Stateless HTTP + Stateful Session (연결마다 독립 `McpServer` 인스턴스)
- **확장성**: 플러그인 기반 도구 등록 (`McpPlugin` 인터페이스)
- **보안**: CORS, API Key 인증, Rate Limiting 지원
- **운영**: 세션 타임아웃, 메모리 모니터링, Graceful Shutdown

## 2. 디렉토리 구조 (Standalone)

```text
mcp-sse-core/
├── src/
│   ├── index.ts              # 서버 진입점
│   ├── server.ts             # HTTP 라우팅 및 SSE 스트림 관리
│   ├── session.ts            # 세션 관리 (격리된 McpServer)
│   ├── session-manager.ts    # 세션 Map + 타임아웃 정리
│   ├── config.ts             # 환경변수 및 설정 로딩
│   ├── plugins/
│   │   ├── interface.ts      # McpPlugin 인터페이스
│   │   ├── manager.ts        # 플러그인 생명주기 관리
│   │   └── index.ts          # 플러그인 팩토리 등록
│   └── security/
│       ├── auth.ts           # API Key 인증 미들웨어
│       ├── cors.ts           # CORS 정책
│       └── rate-limit.ts     # IP 기반 Rate Limiting
├── package.json
├── tsconfig.json
└── .env.example
```

## 3. 핵심 구현 상세

### 3.1. 전송 프로토콜 흐름

1. **클라이언트 → 서버**: `GET /sse`
   - 서버는 `Content-Type: text/event-stream` 응답을 열고 연결을 유지합니다.
   - 초기 이벤트 `{ event: "endpoint", data: "/message?sessionId=..." }` 를 발송합니다.
   - 초기화가 완료될 때까지 클라이언트는 `POST /message`를 보내지 않는 것을 권장합니다. (필요 시 `ready` 이벤트 추가 가능)

2. **클라이언트 → 서버**: `POST /message?sessionId=...`
   - MCP JSON-RPC 요청 (`initialize`, `tools/list`, `tools/call` 등) 전송.

3. **서버 → 클라이언트**: SSE 스트림
   - `{ event: "message", data: "<json-rpc-response>" }` 형태로 응답.

### 3.2. 세션 관리 (`src/session.ts`)

```typescript
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
      { name: "mcp-sse-core", version: "0.2.0" },
      { capabilities: { tools: {} } }
    );
    this.pluginManager = new PluginManager();
  }

  /** 외부에서 transport에 안전하게 접근하기 위한 getter */
  get transport(): SSEServerTransport | null {
    return this._transport;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(
    transport: SSEServerTransport,
    plugins: string[]
  ): Promise<void> {
    if (this._isInitialized) {
      throw new Error(`Session ${this.id} is already initialized`);
    }

    this._transport = transport;

    await this.pluginManager.loadPlugins(plugins);
    await this.pluginManager.registerToolsToServer(this.server);

    await this.server.connect(transport);
    this._isInitialized = true;
  }

  async shutdown(): Promise<void> {
    if (this._isShuttingDown) return;
    this._isShuttingDown = true;

    try {
      await this.pluginManager.shutdownAll();
      // SDK에 close 메서드가 있으면 호출
      // await this.server.close?.();
    } finally {
      this._transport = null;
      this._isInitialized = false;
    }
  }
}
```

### 3.3. 세션 매니저 (`src/session-manager.ts`)

```typescript
import { McpSession } from "./session.js";

export interface SessionManagerOptions {
  /** 유휴 세션 타임아웃 (ms). 기본 30분 */
  idleTimeoutMs?: number;
  /** 최대 동시 세션 수. 초과 시 새 연결 거부 */
  maxSessions?: number;
  /** 정리 주기 (ms). 기본 60초 */
  cleanupIntervalMs?: number;
}

export class SessionManager {
  private sessions = new Map<string, McpSession>();
  private lastActivity = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private readonly idleTimeoutMs: number;
  private readonly maxSessions: number;

  constructor(options: SessionManagerOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60 * 1000;
    this.maxSessions = options.maxSessions ?? 1000;

    const interval = options.cleanupIntervalMs ?? 60 * 1000;
    this.cleanupTimer = setInterval(() => this.cleanupIdleSessions(), interval);
  }

  canAcceptNewSession(): boolean {
    return this.sessions.size < this.maxSessions;
  }

  add(session: McpSession): void {
    this.sessions.set(session.id, session);
    this.touch(session.id);
  }

  get(sessionId: string): McpSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) this.touch(sessionId);
    return session;
  }

  async remove(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);
    this.lastActivity.delete(sessionId);
    await session.shutdown();
  }

  touch(sessionId: string): void {
    this.lastActivity.set(sessionId, Date.now());
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, last] of this.lastActivity) {
      if (now - last > this.idleTimeoutMs) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      await this.remove(id);
    }
  }

  async shutdownAll(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const ids = [...this.sessions.keys()];
    await Promise.all(ids.map((id) => this.remove(id)));
  }

  get size(): number {
    return this.sessions.size;
  }
}
```

### 3.4. HTTP 라우팅 및 SSE 핸들러 (`src/server.ts`)

```typescript
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";
import { randomUUID } from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpSession } from "./session.js";
import { SessionManager } from "./session-manager.js";
import { applyCors } from "./security/cors.js";
import { authenticate } from "./security/auth.js";
import { rateLimit } from "./security/rate-limit.js";
import type { ServerConfig } from "./config.js";

export function createMcpSseServer(config: ServerConfig) {
  const sessionManager = new SessionManager({
    idleTimeoutMs: config.sessionIdleTimeoutMs,
    maxSessions: config.maxSessions,
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = parse(req.url || "", true);

    // CORS preflight
    if (req.method === "OPTIONS") {
      applyCors(req, res, config);
      res.writeHead(204);
      res.end();
      return;
    }

    applyCors(req, res, config);

    // Rate Limiting
    if (!rateLimit(req, res, config)) {
      return; // 이미 429 응답됨
    }

    // Auth (선택)
    if (config.apiSecretToken && !authenticate(req, config)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // 1. SSE 연결
    if (req.method === "GET" && url.pathname === "/sse") {
      if (!sessionManager.canAcceptNewSession()) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too many sessions" }));
        return;
      }

      const sessionId = randomUUID();
      const transport = new SSEServerTransport("/message", res);
      const session = new McpSession(sessionId);

      sessionManager.add(session);

      try {
        await session.initialize(transport, config.enabledPlugins);

        res.on("close", () => {
          sessionManager.remove(sessionId).catch(console.error);
        });
      } catch (error) {
        console.error("Session init failed:", error);
        await sessionManager.remove(sessionId);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Initialization failed" }));
        }
      }
      return;
    }

    // 2. 메시지 수신
    if (req.method === "POST" && url.pathname === "/message") {
      const sessionId = url.query.sessionId as string | undefined;
      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "sessionId required" }));
        return;
      }

      const session = sessionManager.get(sessionId);
      if (!session || !session.isInitialized || !session.transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found or not ready" }));
        return;
      }

      try {
        await session.transport.handlePostMessage(req, res);
      } catch (error) {
        console.error("handlePostMessage error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal error" }));
        }
      }
      return;
    }

    // Health check
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        sessions: sessionManager.size,
        uptime: process.uptime(),
      }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(config.port, () => {
    console.log(`MCP SSE Server running on port ${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    await sessionManager.shutdownAll();
    server.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return { server, sessionManager };
}
```

### 3.5. 플러그인 시스템 (`src/plugins/`)

#### 인터페이스 (`interface.ts`)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export interface McpPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
}

export interface McpPlugin {
  readonly manifest: McpPluginManifest;
  initialize(config: Record<string, unknown>): Promise<void>;
  registerTools(server: Server): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck?(): Promise<{ status: "ok" | "degraded" | "error"; message?: string }>;
}

export type McpPluginFactory = () => Promise<McpPlugin>;
```

#### 매니저 요약 (`manager.ts`)

- `loadPlugins(names: string[])`: 환경변수/설정에 지정된 플러그인 인스턴스 생성
- `registerToolsToServer(server: Server)`: 각 플러그인의 `registerTools` 호출
- **중요**: 도구 이름에 `${plugin.manifest.id}_` 접두사를 자동 부여하여 충돌 방지
- `shutdownAll()`: 모든 플러그인 리소스 정리
- `healthCheckAll()`: 플러그인별 헬스 상태 수집

### 3.6. 보안 (`src/security/`)

#### CORS (`cors.ts`)

```typescript
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerConfig } from "../config.js";

export function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig
): void {
  const origin = req.headers.origin;
  const allowed = config.allowedOrigins;

  if (allowed.includes("*") || (origin && allowed.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}
```

#### Auth (`auth.ts`)

```typescript
import type { IncomingMessage } from "node:http";
import type { ServerConfig } from "../config.js";

export function authenticate(req: IncomingMessage, config: ServerConfig): boolean {
  if (!config.apiSecretToken) return true;

  const header =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");

  return header === config.apiSecretToken;
}
```

#### Rate Limit (`rate-limit.ts`)

```typescript
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerConfig } from "../config.js";

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig
): boolean {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = config.rateLimitPerMin;

  let entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    hits.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    res.writeHead(429, {
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
    });
    res.end(JSON.stringify({ error: "Too many requests" }));
    return false;
  }

  return true;
}
```

## 4. 의존성 및 설정

### package.json

```json
{
  "name": "mcp-sse-core",
  "version": "0.2.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 환경 변수 (`.env.example`)

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `PORT` | 서버 리스닝 포트 | `3000` |
| `ENABLED_PLUGINS` | 활성화할 플러그인 (쉼표 구분) | `tossinvest` |
| `API_SECRET_TOKEN` | 클라이언트 인증 토큰 (비우면 인증 비활성화) | - |
| `ALLOWED_ORIGINS` | CORS 허용 도메인 (쉼표 구분) | `*` |
| `RATE_LIMIT_PER_MIN` | IP당 분당 요청 제한 | `60` |
| `SESSION_IDLE_TIMEOUT_MS` | 유휴 세션 타임아웃 (ms) | `1800000` |
| `MAX_SESSIONS` | 최대 동시 세션 수 | `1000` |

## 5. 확장 가이드: 새 플러그인 추가

1. `src/plugins/weather-plugin.ts` 생성

```typescript
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { McpPlugin, McpPluginManifest } from "./interface.js";

export class WeatherPlugin implements McpPlugin {
  readonly manifest: McpPluginManifest = {
    id: "weather",
    name: "Weather Plugin",
    version: "1.0.0",
    description: "날씨 정보 조회",
  };

  async initialize(config: Record<string, unknown>): Promise<void> {
    // API 키 등 로드
  }

  async registerTools(server: Server): Promise<void> {
    // server.setRequestHandler(...) 구현
    // 도구 이름은 manager가 접두사를 붙임
  }

  async shutdown(): Promise<void> {}
}
```

2. `src/plugins/index.ts`에 팩토리 등록

```typescript
import type { McpPluginFactory } from "./interface.js";
import { WeatherPlugin } from "./weather-plugin.js";

export const PLUGIN_FACTORIES: Record<string, McpPluginFactory> = {
  weather: async () => new WeatherPlugin(),
};
```

3. `.env`의 `ENABLED_PLUGINS`에 `weather` 추가

## 6. 배포 및 운영

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Nginx (SSE 최적화)

```nginx
location /sse {
    proxy_pass http://localhost:3000/sse;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    proxy_read_timeout 3600s;
    add_header X-Accel-Buffering no;
}

location /message {
    proxy_pass http://localhost:3000/message;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /health {
    proxy_pass http://localhost:3000/health;
}
```

## 7. 주의사항 (Caveats)

- **메모리**: 세션마다 `McpServer` 인스턴스가 생성됩니다. `MAX_SESSIONS`와 `SESSION_IDLE_TIMEOUT_MS`로 제어하세요.
- **상태 공유 금지**: 세션 간 변수/캐시 공유 금지. 공유가 필요하면 Redis 등 외부 저장소를 사용하세요.
- **초기화 지연**: 플러그인 로드에 시간이 걸릴 수 있습니다. 클라이언트는 `endpoint` 이벤트 수신 후에 메시지를 보내는 것이 안전합니다.
- **스케일 아웃**: 현재 구현은 단일 프로세스 기준입니다. 여러 인스턴스로 확장 시 세션 애피니티(예: Redis) 검토가 필요합니다.

## 8. 관련 문서

- 대시보드 및 플러그인 플랫폼 확장: [`architecture.md`](./architecture.md)
- 로드맵: [`roadmap.md`](./roadmap.md)
