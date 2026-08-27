# Docker Images CI

Workflow: [`.github/workflows/docker-images.yml`](../.github/workflows/docker-images.yml)

## Triggers

| Event | Build | Push to GHCR |
|-------|-------|--------------|
| PR → `main` | ✅ | ❌ |
| Push → `main` | ✅ | ✅ (`:latest`, `:main`, `:sha-…`) |
| Tag `v*` | ✅ | ✅ (semver tags) |
| `workflow_dispatch` | ✅ | ✅ (if not from a PR context) |

## Images

| Name | Dockerfile | Context |
|------|------------|---------|
| `core` | `packages/core/Dockerfile` | repo root |
| `control-plane` | `packages/control-plane/Dockerfile` | repo root |
| `dashboard` | `packages/dashboard/Dockerfile` | repo root |
| `plugin-runtime` | `packages/plugin-runtime/Dockerfile` | `packages/plugin-runtime` |

Published as:

```text
ghcr.io/<owner>/<repo>/<image>:<tag>
```

Example for this repo:

```text
ghcr.io/raonwglobal/gaon/core:latest
ghcr.io/raonwglobal/gaon/control-plane:latest
ghcr.io/raonwglobal/gaon/dashboard:latest
ghcr.io/raonwglobal/gaon/plugin-runtime:latest
```

## Pull

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/raonwglobal/gaon/core:latest
```

Package visibility: repository **Settings → Packages** (or each package’s settings).  
First push may require linking the package to the repo and setting visibility.

## Permissions

Workflow uses `packages: write` with `GITHUB_TOKEN`. No extra secrets required for GHCR.
