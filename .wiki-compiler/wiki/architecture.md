# Architecture

## Metadata
- created: 2026-09-15
- aliases: architecture, docs/architecture.md
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/30_doc_architecture.txt

## Related
- [[Control Plane]]
- [[Core]]
- [[Dashboard]]
- [[Gaon Platform]]
- [[Plugin Runtime]]
- [[Prd]]

## Referenced By
- [[Gaon Platform]]

## Body
Documentation file: docs/architecture.md.
Architecture documents Gaon Platform.
References packages: Control Plane, Core, Dashboard, Plugin Runtime.
Excerpt: 이 문서는 기본 MCP SSE 코어(`prd.md`) 위에 **다양한 MCP를 플러그인으로 등록·관리·모니터링할 수 있는 대시보드형 플랫폼**으로 확장하기 위한 설계입니다. - 여러 MCP 서버/도구를 **플러그인** 형태로 등록·활성화·비활성화 - 웹 대시보드에서 설정·세션·로그·메트릭을 한눈에 관리 - 코어(실행) 계층과 관리 계층을 분리하여 확장성·안전성 확보 ```text ┌────────────────────────────────────────────────────────────┐

## Notes
_(add your own notes here -- preserved on recompile)_
