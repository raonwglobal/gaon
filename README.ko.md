# MCP SSE Platform

플러그인 시스템과 관리 대시보드를 갖춘 **MCP over SSE** 서버 플랫폼입니다.

> 여러 MCP 도구를 플러그인으로 등록하고, 웹 대시보드에서 관리하며, HTTP + Server-Sent Events로 서빙합니다.

## 빠른 시작

```bash
npm install
npm run dev:core       # :3000 — MCP SSE Data Plane
npm run dev:control    # :3001 — Control Plane API
npm run dev:dashboard  # :5173 — Admin UI
```

`.env.example`을 복사해 `.env`를 만들고 `ADMIN_TOKEN` / `INTERNAL_TOKEN`을 설정하세요.

상세 문서는 **[PLATFORM.md](./PLATFORM.md)** 를 참조하세요.

## 구조

```text
packages/
  core/            # MCP SSE 서버
  control-plane/   # 플러그인 레지스트 & 관리 API
  dashboard/       # React 관리 UI
plugins/
  weather/         # 예시 플러그인
  echo/            # 스모크 테스트용
  _template/       # 새 플러그인 템플릿
docs/
  prd.md
  architecture.md
  roadmap.md
```

## 플러그인 추가

```bash
cp -r plugins/_template plugins/my-plugin
# plugins/my-plugin/index.ts 편집
# packages/core/src/plugins/index.ts 에 팩토리 등록
# Dashboard에서 활성화
```

## 라이선스

MIT
