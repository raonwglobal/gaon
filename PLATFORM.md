# MCP SSE Platform

다양한 MCP를 플러그인으로 등록·관리할 수 있는 **MCP over SSE** 플랫폼 스켈레톤입니다.

## 구조

```text
packages/
  core/            # MCP SSE Data Plane (port 3000)
  control-plane/   # 관리 API (port 3001)
  dashboard/       # Web UI (port 5173 / 80)
plugins/
  weather/         # 예시 플러그인
docs/
  prd.md           # 코어 구현 가이드
  architecture.md  # 플랫폼 아키텍처
  roadmap.md       # 단계별 로드맵
```

## 빠른 시작

```bash
# 의존성 설치
npm install

# Core 서버
npm run dev:core

# Control Plane
npm run dev:control

# Dashboard
npm run dev:dashboard
```

환경 변수는 루트 `.env.example`을 참고하세요.

## Docker

```bash
docker compose up --build
```

- Core: http://localhost:3000/health
- Control Plane: http://localhost:3001/api/health
- Dashboard: http://localhost:5173

## API 요약

### Core

| Method | Path | 설명 |
|--------|------|------|
| GET | `/sse` | SSE 연결 |
| POST | `/message?sessionId=` | MCP JSON-RPC |
| GET | `/health` | 헬스체크 |

### Control Plane

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/plugins` | 플러그인 목록 |
| POST | `/api/plugins` | 플러그인 등록 |
| POST | `/api/plugins/:id/enable` | 활성화 |
| POST | `/api/plugins/:id/disable` | 비활성화 |
| GET | `/api/sessions` | 활성 세션 |
| GET/PUT | `/api/config` | 플랫폼 설정 |
| GET | `/api/metrics` | 메트릭 |

Admin 인증: `X-Admin-Token` 헤더 또는 `ADMIN_TOKEN` 환경변수.

## 문서

- [코어 PRD](docs/prd.md)
- [아키텍처](docs/architecture.md)
- [로드맵](docs/roadmap.md)

## 라이선스

MIT
