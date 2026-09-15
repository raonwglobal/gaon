# Gaon 플러그인 개발 가이드

신규 플러그인을 **동일한 포맷·생명주기·운영 규칙**으로 개발·배포·관리하기 위한 표준 문서입니다.  
특정 증권사·벤더에 종속되지 않으며, 내부 도구·외부 API·데이터 연동 등 모든 신규 MCP 플러그인에 적용합니다.

| 항목 | 표준 |
|------|------|
| 전송 | MCP over **stdio** |
| 언어/런타임 | **TypeScript → Node.js ≥ 20** (`dist/index.js`) |
| gaon 연동 | Core **stdio 브리지** + `plugin.meta.json` |
| 설치 | git (대시보드) 또는 볼륨 직접 배치 |
| 활성화 | Control Plane 레지스트리 → **sync** → Core enabled |

> 기존 Python MCP 이식은 [external-mcp-plugins.md](./external-mcp-plugins.md) 를 참고하세요.  
> **신규 개발은 본 가이드(Node stdio)만** 사용합니다.

---

## 1. 아키텍처

```text
클라이언트 (Grok, Claude, curl 등)
        │  HTTP + SSE
        ▼
┌─────────────────── gaon ───────────────────┐
│  Control Plane   설치·enable·config·sync     │
│  Core (SSE)      세션·도구 라우팅             │
│       │                                      │
│       │  plugin.meta.json → spawn            │
│       ▼                                      │
│  플러그인 프로세스 (node dist/index.js)       │
│       │  MCP JSON-RPC over stdio             │
│       ▼                                      │
│  업스트림 API / DB / 사내 서비스              │
└──────────────────────────────────────────────┘
```

- 플러그인은 **gaon 내부 `McpPlugin` 클래스가 아닙니다.**  
  표준 MCP 서버 프로세스이며, Core가 세션마다(또는 정책에 따라) 자식으로 실행합니다.
- 도구 이름은 Core에서 `<pluginId>_<toolName>` 형태로 노출됩니다.

---

## 2. 플러그인 ID 규칙

| 규칙 | 설명 |
|------|------|
| 문자 | `^[a-z][a-z0-9_-]{1,31}$` 권장 (소문자, 숫자, `-`, `_`) |
| 유일성 | 플랫폼 전역에서 유일 |
| 안정성 | 한번 배포한 id는 바꾸지 않음 (도구 이름 prefix가 바뀜) |
| 예시 | `crm`, `ops-alerts`, `market-data`, `invoice` |

---

## 3. 표준 디렉터리 구조

```text
<plugin-id>-mcp/                 # 저장소 루트 이름 (자유)
├── package.json
├── package-lock.json            # 권장 (재현 가능한 설치)
├── tsconfig.json
├── plugin.meta.json             # gaon 배포 메타 (시크릿 값 금지)
├── .env.example                 # 키 이름만, 값 비움
├── .gitignore                   # node_modules, dist, .env
├── README.md                    # 도구 목록·환경변수·권한 설명
├── src/
│   ├── index.ts                 # stdio 엔트리
│   ├── config.ts                # env 로드·검증
│   ├── server.ts                # MCP Server + 핸들러
│   ├── tools/                   # 도구별 모듈 (권장)
│   │   ├── ping.ts
│   │   └── ...
│   └── lib/                     # HTTP 클라이언트 등 (선택)
└── dist/                        # tsc 산출물 (런타임 필수)
    └── index.js
```

---

## 4. 패키지 스펙

### 4.1 `package.json`

```json
{
  "name": "@org/<plugin-id>-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "<plugin-id>-mcp": "dist/index.js"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test"
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

### 4.2 `tsconfig.json` (예시)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

---

## 5. 소스 템플릿

### 5.1 엔트리 — `src/index.ts`

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
  // stdout 은 MCP 전용 — 진단은 stderr 만
  console.error(`plugin failed to start: ${message}`);
  process.exit(1);
});
```

### 5.2 설정 — `src/config.ts`

