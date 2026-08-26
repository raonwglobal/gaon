# MCP SSE Platform

다양한 MCP를 플러그인으로 등록·관리할 수 있는 **MCP over SSE** 플랫폼입니다.

## 구조

```text
packages/
  core/            # MCP SSE Data Plane (:3000)
  control-plane/   # 관리 API (:3001)
  dashboard/       # Web UI (:5173)
plugins/
  weather/         # 예시 플러그인
  echo/            # 스모크 테스트용
  _template/       # 새 플러그인 템플릿
docs/
```

## 빠른 시작

```bash
npm install
npm run dev:core
npm run dev:control
npm run dev:dashboard
```

`.env.example`을 참고해 `.env`를 만드세요. `ADMIN_TOKEN`과 `INTERNAL_TOKEN`을 같게 두면 Control→Core 동기화가 동작합니다.

## 플러그인 추가

```bash
cp -r plugins/_template plugins/my-plugin
# index.ts 편집 후
# packages/core/src/plugins/index.ts 에 팩토리 추가
# Dashboard → Register Plugin → Enable
```

새 SSE 세션부터 활성 플러그인이 적용됩니다. Dashboard의 **Sync to Core** 버튼으로 수동 동기화할 수도 있습니다.

## 엔드포인트

| 서비스 | Path | 설명 |
|--------|------|------|
| Core | `GET /sse` | SSE 연결 |
| Core | `POST /message?sessionId=` | MCP JSON-RPC |
| Core | `GET /health` | 헬스 |
| Core | `PUT /internal/plugins` | 플러그인 목록 수신 (Control Plane) |
| Control | `/api/plugins` | 플러그인 CRUD |
| Control | `POST /api/sync` | Core로 즉시 동기화 |
| Control | `/api/sessions` | 활성 세션 |
| Control | `/api/metrics` | 메트릭 |

## Docker

```bash
docker compose up --build
```

## 문서

- [docs/prd.md](docs/prd.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/roadmap.md](docs/roadmap.md)
- [plugins/_template/README.md](plugins/_template/README.md)

## License

MIT
