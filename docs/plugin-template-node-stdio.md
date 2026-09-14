# Gaon 개발용 플러그인 표준 템플릿 (Node stdio / Toss MCP 기반)

이 문서는 **토스증권 MCP(`tossinvest-mcp`)와 같은 형태**를 gaon 플랫폼 표준으로 채택할 때의 개발·설치·연동 가이드입니다.

- 전송: **MCP over stdio**
- 런타임: **Node.js ≥ 20**
- gaon 연동: Core **stdio 브리지** + `plugin.meta.json`
- 비권장(신규): Python stdio (기존 레포 이식 시에만)

---

## 1. 목표 아키텍처

```text
Grok / Client
    │  SSE
    ▼
gaon Core (Node)
    │  ExternalMcpServerPlugin (stdio bridge)
    ▼
child: node dist/index.js   ← 이 템플릿으로 만드는 MCP 서버
    │
    ▼
외부 API (증권·사내 서비스 등)
```

플러그인은 **gaon `McpPlugin` 클래스가 아니라**, 표준 MCP 서버 프로세스입니다.  
gaon은 `plugin.meta.json`을 보고 프로세스를 띄운 뒤 `tools/list` / `tools/call`을 중계합니다.

---

## 2. 권장 디렉터리 구조

```text
my-mcp-plugin/
├── package.json
├── tsconfig.json
├── plugin.meta.json          # gaon 설치 후 루트에 두거나 install-worker가 생성
├── .env.example
├── README.md
├── src/
│   ├── index.ts              # stdio 엔트리 (#! /usr/bin/env node)
│   ├── config.ts             # env 검증 (zod 권장)
│   ├── server.ts             # McpServer + tool 등록
│   └── tools/                # 도구 단위 모듈 (선택)
│       └── example.ts
└── dist/                     # tsc 산출물 (배포 필수)
    └── index.js
```

---

## 3. `package.json` 최소 스펙

```json
{
  "name": "my-mcp-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "my-mcp-plugin": "dist/index.js"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0"
  }
}
```

참고: 하위 서버의 SDK 버전은 **해당 프로세스의 `node_modules`** 를 씁니다. Core SDK 버전과 달라도 동작하는 것이 일반적입니다.

---

## 4. 엔트리 (`src/index.ts`)

Toss와 동일한 패턴입니다.

```typescript
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // stdio MCP: 프로토콜 채널을 오염시키지 않도록 진단은 stderr 만
  console.error(`my-mcp-plugin failed to start: ${message}`);
  process.exit(1);
});
```

**규칙**

- stdout 은 **MCP JSON-RPC 전용**. 로그는 반드시 `console.error` (stderr).
- 설정 오류 시 **명확한 메시지 후 non-zero exit** (gaon loadReport에 원인 전달).

---

## 5. 설정 (`src/config.ts`)

필수 시크릿은 기동 시 검증합니다 (Toss의 `TOSSINVEST_API_KEY` 패턴).

```typescript
import { z } from "zod";

const envSchema = z.object({
  MY_API_KEY: z.string().min(1),
  MY_API_BASE: z.string().url().default("https://api.example.com"),
  MY_ENABLE_WRITE: z.enum(["true", "false"]).optional(),
});

export type Config = {
  apiKey: string;
  baseUrl: string;
  writeEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cleaned: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v !== "") cleaned[k] = v;
  }
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid config: ${missing}`);
  }
  const data = parsed.data;
  return {
    apiKey: data.MY_API_KEY,
    baseUrl: data.MY_API_BASE,
    writeEnabled: data.MY_ENABLE_WRITE === "true",
  };
}
```

`.env.example`:

```text
MY_API_KEY=
MY_API_BASE=https://api.example.com
MY_ENABLE_WRITE=false
```

---

## 6. 서버·도구 등록 (`src/server.ts`)

SDK 버전에 따라 API 이름이 다를 수 있습니다. 개념은 다음과 같습니다.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.js";

export function createServer(config: Config) {
  const server = new Server(
    { name: "my-mcp-plugin", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "ping",
        description: "Health check — returns ok and config summary (no secrets)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "fetch_example",
        description: "Example read-only API call",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Resource id" },
          },
          required: ["id"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (name === "ping") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              baseUrl: config.baseUrl,
              writeEnabled: config.writeEnabled,
            }),
          },
        ],
      };
    }

    if (name === "fetch_example") {
      // TODO: call upstream with config.apiKey
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ id: args.id, note: "implement me" }),
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  return server;
}
```