```typescript
import { z } from "zod";

/**
 * 플러그인별 환경변수는 접두사로 네임스페이스를 나눕니다.
 * 예: CRM_API_KEY, OPS_WEBHOOK_URL
 */
const envSchema = z.object({
  PLUGIN_API_KEY: z.string().min(1).optional(),
  PLUGIN_BASE_URL: z.string().url().optional(),
  PLUGIN_ENABLE_WRITE: z.enum(["true", "false"]).optional(),
});

export type Config = {
  apiKey?: string;
  baseUrl?: string;
  writeEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cleaned: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== "") cleaned[key] = value;
  }

  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid config: ${detail}`);
  }

  const data = parsed.data;
  return {
    apiKey: data.PLUGIN_API_KEY,
    baseUrl: data.PLUGIN_BASE_URL,
    writeEnabled: data.PLUGIN_ENABLE_WRITE === "true",
  };
}
```

필수 키가 있는 플러그인은 `z.string().min(1)` 로 **기동 실패**시켜 Core `loadReport.failed` 에 원인이 남도록 합니다.

### 5.3 서버 — `src/server.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.js";

export function createServer(config: Config) {
  const server = new Server(
    { name: "plugin-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "ping",
        description: "Health check. Returns ok without secrets.",
        inputSchema: { type: "object", properties: {} },
      },
      // 추가 도구 정의...
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    try {
      if (name === "ping") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                writeEnabled: config.writeEnabled,
                hasApiKey: Boolean(config.apiKey),
              }),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  });

  return server;
}
```

도구가 많아지면 `tools/*.ts` 로 분리하고 `listTools` / `callTool` 만 조립합니다.

---

## 6. `plugin.meta.json` (배포 메타)

플러그인 디렉터리 루트에 둡니다. **시크릿 실값은 넣지 않습니다.**

```json
{
  "id": "myplugin",
  "runtime": "stdio",
  "command": "node",
  "args": ["dist/index.js"],
  "description": "Short human-readable description",
  "version": "0.1.0",
  "envFromHost": ["PLUGIN_API_KEY", "PLUGIN_BASE_URL", "PLUGIN_ENABLE_WRITE"]
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `id` | yes | Core/레지스트리 플러그인 id |
| `runtime` | yes | 신규 표준은 `stdio` |
| `command` | yes | 보통 `node` |
| `args` | yes | 보통 `["dist/index.js"]` (cwd = 플러그인 루트) |
| `env` | no | 비시크릿 기본값만. 키 값은 비우거나 생략 |
| `envFromHost` | no | Core/호스트 process.env 에서 전달할 키 목록 |
| `description` | no | 운영·대시보드 표시용 |

시크릿 주입 우선순위 (개념):

1. Control Plane 플러그인 config (sync)  
2. Core/compose 환경변수  
3. meta `env` (비시크릿 기본값)  

---

## 7. 도구 설계 규칙

| 규칙 | 내용 |
|------|------|
| 이름 | `snake_case`, 짧고 안정적 (`list_items`, `get_quote`) |
| 설명 | 한 줄로 목적·부작용(읽기/쓰기) 명시 |
| 입력 | JSON Schema `object`; 필수 필드는 `required` |
| 출력 | `content[]` 텍스트(JSON 문자열) 권장 |
| 쓰기 | 기본 비활성; 확인 플래그/별도 enable env |
| 오류 | `isError: true` + 사람이 읽을 메시지 (스택·시크릿 금지) |
| 멱등 | 조회는 멱등; 생성/수정은 문서에 명시 |

gaon 노출 예:

```text
플러그인 내부 name:  ping
클라이언트 도구명:   myplugin_ping
```

---

## 8. 로컬 개발·단위 검증

```bash
cd <plugin-repo>
npm install
npm run build
npm run typecheck

# 필수 env 설정 후 — 정상 시 stdout 출력 없이 대기
export PLUGIN_API_KEY=dev-key
node dist/index.js
```

- 기동 직후 종료되면 stderr 메시지를 확인합니다.  
- MCP Inspector 등으로 `tools/list` / `tools/call` 을 검증합니다.  
- CI에서는 `npm run build` + `typecheck` (+ 테스트) 를 게이트로 둡니다.

---

## 9. gaon 배포·생명주기

### 9.1 설치

**A. 대시보드 / API (git)**

1. 저장소를 플랫폼이 허용한 git URL로 등록  
2. plugin id 지정 후 설치 (install-worker: clone → `npm install` → `npm run build` → meta)  
3. enable  

**B. 볼륨 직접 배치**

```bash
rsync -a --delete ./dist ./package.json ./plugin.meta.json \
  /srv/gaon/plugins/<plugin-id>/
# node_modules 필요 시 플러그인 디렉터리에서 npm ci --omit=dev
```

### 9.2 동기화 (필수 개념)

| 동작 | 효과 |
|------|------|
| `POST /api/sync` 또는 Core 기동 bootstrap | 레지스트리 enabled/config → Core |
| `POST /internal/plugins/reload` | 디스크 factory 재스캔 + **현재** enabled 로 세션 리로드 |

**reload 만으로는 신규 enable 목록이 반영되지 않습니다.** 설치·활성화 후에는 항상 sync 가 선행되어야 합니다.

### 9.3 검증

```bash
curl -s -X POST http://localhost:3001/api/sync
# SSE 세션 1회 생성 후
curl -s http://localhost:3000/health | jq '{plugins, loadReport}'
```

성공 예:

```json
{
  "plugins": ["myplugin"],
  "loadReport": {
    "loaded": ["myplugin"],
    "failed": [],
    "tools": ["myplugin_ping"]
  }
}
```

### 9.4 클라이언트 (Grok 등)

- SSE URL: `https://<host>/sse`  
- 도구 목록이 바뀌면 **커넥터 재연결 + 새 대화** 권장 (캐시된 tools/list 불일치 방지)  

---

## 10. 설정·시크릿 관리

| 저장 위치 | 용도 |
|-----------|------|
| `.env.example` | 키 **이름** 문서화 (값 없음) |
| Control Plane plugin config | 운영 시크릿·기능 플래그 |
| Compose / 오케스트레이터 env | 인프라 공통 값 |
| `plugin.meta.json` | 비시크릿 기본값·`envFromHost` 목록만 |

금지:

- git / README / 공개 스토리지에 실키 커밋  
- stdout 로그에 토큰·개인정보 출력  

---

## 11. 운영 체크리스트 (신규 플러그인 공통)

- [ ] id 규칙 준수, README에 도구·env 표기  
- [ ] `npm run build` 산출물 `dist/index.js` 존재  
- [ ] stdout 미사용, 실패 시 stderr + exit ≠ 0  
- [ ] `plugin.meta.json` 완비 (시크릿 값 없음)  
- [ ] 쓰기 도구 기본 OFF  
- [ ] 로컬 `tools/list` 통과  
- [ ] gaon sync 후 `loadReport.loaded` 에 id 포함  
- [ ] 클라이언트에서 접두사 붙은 도구명으로 호출 성공  

---

## 12. 피해야 할 패턴

| 안티패턴 | 이유 |
|----------|------|
| stdout `console.log` | MCP 프레이밍 파괴 |
| Core 프로세스에 비즈니스 코드 in-process 혼입 | 격리·장애 전파 |
| 시스템 전역 `npm install -g` 의존 | 재현 불가·이미지 오염 |
| enable 없이 reload 만 반복 | 도구 미노출 |
| id / tool name 잦은 변경 | 클라이언트·자동화 파손 |
| Python을 신규 기본으로 선택 | 이미지·venv·볼륨 복잡도 |

---

## 13. 관련 문서

- [External MCP plugins (stdio bridge 운영)](./external-mcp-plugins.md)  
- MCP SSE Core 개요: `docs/prd.md` (존재 시)  

---

## 부록 A. 최소 README 뼈대

```markdown
# <plugin-id>-mcp

## Tools
| Name | Description | Side effect |
|------|-------------|-------------|
| ping | Health check | none |

## Environment
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PLUGIN_API_KEY | yes* | — | API key |
| PLUGIN_ENABLE_WRITE | no | false | Enable mutating tools |

## Run
npm install && npm run build && npm start
```

## 부록 B. 버전·호환

- Node ≥ 20  
- `@modelcontextprotocol/sdk` 는 플러그인 자체 `node_modules` 사용 (Core 버전과 독립 가능)  
- breaking tool rename 시 major 버전 증가 + README 공지  
