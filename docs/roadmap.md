# MCP SSE 플랫폼 로드맵

## Phase 1 — 코어 안정화

**상태**: 완료 (스켈레톤 + SDK 연동)

- [x] PRD 오류 수정
- [x] session / session-manager / server / security
- [x] PluginManager + `ListToolsRequestSchema` / `CallToolRequestSchema` 집계
- [x] Weather / Echo 플러그인 실구현
- [x] `/health`, `/internal/*`
- [x] Docker 정의

---

## Phase 2 — Control Plane

**상태**: 완료

- [x] Plugin Registry + JSON 파일 영속화 (`data/platform.json`)
- [x] CRUD / enable / disable API
- [x] Core 동기화 (`PUT /internal/plugins`, `POST /api/sync`)
- [x] sessions / config / metrics

---

## Phase 3 — Dashboard MVP

**상태**: 완료

- [x] React + Vite UI
- [x] 플러그인 목록 / enable·disable / delete
- [x] 플러그인 등록 폼
- [x] Sync to Core 버튼
- [x] 세션·메트릭·설정

---

## Phase 4 — 운영 기능

**상태**: 부분 완료

- [x] 메트릭 API
- [x] 플러그인 설정 영속화
- [ ] 구조화 로그 수집 UI
- [ ] 플러그인 버전 롤백 UI

---

## Phase 5 — 고급

**상태**: 템플릿 완료 / 런타임 남음

- [x] `plugins/_template` 플러그인 템플릿
- [ ] npm/Git 원격 로딩
- [ ] 샌드박스 실행
- [ ] 다중 인스턴스 + 세션 애피니티

---

## 플러그인 추가 절차

1. `cp -r plugins/_template plugins/my-plugin`
2. `manifest.id` / tools 구현
3. `packages/core/src/plugins/index.ts` 팩토리 등록
4. Dashboard에서 Register + Enable
5. 새 SSE 세션 연결 후 `tools/list` 확인
