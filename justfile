set shell := ["bash", "-euo", "pipefail", "-c"]

default: check test

install:
    pnpm install --frozen-lockfile

check: typecheck lint deps

typecheck:
    pnpm exec tsc --noEmit -p tsconfig.scripts.json
    pnpm -r --filter "./packages/**" run typecheck

lint:
    pnpm exec biome check .

fix:
    pnpm exec biome check --write .

deps:
    pnpm exec depcruise packages scripts --config .dependency-cruiser.cjs

install-browsers:
    pnpm exec playwright install chromium firefox webkit

test:
    pnpm -r --filter "./packages/**" run test

build:
    pnpm -r --filter "./packages/**" run build

package-check: build
    pnpm -r run package-check

size: build
    pnpm exec tsx scripts/check-bundle-size.ts

# Constraint: fixtures는 배포 산출물(dist)을 소비하므로 build 뒤에만 타입 검사·테스트가 가능함. 그래서 check·test에서 빼고 여기서 돌림
fixtures: build
    pnpm -r --filter "./fixtures/**" run typecheck
    pnpm -r --filter "./fixtures/**" run test
    pnpm -r --filter "./fixtures/**" run build
    pnpm -r --filter "./fixtures/**" run check:markup
    pnpm -r --filter "./fixtures/**" --if-present run check:hydration

# Constraint: 문서 앱도 dist를 소비하고 astro build가 만드는 .astro 타입이 있어야 타입 검사가 되므로 build 뒤에 묶음
docs-build: build
    pnpm --filter @lunisolar-picker/docs run build
    pnpm --filter @lunisolar-picker/docs run typecheck
    pnpm exec tsx scripts/assert-markup.ts apps/docs/dist/getting-started/index.html '<astro-island' 'client="only"'

compare-intl:
    pnpm --filter @lunisolar-picker/calendar run compare:intl

visual:
    bash scripts/run-visual-tests.sh

visual-update:
    bash scripts/run-visual-tests.sh --update
