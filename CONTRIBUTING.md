# Contributing

Thanks for helping. Bug reports, documentation fixes and pull requests are all welcome. For a larger change, open an issue first so we can agree on the approach before you write code.

## Setup

Requires Node 24.11 or later, [pnpm](https://pnpm.io) and [just](https://github.com/casey/just).

```sh
just install     # pnpm install --frozen-lockfile
just check       # types, lint, dependency boundaries
just test        # unit, property and browser tests
just build       # build all packages
just fixtures    # build the Next, Vite and Astro fixtures and check their output
just docs-build  # build and check the documentation site
```

Browser tests need Playwright browsers: `just install-browsers`. Run the docs site locally with `pnpm --filter @lunisolar-picker/docs dev`.

## Repository layout

| Path | Contents |
|---|---|
| `packages/calendar` | Date values, Gregorian and Korean lunar calendars |
| `packages/core` | Framework-agnostic picker state |
| `packages/react` | React hooks, parts and pickers |
| `packages/theme` | The Mono theme |
| `apps/docs` | Documentation site (Astro Starlight) |
| `fixtures` | Next, Vite and Astro apps that consume the built packages |
| `docs/decisions` | Architecture decision records |

## Pull requests

- Run `just check` and `just test` before you push. CI also runs the fixtures, docs build, bundle size budget and package checks.
- If the change affects a published package, add a changeset with `pnpm changeset` and describe the change from a user's point of view. Documentation-only and internal changes don't need one.
- Visual changes: update the screenshots with `just visual-update` (runs in Docker so screenshots render the same on every machine) and include them in the PR.
- Lunar calendar data comes from KASI. Don't edit `dangi-table.generated.ts` by hand; see the `kasi:*` scripts in `packages/calendar`.

Releases are automated; see [docs/releasing.md](docs/releasing.md).
