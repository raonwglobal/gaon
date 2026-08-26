# MCP Plugin Template

이 폴더를 복사해서 새 플러그인을 만드세요.

```bash
cp -r plugins/_template plugins/my-plugin
# plugins/my-plugin/index.ts 수정
# packages/core/src/plugins/index.ts 에 팩토리 등록
```

## 계약 (Contract)

플러그인은 `McpPlugin` 을 구현합니다.

필수:
- `manifest` — id, name, version
- `initialize(config)`
- `listTools()` — 도구 정의 목록
- `callTool(ctx)` — 도구 실행
- `shutdown()`

선택:
- `healthCheck()`
- `registerTools(server)` — 레거시 직접 등록 (보통 불필요)

도구 이름은 PluginManager가 자동으로 `{pluginId}_{toolName}` 으로 접두사를 붙입니다.

## 등록

1. `packages/core/src/plugins/index.ts` 의 `PLUGIN_FACTORIES` 에 추가
2. Control Plane / Dashboard 에서 enable
3. 새 SSE 세션부터 적용
