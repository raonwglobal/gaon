# MCP SSE Platform

플러그인 기반 **MCP over SSE** 플랫폼 (v0.3).

## 빠른 시작

```bash
npm install
npm test
npm run dev:core
npm run dev:control
npm run dev:dashboard
```

`.env.example` → `.env` (`ADMIN_TOKEN` / `INTERNAL_TOKEN` 동일 값 권장).

## 주요 기능

| 기능 | 설명 |
|------|------|
| Config 단일 소스 | Dashboard/Control `PUT /api/config` → Core `PUT /internal/config` (
CORS, rate limit, max sessions) |
| 플러그인 자동 발견 | `PLUGINS_DIR` 하위 디렉토리 스캔 (`_` 점두 제외) |
| 관측성 | Core `metrics` — HTTP/tools/세션/와도제한 카운터, `/health`·`/internal/metrics` |
| 테스트 | `npm test` (vitest) |

## 플러그인 추가

```bash
cp -r plugins/_template plugins/my-plugin
# index.ts · package.json mcpPluginId 수정
# Core 재시작 (발견) 후 Dashboard에서 Register + Enable
```

## Docker

```bash
docker compose up --build
```

Core 이미지에 `plugins/` 가 포함되며 `PLUGINS_DIR=/app/plugins` 로 로드됩니다.

## 문서

- [docs/prd.md](docs/prd.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/roadmap.md](docs/roadmap.md)
