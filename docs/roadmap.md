# MCP SSE 플랫폼 로드맵

## Phase 1 — 코어 안정화 ✅

- [x] PRD / session / PluginManager / SDK handlers
- [x] security, health, Docker

## Phase 2 — Control Plane ✅

- [x] Registry + JSON 영속화
- [x] Core 플러그인 동기화
- [x] **Platform config 단일 소스** (`PUT /internal/config`)

## Phase 3 — Dashboard MVP+ ✅

- [x] 플러그인 CRUD / config / sync
- [x] Metrics 카드 / 세션 종료 / auto-refresh

## Phase 4 — 운영 ✅

- [x] 관측성 (`metrics` + `/internal/metrics` + tools 호출수)
- [x] 플러그인 설정 영속화
- [ ] 구조화 로그 UI (다음)

## Phase 5 — 확장 ✅ (기반)

- [x] `plugins/_template`
- [x] **플러그인 자동 발견** (`PLUGINS_DIR` 스캔)
- [x] **단위 테스트** (vitest: metrics, rate-limit, runtime-state, manager, discover)
- [x] **Docker 플러그인 경로** (`PLUGINS_DIR=/app/plugins`)
- [ ] npm/Git 원격 로딩
- [ ] 프로세스 샌드박스
- [ ] 다중 인스턴스 + 세션 애피니티

## 검증

```bash
npm install
npm test
npm run dev:core
# Dashboard Settings → platform config 저장 → Core rate limit 반영 확인
```
