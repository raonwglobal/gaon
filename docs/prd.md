# 📘 MCP SSE 서버 코어 구현 가이드

이 문서는 MCP over SSE (Server-Sent Events) 서버 기능을 독립적으로 구축, 재구축 또는 다른 프로젝트에 이식할 수 있도록 설계된 기술 명세서입니다.

## 1. 개요 (Overview)

본 모듈은 표준 MCP 프로토콜을 HTTP/SSE 전송 계층 위에서 동작하도록 구현한 서버 코어입니다. 기존의 stdio 방식과 달리, 네트워크 기반의 다중 클라이언트 연결, 세션 격리, 동적 플러그인 로딩을 지원합니다.

### 주요 특징

- **전송 계층**: HTTP POST (Client→Server) + SSE (Server→Client)
- **아키텍처**: 요청당 독립 세션 생성 (Stateless HTTP + Stateful Session)
- **확장성**: 플러그인 기반 도구 등록 (McpPlugin 인터페이스)
- **보안**: CORS, API Key 인증, Rate Limiting 내장

## 2. 디렉토리 구조 (Standalone)

이 모듈을 별도 프로젝트로 구성할 때 필요한 최소 파일 구조입니다.

```text
mcp-sse-core/
├── src/
│   ├── index.ts          # 서버 진입점 (HTTP 서버 시작)
│   ├── server.ts         # HTTP 라우팅 및 SSE 스트림 관리
│   ├── session.ts        # 세션 관리 (격리된 McpServer 인스턴스)
│   ├── plugins/
│   │   ├── interface.ts  # McpPlugin 인터페이스 정의
│   │   ├── manager.ts    # 플러그인 생명주기 관리자
│   │   └── index.ts      # 플러그인 팩토리 등록
│   └── security/
│       ├── auth.ts       # 인증 미들웨어
│       └── cors.ts       # CORS 정책
├── package.json
└── tsconfig.json
```

## 3. 핵심 구현 상세

### 3.1. 전송 프로토콜 흐름

MCP over SSE는 다음과 같은 핸드셰이크 과정을 거칩니다.

1. **클라이언트 → 서버**: `GET /sse`
   - 서버는 `Content-Type: text/event-stream` 응답을 열고 연결을 유지합니다.
   - 서버는 초기 이벤트 `{ event: "endpoint", data: "/message?sessionId=..." }` 를 발송합니다.

2. **클라이언트 → 서버**: `POST /message?sessionId=...`
   - 클라이언트는 실제 MCP JSON-RPC 요청 (`initialize`, `tools/list` 등)을 이 엔드포인트로 전송합니다.

3. **서버 → 클라이언트**: SSE 스트림 통해 응답
   - 서버는 처리 결과를 `{ event: "message", data: "..." }` 형태로 스트림합니다.

### 3.2. 세션 관리 (`src/session.ts`)

다중 클라이언트 지원을 위해 각 연결마다 독립된 `McpServer` 인스턴스를 생성합니다.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { PluginManager } from "./plugins/manager.js";

export class McpSession {
  public readonly id: string;
  public readonly server: Server;
  public readonly pluginManager: PluginManager;
  private transport?: SSEServerTransport;
  private isInitialized = false;

  constructor(sessionId: string) {
    this.id = sessionId;
    // 각 세션마다 새로운 Server 인스턴스 생성 (격리 핵심)
    this.server = new Server(
      { name: "mcp-sse-core", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.pluginManager = new PluginManager();
  }

  async initialize(transport: SSEServerTransport, plugins: string[]): Promise<void> {
    this.transport = transport;

    // 플러그인 로드 및 도구 등록
    await this.pluginManager.loadPlugins(plugins);
    await this.pluginManager.registerToolsToServer(this.server);

    this.isInitialized = true;

    // 서버 실행 (transport 연결)
    await this.server.connect(transport);
  }

  async shutdown(): Promise<void> {
    await this.pluginManager.shutdownAll();
    // 서버 연결 종료 로직
  }
}
```

### 3.3. HTTP 라우팅 및 SSE 핸들러 (`src/server.ts`)

Node.js `http` 모듈을 사용하여 수동으로 라우팅을 처리합니다. (Express 등 프레임워크 없이도 동작 가능하도록 설계 권장)

```typescript
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";
import { randomUUID } from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpSession } from "./session.js";

const sessions = new Map<string, McpSession>();

export function createMcpSseServer(port: number, config: any) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = parse(req.url || "", true);

