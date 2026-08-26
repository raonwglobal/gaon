# MCP SSE 플랫폼 로드맵

## Phase 1 — 코어 안정화

**상태**: 스켈레톤 완료

- [x] PRD 오류 수정 (타입, transport 접근, 세션 타임아웃, 보안 인터페이스)
- [x] `packages/core` 스켈레톤
  - [x] session.ts / session-manager.ts
  - [x] server.ts (라우팅, CORS, Auth, Rate Limit)
  - [x] plugins/interface.ts + manager.ts
  - [x] config.ts + index.ts
- [x] `/health`, `/internal/sessions` 엔드포인트
- [x] Docker 빌드 정의
- [ ] 실제 MCP SDK 도구 등록 API와의 정합 테스트 (런타임 검증 필요)
- [ ] 단위 테스트

**성공 기준**: `GET /sse` 후 세션 생성, 유휴 세션 자동 정리, API Key로 미인증 요청 차단.

---

## Phase 2 — Control Plane 기초

**상태**: 스켈레톤 완료

- [x] Plugin Registry (인메모리 저장소)
- [x] `POST/GET/PATCH/DELETE /api/plugins`
- [x] enable / disable
- [x] `/api/config`, `/api/sessions`, `/api/metrics`, `/api/health`
- [ ] SQLite/PostgreSQL 영속화
- [ ] Core와의 플러그인 목록 동기화 (hot reload)

---

## Phase 3 — Dashboard MVP

**상태**: 스켈레톤 완료

- [x] React + Vite 대시보드
- [x] 플러그인 목록 / enable·disable
- [x] 세션 모니터링
- [x] 메트릭 조회
- [x] Admin Token 설정
- [ ] 플러그인 등록 폼 (UI)
- [ ] JSON Schema 기반 설정 폼

---

## Phase 4 — 운영 기능

**상태**: 구조 완료 / 상세 구현 남음

- [x] 메트릭 API 초안
- [ ] 로그 수집 및 UI
- [ ] 플러그인 헬스체크 주기
- [ ] 버전 관리 / 롤백
- [ ] Rate Limit·CORS 대시보드 편집

---

## Phase 5 — 고급 기능

**상태**: 설계 완료 / 구현 남음

- [ ] 원격 플러그인 (npm / Git)
- [ ] 플러그인 샌드박스
- [ ] 공개 마켓플레이스
- [ ] 다중 인스턴스 + 세션 애피니티
- [ ] SSO / 고급 RBAC

---

## 현재 진행 상태

| Phase | 상태 | 비고 |
|-------|------|------|
| Phase 1 | 스켈레톤 완료 | 런타임 검증·SDK 정합 필요 |
| Phase 2 | 스켈레톤 완료 | 인메모리 레지스트 |
| Phase 3 | 스켈레톤 완료 | MVP UI |
| Phase 4 | 부분 완료 | 메트릭 API만 |
| Phase 5 | 설계만 | 미구현 |

### 다음 우선순위 작업

1. `npm install` 후 core / control-plane 로컬 기동 검증
2. `@modelcontextprotocol/sdk` 실제 tool registration API에 맞추어 Weather 플러그인 완성
3. Control Plane ↔ Core 플러그인 enable 목록 동기화
4. Dashboard 플러그인 등록 폼 추가
