# MCP SSE 플랫폼 아키텍처 — 대시보드 & 플러그인 등록 플랫폼

이 문서는 기본 MCP SSE 코어(`prd.md`) 위에 **다양한 MCP를 플러그인으로 등록·관리·모니터링할 수 있는 대시보드형 플랫폼**으로 확장하기 위한 설계입니다.

## 1. 목표

- 여러 MCP 서버/도구를 **플러그인** 형태로 등록·활성화·비활성화
- 웹 대시보드에서 설정·세션·로그·메트릭을 한눈에 관리
- 코어(실행) 계층과 관리 계층을 분리하여 확장성·안전성 확보

## 2. 전체 아키텍처

```text
┌────────────────────────────────────────────────────────────┐
│                    Admin Dashboard (Web UI)                 │
│  - 플러그인 등록 / 활성화 / 비활성화 / 설정                     │
│  - 세션 모니터링 / 로그 / 메트릭                             │
│  - API Key, CORS, Rate Limit 설정                          │
│  - (선택) 플러그인 마켓플레이스                                    │
└─────────────────────────────────┬────────────────────────────┘
                           │ REST / WebSocket
┌─────────────────────────────────┴────────────────────────────┐
│                 Control Plane (Management API)               │
│  - Plugin Registry                                           │
│  - Config Store (SQLite / PostgreSQL / Redis)                │
│  - Auth / RBAC                                               │
│  - Metrics & Logs Aggregator                                 │
└─────────────────────────────────┬────────────────────────────┘
                           │
┌─────────────────────────────────┴────────────────────────────┐
│                    Data Plane (MCP SSE Core)                 │
│  - Session Manager                                           │
│  - Plugin Runtime (동적 로딩)                                  │
│  - SSE / HTTP Endpoints                                      │
└────────────────────────────────────────────────────────────┘
```

- **Data Plane**: 기존 `prd.md`의 MCP SSE 코어 (세션 + 플러그인 실행)
- **Control Plane**: 플러그인 등록, 설정, 모니터링 API
- **Dashboard**: 운영자가 사용하는 Web UI

## 3. 플러그인 모델 (확장)

```typescript
export interface McpPluginManifest {
  id: string;                       // 고유 ID (예: "tossinvest")
  name: string;
  version: string;
  description?: string;
  author?: string;
  entrypoint: string;               // 로컬 경로 또는 패키지명
  configSchema?: Record<string, unknown>; // JSON Schema (설정 UI 자동 생성용)
  permissions?: ("network" | "fs" | "env")[];
  tools?: string[];                 // 노출 도구 목록 (선택)
}

export interface McpPlugin {
  readonly manifest: McpPluginManifest;
  initialize(config: Record<string, unknown>): Promise<void>;
  registerTools(server: import("@modelcontextprotocol/sdk/server/index.js").Server): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck?(): Promise<{ status: "ok" | "degraded" | "error"; message?: string }>;
}

export type PluginSource =
  | { type: "local"; path: string }
  | { type: "npm"; package: string; version?: string }
  | { type: "git"; url: string; ref?: string }
  | { type: "upload"; artifactId: string };
```

### 등록 방식

1. **로컬 플러그인** — `plugins/` 디렉토리 또는 모노레포 패키지
2. **원격/패키지** — npm 또는 Git URL에서 동적 import
3. **대시보드 업로드** — zip/tarball 업로드 후 검증·등록

## 4. Control Plane API (초안)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/plugins` | 등록된 플러그인 목록 |
| POST | `/api/plugins` | 플러그인 등록 |
| GET | `/api/plugins/:id` | 플러그인 상세 |
| PATCH | `/api/plugins/:id` | 활성/비활성, 설정 변경 |
| DELETE | `/api/plugins/:id` | 플러그인 제거 |
| GET | `/api/sessions` | 현재 활성 세션 목록 |
| DELETE | `/api/sessions/:id` | 특정 세션 종료 |
| GET | `/api/config` | 전역 설정 조회 |
| PUT | `/api/config` | 전역 설정 변경 (CORS, Rate Limit 등) |
| GET | `/api/metrics` | 요청 수, 에러율, 세션 수 등 |
| GET | `/api/health` | 전체 및 플러그인 헬스 |

### Plugin Registry 인터페이스

```typescript
interface PluginRegistry {
  list(): Promise<McpPluginManifest[]>;
  get(id: string): Promise<McpPluginManifest | null>;
  register(manifest: McpPluginManifest, source: PluginSource): Promise<void>;
  enable(id: string): Promise<void>;
  disable(id: string): Promise<void>;
  updateConfig(id: string, config: Record<string, unknown>): Promise<void>;
  uninstall(id: string): Promise<void>;
}
```

## 5. 대시보드 핵심 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 플러그인 목록/상태 | 등록된 플러그인, 활성 여부, 버전, 헬스체크 | 필수 |
| 플러그인 등록 | 로컬 / npm / Git / 파일 업로드 | 필수 |
| 설정 관리 | 플러그인별 config (JSON Schema 기반 폼) | 필수 |
| 세션 모니터링 | 활성 세션 수, 세션별 플러그인, 연결 시간 | 높음 |
| 보안 설정 | API Key, CORS, Rate Limit | 높음 |
| 로그/메트릭 | 요청 수, 에러율, 지연시간, 플러그인별 통계 | 중간 |
| 버전/롤백 | 플러그인 버전 관리 및 이전 버전 롤백 | 중간 |
| 마켓플레이스 | 공개 플러그인 검색·설치 (선택) | 낮음 |

## 6. 권장 디렉토리 구조 (Monorepo)

```text
mcp-sse-platform/
├── packages/
│   ├── core/                 # Data Plane (prd.md 기반)
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── session.ts
│   │   │   ├── session-manager.ts
│   │   │   ├── plugins/
│   │   │   └── security/
│   │   └── package.json
│   ├── control-plane/        # 관리 API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── plugins.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── metrics.ts
│   │   │   ├── registry.ts
│   │   │   └── store.ts
│   │   └── package.json
│   └── dashboard/            # Web UI (React/Vue/Svelte 등)
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Plugins.tsx
│       │   │   ├── Sessions.tsx
│       │   │   ├── Settings.tsx
│       │   │   └── Logs.tsx
│       │   └── components/
│       └── package.json
├── plugins/                  # 런타임 플러그인 저장소
│   ├── tossinvest/
│   └── weather/
├── docker-compose.yml
└── package.json              # pnpm workspace 권장
```

## 7. 동적 로딩 & 세션 정책

- **세션 생성 시**: 현재 **활성화된 플러그인 목록**을 스냅샷으로 가져간다.
- **플러그인 비활성화**: 기존 세션은 계속 동작, **신규 세션**부터 제외 (또는 정책으로 강제 재시작 선택).
- **핫 리로드**: 설정 변경 시 기존 세션 유지 + 신규 세션에만 반영을 기본으로 한다.

## 8. 보안 고려사항

- 플러그인 실행은 가능하면 **워커 프로세스 또는 컨테이너**로 격리.
- `permissions` 매니페스트에 따라 네트워크/파일시스템 접근을 제한.
- 대시보드 접근은 **RBAC** (
  - Admin: 모든 권한
  - Operator: 플러그인 활성/비활성, 세션 조회
  - Viewer: 읽기 전용
).
- 업로드된 플러그인은 체크섬/서명 검증 후에만 등록.

## 9. 관련 문서

- 코어 구현 가이드: [`prd.md`](./prd.md)
- 단계별 로드맵: [`roadmap.md`](./roadmap.md)
