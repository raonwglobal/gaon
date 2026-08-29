# gaon MCP SSE Gateway — 개선 설계안 (v2)

> 상태: 채택 (2026-08-29)  
> 목표: 관리 평면과 데이터 평면을 분리하고, 사용자 단위 MCP(플러그인) 관리와 보안을 강화한다.

## 1. 제품 목표

| 영역 | 역할 |
|------|------|
| **관리 평면** | Dashboard + Control API — 사용자 관리, 커넥터(플러그인) 추가·삭제·설정 |
| **데이터 평면** | MCP SSE Gateway (Core) — 외부 클라이언트에 MCP over SSE 제공 (별도 서비스로 배포 가능) |

외부(ChatGPT, Grok 등)에는 **Gateway만** 노출하고, Dashboard/Control은 운영·내부망에 둔다.

## 2. 아키텍처

```text
[관리 평면]  Dashboard ──session──► Control API ──internal──► Gateway
[데이터 평면] ChatGPT/Grok ──MCP SSE──► Gateway ──► plugins / remote MCP
```

- 사람 인증(콘솔) ≠ 에이전트 인증(MCP 클라이언트)
- 커넥터·시크릿은 사용자(또는 테넌트) 스코프
- 시크릿은 디스크 평문·브라우저·Git 레포에 두지 않음 (Vault/세션 방향)

## 3. 역할 (RBAC)

| 역할 | 권한 |
|------|------|
| `viewer` | 본인 스코프 조회 |
| `user` | 본인 커넥터 CRUD |
| `operator` | 동기화·세션·카탈로그 운영 |
| `admin` | 사용자 관리·전역 설정·전체 커넥터 |

## 4. 보안 원칙

1. Fail closed — 인증 없이는 관리 API 거부
2. `/config.json`에 관리 시크릿 주입 금지
3. 세션 쿠키(HttpOnly) 우선, 공유 ADMIN 토큰은 부트스트랩/호환용만
4. 익명은 대시보드·Control로 플러그인 상태 검색 불가
5. Gateway MCP 클라이언트 인증·스코프는 데이터 평면에서 강화 (단계적)

## 5. 배포 프로파일

- `gateway`: core + plugin-runtime (공개 가능)
- `admin`: control-plane + dashboard (비공개 권장)

## 6. 로드맵 정렬

- P0: 로그인·세션·RBAC·플러그인 owner · config.json 시크릿 제거 (본 고도화)
- P1: Vault, upstream 주입, Gateway 테넌트 스코프 tools/list
- P2: install-worker 분리, Git allowlist, audit UI
