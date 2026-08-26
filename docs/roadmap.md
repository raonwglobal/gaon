# MCP SSE 플랫폼 로드맵

## Phase 1 — 코어 안정화 (Current Focus)

**목표**: `prd.md`에 정의된 Data Plane을 실제 동작 가능한 상태로 만든다.

- [x] PRD 오류 수정 (타입, transport 접근, 세션 타임아웃, 보안 인터페이스)
- [ ] `src/` 스켈레톤 코드 구현
  - [ ] session.ts / session-manager.ts
  - [ ] server.ts (라우팅, CORS, Auth, Rate Limit)
  - [ ] plugins/interface.ts + manager.ts
  - [ ] config.ts + index.ts
- [ ] 기본 Health 엔드포인트 (`/health`)
- [ ] Docker 빌드 + 로컬 실행 검증
- [ ] 단위 테스트 (세션 생성/종료, Rate Limit)

**성공 기준**: `GET /sse` 후 `tools/list` 가능, 유휴 세션 자동 정리, API Key로 미인증 요청 차단.

---

## Phase 2 — Control Plane 기초

**목표**: 플러그인을 런타임에 등록·활성화·비활성화할 수 있는 관리 API.

- [ ] Plugin Registry (메모리 또는 SQLite)
- [ ] `POST/GET/PATCH/DELETE /api/plugins`
- [ ] 플러그인 enable/disable 시 세션 스냅샷 정책 적용
- [ ] 전역 설정 API (`/api/config`)
- [ ] 세션 목록/종료 API (`/api/sessions`)

**성공 기준**: 대시보드 없이도 curl/Postman으로 플러그인을 추가·비활성화할 수 있음.

---

## Phase 3 — Dashboard MVP

**목표**: 운영자가 브라우저에서 플러그인과 세션을 관리.

- [ ] 플러그인 목록 / 상세 / 활성화 토글
- [ ] 플러그인 등록 폼 (로컬 경로 또는 업로드)
- [ ] 플러그인별 설정 폼 (JSON Schema 기반)
- [ ] 세션 모니터링 페이지
- [ ] 기본 인증 (Admin 로그인)

**성공 기준**: 브라우저만으로 플러그인 1개를 등록하고 세션이 그 플러그인을 사용하는 것을 확인.

---

## Phase 4 — 운영 기능

- [ ] 로그 수집 및 조회 UI
- [ ] 메트릭 (요청 수, 에러율, 지연시간, 플러그인별 통계)
- [ ] 플러그인 헬스체크 주기적 실행
- [ ] 플러그인 버전 관리 및 롤백
- [ ] Rate Limit / CORS 대시보드에서 설정

---

## Phase 5 — 고급 기능

- [ ] 원격 플러그인 (npm / Git)
- [ ] 플러그인 샌드박스 (격리 실행)
- [ ] 공개 마켓플레이스 (선택)
- [ ] 다중 인스턴스 지원 (세션 애피니티)
- [ ] SSO / 고급 RBAC

---

## 현재 진행 상태

| Phase | 상태 | 비고 |
|-------|------|------|
| Phase 1 | 진행 중 | PRD 개선 완료, 코드 스켈레톤 대기 |
| Phase 2~5 | 미시작 | architecture.md 참조 |

다음 작업으로 Phase 1 코드 스켈레톤을 저장소에 추가할 수 있습니다.
