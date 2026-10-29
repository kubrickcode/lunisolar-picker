# lunisolar-picker

Modern, accessible date pickers for React, with optional Korean lunisolar (음력) calendar support.

- Five pickers: date, date range, month, wheel and time.
- Mouse, keyboard and touch. Bottom sheets on phones.
- Values are canonical strings (`'2026-10-14'`, `'14:30'`) that compare with `===` and parse with Temporal.
- Headless core with React parts, so you can rebuild any picker.
- Korean lunar dates with leap months and 30th days, from KASI data (lunar 1900–2050). Off unless you import it.

```sh
pnpm add @lunisolar-picker/react @lunisolar-picker/core @lunisolar-picker/calendar @lunisolar-picker/theme
```

```css
/* global CSS */
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
```

```tsx
import type { DateString } from '@lunisolar-picker/calendar';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';

export function DueDate() {
  const [value, setValue] = useState<DateString | null>(null);
  return <DatePicker aria-label="Due date" value={value} onValueChange={(next) => setValue(next)} />;
}
```

| Package | Contents |
|---|---|
| [`@lunisolar-picker/calendar`](packages/calendar) | Date values, Gregorian and Korean lunar calendars. No dependencies. |
| [`@lunisolar-picker/core`](packages/core) | Framework-agnostic picker state, constraints, grids and locales. |
| [`@lunisolar-picker/react`](packages/react) | React hooks, parts and finished pickers. |
| [`@lunisolar-picker/theme`](packages/theme) | The Mono theme and the shadcn token bridge. |

Documentation lives in `apps/docs` (`pnpm --filter @lunisolar-picker/docs dev`).

## Development

Requires Node 22.12 or later, pnpm and [just](https://github.com/casey/just).

```sh
just install     # pnpm install --frozen-lockfile
just check       # types, lint, dependency boundaries
just test        # unit, property and browser tests
just build       # build all packages
just fixtures    # build the Next, Vite and Astro fixtures and check their output
just docs-build  # build and check the documentation site
```

한국어 안내: 이 저장소는 양력 picker를 기본으로 하고, 필요할 때 한국 음력(윤달·30일 포함) 입력을 켤 수 있는 React 날짜 picker 라이브러리다. 설계는 `docs/superpowers/specs/`에 있다.
