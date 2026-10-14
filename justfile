set shell := ["bash", "-euo", "pipefail", "-c"]

default: check test

install:
    pnpm install --frozen-lockfile

check: typecheck lint deps

typecheck:
    pnpm exec tsc --noEmit -p tsconfig.scripts.json
    pnpm -r run typecheck

lint:
    pnpm exec biome check .

fix:
    pnpm exec biome check --write .

deps:
    pnpm exec depcruise packages scripts --config .dependency-cruiser.cjs

install-browsers:
    pnpm exec playwright install chromium firefox webkit

test:
    pnpm -r run test

build:
    pnpm -r run build

package-check: build
    pnpm -r run package-check

size: build
    pnpm exec tsx scripts/check-bundle-size.ts

compare-intl:
    pnpm --filter @lunisolar-picker/calendar run compare:intl

visual:
    bash scripts/run-visual-tests.sh

visual-update:
    bash scripts/run-visual-tests.sh --update
