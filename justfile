set shell := ["bash", "-euo", "pipefail", "-c"]

default: check test

install:
    pnpm install --frozen-lockfile

check: typecheck lint deps

typecheck:
    pnpm -r run typecheck

lint:
    pnpm exec biome check .

fix:
    pnpm exec biome check --write .

deps:
    pnpm exec depcruise packages --config .dependency-cruiser.cjs

test:
    pnpm -r run test