    // CORS 처리 생략됨 (security/cors.ts 참조)
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. SSE 연결 요청 (/sse)
    if (req.method === "GET" && url.pathname === "/sse") {
      const sessionId = randomUUID();
      const transport = new SSEServerTransport("/message", res);
      const session = new McpSession(sessionId);

      sessions.set(sessionId, session);

      // 세션 초기화 (비동기 대기 필요)
      try {
        await session.initialize(transport, config.enabledPlugins);

        // 연결 종료 시 세션 정리
        res.on("close", () => {
          session.shutdown().finally(() => sessions.delete(sessionId));
        });
      } catch (error) {
        console.error("Session init failed:", error);
        res.writeHead(500).end("Initialization failed");
        sessions.delete(sessionId);
      }
      return;
    }

    // 2. 메시지 수신 요청 (/message)
    if (req.method === "POST" && url.pathname === "/message") {
      const sessionId = url.query.sessionId as string;
      const session = sessions.get(sessionId);

      if (!session) {
        res.writeHead(404).end("Session not found");
        return;
      }

      // SSETransport 에게 요청 처리 위임
      await session.transport!.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404).end("Not found");
  });

  server.listen(port, () => {
    console.log(`MCP SSE Server running on port ${port}`);
  });
}
```

### 3.4. 플러그인 시스템 (`src/plugins/`)

플러그인은 서버 코어와 분리되어 동적으로 로드됩니다.

#### 인터페이스 (`interface.ts`)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export interface McpPlugin {
  readonly name: string;
  initialize(config: Record<string, unknown>): Promise<void>;
  registerTools(server: Server): Promise<void>;
  shutdown(): Promise<void>;
}

export type McpPluginFactory = () => Promise<McpPlugin>;
```

#### 매니저 (`manager.ts`)

- `loadPlugins(names: string[])`: 환경변수에 지정된 플러그인 인스턴스 생성
- `registerToolsToServer(server: Server)`: 각 플러그인의 `registerTools` 호출
- **중요**: 도구 이름에 `pluginName_` 접두사를 자동으로 부여하여 충돌 방지
- `shutdownAll()`: 서버 종료 시 모든 플러그인의 리소스 정리

## 4. 의존성 및 설정

### package.json 필수 의존성

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### 환경 변수 (`.env`)

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `PORT` | 서버 리스닝 포트 | `3000` |
| `ENABLED_PLUGINS` | 활성화할 플러그인 목록 (쉼표 구분) | `tossinvest` |
| `API_SECRET_TOKEN` | 클라이언트 인증 토큰 (선택) | - |
| `ALLOWED_ORIGINS` | CORS 허용 도메인 | `*` |
| `RATE_LIMIT_PER_MIN` | IP 당 분당 요청 제한 | `60` |

## 5. 확장 가이드: 새 플러그인 추가

새로운 기능 (예: 날씨 조회, 데이터베이스 연동) 을 추가하려면 다음 단계를 따릅니다.

1. **클래스 구현**: `src/plugins/weather-plugin.ts` 생성.

```typescript
export class WeatherPlugin implements McpPlugin {
  name = "weather";

  async initialize(config: Record<string, unknown>) {
    // API 키 로드
  }

  async registerTools(server: Server) {
    // server.setRequestHandler(...) 구현
  }

  async shutdown() {
    // 정리
  }
}
```

2. **팩토리 등록**: `src/plugins/index.ts`에 등록.

```typescript
export const PLUGIN_FACTORIES = {
  weather: async () => new WeatherPlugin(),
  // ...
};
```

3. **활성화**: `.env`의 `ENABLED_PLUGINS`에 `weather` 추가.

## 6. 배포 및 운영

### Docker 컨테이너화

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Nginx 리버스 프록시 설정 예시

SSL 종단 및 WebSocket/SSE 연결 유지를 위해 필요합니다.

```nginx
location /sse {
    proxy_pass http://localhost:3000/sse;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
}

location /message {
    proxy_pass http://localhost:3000/message;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## 7. 주의사항 (Caveats)

- **메모리 사용량**: 각 클라이언트 연결마다 `McpServer` 인스턴스가 생성되므로, 동시 연결 수가 매우 많을 경우 메모리 모니터링이 필요합니다. (불필요한 세션은 타임아웃으로 자동 정리되어야 함)
- **상태 공유 금지**: 세션 간에 변수나 캐시를 공유하면 안 됩니다. 공유가 필요하면 외부 DB 또는 Redis를 사용해야 합니다.
- **초기화 지연**: 플러그인 로드에 시간이 걸릴 수 있으므로, `GET /sse` 응답 후 실제 메시지 처리가 가능해질 때까지의 대기 시간을 고려해야 합니다. (현재 구현은 초기화 완료 전까지 연결을 유지함)