gaon에 붙으면 도구 이름은 접두사가 붙습니다.

```text
ping           →  <pluginId>_ping
fetch_example  →  <pluginId>_fetch_example
```

`pluginId` 는 설치 id (예: `toss`, `myplugin`) 입니다.

---

## 7. gaon용 `plugin.meta.json`

설치 디렉터리 루트 (예: `/srv/gaon/plugins/myplugin/plugin.meta.json`):

```json
{
  "id": "myplugin",
  "runtime": "stdio",
  "command": "node",
  "args": ["dist/index.js"],
  "description": "My MCP plugin (Node stdio)",
  "env": {
    "MY_API_KEY": "",
    "MY_API_BASE": "https://api.example.com",
    "MY_ENABLE_WRITE": "false"
  }
}
```

- `env` 는 파일에 넣지 말고 **배포 시 주입**하는 것을 권장합니다.
- Core는 meta `env` + 플러그인 config + 호스트 `process.env` 를 합쳐 자식에게 전달합니다.
- install-worker는 git 설치 후 `npm install` / `npm run build` 및 meta 추론을 시도합니다.

---

## 8. 로컬 개발 체크리스트

```bash
cd my-mcp-plugin
npm install
npm run build

# 필수 env 설정 후 — 정상 시 아무 출력 없이 대기 (stdio 서버)
export MY_API_KEY=test
node dist/index.js
```

MCP Inspector 또는 간단 클라이언트로 `tools/list` 확인.

gaon 볼륨에 복사:

```bash
rsync -a --delete ./ /srv/gaon/plugins/myplugin/
# plugin.meta.json 확인
curl -s -X POST http://localhost:3001/api/sync
curl -s -X POST http://localhost:3000/internal/plugins/reload
```

SSE 한 번 연 뒤:

```bash
curl -s http://localhost:3000/health | jq .loadReport
```

기대:

```json
{
  "loaded": ["myplugin"],
  "failed": [],
  "tools": ["myplugin_ping", "myplugin_fetch_example"]
}
```

---

## 9. 대시보드 / git 설치

1. GitHub에 템플릿 레포 push  
2. gaon 대시보드에서 git source로 설치 (`id`: `myplugin`)  
3. Control Plane **sync** (Core 기동 시 `/internal/sync` bootstrap 도 동일)  
4. Grok 커넥터는 도구 목록 변경 후 **재연결 + 새 채팅** 권장  

---

## 10. 표준 규칙 요약

| 항목 | 표준 |
|------|------|
| 언어 | TypeScript → `dist/index.js` |
| 전송 | stdio only (신규 플러그인) |
| 로그 | stderr only |
| 설정 | zod 등 기동 시 검증, 빈 문자열은 unset 취급 |
| 시크릿 | meta/git 커밋 금지, env 또는 Control Plane config |
| 쓰기 API | 기본 OFF (`*_ENABLE_*=false`) |
| 도구 이름 | 짧고 stable; gaon이 `id_` 접두사 부여 |
| 실패 | loadReport.failed 메시지에 원인 포함되도록 exit |

---

## 11. Toss 플러그인과의 대응

| 템플릿 | Toss (`tossinvest-mcp`) |
|--------|-------------------------|
| `MY_API_KEY` | `TOSSINVEST_API_KEY` + `TOSSINVEST_SECRET_KEY` |
| `dist/index.js` | 동일 |
| `StdioServerTransport` | 동일 |
| trading 가드레일 | Toss 전용 env 다수 |

신규 사내/개발용 플러그인은 **이 템플릿을 복제**하고, Toss는 동일 표준의 참고 구현으로 보면 됩니다.

---

## 12. 피해야 할 것

- stdout에 `console.log` (MCP 파싱 깨짐)  
- gaon Core 프로세스 안에 직접 `require` 로 비즈니스 코드 섞기 (프로세스 격리 상실)  
- 시스템 전역 `npm install -g` 의존  
- 시크릿을 README·git·공개 Drive에 평문 저장  

---

## 관련 문서

- [External MCP plugins (stdio bridge)](./external-mcp-plugins.md)  
- PRD / MCP SSE Core 개요: `docs/prd.md` (있는 경우)  
