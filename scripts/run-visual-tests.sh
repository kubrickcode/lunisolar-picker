#!/usr/bin/env bash
set -euo pipefail

# Goal: 기준 이미지를 OS와 상관없이 같은 Linux·글꼴 환경에서 만들고 비교함 (스펙 11장)
IMAGE="mcr.microsoft.com/playwright:v1.64.0-noble"
VITEST_EXTRA_ARGUMENTS="${1:-}"
REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker info >/dev/null 2>&1 || {
  echo "Docker daemon is not running — start Docker Desktop and retry" >&2
  exit 1
}

# node_modules를 볼륨으로 분리하는 이유: macOS용 네이티브 바이너리(esbuild 등)가 Linux 컨테이너에 섞이지 않게 함
docker run --rm --ipc=host \
  -v "${REPOSITORY_ROOT}:/work" -w /work \
  -v lsp-visual-root-modules:/work/node_modules \
  -v lsp-visual-calendar-modules:/work/packages/calendar/node_modules \
  -v lsp-visual-core-modules:/work/packages/core/node_modules \
  -v lsp-visual-react-modules:/work/packages/react/node_modules \
  -v lsp-visual-theme-modules:/work/packages/theme/node_modules \
  "${IMAGE}" \
  bash -c "corepack enable && corepack prepare pnpm@11.28.2 --activate && pnpm install --frozen-lockfile && pnpm --filter @lunisolar-picker/react exec vitest run --config vitest.visual.config.ts ${VITEST_EXTRA_ARGUMENTS}"
