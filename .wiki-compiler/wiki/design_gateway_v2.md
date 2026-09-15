# Design Gateway V2

## Metadata
- created: 2026-09-15
- aliases: design-gateway-v2, docs/design-gateway-v2.md
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/30_doc_design_gateway_v2.txt

## Related
- [[Core]]
- [[Dashboard]]
- [[Gaon Platform]]

## Referenced By
- [[Gaon Platform]]

## Body
Documentation file: docs/design-gateway-v2.md.
Design Gateway V2 documents Gaon Platform.
References packages: Core, Dashboard.
Excerpt: > 상태: 채택 (2026-08-29) > 목표: 관리 평면과 데이터 평면을 분리하고, 사용자 단위 MCP(플러그인) 관리와 보안을 강화한다. | 영역 | 역할 | |------|------| | **관리 평면** | Dashboard + Control API — 사용자 관리, 커넥터(플러그인) 추가·삭제·설정 | | **데이터 평면** | MCP SSE Gateway (Core) — 외부 클라이언트에 MCP over SSE 제공 (별도 서비스로 배포 가능) |

## Notes
_(add your own notes here -- preserved on recompile)_
