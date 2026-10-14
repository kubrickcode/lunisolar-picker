# M3: React 기반·theme·입력 부품 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@lunisolar-picker/react`의 공통 기반(Provider, 오늘 날짜, store 바인딩, 제어 값, 요소 렌더, data-* 계약), Popover·Sheet, 입력 부품(DateField, DateRangeField, TimeField, Wheel)과 `@lunisolar-picker/theme`의 입력 부품 스타일을 만든다.

**Architecture:** 상태 로직은 모두 `@lunisolar-picker/core` store가 맡고, react는 `useSyncExternalStore`로 store를 구독해 DOM 이벤트를 core 이벤트로 바꿔 보내고 `data-*`·ARIA 속성을 붙여 렌더만 한다. 부품은 스타일이 없고 `data-lsp-part`와 상태 속성만 출력하며, theme의 `mono.css`가 그 속성만 보고 모양을 입힌다. 입력 칸은 `contentEditable` spinbutton이고 글자는 React가 아니라 상태 기준으로 고정한다. 휠 애니메이션은 React 렌더를 거치지 않고 CSS 변수 하나를 직접 갱신한다.

**Tech Stack:** React 19.3.0, @floating-ui/react-dom 2.1.9, vitest 5.0.4 브라우저 모드(@vitest/browser-playwright 5.0.4, playwright 1.64.0, chromium·firefox·webkit), vitest-browser-react 2.3.0, @vitejs/plugin-react 6.1.2, vite 8.3.4, axe-core 4.14.0, tsdown 0.23.1

**Spec:** `docs/superpowers/specs/2026-10-14-lunisolar-picker-design.md` (3장 아키텍처, 7장 React API, 8장 테마, 9장 다국어, 10장 접근성, 11장 테스트)
**계약:** `docs/superpowers/plans/2026-10-14-v1-interface-contract.md` §2(core 사용분), §3, §4
**선행:** M1(calendar) 완료, M2(core) 완료. M2 API는 계약 §2를 따른다고 가정한다.

## Global Constraints

- M1 계획의 Global Constraints(정확한 버전, ESM 전용, 이름·주석·테스트·커밋 규칙, `just check`·`just test` 통과)를 모두 따른다.
- react 패키지: peer `react ^19.0.0`, `react-dom ^19.0.0`. 런타임 의존성은 `@lunisolar-picker/core`, `@lunisolar-picker/calendar`(`workspace:*`), `@floating-ui/react-dom` `2.1.9`뿐. `workspace:*`는 배포 시 pnpm이 정확한 버전으로 바꾼다.
- 빌드 산출 JS 파일마다 첫 줄이 `'use client';`여야 한다(스펙 12장). 소스에는 지시문을 쓰지 않고 tsdown `banner`로 붙인다.
- 지원 브라우저 기준선(스펙 12장): Safari·iOS 15.5+, Chrome 99+, Firefox 112+. CSS에서 단위끼리 나누는 `calc()`, `abs()`, `contenteditable="plaintext-only"`는 쓰지 않는다.
- 모듈 최상위에서 `window`·`document`에 접근하지 않는다. id는 `useId`로 만든다(스펙 SSR 안전성).
- 모든 store는 컴포넌트 인스턴스마다 만든다. 모듈 전역 상태는 DOM 전역(스크롤 잠금 카운트)만 허용한다.
- 부품은 클래스 이름을 출력하지 않는다. `data-lsp-part="<PART_NAMES 중 하나>"`와 `DATA_ATTRIBUTES` 상태 속성만 출력한다. theme 선택자도 이 둘과 `data-theme`, `.dark`만 쓴다.
- boolean 이름 규칙(`is/has/can/should`)의 예외는 HTML 속성과 같은 이름(`disabled`, `readOnly`, `required`, `invalid`)뿐이다.
- 테스트는 vitest 브라우저 모드로 chromium·firefox·webkit 세 곳에서 돈다. 시각 회귀 테스트(`*.visual.test.tsx`)는 기본 실행에서 빼고 Docker에서만 돈다.
- 🟡 core(M2) API를 쓰는 Task는 맨 위에 잠정 표시를 단다. M2 구현이 계약과 다르면 계약 문서를 먼저 고치고 이 계획의 해당 Task를 고친 뒤 진행한다.

## Review Focus

1. **안드로이드 IME 조합 입력**: `beforeinput`을 취소할 수 없는 `insertCompositionText`로 글자가 DOM에 먼저 들어가도, 숫자는 상태에 반영되고 칸의 글자는 상태 기준으로 되돌아가야 한다. Task 6에서 고정
2. **잘못된 제어 값**: `value="2026-1-5"`처럼 정규 형식이 아닌 값이 들어오면 던지지 않고 빈 값으로 다루며 `onInvalidValue`를 입력값마다 한 번만 불러야 한다(다시 렌더해도 반복 호출 없음). Task 3에서 고정
3. **시간대 없는 SSR**: 서버(UTC)와 브라우저 시간대가 달라도 hydration 불일치 오류가 나면 안 된다. Task 2에서 고정
4. **시트를 닫은 뒤 스크롤 위치**: iOS 방식 body 고정 잠금을 풀면 열기 전 스크롤 위치로 정확히 돌아와야 하고, 겹쳐 연 잠금 하나를 풀어도 다른 잠금은 유지되어야 한다. Task 5에서 고정
5. **휠 항목이 바뀌는 순간의 선택**: 음력 1990년 윤5월을 고른 상태에서 연도를 1991년으로 바꾸면 사라진 윤달 대신 5월이 선택되어야 하고, 예전 인덱스의 다른 달이 선택되면 안 된다. Task 9에서 고정

---

## 파일 구조

```
package.json                                   루트 devDependencies 추가 (Task 1)
biome.json                                     react 부품용 a11y 규칙 조정 (Task 1)
justfile                                       install-browsers, visual (Task 1, 10)
scripts/run-visual-tests.sh                    Docker 시각 회귀 실행 (Task 10)
packages/react/
  package.json  tsconfig.json  tsconfig.scripts.json  tsdown.config.ts
  vitest.config.ts  vitest.visual.config.ts  vitest.setup.ts
  scripts/check-use-client.ts                  dist 첫 줄 "use client" 검사
  src/
    index.ts  contract.ts
    contract/data-attributes.ts                DATA_ATTRIBUTES, PART_NAMES, partAttributes
    utilities/                                  merge-props, use-merged-refs, render-element, use-latest-ref,
                                                use-controllable-state, is-development, compact-object, escape-html
    testing/                                    expect-accessible, expect-hydration (테스트 전용, export 안 함)
    settings/                                   shared-picker-props, lunisolar-provider, use-picker-settings, use-picker-context
    today/                                      epoch-day-in-time-zone, use-today
    store/use-store-instance.ts
    value/                                      parse-controlled-value, use-parsed-value, use-value-bridge, format-or-null, hidden-input
    focus/focusable-elements.ts
    popover/                                    use-popover, popover-context, parts
    sheet/                                      scroll-lock, inert-siblings, use-sheet, sheet-context, parts
    presentation/use-presentation.ts
    segments/                                   segment-commands, use-segmented-field
    date-field/                                 use-date-field-core, use-date-field, date-field-context, parts
    date-range-field/                           use-date-range-field, date-range-field-context, parts
    time-field/                                 use-time-field, time-field-context, parts
    wheel/                                      wheel-geometry, use-wheel-motion, use-wheel, parts, use-wheel-date
    visual/                                     *.visual.test.tsx (Task 10)
packages/theme/
  package.json  tsconfig.json  vitest.config.ts
  src/mono.css  src/bridge/shadcn.css
  tests/selector-contract.test.ts
```

---

### Task 1: react 패키지 뼈대, 브라우저 테스트 환경, data-* 계약, 요소 렌더 유틸

**Files:**
- Modify: `package.json`(루트), `biome.json`, `justfile`, `.dependency-cruiser.cjs`
- Create: `packages/react/package.json`, `packages/react/tsconfig.json`, `packages/react/tsconfig.scripts.json`, `packages/react/tsdown.config.ts`, `packages/react/vitest.config.ts`, `packages/react/vitest.setup.ts`, `packages/react/scripts/check-use-client.ts`
- Create: `packages/react/src/contract/data-attributes.ts`, `packages/react/src/contract.ts`, `packages/react/src/index.ts`
- Create: `packages/react/src/utilities/merge-props.ts`, `use-merged-refs.ts`, `render-element.ts`, `use-latest-ref.ts`, `use-controllable-state.ts`, `is-development.ts`, `compact-object.ts`, `escape-html.ts`, `focus-leave.ts`
- Create: `packages/react/src/testing/expect-accessible.ts`
- Test: `packages/react/src/contract/data-attributes.test.ts`, `packages/react/src/utilities/merge-props.test.ts`, `packages/react/src/utilities/render-element.test.tsx`

**Interfaces:**
- Consumes: 없음 (core·calendar는 아직 import하지 않음)
- Produces:
  - `DATA_ATTRIBUTES`, `type DataAttribute`, `PART_NAMES`, `type PartName`, `PART_ATTRIBUTE = 'data-lsp-part'`, `type DataAttributeProps`, `type StateFlags`, `stateAttributes(flags: StateFlags): DataAttributeProps`, `partAttributes(part: PartName, flags?: StateFlags): DataAttributeProps`
  - `createFocusLeaveListener(onFocusLeave: (() => void) | undefined): (event: FocusEvent<HTMLElement>) => void`
  - `mergeProps<Base extends object, Override extends object>(base: Base, override: Override): Base & Override`, `mergeRefs<Element>(...refs): RefCallback<Element>`, `useMergedRefs<Element>(...refs): RefCallback<Element>`
  - `type RenderProp<Props, State> = ReactElement | ((props: Props, state: State) => ReactElement)`, `renderElement<Props extends object, State>(tagName: ElementType, render: RenderProp<Props, State> | undefined, props: Props, state: State): ReactElement`
  - `useLatestRef<Value>(value: Value): RefObject<Value>`
  - `useControllableState<Value>(controlled: Value | undefined, defaultValue: Value, onChange: ((value: Value) => void) | undefined): readonly [Value, (next: Value) => void]`
  - `isDevelopment(): boolean`, `compactObject<Shape extends object>(shape: Shape): Shape`, `escapeHtml(text: string): string`
  - 테스트 헬퍼 `expectNoAxeViolations(container: Element): Promise<void>`

- [ ] **Step 1: 루트 개발 의존성과 공통 설정 수정**

루트 `package.json`의 `devDependencies`에 아래를 추가한다(알파벳 순서 유지, 정확한 버전):
```json
"@types/react": "19.3.0",
"@types/react-dom": "19.3.0",
"@vitejs/plugin-react": "6.1.2",
"@vitest/browser-playwright": "5.0.4",
"axe-core": "4.14.0",
"playwright": "1.64.0",
"react": "19.3.0",
"react-dom": "19.3.0",
"vitest-browser-react": "2.3.0"
```
`vite` 8.3.4는 M2 Task 2에서 이미 루트에 추가했다.
vitest가 브라우저 provider를 선택적 peer로 찾으므로 테스트 도구는 루트에 둔다. 패키지 안의 모듈은 상위 디렉터리의 `node_modules`로 루트 의존성을 찾는다.

`biome.json`에 `overrides`를 추가한다(APG 패턴대로 `div[role=group]`, `span[role=spinbutton]`을 의도적으로 쓰므로 시맨틱 요소 권고를 끈다):
```json
"overrides": [
  {
    "includes": ["packages/react/src/**"],
    "linter": { "rules": { "a11y": { "useSemanticElements": "off" } } }
  }
]
```
그 밖의 a11y 규칙이 걸리면 그 줄에 `// biome-ignore lint/a11y/<규칙>: <WAI-ARIA APG 근거>`를 단다. 규칙을 통째로 끄지 않는다.

`justfile`에 추가:
```make
install-browsers:
    pnpm exec playwright install chromium firefox webkit
```

`.dependency-cruiser.cjs`의 `forbidden`에 추가:
```js
{
  name: 'react-no-internal-imports-of-other-packages',
  comment: '다른 패키지는 공개 진입점으로만 쓴다 (스펙 3.2). source 조건으로 공개 진입점도 src 파일로 해석되므로 진입점 파일은 허용',
  severity: 'error',
  from: { path: '^packages/react/src' },
  to: {
    path: '^packages/(calendar|core)/src/',
    pathNot: '^packages/calendar/src/(index|dangi/index)\\.ts$|^packages/core/src/(index|locales/(ko|en|ja))\\.ts$',
  },
},
{
  name: 'react-src-no-node-builtins',
  severity: 'error',
  from: { path: '^packages/react/src' },
  to: { dependencyTypes: ['core'] },
},
```

- [ ] **Step 2: source 조건 확인**

> 정합성 조정(2026-10-14): `@lunisolar-picker/source` 조건은 M1 Task 1(`tsconfig.base.json`의 `customConditions`, calendar `exports`)과 M2 Task 2(core `exports`)가 이미 설정했다. 이 단계에서는 확인만 한다.

Run: `grep -c '"@lunisolar-picker/source"' packages/calendar/package.json packages/core/package.json && grep -c customConditions tsconfig.base.json`
Expected: calendar 2, core 4, tsconfig 1. 하나라도 0이면 앞 마일스톤 계획의 해당 단계를 먼저 반영한다.

- [ ] **Step 3: react 패키지 설정 파일 작성**

`packages/react/package.json`:
```json
{
  "name": "@lunisolar-picker/react",
  "version": "0.0.0",
  "description": "Unstyled React hooks and parts for lunisolar-picker",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "src", "!src/**/*.test.ts", "!src/**/*.test.tsx", "!src/testing", "!src/visual"],
  "exports": {
    ".": { "@lunisolar-picker/source": "./src/index.ts", "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./contract": { "@lunisolar-picker/source": "./src/contract.ts", "types": "./dist/contract.d.ts", "default": "./dist/contract.js" },
    "./package.json": "./package.json"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@floating-ui/react-dom": "2.1.9",
    "@lunisolar-picker/calendar": "workspace:*",
    "@lunisolar-picker/core": "workspace:*"
  },
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "test:visual": "vitest run --config vitest.visual.config.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.scripts.json",
    "package-check": "publint --strict && attw --pack . --profile esm-only && tsx scripts/check-use-client.ts"
  }
}
```

`packages/react/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": []
  },
  "include": ["src"]
}
```

`packages/react/tsconfig.scripts.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "types": ["node"],
    "isolatedDeclarations": false,
    "declaration": false
  },
  "include": ["scripts", "*.config.ts", "vitest.setup.ts"]
}
```

`packages/react/tsdown.config.ts`:
```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', contract: 'src/contract.ts' },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
  // Constraint: 번들러가 소스 모듈의 지시문을 지우므로 산출 청크마다 붙임. RSC 앱에서 부품이 클라이언트 경계가 되어야 함 (스펙 12장)
  banner: { js: "'use client';" },
});
```

`packages/react/vitest.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['@lunisolar-picker/source', ...defaultClientConditions] },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.visual.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
});
```

`packages/react/vitest.setup.ts`:
```ts
import fc from 'fast-check';
import 'vitest-browser-react';

// Constraint: 성질 테스트 실패를 그대로 재현할 수 있도록 시드를 고정함
const DEFAULT_SEED = 20261014;

fc.configureGlobal({ seed: DEFAULT_SEED });
```

`packages/react/scripts/check-use-client.ts`:
```ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USE_CLIENT_PATTERN = /^(['"])use client\1;?/;
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(packageRoot, 'dist');

async function checkUseClientDirectives(): Promise<void> {
  const javascriptFiles = (await readdir(distDirectory)).filter((fileName) => fileName.endsWith('.js'));
  if (javascriptFiles.length === 0) throw new Error('dist has no .js files; run the build first');
  const missingFiles: string[] = [];
  for (const fileName of javascriptFiles) {
    const source = await readFile(path.join(distDirectory, fileName), 'utf8');
    if (!USE_CLIENT_PATTERN.test(source)) missingFiles.push(fileName);
  }
  if (missingFiles.length > 0) throw new Error(`"use client" is missing at the top of: ${missingFiles.join(', ')}`);
  console.info(`"use client" is the first statement in all ${javascriptFiles.length} files`);
}

try {
  await checkUseClientDirectives();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
```

- [ ] **Step 4: 설치와 브라우저 내려받기**

Run: `pnpm install && just install-browsers`
Expected: 오류 없음. Playwright가 chromium·firefox·webkit을 내려받는다.

- [ ] **Step 5: 실패하는 테스트 작성**

`packages/react/src/contract/data-attributes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DATA_ATTRIBUTES, PART_NAMES, partAttributes, stateAttributes } from './data-attributes';

describe('data-attributes', () => {
  it('renders state flags alone for elements that another part already names', () => {
    expect(stateAttributes({ selected: true, disabled: false, slide: undefined })).toEqual({ 'data-selected': '' });
  });

  it('marks the part and renders true flags as empty attributes', () => {
    expect(partAttributes('date-field-segment', { focused: true, placeholder: false, invalid: undefined })).toEqual({
      'data-lsp-part': 'date-field-segment',
      'data-focused': '',
    });
  });

  it('renders string and number flags as attribute values', () => {
    expect(partAttributes('calendar-cell', { weekday: 0, calendar: 'dangi' })).toEqual({
      'data-lsp-part': 'calendar-cell',
      'data-weekday': '0',
      'data-calendar': 'dangi',
    });
  });

  it('keeps every attribute and part name unique', () => {
    expect(new Set(DATA_ATTRIBUTES).size).toBe(DATA_ATTRIBUTES.length);
    expect(new Set(PART_NAMES).size).toBe(PART_NAMES.length);
  });
});
```

`packages/react/src/utilities/merge-props.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { mergeProps, mergeRefs } from './merge-props';

describe('mergeProps', () => {
  it('joins class names and merges styles with the override winning', () => {
    const merged = mergeProps({ className: 'part', style: { color: 'red', margin: 0 } }, { className: 'app', style: { color: 'blue' } });

    expect(merged).toEqual({ className: 'part app', style: { color: 'blue', margin: 0 } });
  });

  it('runs the app handler first and skips the part handler after preventDefault', () => {
    const calls: string[] = [];
    const merged = mergeProps(
      { onClick: () => calls.push('part') },
      {
        onClick: (event: { preventDefault: () => void }) => {
          calls.push('app');
          event.preventDefault();
        },
      },
    );
    let isPrevented = false;

    merged.onClick({ preventDefault: () => { isPrevented = true; }, isDefaultPrevented: () => isPrevented } as never);

    expect(calls).toEqual(['app']);
  });

  it('runs both handlers when the app handler does not prevent default', () => {
    const partHandler = vi.fn();
    const appHandler = vi.fn();
    const merged = mergeProps({ onKeyDown: partHandler }, { onKeyDown: appHandler });

    merged.onKeyDown({ isDefaultPrevented: () => false } as never);

    expect(appHandler).toHaveBeenCalledOnce();
    expect(partHandler).toHaveBeenCalledOnce();
  });

  it('keeps the base value when the override is undefined', () => {
    expect(mergeProps({ id: 'part' }, { id: undefined })).toEqual({ id: 'part' });
  });
});

describe('mergeRefs', () => {
  it('assigns object and callback refs and clears them on cleanup', () => {
    const objectRef = { current: null as string | null };
    const callbackRef = vi.fn();
    const cleanup = mergeRefs<string>(objectRef, callbackRef)('node');

    expect(objectRef.current).toBe('node');
    expect(callbackRef).toHaveBeenLastCalledWith('node');

    if (typeof cleanup === 'function') cleanup();

    expect(objectRef.current).toBeNull();
    expect(callbackRef).toHaveBeenLastCalledWith(null);
  });
});
```

`packages/react/src/utilities/render-element.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { renderElement } from './render-element';

function Part({ render: renderProp }: { render?: Parameters<typeof renderElement>[1] }) {
  return renderElement('button', renderProp, { type: 'button', className: 'part', 'data-lsp-part': 'popover-trigger', children: 'Open' }, { isOpen: false });
}

describe('renderElement', () => {
  it('renders the default tag with the part props', async () => {
    const screen = await render(<Part />);

    await expect.element(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('data-lsp-part', 'popover-trigger');
    await expectNoAxeViolations(screen.container);
  });

  it('merges part props into an element passed as render', async () => {
    const screen = await render(<Part render={<a href="#chip" className="chip" />} />);
    const link = screen.getByRole('link', { name: 'Open' });

    await expect.element(link).toHaveClass('part');
    await expect.element(link).toHaveClass('chip');
  });

  it('lets a render function build the element from props and state', async () => {
    const screen = await render(
      <Part render={(props, state) => <span {...(props as object)} data-open={String((state as { isOpen: boolean }).isOpen)} />} />,
    );

    await expect.element(screen.getByText('Open')).toHaveAttribute('data-open', 'false');
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/contract src/utilities`
Expected: FAIL — `Failed to resolve import "./data-attributes"` 등

- [ ] **Step 7: 구현**

`packages/react/src/contract/data-attributes.ts`:
```ts
// Goal: 부품과 theme이 공유하는 공개 스타일 계약의 단일 정의 (스펙 7.4)
export const DATA_ATTRIBUTES = [
  'data-selected',
  'data-today',
  'data-disabled',
  'data-readonly',
  'data-outside',
  'data-in-range',
  'data-range-start',
  'data-range-end',
  'data-preview',
  'data-invalid',
  'data-focused',
  'data-open',
  'data-placeholder',
  'data-calendar',
  'data-view',
  'data-weekday',
] as const;

export type DataAttribute = (typeof DATA_ATTRIBUTES)[number];

export const PART_ATTRIBUTE = 'data-lsp-part';

export const PART_NAMES = [
  'calendar',
  'calendar-header',
  'calendar-heading',
  'calendar-nav-button',
  'calendar-today-button',
  'calendar-toggle',
  'calendar-view-button',
  'calendar-grid',
  'calendar-head-cell',
  'calendar-cell',
  'calendar-month-grid',
  'calendar-year-grid',
  'date-field',
  'date-field-segment',
  'date-field-separator',
  'date-field-leap-toggle',
  'date-range-field',
  'time-field',
  'time-field-segment',
  'time-field-separator',
  'wheel',
  'wheel-column',
  'wheel-track',
  'wheel-item',
  'wheel-highlight',
  'popover',
  'popover-trigger',
  'sheet',
  'sheet-backdrop',
  'picker-footer',
  'picker-presets',
] as const;

export type PartName = (typeof PART_NAMES)[number];

type StateFlagName = DataAttribute extends `data-${infer Name}` ? Name : never;

export type StateFlags = Partial<Record<StateFlagName, boolean | string | number | null | undefined>>;

export type DataAttributeProps = { readonly 'data-lsp-part'?: PartName } & Partial<Record<DataAttribute, string>>;

export function stateAttributes(flags: StateFlags): DataAttributeProps {
  const attributes: Record<string, string> = {};
  for (const [name, flag] of Object.entries(flags)) {
    if (flag === true) attributes[`data-${name}`] = '';
    else if (typeof flag === 'string' || typeof flag === 'number') attributes[`data-${name}`] = String(flag);
  }
  return attributes as DataAttributeProps;
}

export function partAttributes(part: PartName, flags: StateFlags = {}): DataAttributeProps {
  return { [PART_ATTRIBUTE]: part, ...stateAttributes(flags) } as DataAttributeProps;
}
```

`packages/react/src/contract.ts`:
```ts
export type { DataAttribute, DataAttributeProps, PartName, StateFlags } from './contract/data-attributes';
export { DATA_ATTRIBUTES, PART_ATTRIBUTE, PART_NAMES, partAttributes, stateAttributes } from './contract/data-attributes';
```

`packages/react/src/utilities/merge-props.ts`:
```ts
import type { Ref, RefCallback } from 'react';

type PropsRecord = Record<string, unknown>;
type EventLike = { readonly isDefaultPrevented?: () => boolean; readonly defaultPrevented?: boolean } | undefined;
type EventHandler = (event: EventLike) => void;

const EVENT_HANDLER_PATTERN = /^on[A-Z]/;

export function mergeProps<Base extends object, Override extends object>(base: Base, override: Override): Base & Override {
  const merged: PropsRecord = { ...base };
  for (const [key, overrideValue] of Object.entries(override)) {
    merged[key] = mergeProp(key, (base as PropsRecord)[key], overrideValue);
  }
  return merged as Base & Override;
}

export function mergeRefs<Element>(...refs: readonly (Ref<Element> | undefined)[]): RefCallback<Element> {
  return (node) => {
    const cleanups = refs.map((ref) => assignRef(ref, node));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };
}

function mergeProp(key: string, baseValue: unknown, overrideValue: unknown): unknown {
  if (overrideValue === undefined) return baseValue;
  if (baseValue === undefined) return overrideValue;
  if (key === 'className') return `${String(baseValue)} ${String(overrideValue)}`;
  if (key === 'style') return { ...(baseValue as object), ...(overrideValue as object) };
  if (key === 'ref') return mergeRefs(baseValue as Ref<unknown>, overrideValue as Ref<unknown>);
  const isHandlerPair = EVENT_HANDLER_PATTERN.test(key) && typeof baseValue === 'function' && typeof overrideValue === 'function';
  if (isHandlerPair) return chainEventHandlers(baseValue as EventHandler, overrideValue as EventHandler);
  return overrideValue;
}

// Goal: 앱이 넘긴 핸들러가 먼저 돌고, 거기서 preventDefault 하면 부품의 기본 동작을 건너뜀
function chainEventHandlers(partHandler: EventHandler, appHandler: EventHandler): EventHandler {
  return (event) => {
    appHandler(event);
    const isPrevented = event?.isDefaultPrevented?.() ?? event?.defaultPrevented ?? false;
    if (!isPrevented) partHandler(event);
  };
}

function assignRef<Element>(ref: Ref<Element> | undefined, node: Element | null): () => void {
  if (typeof ref === 'function') {
    const cleanup = ref(node);
    return typeof cleanup === 'function' ? cleanup : () => ref(null);
  }
  if (ref) {
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }
  return () => {};
}
```

`packages/react/src/utilities/use-merged-refs.ts`:
```ts
import { type Ref, type RefCallback, useMemo } from 'react';
import { mergeRefs } from './merge-props';

export function useMergedRefs<Element>(...refs: readonly (Ref<Element> | undefined)[]): RefCallback<Element> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: 전달된 ref 목록 자체가 의존성
  return useMemo(() => mergeRefs(...refs), refs);
}
```

`packages/react/src/utilities/render-element.ts`:
```ts
import { type ElementType, type ReactElement, cloneElement, createElement, isValidElement } from 'react';
import { mergeProps } from './merge-props';

export type RenderProp<Props, State> = ReactElement | ((props: Props, state: State) => ReactElement);

// Goal: 앱이 부품의 DOM 요소를 자기 컴포넌트로 바꾸되 부품의 속성·이벤트·ref는 유지하게 함 (스펙 7.3 render prop)
export function renderElement<Props extends object, State>(
  tagName: ElementType,
  render: RenderProp<Props, State> | undefined,
  props: Props,
  state: State,
): ReactElement {
  if (typeof render === 'function') return render(props, state);
  if (isValidElement(render)) {
    return cloneElement(render, mergeProps(props, render.props as object) as Record<string, unknown>);
  }
  return createElement(tagName, props);
}
```

`packages/react/src/utilities/use-latest-ref.ts`:
```ts
import { type RefObject, useLayoutEffect, useRef } from 'react';

// Goal: 이펙트·네이티브 이벤트 리스너가 다시 등록되지 않고도 최신 값과 콜백을 읽게 함
export function useLatestRef<Value>(value: Value): RefObject<Value> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
```

`packages/react/src/utilities/use-controllable-state.ts`:
```ts
import { useCallback, useState } from 'react';
import { useLatestRef } from './use-latest-ref';

export function useControllableState<Value>(
  controlled: Value | undefined,
  defaultValue: Value,
  onChange: ((value: Value) => void) | undefined,
): readonly [Value, (next: Value) => void] {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const current = isControlled ? controlled : uncontrolled;
  const currentRef = useLatestRef(current);
  const onChangeRef = useLatestRef(onChange);
  const setValue = useCallback(
    (next: Value) => {
      if (Object.is(next, currentRef.current)) return;
      if (!isControlled) setUncontrolled(next);
      onChangeRef.current?.(next);
    },
    [isControlled, currentRef, onChangeRef],
  );
  return [current, setValue];
}
```

`packages/react/src/utilities/is-development.ts`:
```ts
declare const process: { readonly env: { readonly NODE_ENV?: string } } | undefined;

// Constraint: 소비자 번들러가 process.env.NODE_ENV를 치환함. 치환되지 않는 환경(브라우저 직접 로드)에서는 개발 경고를 끔
export function isDevelopment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}
```

`packages/react/src/utilities/compact-object.ts`:
```ts
// Constraint: exactOptionalPropertyTypes 아래에서 undefined 값을 가진 키를 core 옵션 객체에 넘기지 않으려고 제거함
export function compactObject<Shape extends object>(shape: Shape): Shape {
  return Object.fromEntries(Object.entries(shape).filter(([, value]) => value !== undefined)) as Shape;
}
```

`packages/react/src/utilities/escape-html.ts`:
```ts
const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}
```

`packages/react/src/utilities/focus-leave.ts`:
```ts
import type { FocusEvent } from 'react';

// Goal: 포커스가 부품 그룹 안에서 칸끼리 옮겨 다닐 때는 조용하고, 그룹 밖으로 나갈 때만 한 번 알림. react-hook-form의 touched 판정에 씀
export function createFocusLeaveListener(onFocusLeave: (() => void) | undefined): (event: FocusEvent<HTMLElement>) => void {
  return (event) => {
    if (!onFocusLeave) return;
    const nextFocus = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextFocus)) onFocusLeave();
  };
}
```

`packages/react/src/testing/expect-accessible.ts`:
```ts
import axe from 'axe-core';
import { expect } from 'vitest';

export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { resultTypes: ['violations'] });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}
```

`packages/react/src/index.ts`:
```ts
export type { DataAttribute, DataAttributeProps, PartName } from './contract/data-attributes';
export { DATA_ATTRIBUTES, PART_NAMES } from './contract/data-attributes';
export type { RenderProp } from './utilities/render-element';
```

- [ ] **Step 8: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/contract src/utilities`
Expected: chromium·firefox·webkit 세 곳 모두 PASS

- [ ] **Step 9: 빌드와 "use client" 확인**

Run: `pnpm --filter @lunisolar-picker/react run build && head -c 14 packages/react/dist/index.js && pnpm --filter @lunisolar-picker/react exec tsx scripts/check-use-client.ts`
Expected: `'use client';`로 시작, `"use client" is the first statement in all <N> files`

- [ ] **Step 10: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 11: 커밋**

```bash
git add package.json pnpm-lock.yaml biome.json justfile .dependency-cruiser.cjs packages/react
ALLOW_COMMIT=1 git commit -m "chore: React 부품이 스타일 계약과 클라이언트 경계를 지키며 세 브라우저에서 검증되도록 react 패키지 기반 마련" -m "- theme이 기댈 data-* 속성과 부품 이름을 한 곳에서 정의해 부품과 CSS가 어긋나지 않게 함.
- 번들러가 지시문을 지우는 문제를 피하려고 산출 청크마다 use client를 붙이고 빌드 후 검사하게 함.
- 워크스페이스에서 빌드 없이 소스를 쓰도록 source 조건을 두고, 상호작용 테스트는 chromium·firefox·webkit에서 돌게 함."
```

---

### Task 2: Provider, 설정 해석, 오늘 날짜, SSR 검사 도구

> 🟡 잠정: M2 구현 결과에 따라 `LocaleData`, `Weekday`, 로케일 subpath 이름(`@lunisolar-picker/core/locales/en`)이 바뀔 수 있음

**Files:**
- Create: `packages/react/src/settings/shared-picker-props.ts`, `lunisolar-provider.tsx`, `use-picker-settings.ts`
- Create: `packages/react/src/today/epoch-day-in-time-zone.ts`, `use-today.ts`
- Create: `packages/react/src/testing/expect-hydration.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/today/epoch-day-in-time-zone.test.ts`, `packages/react/src/today/use-today.test.tsx`, `packages/react/src/settings/use-picker-settings.test.tsx`

**Interfaces:**
- Consumes: calendar `gregory`, `parseDate`, `epochDayFromCivil`, `EpochDay`, `CalendarSystem`, `ValidationReason`, `LunisolarPickerError`; core `LocaleData`, `Weekday`, `en`
- Produces:
  - `interface SharedPickerProps` (계약 §3.1 + `onBlur`), `interface ValueChangeDetails { readonly validity: Validity }`
  - `interface LunisolarProviderProps`, `LunisolarProvider(props): ReactElement`
  - `interface PickerSettings { readonly locale: LocaleData; readonly timeZone: string | undefined; readonly todayEpochDay: EpochDay; readonly weekStartsOn: Weekday; readonly calendars: readonly CalendarSystem[] }`
  - `usePickerSettings(props: SharedPickerProps): PickerSettings`, `withGregorian(calendars: readonly CalendarSystem[] | undefined): readonly CalendarSystem[]`
  - `epochDayInTimeZone(instantMilliseconds: number, timeZone: string | undefined): EpochDay`
  - `useToday(timeZone: string | undefined, today: string | undefined): EpochDay`
  - 테스트 헬퍼 `renderWithHydration(element: ReactElement): Promise<HydrationResult>` (`{ container, recoverableErrors, unmount }`)

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/today/epoch-day-in-time-zone.test.ts`:
```ts
import { epochDayFromCivil } from '@lunisolar-picker/calendar';
import { describe, expect, it } from 'vitest';
import { epochDayInTimeZone } from './epoch-day-in-time-zone';

describe('epochDayInTimeZone', () => {
  const instant = Date.UTC(2026, 9, 14, 15, 30);

  it.each([
    ['UTC', epochDayFromCivil(2026, 10, 14)],
    ['Asia/Seoul', epochDayFromCivil(2026, 10, 15)],
    ['America/Los_Angeles', epochDayFromCivil(2026, 10, 14)],
  ])('reads the civil date of the instant in %s', (timeZone, expected) => {
    expect(epochDayInTimeZone(instant, timeZone)).toBe(expected);
  });

  it('reads the previous day in a zone behind UTC near midnight', () => {
    expect(epochDayInTimeZone(Date.UTC(2026, 9, 14, 5, 0), 'America/Los_Angeles')).toBe(epochDayFromCivil(2026, 10, 13));
  });
});
```

`packages/react/src/today/use-today.test.tsx`:
```tsx
import { epochDayFromCivil } from '@lunisolar-picker/calendar';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { renderWithHydration } from '../testing/expect-hydration';
import { useToday } from './use-today';

function TodayProbe({ timeZone, today }: { timeZone?: string; today?: string }) {
  return <output>{useToday(timeZone, today)}</output>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useToday', () => {
  it('uses the fixed today string when given', async () => {
    const screen = await render(<TodayProbe today="2026-10-14" />);

    await expect.element(screen.getByRole('status')).toHaveTextContent(String(epochDayFromCivil(2026, 10, 14)));
  });

  it('throws for a fixed today that is not a canonical date', () => {
    expect(() => renderToThrow(<TodayProbe today="2026-1-5" />)).toThrow(/today must be/);
  });

  it('moves to the next day after midnight in the given time zone', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-14T14:59:30Z'));
    const screen = await render(<TodayProbe timeZone="Asia/Seoul" />);

    await expect.element(screen.getByRole('status')).toHaveTextContent(String(epochDayFromCivil(2026, 10, 14)));

    await vi.advanceTimersByTimeAsync(60_000);

    await expect.element(screen.getByRole('status')).toHaveTextContent(String(epochDayFromCivil(2026, 10, 15)));
  });

  it('hydrates without a mismatch when neither a time zone nor today is given', async () => {
    const { recoverableErrors, unmount } = await renderWithHydration(<TodayProbe />);

    expect(recoverableErrors).toEqual([]);
    unmount();
  });
});

function renderToThrow(element: ReactElement): void {
  renderToString(element);
}
```

`packages/react/src/settings/use-picker-settings.test.tsx`:
```tsx
import { epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { LunisolarProvider } from './lunisolar-provider';
import type { SharedPickerProps } from './shared-picker-props';
import { usePickerSettings, withGregorian } from './use-picker-settings';

function SettingsProbe(props: SharedPickerProps) {
  const settings = usePickerSettings(props);
  return (
    <output>
      {JSON.stringify({
        locale: settings.locale.id,
        timeZone: settings.timeZone ?? null,
        today: settings.todayEpochDay,
        weekStartsOn: settings.weekStartsOn,
        calendars: settings.calendars.map((calendar) => calendar.id),
      })}
    </output>
  );
}

async function readSettings(element: React.ReactElement): Promise<Record<string, unknown>> {
  const screen = await render(element);
  return JSON.parse(screen.getByRole('status').element().textContent ?? '{}') as Record<string, unknown>;
}

describe('usePickerSettings', () => {
  it('falls back to English, the locale week start, and the Gregorian calendar', async () => {
    const settings = await readSettings(<SettingsProbe today="2026-10-14" />);

    expect(settings).toEqual({
      locale: 'en',
      timeZone: null,
      today: epochDayFromCivil(2026, 10, 14),
      weekStartsOn: 0,
      calendars: ['gregory'],
    });
  });

  it('takes provider settings and lets component props override them', async () => {
    const settings = await readSettings(
      <LunisolarProvider locale={ko} timeZone="Asia/Seoul" weekStartsOn={1} calendars={[dangi]} today="2026-10-14">
        <SettingsProbe weekStartsOn={0} />
      </LunisolarProvider>,
    );

    expect(settings).toMatchObject({ locale: 'ko', timeZone: 'Asia/Seoul', weekStartsOn: 0, calendars: ['gregory', 'dangi'] });
  });
});

describe('withGregorian', () => {
  it('always puts the Gregorian calendar first and drops duplicates', () => {
    expect(withGregorian([dangi, gregory, dangi]).map((calendar) => calendar.id)).toEqual(['gregory', 'dangi']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/today src/settings`
Expected: FAIL — `Failed to resolve import "./epoch-day-in-time-zone"` 등

- [ ] **Step 3: 구현**

`packages/react/src/settings/shared-picker-props.ts`:
```ts
import type { CalendarSystem, ValidationReason } from '@lunisolar-picker/calendar';
import type { LocaleData, Validity, Weekday } from '@lunisolar-picker/core';

export interface ValueChangeDetails {
  readonly validity: Validity;
}

export interface SharedPickerProps {
  readonly locale?: LocaleData | undefined;
  readonly timeZone?: string | undefined;
  readonly today?: string | undefined;
  readonly weekStartsOn?: Weekday | undefined;
  readonly calendars?: readonly CalendarSystem[] | undefined;
  readonly disabled?: boolean | undefined;
  readonly readOnly?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly name?: string | undefined;
  readonly form?: string | undefined;
  readonly onInvalidValue?: ((input: string, reason: ValidationReason) => void) | undefined;
  // Goal: 포커스가 부품 전체를 벗어날 때 한 번. react-hook-form Controller의 field.onBlur를 그대로 연결함
  readonly onBlur?: (() => void) | undefined;
}
```

`packages/react/src/settings/lunisolar-provider.tsx`:
```tsx
import type { CalendarSystem } from '@lunisolar-picker/calendar';
import type { LocaleData, Weekday } from '@lunisolar-picker/core';
import { type ReactElement, type ReactNode, createContext, useMemo } from 'react';

export interface LunisolarSettings {
  readonly locale?: LocaleData | undefined;
  readonly timeZone?: string | undefined;
  readonly today?: string | undefined;
  readonly weekStartsOn?: Weekday | undefined;
  readonly calendars?: readonly CalendarSystem[] | undefined;
}

export interface LunisolarProviderProps extends LunisolarSettings {
  readonly children: ReactNode;
}

export const LunisolarSettingsContext = createContext<LunisolarSettings>({});

export function LunisolarProvider({ children, locale, timeZone, today, weekStartsOn, calendars }: LunisolarProviderProps): ReactElement {
  const settings = useMemo(
    () => ({ locale, timeZone, today, weekStartsOn, calendars }),
    [locale, timeZone, today, weekStartsOn, calendars],
  );
  return <LunisolarSettingsContext value={settings}>{children}</LunisolarSettingsContext>;
}
```

`packages/react/src/settings/use-picker-settings.ts`:
```ts
import { type CalendarSystem, type EpochDay, gregory } from '@lunisolar-picker/calendar';
import type { LocaleData, Weekday } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { useContext, useMemo } from 'react';
import { useToday } from '../today/use-today';
import { LunisolarSettingsContext } from './lunisolar-provider';
import type { SharedPickerProps } from './shared-picker-props';

export interface PickerSettings {
  readonly locale: LocaleData;
  readonly timeZone: string | undefined;
  readonly todayEpochDay: EpochDay;
  readonly weekStartsOn: Weekday;
  readonly calendars: readonly CalendarSystem[];
}

export function usePickerSettings(props: SharedPickerProps): PickerSettings {
  const provided = useContext(LunisolarSettingsContext);
  const locale = props.locale ?? provided.locale ?? en;
  const timeZone = props.timeZone ?? provided.timeZone;
  const todayEpochDay = useToday(timeZone, props.today ?? provided.today);
  const weekStartsOn = props.weekStartsOn ?? provided.weekStartsOn ?? locale.weekStartsOn;
  const requestedCalendars = props.calendars ?? provided.calendars;
  const calendars = useMemo(() => withGregorian(requestedCalendars), [requestedCalendars]);
  return useMemo(
    () => ({ locale, timeZone, todayEpochDay, weekStartsOn, calendars }),
    [locale, timeZone, todayEpochDay, weekStartsOn, calendars],
  );
}

// Constraint: 양력은 항상 첫 번째. 화면 기본값과 값 해석의 기준이 되기 때문 (계약 §2.2)
export function withGregorian(calendars: readonly CalendarSystem[] | undefined): readonly CalendarSystem[] {
  const others = (calendars ?? []).filter((calendar) => calendar.id !== gregory.id);
  const uniqueOthers = others.filter((calendar, index) => others.findIndex((other) => other.id === calendar.id) === index);
  return [gregory, ...uniqueOthers];
}
```

`packages/react/src/today/epoch-day-in-time-zone.ts`:
```ts
import { type EpochDay, epochDayFromCivil } from '@lunisolar-picker/calendar';

const LOCAL_TIME_ZONE_KEY = 'local';
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function epochDayInTimeZone(instantMilliseconds: number, timeZone: string | undefined): EpochDay {
  const parts = formatterFor(timeZone).formatToParts(instantMilliseconds);
  const partValue = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value);
  return epochDayFromCivil(partValue('year'), partValue('month'), partValue('day'));
}

function formatterFor(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? LOCAL_TIME_ZONE_KEY;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const baseOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-US', timeZone === undefined ? baseOptions : { ...baseOptions, timeZone });
  formatterCache.set(key, formatter);
  return formatter;
}
```

`packages/react/src/today/use-today.ts`:
```ts
import { type EpochDay, LunisolarPickerError, parseDate } from '@lunisolar-picker/calendar';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { epochDayInTimeZone } from './epoch-day-in-time-zone';

const TODAY_CHECK_INTERVAL_MILLISECONDS = 60_000;
const SERVER_FALLBACK_TIME_ZONE = 'UTC';

export function useToday(timeZone: string | undefined, today: string | undefined): EpochDay {
  const fixedEpochDay = useMemo(() => parseFixedToday(today), [today]);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (fixedEpochDay !== null) return () => {};
      const timer = setInterval(onChange, TODAY_CHECK_INTERVAL_MILLISECONDS);
      return () => clearInterval(timer);
    },
    [fixedEpochDay],
  );
  const readClientToday = (): EpochDay => fixedEpochDay ?? epochDayInTimeZone(Date.now(), timeZone);
  // Constraint: 서버(Cloudflare 등)는 UTC로 돈다. 시간대가 없으면 서버 렌더와 hydration 첫 렌더를 UTC로 맞추고, 그 뒤 브라우저 시간대로 바꿈 (스펙 6.2)
  const readServerToday = (): EpochDay => fixedEpochDay ?? epochDayInTimeZone(Date.now(), timeZone ?? SERVER_FALLBACK_TIME_ZONE);
  return useSyncExternalStore(subscribe, readClientToday, readServerToday);
}

function parseFixedToday(today: string | undefined): EpochDay | null {
  if (today === undefined) return null;
  const parsed = parseDate(today);
  if (!parsed.isOk) throw new LunisolarPickerError(`today must be a YYYY-MM-DD date string, received "${today}"`);
  return parsed.value.epochDay;
}
```

`packages/react/src/testing/expect-hydration.tsx`:
```tsx
import type { ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

export interface HydrationResult {
  readonly container: HTMLElement;
  readonly recoverableErrors: readonly unknown[];
  unmount(): void;
}

const HYDRATION_SETTLE_FRAMES = 2;

export async function renderWithHydration(element: ReactElement): Promise<HydrationResult> {
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.append(container);
  const recoverableErrors: unknown[] = [];
  const root = hydrateRoot(container, element, { onRecoverableError: (error) => recoverableErrors.push(error) });
  for (let frame = 0; frame < HYDRATION_SETTLE_FRAMES; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return {
    container,
    recoverableErrors,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}
```

`packages/react/src/index.ts`에 추가:
```ts
export type { LunisolarProviderProps } from './settings/lunisolar-provider';
export { LunisolarProvider } from './settings/lunisolar-provider';
export type { SharedPickerProps, ValueChangeDetails } from './settings/shared-picker-props';
export { useToday } from './today/use-today';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/today src/settings`
Expected: PASS (세 브라우저)

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 서버와 브라우저 시간대가 달라도 오늘 날짜가 어긋나지 않는 Provider 설정 지원" -m "- Cloudflare 같은 UTC 서버와 한국 브라우저가 다른 날을 그려 hydration이 깨지지 않도록 서버 렌더와 첫 hydration은 UTC나 지정 시간대로 맞춤.
- 로케일·시간대·주 시작·역법을 Provider와 컴포넌트 prop에서 한 번에 해석하고 양력을 항상 첫 역법으로 둠."
```

---

### Task 3: store 바인딩, 제어 값 다리, hidden input

> 🟡 잠정: M2 구현 결과에 따라 `createStore`·`Reducer`·`PickerContext`·`resolveConstraints`·`findCalendar`의 시그니처가 바뀔 수 있음

**Files:**
- Create: `packages/react/src/store/use-store-instance.ts`, `packages/react/src/settings/use-picker-context.ts`
- Create: `packages/react/src/value/parse-controlled-value.ts`, `use-parsed-value.ts`, `use-value-bridge.ts`, `format-or-null.ts`, `hidden-input.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/store/use-store-instance.test.tsx`, `packages/react/src/value/parse-controlled-value.test.ts`, `packages/react/src/value/use-parsed-value.test.tsx`, `packages/react/src/value/use-value-bridge.test.tsx`, `packages/react/src/value/hidden-input.test.tsx`

**Interfaces:**
- Consumes: core `createStore`, `Reducer`, `PickerContext`, `CommitMode`, `RangeConstraints`, `resolveConstraints`, `findCalendar`; calendar `parseDate`, `parseTime`, `normalizeDateRange`, `formatDate`, `DateString`, `TimeString`, `DateRangeValue`, `CalendarSystem`, `CalendarId`, `EpochDay`, `ValidationReason`; Task 1·2의 유틸·설정
- Produces:
  - `interface StoreInstance<State, Event> { readonly state: State; readonly send: (event: Event) => void }`
  - `useStoreInstance<State, Event, Context>(createInitialState: () => State, reducer: Reducer<State, Event, Context>, context: Context): StoreInstance<State, Event>`
  - `interface PickerContextOptions { readonly constraints: RangeConstraints; readonly commitMode: CommitMode; readonly numberOfMonths: number }`, `usePickerContext(settings: PickerSettings, options: PickerContextOptions): PickerContext` (제약은 양력 기준으로 해석. 표시 역법 범위는 core 리듀서가 `boundsFor`로 겹침)
  - `interface ParsedControlledValue<Value> { readonly value: Value | null; readonly invalidReason: ValidationReason | null }`
  - `parseOptionalDate(input: string | null | undefined, calendars: readonly CalendarSystem[]): ParsedControlledValue<DateString>`
  - `parseOptionalTime(input: string | null | undefined, options: { readonly isEndOfDayAllowed: boolean }): ParsedControlledValue<TimeString>`
  - `parseOptionalRange(input: { readonly start: string; readonly end: string | null } | null | undefined, calendars: readonly CalendarSystem[]): ParsedControlledValue<DateRangeValue>`
  - `interface ControlledInput<Value> { readonly isControlled: boolean; readonly value: Value | null }`
  - `useParsedValue<Input, Value>(input: Input | null | undefined, parse: (input: Input | null | undefined) => ParsedControlledValue<Value>, describeInput: (input: Input) => string, onInvalidValue: SharedPickerProps['onInvalidValue']): ControlledInput<Value>` (입력은 `describeInput` 문자열 기준으로 한 번만 해석·보고)
  - `interface ValueBridgeOptions<Value> { readonly committedValue: Value; readonly controlled: ControlledInput<Value>; readonly isEqual: (first: Value, second: Value) => boolean; readonly syncStore: (value: Value) => void; readonly onValueChange: ((value: Value) => void) | undefined }`, `useValueBridge<Value>(options: ValueBridgeOptions<Value | null>): void`
  - `formatOrNull(epochDay: EpochDay | null, calendar: CalendarSystem): DateString | null`
  - `interface HiddenInputProps { readonly name?: string | undefined; readonly form?: string | undefined; readonly value: string; readonly required?: boolean | undefined; readonly disabled?: boolean | undefined; readonly onFocusRequest: () => void }`, `HiddenInput(props: HiddenInputProps): ReactElement | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/store/use-store-instance.test.tsx`:
```tsx
import type { Reducer } from '@lunisolar-picker/core';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { useStoreInstance } from './use-store-instance';

type CounterEvent = { readonly type: 'increment' };
const counterReducer: Reducer<number, CounterEvent, { readonly step: number }> = (count, _event, context) => count + context.step;

function Counter() {
  const [step, setStep] = useState(1);
  const counter = useStoreInstance(() => 10, counterReducer, { step });
  return (
    <>
      <output>{counter.state}</output>
      <button type="button" onClick={() => counter.send({ type: 'increment' })}>Increment</button>
      <button type="button" onClick={() => setStep(5)}>Use step 5</button>
    </>
  );
}

describe('useStoreInstance', () => {
  it('renders the store snapshot and re-renders after an event', async () => {
    const screen = await render(<Counter />);

    await screen.getByRole('button', { name: 'Increment' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('11');
  });

  it('reads the latest context without recreating the store', async () => {
    const screen = await render(<Counter />);

    await screen.getByRole('button', { name: 'Use step 5' }).click();
    await screen.getByRole('button', { name: 'Increment' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('15');
  });

  it('keeps separate state for each component instance', async () => {
    const screen = await render(
      <>
        <Counter />
        <Counter />
      </>,
    );

    await screen.getByRole('button', { name: 'Increment' }).first().click();

    await expect.element(screen.getByRole('status').first()).toHaveTextContent('11');
    await expect.element(screen.getByRole('status').last()).toHaveTextContent('10');
  });
});
```

`packages/react/src/value/parse-controlled-value.test.ts`:
```ts
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { gregory } from '@lunisolar-picker/calendar';
import { describe, expect, it } from 'vitest';
import { parseOptionalDate, parseOptionalRange, parseOptionalTime } from './parse-controlled-value';

const calendars = [gregory, dangi];

describe('parse-controlled-value', () => {
  it.each([undefined, null, ''])('treats %s as an empty value without a reason', (input) => {
    expect(parseOptionalDate(input, calendars)).toEqual({ value: null, invalidReason: null });
  });

  it('keeps a canonical lunar entry as is', () => {
    expect(parseOptionalDate('1990-06-23[u-ca=dangi]', calendars)).toEqual({ value: '1990-06-23[u-ca=dangi]', invalidReason: null });
  });

  it('reports why a non-canonical date was rejected', () => {
    expect(parseOptionalDate('2026-1-5', calendars)).toEqual({ value: null, invalidReason: 'invalid-date' });
  });

  it('accepts 24:00 only when end of day is allowed', () => {
    expect(parseOptionalTime('24:00', { isEndOfDayAllowed: false })).toEqual({ value: null, invalidReason: 'invalid-time' });
    expect(parseOptionalTime('24:00', { isEndOfDayAllowed: true })).toEqual({ value: '24:00', invalidReason: null });
  });

  it('normalizes a reversed range and rejects a range with an invalid end', () => {
    expect(parseOptionalRange({ start: '2026-10-17', end: '2026-10-13' }, calendars)).toEqual({
      value: { start: '2026-10-13', end: '2026-10-17' },
      invalidReason: null,
    });
    expect(parseOptionalRange({ start: '2026-10-13', end: '2026-10-32' }, calendars)).toEqual({
      value: null,
      invalidReason: 'invalid-date',
    });
  });
});
```

`packages/react/src/value/use-parsed-value.test.tsx`:
```tsx
import { gregory } from '@lunisolar-picker/calendar';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { parseOptionalDate } from './parse-controlled-value';
import { useParsedValue } from './use-parsed-value';

function Probe({ onInvalidValue }: { onInvalidValue: (input: string, reason: string) => void }) {
  const [value, setValue] = useState('2026-1-5');
  const [renderCount, setRenderCount] = useState(0);
  const controlled = useParsedValue(value, (input) => parseOptionalDate(input, [gregory]), String, onInvalidValue);
  return (
    <>
      <output>{String(controlled.value)}</output>
      <button type="button" onClick={() => setRenderCount(renderCount + 1)}>Re-render</button>
      <button type="button" onClick={() => setValue('2026-10-14')}>Fix value</button>
    </>
  );
}

describe('useParsedValue', () => {
  it('treats an invalid controlled value as empty and reports it once per input', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(<Probe onInvalidValue={onInvalidValue} />);

    await screen.getByRole('button', { name: 'Re-render' }).click();
    await screen.getByRole('button', { name: 'Re-render' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('null');
    expect(onInvalidValue).toHaveBeenCalledOnce();
    expect(onInvalidValue).toHaveBeenCalledWith('2026-1-5', 'invalid-date');
  });

  it('accepts the value once it becomes canonical', async () => {
    const screen = await render(<Probe onInvalidValue={vi.fn()} />);

    await screen.getByRole('button', { name: 'Fix value' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-10-14');
  });
});
```

`packages/react/src/value/use-value-bridge.test.tsx`:
```tsx
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useValueBridge } from './use-value-bridge';

function BridgeProbe({ controlledValue, onValueChange }: { controlledValue?: string | null; onValueChange: (value: string | null) => void }) {
  const [storeValue, setStoreValue] = useState<string | null>(controlledValue ?? null);
  useValueBridge<string>({
    committedValue: storeValue,
    controlled: { isControlled: controlledValue !== undefined, value: controlledValue ?? null },
    isEqual: Object.is,
    syncStore: setStoreValue,
    onValueChange,
  });
  return (
    <>
      <output>{String(storeValue)}</output>
      <button type="button" onClick={() => setStoreValue('2026-10-14')}>Pick</button>
    </>
  );
}

function ControlledParent({ onValueChange }: { onValueChange: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>('2026-01-01');
  return (
    <>
      <BridgeProbe controlledValue={value} onValueChange={onValueChange} />
      <button type="button" onClick={() => setValue('2026-02-02')}>Set from parent</button>
    </>
  );
}

describe('useValueBridge', () => {
  it('reports a user change exactly once', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<BridgeProbe onValueChange={onValueChange} />);

    await screen.getByRole('button', { name: 'Pick' }).click();

    await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-10-14']]);
  });

  it('syncs a parent value into the store without reporting it back', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<ControlledParent onValueChange={onValueChange} />);

    await screen.getByRole('button', { name: 'Set from parent' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-02-02');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
```

`packages/react/src/value/hidden-input.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { HiddenInput } from './hidden-input';

describe('HiddenInput', () => {
  it('submits the value under the given name', async () => {
    const screen = await render(
      <form aria-label="Booking">
        <HiddenInput name="checkIn" value="2026-10-14" onFocusRequest={vi.fn()} />
      </form>,
    );
    const form = screen.getByRole('form').element() as HTMLFormElement;

    expect(new FormData(form).get('checkIn')).toBe('2026-10-14');
  });

  it('blocks native form validation while a required value is empty', async () => {
    const screen = await render(
      <form aria-label="Booking">
        <HiddenInput name="checkIn" value="" required onFocusRequest={vi.fn()} />
      </form>,
    );

    expect((screen.getByRole('form').element() as HTMLFormElement).checkValidity()).toBe(false);
  });

  it('hands focus to the visible field when the browser focuses it for a validation message', async () => {
    const onFocusRequest = vi.fn();
    const screen = await render(
      <form aria-label="Booking">
        <HiddenInput name="checkIn" value="" required onFocusRequest={onFocusRequest} />
      </form>,
    );

    (screen.container.querySelector('input') as HTMLInputElement).focus();

    expect(onFocusRequest).toHaveBeenCalledOnce();
  });

  it('renders nothing without a name', async () => {
    const screen = await render(<HiddenInput value="2026-10-14" onFocusRequest={vi.fn()} />);

    expect(screen.container.querySelector('input')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/store src/value`
Expected: FAIL — `Failed to resolve import "./use-store-instance"` 등

- [ ] **Step 3: 구현**

`packages/react/src/store/use-store-instance.ts`:
```ts
import { type Reducer, createStore } from '@lunisolar-picker/core';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface StoreInstance<State, Event> {
  readonly state: State;
  readonly send: (event: Event) => void;
}

// Constraint: store는 인스턴스마다 한 번만 만들고, 바뀐 prop은 context ref로 읽게 함. 서버 렌더에서 요청끼리 상태가 섞이지 않음 (스펙 3.3)
export function useStoreInstance<State, Event, Context>(
  createInitialState: () => State,
  reducer: Reducer<State, Event, Context>,
  context: Context,
): StoreInstance<State, Event> {
  const contextRef = useRef(context);
  useLayoutEffect(() => {
    contextRef.current = context;
  });
  const [store] = useState(() =>
    createStore({ initialState: createInitialState(), reducer, readContext: () => contextRef.current }),
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { state, send: store.send };
}
```

`packages/react/src/settings/use-picker-context.ts`:
```ts
import { gregory } from '@lunisolar-picker/calendar';
import { type CommitMode, type PickerContext, type RangeConstraints, resolveConstraints } from '@lunisolar-picker/core';
import { useMemo } from 'react';
import { compactObject } from '../utilities/compact-object';
import type { PickerSettings } from './use-picker-settings';

export interface PickerContextOptions {
  readonly constraints: RangeConstraints;
  readonly commitMode: CommitMode;
  readonly numberOfMonths: number;
}

// Constraint: 컨텍스트의 제약은 양력 기준. 표시 역법의 지원 범위는 core 리듀서가 boundsFor로 겹쳐 계산함 (계약 §2.2)
export function usePickerContext(settings: PickerSettings, options: PickerContextOptions): PickerContext {
  const { min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed } = options.constraints;
  const knownCalendars = settings.calendars;
  const constraints = useMemo(
    () =>
      resolveConstraints(
        compactObject({ min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed }),
        gregory,
        knownCalendars,
      ),
    [min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed, knownCalendars],
  );
  const { calendars, todayEpochDay, weekStartsOn, locale } = settings;
  const { commitMode, numberOfMonths } = options;
  return useMemo(
    () => ({ calendars, constraints, today: todayEpochDay, weekStartsOn, locale, commitMode, numberOfMonths }),
    [calendars, constraints, todayEpochDay, weekStartsOn, locale, commitMode, numberOfMonths],
  );
}
```

`packages/react/src/value/parse-controlled-value.ts`:
```ts
import {
  type CalendarSystem,
  type DateRangeValue,
  type DateString,
  type TimeString,
  type ValidationReason,
  normalizeDateRange,
  parseDate,
  parseTime,
} from '@lunisolar-picker/calendar';

export interface ParsedControlledValue<Value> {
  readonly value: Value | null;
  readonly invalidReason: ValidationReason | null;
}

export interface DateRangeInput {
  readonly start: string;
  readonly end: string | null;
}

const EMPTY: ParsedControlledValue<never> = { value: null, invalidReason: null };

export function parseOptionalDate(input: string | null | undefined, calendars: readonly CalendarSystem[]): ParsedControlledValue<DateString> {
  if (input === undefined || input === null || input === '') return EMPTY;
  const parsed = parseDate(input, { calendars });
  return parsed.isOk ? { value: parsed.value.value, invalidReason: null } : { value: null, invalidReason: parsed.error };
}

export function parseOptionalTime(
  input: string | null | undefined,
  options: { readonly isEndOfDayAllowed: boolean },
): ParsedControlledValue<TimeString> {
  if (input === undefined || input === null || input === '') return EMPTY;
  const parsed = parseTime(input, options);
  return parsed.isOk ? { value: parsed.value.value, invalidReason: null } : { value: null, invalidReason: parsed.error };
}

export function parseOptionalRange(
  input: DateRangeInput | null | undefined,
  calendars: readonly CalendarSystem[],
): ParsedControlledValue<DateRangeValue> {
  if (input === undefined || input === null) return EMPTY;
  const start = parseOptionalDate(input.start, calendars);
  if (start.value === null) return { value: null, invalidReason: start.invalidReason ?? 'incomplete' };
  const end = parseOptionalDate(input.end, calendars);
  if (end.invalidReason !== null) return { value: null, invalidReason: end.invalidReason };
  const normalized = normalizeDateRange(start.value, end.value);
  return normalized.isOk ? { value: normalized.value, invalidReason: null } : { value: null, invalidReason: normalized.error };
}
```

`packages/react/src/value/use-parsed-value.ts`:
```ts
import { useEffect, useMemo } from 'react';
import type { SharedPickerProps } from '../settings/shared-picker-props';
import { isDevelopment } from '../utilities/is-development';
import { useLatestRef } from '../utilities/use-latest-ref';
import type { ParsedControlledValue } from './parse-controlled-value';

export interface ControlledInput<Value> {
  readonly isControlled: boolean;
  readonly value: Value | null;
}

// Goal: 잘못된 제어 값을 던지지 않고 빈 값으로 다루며, 같은 입력에 대해 알림을 한 번만 보냄 (스펙 4.2)
// Constraint: 범위처럼 객체로 오는 값은 매 렌더 새 참조일 수 있으므로 describeInput 문자열을 기준으로 다시 해석함
export function useParsedValue<Input, Value>(
  input: Input | null | undefined,
  parse: (input: Input | null | undefined) => ParsedControlledValue<Value>,
  describeInput: (input: Input) => string,
  onInvalidValue: SharedPickerProps['onInvalidValue'],
): ControlledInput<Value> {
  const inputKey = input === undefined || input === null ? input : describeInput(input);
  const latest = useLatestRef({ onInvalidValue });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 입력의 문자열 표현이 같으면 다시 해석하지 않음 (Review Focus 2)
  const parsed = useMemo(() => parse(input), [inputKey]);
  useEffect(() => {
    if (parsed.invalidReason === null || typeof inputKey !== 'string') return;
    latest.current.onInvalidValue?.(inputKey, parsed.invalidReason);
    if (isDevelopment()) console.warn(`[lunisolar-picker] ignored invalid value "${inputKey}": ${parsed.invalidReason}`);
  }, [parsed, inputKey, latest]);
  return { isControlled: input !== undefined, value: parsed.value };
}
```

`packages/react/src/value/use-value-bridge.ts`:
```ts
import { useEffect, useRef } from 'react';
import { useLatestRef } from '../utilities/use-latest-ref';
import type { ControlledInput } from './use-parsed-value';

export interface ValueBridgeOptions<Value> {
  readonly committedValue: Value;
  readonly controlled: ControlledInput<Value>;
  readonly isEqual: (first: Value, second: Value) => boolean;
  readonly syncStore: (value: Value) => void;
  readonly onValueChange: ((value: Value) => void) | undefined;
}

// Goal: store가 값의 단일 출처. 부모가 준 값은 store로 밀어 넣고(알림 없음), 사용자가 바꾼 값만 onValueChange로 알림 (계약 §2.1)
// Constraint: 제어 모드에서 부모가 새 값을 거부하면 다음 value 변경 때 store가 맞춰짐(semi-controlled). 입력 중인 칸을 매 렌더마다 되돌리지 않기 위함
export function useValueBridge<Value>(options: ValueBridgeOptions<Value | null>): void {
  const { committedValue, controlled } = options;
  const lastKnownRef = useRef(committedValue);
  const latest = useLatestRef(options);
  const controlledValue = controlled.isControlled ? controlled.value : undefined;

  useEffect(() => {
    if (controlledValue === undefined || latest.current.isEqual(controlledValue, lastKnownRef.current)) return;
    lastKnownRef.current = controlledValue;
    latest.current.syncStore(controlledValue);
  }, [controlledValue, latest]);

  useEffect(() => {
    if (latest.current.isEqual(committedValue, lastKnownRef.current)) return;
    lastKnownRef.current = committedValue;
    latest.current.onValueChange?.(committedValue);
  }, [committedValue, latest]);
}
```

`packages/react/src/value/format-or-null.ts`:
```ts
import { type CalendarSystem, type DateString, type EpochDay, formatDate } from '@lunisolar-picker/calendar';

export function formatOrNull(epochDay: EpochDay | null, calendar: CalendarSystem): DateString | null {
  if (epochDay === null) return null;
  const formatted = formatDate(epochDay, calendar);
  return formatted.isOk ? formatted.value : null;
}
```

`packages/react/src/value/hidden-input.tsx`:
```tsx
import type { CSSProperties, ReactElement } from 'react';

export interface HiddenInputProps {
  readonly name?: string | undefined;
  readonly form?: string | undefined;
  readonly value: string;
  readonly required?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly onFocusRequest: () => void;
}

const VISUALLY_HIDDEN_STYLE: CSSProperties = {
  position: 'absolute',
  inlineSize: 1,
  blockSize: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
  opacity: 0,
};

function ignoreChange(): void {}

// Goal: 네이티브 form 제출과 required 검증을 받기 위한 숨은 입력. type=hidden은 required 검증에서 빠지므로 text로 두고 화면에서만 숨김
export function HiddenInput({ name, form, value, required, disabled, onFocusRequest }: HiddenInputProps): ReactElement | null {
  if (name === undefined) return null;
  return (
    <input
      aria-hidden="true"
      tabIndex={-1}
      type="text"
      name={name}
      form={form}
      value={value}
      required={required}
      disabled={disabled}
      onChange={ignoreChange}
      onFocus={onFocusRequest}
      style={VISUALLY_HIDDEN_STYLE}
    />
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/store src/value`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 부모가 준 값과 사용자가 바꾼 값을 구분해 한 번씩만 반영하는 제어 값 처리 지원" -m "- store를 값의 단일 출처로 두고 부모 값은 알림 없이 store에 넣고 사용자 변경만 onValueChange로 알리도록 함.
- 정규 형식이 아닌 제어 값은 던지지 않고 빈 값으로 다루며 입력값마다 onInvalidValue를 한 번만 호출함.
- 네이티브 form 제출과 required 검증을 받도록 화면에만 숨긴 텍스트 입력을 둠."
```

---

### Task 4: Popover

**Files:**
- Create: `packages/react/src/focus/focusable-elements.ts`, `packages/react/src/popover/use-popover.ts`, `popover-context.ts`, `parts.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/popover/popover.test.tsx`

**Interfaces:**
- Consumes: `@floating-ui/react-dom`의 `useFloating`, `autoUpdate`, `offset`, `flip`, `shift`, `Placement`; Task 1 유틸
- Produces:
  - `getFocusableElements(container: HTMLElement): HTMLElement[]`, `focusInitialElement(container: HTMLElement): void`, `trapTabKey(event: KeyboardEvent | ReactKeyboardEvent, container: HTMLElement): void`
  - `interface UsePopoverProps { readonly open?: boolean; readonly defaultOpen?: boolean; readonly onOpenChange?: (open: boolean) => void; readonly placement?: Placement }`
  - `interface PopoverApi { readonly isOpen: boolean; readonly contentId: string; setOpen(open: boolean): void; closeAndRestoreFocus(): void; getTriggerProps(): PopoverTriggerProps; getContentProps(): PopoverContentProps }`
  - `usePopover(props: UsePopoverProps): PopoverApi`
  - `Popover.Root`, `Popover.Trigger`, `Popover.Content`, `Popover.Close`, `usePopoverContext(): PopoverApi`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/popover/popover.test.tsx`:
```tsx
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import * as Popover from './parts';

function Example({ isOpenInitially = false }: { isOpenInitially?: boolean }) {
  return (
    <>
      <button type="button">Outside</button>
      <Popover.Root defaultOpen={isOpenInitially}>
        <Popover.Trigger>Choose date</Popover.Trigger>
        <Popover.Content aria-label="Calendar">
          <button type="button">First</button>
          <button type="button" data-autofocus>
            Selected day
          </button>
          <Popover.Close>Close</Popover.Close>
        </Popover.Content>
      </Popover.Root>
    </>
  );
}

function ControlledExample() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <output>{String(isOpen)}</output>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>Choose date</Popover.Trigger>
        <Popover.Content aria-label="Calendar">
          <button type="button">Inside</button>
        </Popover.Content>
      </Popover.Root>
    </>
  );
}

describe('Popover', () => {
  it('opens from the trigger and focuses the autofocus element', async () => {
    const screen = await render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Choose date' });

    await trigger.click();

    await expect.element(screen.getByRole('dialog', { name: 'Calendar' })).toBeVisible();
    await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect.element(screen.getByRole('button', { name: 'Selected day' })).toHaveFocus();
  });

  it('keeps Tab focus inside the content', async () => {
    const screen = await render(<Example isOpenInitially />);
    await expect.element(screen.getByRole('button', { name: 'Selected day' })).toHaveFocus();

    await userEvent.keyboard('{Tab}{Tab}');

    await expect.element(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const screen = await render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Choose date' });
    await trigger.click();

    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(trigger).toHaveFocus();
  });

  it('closes when the pointer goes down outside', async () => {
    const screen = await render(<Example />);
    await screen.getByRole('button', { name: 'Choose date' }).click();

    await screen.getByRole('button', { name: 'Outside' }).click();

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes from the close part and restores focus', async () => {
    const screen = await render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Choose date' });
    await trigger.click();

    await screen.getByRole('button', { name: 'Close' }).click();

    await expect.element(trigger).toHaveFocus();
  });

  it('follows a controlled open state', async () => {
    const screen = await render(<ControlledExample />);

    await screen.getByRole('button', { name: 'Choose date' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('true');
    await expect.element(screen.getByRole('dialog')).toBeVisible();
  });

  it('has no accessibility violations while open', async () => {
    const screen = await render(<Example isOpenInitially />);
    await expect.element(screen.getByRole('dialog')).toBeVisible();

    await expectNoAxeViolations(document.body);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/popover`
Expected: FAIL — `Failed to resolve import "./parts"`

- [ ] **Step 3: 구현**

`packages/react/src/focus/focusable-elements.ts`:
```ts
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const AUTOFOCUS_SELECTOR = '[data-autofocus]';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => !element.closest('[inert]'));
}

// Goal: 달력이 열리면 선택된 날(없으면 오늘)에 포커스가 가야 함. 부품은 그 칸에 data-autofocus를 붙임 (스펙 10.4)
export function focusInitialElement(container: HTMLElement): void {
  const target = container.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR) ?? getFocusableElements(container)[0] ?? container;
  target.focus({ preventScroll: true });
}

export function trapTabKey(event: KeyboardEvent | ReactKeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const focusableElements = getFocusableElements(container);
  const first = focusableElements[0];
  const last = focusableElements.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const isLeavingStart = event.shiftKey && document.activeElement === first;
  const isLeavingEnd = !event.shiftKey && document.activeElement === last;
  if (!isLeavingStart && !isLeavingEnd) return;
  event.preventDefault();
  (isLeavingStart ? last : first).focus();
}
```

`packages/react/src/popover/use-popover.ts`:
```ts
import { type Placement, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react-dom';
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { focusInitialElement, trapTabKey } from '../focus/focusable-elements';
import { useControllableState } from '../utilities/use-controllable-state';
import { useMergedRefs } from '../utilities/use-merged-refs';

export interface UsePopoverProps {
  readonly open?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly placement?: Placement | undefined;
}

export type PopoverTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLButtonElement> };

export type PopoverContentProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement>; readonly style: CSSProperties };

export interface PopoverApi {
  readonly isOpen: boolean;
  readonly contentId: string;
  setOpen(open: boolean): void;
  closeAndRestoreFocus(): void;
  getTriggerProps(): PopoverTriggerProps;
  getContentProps(): PopoverContentProps;
}

const POPOVER_OFFSET_PIXELS = 8;
const VIEWPORT_PADDING_PIXELS = 8;

export function usePopover({ open, defaultOpen = false, onOpenChange, placement = 'bottom-start' }: UsePopoverProps): PopoverApi {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement,
    strategy: 'fixed',
    middleware: [offset(POPOVER_OFFSET_PIXELS), flip({ padding: VIEWPORT_PADDING_PIXELS }), shift({ padding: VIEWPORT_PADDING_PIXELS })],
    whileElementsMounted: autoUpdate,
  });
  const triggerRefCallback = useMergedRefs<HTMLButtonElement>(triggerRef, refs.setReference);
  const contentRefCallback = useMergedRefs<HTMLDivElement>(contentRef, refs.setFloating);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, [setOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      if (contentRef.current) focusInitialElement(contentRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const isInside = contentRef.current?.contains(target) || triggerRef.current?.contains(target);
      if (!isInside) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [isOpen, setOpen]);

  const onContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (contentRef.current) trapTabKey(event, contentRef.current);
  };

  return {
    isOpen,
    contentId,
    setOpen,
    closeAndRestoreFocus,
    getTriggerProps: () => ({
      ref: triggerRefCallback,
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? contentId : undefined,
      onClick: () => setOpen(!isOpen),
      ...partAttributes('popover-trigger', { open: isOpen }),
    }),
    getContentProps: () => ({
      ref: contentRefCallback,
      id: contentId,
      role: 'dialog',
      tabIndex: -1,
      style: floatingStyles,
      onKeyDown: onContentKeyDown,
      ...partAttributes('popover', { open: isOpen }),
    }),
  };
}
```

`packages/react/src/popover/popover-context.ts`:
```ts
import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { createContext, useContext } from 'react';
import type { PopoverApi } from './use-popover';

export const PopoverContext = createContext<PopoverApi | null>(null);

export function usePopoverContext(): PopoverApi {
  const popover = useContext(PopoverContext);
  if (!popover) throw new LunisolarPickerError('Popover parts must be rendered inside <Popover.Root>');
  return popover;
}
```

`packages/react/src/popover/parts.tsx`:
```tsx
import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { PopoverContext, usePopoverContext } from './popover-context';
import { type UsePopoverProps, usePopover } from './use-popover';

export interface PopoverState {
  readonly isOpen: boolean;
}

export interface RootProps extends UsePopoverProps {
  readonly children: ReactNode;
}

export function Root({ children, ...props }: RootProps): ReactElement {
  const popover = usePopover(props);
  return <PopoverContext value={popover}>{children}</PopoverContext>;
}

export interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, PopoverState> | undefined;
}

export function Trigger({ render, ...props }: TriggerProps): ReactElement {
  const popover = usePopoverContext();
  return renderElement('button', render, mergeProps(popover.getTriggerProps(), props), { isOpen: popover.isOpen });
}

export interface ContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, PopoverState> | undefined;
}

export function Content({ render, ...props }: ContentProps): ReactElement | null {
  const popover = usePopoverContext();
  if (!popover.isOpen) return null;
  return createPortal(
    renderElement('div', render, mergeProps(popover.getContentProps(), props), { isOpen: popover.isOpen }),
    document.body,
  );
}

export interface CloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, PopoverState> | undefined;
}

export function Close({ render, ...props }: CloseProps): ReactElement {
  const popover = usePopoverContext();
  const closeProps = { type: 'button' as const, onClick: popover.closeAndRestoreFocus };
  return renderElement('button', render, mergeProps(closeProps, props), { isOpen: popover.isOpen });
}

export { usePopoverContext };
```

`packages/react/src/index.ts`에 추가:
```ts
export * as Popover from './popover/parts';
export type { PopoverApi, UsePopoverProps } from './popover/use-popover';
export { usePopover } from './popover/use-popover';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/popover`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 화면 가장자리에서도 잘리지 않고 키보드로 오갈 수 있는 팝오버 부품 지원" -m "- 위치 계산은 검증된 floating-ui에 맡겨 iOS 인앱처럼 anchor positioning을 보장할 수 없는 환경에서도 뒤집기·밀어내기가 되게 함.
- 열면 선택된 날로 포커스를 옮기고, Tab은 안에 가두며, Esc와 닫기 버튼은 트리거로 포커스를 되돌림 (APG Date Picker Dialog)."
```

---

### Task 5: Sheet, 스크롤 잠금, presentation 판정

**Files:**
- Create: `packages/react/src/sheet/scroll-lock.ts`, `inert-siblings.ts`, `use-sheet.ts`, `sheet-context.ts`, `parts.tsx`
- Create: `packages/react/src/presentation/use-presentation.ts`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/sheet/scroll-lock.test.ts`, `packages/react/src/sheet/sheet.test.tsx`, `packages/react/src/presentation/use-presentation.test.ts`

**Interfaces:**
- Consumes: Task 1 유틸, Task 4 `focusInitialElement`, `trapTabKey`
- Produces:
  - `lockBodyScroll(): () => void`
  - `makeSiblingsInert(container: HTMLElement): () => void`
  - `interface UseSheetProps { readonly open?: boolean; readonly defaultOpen?: boolean; readonly onOpenChange?: (open: boolean) => void }`
  - `interface SheetApi { readonly isOpen: boolean; readonly titleId: string; setOpen(open: boolean): void; getBackdropProps(): SheetBackdropProps; getPanelProps(): SheetPanelProps }`, `useSheet(props: UseSheetProps): SheetApi`
  - `Sheet.Root`, `Sheet.Content`, `Sheet.Close`, `useSheetContext(): SheetApi`
  - `type Presentation = 'auto' | 'popover' | 'sheet'`, `type ResolvedPresentation = 'popover' | 'sheet'`, `COARSE_NARROW_SCREEN_QUERY`, `resolvePresentation(presentation: Presentation, isCoarseNarrowScreen: boolean): ResolvedPresentation`, `usePresentation(presentation: Presentation): ResolvedPresentation`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/sheet/scroll-lock.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lockBodyScroll } from './scroll-lock';

const TALL_PAGE_HEIGHT = '4000px';
const SCROLL_POSITION = 1234;

let filler: HTMLDivElement;

beforeEach(() => {
  filler = document.createElement('div');
  filler.style.blockSize = TALL_PAGE_HEIGHT;
  document.body.append(filler);
  window.scrollTo(0, SCROLL_POSITION);
});

afterEach(() => {
  filler.remove();
  window.scrollTo(0, 0);
});

describe('lockBodyScroll', () => {
  it('pins the body at the current scroll position and restores it exactly', () => {
    const release = lockBodyScroll();

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe(`-${SCROLL_POSITION}px`);

    release();

    expect(document.body.style.position).toBe('');
    expect(window.scrollY).toBe(SCROLL_POSITION);
  });

  it('keeps the page locked until every nested lock is released', () => {
    const releaseOuter = lockBodyScroll();
    const releaseInner = lockBodyScroll();

    releaseInner();
    expect(document.body.style.position).toBe('fixed');

    releaseOuter();
    expect(document.body.style.position).toBe('');
  });

  it('ignores a second release of the same lock', () => {
    const releaseOuter = lockBodyScroll();
    const releaseInner = lockBodyScroll();

    releaseInner();
    releaseInner();

    expect(document.body.style.position).toBe('fixed');
    releaseOuter();
  });
});
```

`packages/react/src/sheet/sheet.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import * as Sheet from './parts';
import { useSheetContext } from './sheet-context';

function OpenButton() {
  const sheet = useSheetContext();
  return (
    <button type="button" onClick={() => sheet.setOpen(true)}>
      Pick a date
    </button>
  );
}

function Example() {
  return (
    <>
      <main>
        <p>Page content</p>
      </main>
      <Sheet.Root>
        <OpenButton />
        <Sheet.Content aria-label="Birth date">
          <button type="button" data-autofocus>
            Wheel
          </button>
          <Sheet.Close>Done</Sheet.Close>
        </Sheet.Content>
      </Sheet.Root>
    </>
  );
}

describe('Sheet', () => {
  it('opens as a modal dialog, focuses the autofocus element, and makes the page inert', async () => {
    const screen = await render(<Example />);

    await screen.getByRole('button', { name: 'Pick a date' }).click();

    const dialog = screen.getByRole('dialog', { name: 'Birth date' });
    await expect.element(dialog).toHaveAttribute('aria-modal', 'true');
    await expect.element(screen.getByRole('button', { name: 'Wheel' })).toHaveFocus();
    expect(screen.container.inert).toBe(true);
  });

  it('closes on Escape, restores inert state, and returns focus to the opener', async () => {
    const screen = await render(<Example />);
    const opener = screen.getByRole('button', { name: 'Pick a date' });
    await opener.click();

    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(screen.container.inert).toBe(false);
    await expect.element(opener).toHaveFocus();
  });

  it('closes when the backdrop is tapped but not when the panel is tapped', async () => {
    const screen = await render(<Example />);
    await screen.getByRole('button', { name: 'Pick a date' }).click();

    screen.getByRole('dialog').element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.element(screen.getByRole('dialog')).toBeVisible();

    const backdrop = document.querySelector('[data-lsp-part="sheet-backdrop"]') as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no accessibility violations while open', async () => {
    const screen = await render(<Example />);
    await screen.getByRole('button', { name: 'Pick a date' }).click();

    await expectNoAxeViolations(screen.getByRole('dialog').element());
  });
});
```

`packages/react/src/presentation/use-presentation.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { resolvePresentation } from './use-presentation';

describe('resolvePresentation', () => {
  it.each([
    ['auto', true, 'sheet'],
    ['auto', false, 'popover'],
    ['popover', true, 'popover'],
    ['sheet', false, 'sheet'],
  ] as const)('resolves %s on a coarse narrow screen (%s) to %s', (presentation, isCoarseNarrowScreen, expected) => {
    expect(resolvePresentation(presentation, isCoarseNarrowScreen)).toBe(expected);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/sheet src/presentation`
Expected: FAIL — `Failed to resolve import "./scroll-lock"` 등

- [ ] **Step 3: 구현**

`packages/react/src/sheet/scroll-lock.ts`:
```ts
interface SavedBodyStyle {
  readonly position: string;
  readonly top: string;
  readonly insetInline: string;
  readonly overflow: string;
  readonly paddingInlineEnd: string;
}

// Constraint: 문서 전체에 하나뿐인 body 잠금을 여러 시트가 공유하므로 잠금 수를 셈. DOM 전역이라 모듈 상태가 허용되는 유일한 경우
let activeLockCount = 0;
let restoreBody: (() => void) | null = null;

export function lockBodyScroll(): () => void {
  activeLockCount += 1;
  if (activeLockCount === 1) restoreBody = applyBodyLock();
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    activeLockCount -= 1;
    if (activeLockCount > 0) return;
    restoreBody?.();
    restoreBody = null;
  };
}

// Constraint: iOS Safari는 body overflow:hidden만으로 뒤 화면 스크롤이 막히지 않음 → body를 고정하고 닫을 때 위치를 되돌림 (스펙 10.4)
function applyBodyLock(): () => void {
  const { body, documentElement } = document;
  const scrollY = window.scrollY;
  const saved: SavedBodyStyle = {
    position: body.style.position,
    top: body.style.top,
    insetInline: body.style.insetInline,
    overflow: body.style.overflow,
    paddingInlineEnd: body.style.paddingInlineEnd,
  };
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
  Object.assign(body.style, {
    position: 'fixed',
    top: `-${scrollY}px`,
    insetInline: '0',
    overflow: 'hidden',
    paddingInlineEnd: `${scrollbarWidth}px`,
  });
  return () => {
    Object.assign(body.style, saved);
    window.scrollTo(0, scrollY);
  };
}
```

`packages/react/src/sheet/inert-siblings.ts`:
```ts
// Goal: 모달 시트가 열린 동안 뒤 화면을 보조기기와 포커스에서 숨김 (스펙 10.4)
export function makeSiblingsInert(container: HTMLElement): () => void {
  const siblings = Array.from(document.body.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement && element !== container && !element.inert,
  );
  for (const element of siblings) element.inert = true;
  return () => {
    for (const element of siblings) element.inert = false;
  };
}
```

`packages/react/src/sheet/use-sheet.ts`:
```ts
import {
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { focusInitialElement, trapTabKey } from '../focus/focusable-elements';
import { useControllableState } from '../utilities/use-controllable-state';
import { makeSiblingsInert } from './inert-siblings';
import { lockBodyScroll } from './scroll-lock';

export interface UseSheetProps {
  readonly open?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}

export type SheetBackdropProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement> };
export type SheetPanelProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement> };

export interface SheetApi {
  readonly isOpen: boolean;
  readonly titleId: string;
  setOpen(open: boolean): void;
  getBackdropProps(): SheetBackdropProps;
  getPanelProps(): SheetPanelProps;
}

export function useSheet({ open, defaultOpen = false, onOpenChange }: UseSheetProps): SheetApi {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const titleId = useId();
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !backdropRef.current) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScroll = lockBodyScroll();
    const releaseInert = makeSiblingsInert(backdropRef.current);
    const frame = requestAnimationFrame(() => {
      if (panelRef.current) focusInitialElement(panelRef.current);
    });
    return () => {
      cancelAnimationFrame(frame);
      releaseInert();
      releaseScroll();
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (panelRef.current) trapTabKey(event, panelRef.current);
  };

  return {
    isOpen,
    titleId,
    setOpen,
    getBackdropProps: () => ({
      ref: (node) => {
        backdropRef.current = node;
      },
      onClick: onBackdropClick,
      ...partAttributes('sheet-backdrop', { open: isOpen }),
    }),
    getPanelProps: () => ({
      ref: (node) => {
        panelRef.current = node;
      },
      role: 'dialog',
      'aria-modal': true,
      tabIndex: -1,
      onKeyDown: onPanelKeyDown,
      ...partAttributes('sheet', { open: isOpen }),
    }),
  };
}
```

`packages/react/src/sheet/sheet-context.ts`:
```ts
import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { createContext, useContext } from 'react';
import type { SheetApi } from './use-sheet';

export const SheetContext = createContext<SheetApi | null>(null);

export function useSheetContext(): SheetApi {
  const sheet = useContext(SheetContext);
  if (!sheet) throw new LunisolarPickerError('Sheet parts must be rendered inside <Sheet.Root>');
  return sheet;
}
```

`packages/react/src/sheet/parts.tsx`:
```tsx
import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { SheetContext, useSheetContext } from './sheet-context';
import { type UseSheetProps, useSheet } from './use-sheet';

export interface SheetState {
  readonly isOpen: boolean;
}

export interface RootProps extends UseSheetProps {
  readonly children: ReactNode;
}

export function Root({ children, ...props }: RootProps): ReactElement {
  const sheet = useSheet(props);
  return <SheetContext value={sheet}>{children}</SheetContext>;
}

export interface ContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, SheetState> | undefined;
}

export function Content({ render, children, ...props }: ContentProps): ReactElement | null {
  const sheet = useSheetContext();
  if (!sheet.isOpen) return null;
  const panel = renderElement('div', render, mergeProps(sheet.getPanelProps(), { ...props, children }), { isOpen: true });
  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: 배경 탭 닫기는 포인터 보조 수단. 키보드는 패널의 Esc와 닫기 버튼으로 닫음 (APG Dialog)
    <div {...sheet.getBackdropProps()}>{panel}</div>,
    document.body,
  );
}

export interface CloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, SheetState> | undefined;
}

export function Close({ render, ...props }: CloseProps): ReactElement {
  const sheet = useSheetContext();
  const closeProps = { type: 'button' as const, onClick: () => sheet.setOpen(false) };
  return renderElement('button', render, mergeProps(closeProps, props), { isOpen: sheet.isOpen });
}

export { useSheetContext };
```

`packages/react/src/presentation/use-presentation.ts`:
```ts
import { useSyncExternalStore } from 'react';

export type Presentation = 'auto' | 'popover' | 'sheet';
export type ResolvedPresentation = 'popover' | 'sheet';

// Goal: 터치 기기이면서 좁은 화면이면 팝오버 대신 바텀시트로 엶 (스펙 7.5)
export const COARSE_NARROW_SCREEN_QUERY = '(pointer: coarse) and (max-width: 640px)';

export function resolvePresentation(presentation: Presentation, isCoarseNarrowScreen: boolean): ResolvedPresentation {
  if (presentation !== 'auto') return presentation;
  return isCoarseNarrowScreen ? 'sheet' : 'popover';
}

function subscribeToScreen(onChange: () => void): () => void {
  const query = window.matchMedia(COARSE_NARROW_SCREEN_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readIsCoarseNarrowScreen(): boolean {
  return window.matchMedia(COARSE_NARROW_SCREEN_QUERY).matches;
}

// Constraint: 서버는 화면을 모르므로 팝오버로 그리고, hydration 뒤 브라우저 판정으로 바꿈
function readServerIsCoarseNarrowScreen(): boolean {
  return false;
}

export function usePresentation(presentation: Presentation): ResolvedPresentation {
  const isCoarseNarrowScreen = useSyncExternalStore(subscribeToScreen, readIsCoarseNarrowScreen, readServerIsCoarseNarrowScreen);
  return resolvePresentation(presentation, isCoarseNarrowScreen);
}
```

`packages/react/src/index.ts`에 추가:
```ts
export type { Presentation, ResolvedPresentation } from './presentation/use-presentation';
export { resolvePresentation, usePresentation } from './presentation/use-presentation';
export * as Sheet from './sheet/parts';
export type { SheetApi, UseSheetProps } from './sheet/use-sheet';
export { useSheet } from './sheet/use-sheet';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/sheet src/presentation`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 모바일에서 뒤 화면이 스크롤되거나 읽히지 않는 바텀시트 부품 지원" -m "- iOS Safari는 overflow:hidden만으로 뒤 화면 스크롤이 막히지 않아 body를 고정하고 닫을 때 원래 스크롤 위치로 정확히 되돌림.
- 여러 시트가 겹쳐 열려도 마지막 잠금이 풀릴 때만 해제되도록 잠금 수를 세고, 열린 동안 뒤 화면을 inert로 숨김.
- 터치 기기의 좁은 화면이면 팝오버 대신 시트를 쓰도록 판정하는 presentation 헬퍼를 둠."
```

---

### Task 6: 세그먼트 입력 공통과 DateField

> 🟡 잠정: M2 구현 결과에 따라 `DateFieldState`·`DateFieldEvent`·`SegmentEvent`·`Segment`·`createDateFieldState`·`dateFieldReducer`·`dateFieldResult`의 필드·이벤트 이름이 바뀔 수 있음. 특히 윤달 토글과 입력 중 결과(`incomplete`)의 의미

> 정합성 조정(2026-10-14): M2 정의에 맞춰 `createDateFieldState(context, { selected, entryCalendarId })`, `value.sync { selected, entryCalendarId }`, core의 `DateFieldResult`, 윤달 표시 접두사 `locale.field.leapMonthPrefix`를 쓴다. `ValueChangeDetails`는 `settings/shared-picker-props.ts`로 옮겼다. 필드 밖으로 포커스가 나가면 `onBlur`를 부른다.

**Files:**
- Create: `packages/react/src/segments/segment-commands.ts`, `use-segmented-field.ts`
- Create: `packages/react/src/date-field/use-date-field-core.ts`, `use-date-field.ts`, `date-field-context.ts`, `parts.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/segments/segment-commands.test.ts`, `packages/react/src/date-field/date-field.test.tsx`

**Interfaces:**
- Consumes: core `Segment`, `SegmentEvent`, `DateFieldState`, `DateFieldEvent`, `DateSegmentKind`, `createDateFieldState`, `dateFieldReducer`, `dateFieldResult`, `Validity`, `PickerContext`, `DateConstraints`, `findCalendar`; calendar `CalendarId`, `CalendarSystem`, `DateString`, `EpochDay`, `epochDayOf`, `calendarIdOf`, `toMonthCode`; Task 1~3
- Produces:
  - `type SegmentCommand = SegmentEvent | { readonly type: 'text.paste'; readonly text: string } | { readonly type: 'leapMonth.toggle' }`
  - `commandsFromInput(inputType: string, data: string | null): readonly SegmentEvent[]`
  - `commandFromKey(key: string, options: { readonly isRightToLeft: boolean; readonly canToggleLeapMonth: boolean }): SegmentCommand | null`
  - `readPastedText(event: ClipboardEvent): string`
  - `interface SegmentDescription { readonly label: string; readonly displayText: string; readonly valueText: string; readonly isPlaceholder: boolean; readonly minValue: number; readonly maxValue: number; readonly value: number | null }`
  - `interface SegmentedFieldOptions` / `interface SegmentedField` / `useSegmentedField(options): SegmentedField` (아래 코드)
  - `interface DateFieldCoreOptions`, `interface DateFieldCore`, `useDateFieldCore(options): DateFieldCore`
  - `interface UseDateFieldProps`, `interface DateFieldApi`, `useDateField(props: UseDateFieldProps): DateFieldApi`
  - `DateField.Root`, `DateField.Segment`, `DateField.Separator`, `DateField.HiddenInput`, `DateField.LeapMonthToggle`, `useDateFieldContext(): DateFieldCore`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/segments/segment-commands.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { commandFromKey, commandsFromInput } from './segment-commands';

describe('commandsFromInput', () => {
  it('turns each typed digit into a digit command and separators into a separator command', () => {
    expect(commandsFromInput('insertText', '2.0')).toEqual([
      { type: 'digit.type', digit: 2 },
      { type: 'separator.type' },
      { type: 'digit.type', digit: 0 },
    ]);
  });

  it('reads digits from composition text that a virtual keyboard could not cancel', () => {
    expect(commandsFromInput('insertCompositionText', '7')).toEqual([{ type: 'digit.type', digit: 7 }]);
  });

  it('erases on deletion and ignores letters and formatting', () => {
    expect(commandsFromInput('deleteContentBackward', null)).toEqual([{ type: 'segment.erase' }]);
    expect(commandsFromInput('insertText', 'a')).toEqual([]);
    expect(commandsFromInput('formatBold', null)).toEqual([]);
  });

  it('leaves pasting to the paste listener', () => {
    expect(commandsFromInput('insertFromPaste', null)).toEqual([]);
  });
});

describe('commandFromKey', () => {
  const leftToRight = { isRightToLeft: false, canToggleLeapMonth: true };

  it.each([
    ['ArrowUp', { type: 'segment.step', amount: 1 }],
    ['ArrowDown', { type: 'segment.step', amount: -1 }],
    ['ArrowLeft', { type: 'focus.shift', amount: -1 }],
    ['ArrowRight', { type: 'focus.shift', amount: 1 }],
    ['Backspace', { type: 'segment.erase' }],
    ['L', { type: 'leapMonth.toggle' }],
  ])('maps %s', (key, expected) => {
    expect(commandFromKey(key, leftToRight)).toEqual(expected);
  });

  it('reverses horizontal arrows in right-to-left text', () => {
    expect(commandFromKey('ArrowLeft', { isRightToLeft: true, canToggleLeapMonth: false })).toEqual({ type: 'focus.shift', amount: 1 });
  });

  it('ignores the leap month key where no leap month applies and lets Tab pass', () => {
    expect(commandFromKey('l', { isRightToLeft: false, canToggleLeapMonth: false })).toBeNull();
    expect(commandFromKey('Tab', leftToRight)).toBeNull();
  });
});
```

`packages/react/src/date-field/date-field.test.tsx`:
```tsx
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { renderWithHydration } from '../testing/expect-hydration';
import * as DateField from './parts';

function dispatchPaste(element: Element, text: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  element.dispatchEvent(event);
}

describe('DateField', () => {
  it('fills a Korean date from eight typed digits and reports it once complete', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateField.Root aria-label="생년월일" locale={ko} name="birthDate" onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('20261014');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-14');
    expect((screen.container.querySelector('input[name="birthDate"]') as HTMLInputElement).value).toBe('2026-10-14');
  });

  it('follows the English month-day-year order', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateField.Root aria-label="Date" onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton').first().click();
    await userEvent.keyboard('10142026');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-14');
  });

  it('shows the separator given by the app', async () => {
    const screen = await render(<DateField.Root aria-label="Date" locale={ko} separator="-" defaultValue="2026-10-14" />);

    await expect.element(screen.getByRole('group')).toHaveTextContent('2026-10-14');
  });

  it('steps the focused segment with the arrow keys', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateField.Root aria-label="Date" locale={ko} defaultValue="2026-10-14" onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.day }).click();
    await userEvent.keyboard('{ArrowUp}');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-15');
  });

  it('reads a pasted date with any punctuation', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateField.Root aria-label="Date" locale={ko} onValueChange={onValueChange} />);
    const year = screen.getByRole('spinbutton', { name: ko.labels.year });
    await year.click();

    dispatchPaste(year.element(), '1990.3.15');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('1990-03-15');
  });

  it('enters a lunar leap-month date and emits it with the calendar annotation', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root aria-label="Date" locale={ko} calendars={[dangi]} defaultEntryCalendar="dangi" onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('199005');
    await userEvent.keyboard('L');
    await userEvent.keyboard('01');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('1990-06-23[u-ca=dangi]');
  });

  it('keeps a typed lunar day 30 in a 29-day month as an invalid entry instead of changing it', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root aria-label="Date" locale={ko} calendars={[dangi]} defaultEntryCalendar="dangi" onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('20251229');
    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).not.toBeNull();
    await userEvent.keyboard('{Backspace}30');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[1]?.validity.reasons).toContain('invalid-date');
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBeNull();
    await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day })).toHaveTextContent('30');
  });

  it('restores segment text and applies digits after uncancelable composition input', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateField.Root aria-label="Date" locale={ko} defaultValue="2026-10-14" onValueChange={onValueChange} />);
    const day = screen.getByRole('spinbutton', { name: ko.labels.day });
    await day.click();
    const dayElement = day.element() as HTMLElement;

    dayElement.textContent = '14garbage';
    dayElement.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: '0', bubbles: true }));
    dayElement.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: '9', bubbles: true }));

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-09');
    await expect.element(day).toHaveTextContent('09');
  });

  it('syncs a controlled value without reporting it back', async () => {
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState('2026-10-14');
      return (
        <>
          <DateField.Root aria-label="Date" locale={ko} value={value} onValueChange={onValueChange} />
          <button type="button" onClick={() => setValue('2027-01-02')}>
            Next year
          </button>
        </>
      );
    }
    const screen = await render(<Controlled />);

    await screen.getByRole('button', { name: 'Next year' }).click();

    await expect.element(screen.getByRole('group')).toHaveTextContent('2027');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('cannot be edited or focused while disabled', async () => {
    const screen = await render(<DateField.Root aria-label="Date" disabled defaultValue="2026-10-14" />);
    const segment = screen.getByRole('spinbutton').first();

    await expect.element(segment).toHaveAttribute('contenteditable', 'false');
    await expect.element(segment).toHaveAttribute('tabindex', '-1');
    await expect.element(screen.getByRole('group')).toHaveAttribute('data-disabled', '');
  });

  it('has no accessibility violations', async () => {
    const screen = await render(<DateField.Root aria-label="생년월일" locale={ko} calendars={[dangi]} defaultEntryCalendar="dangi" />);

    await expectNoAxeViolations(screen.container);
  });

  it('reports onBlur once when focus leaves the whole field, not between segments', async () => {
    const onBlur = vi.fn();
    const screen = await render(
      <>
        <DateField.Root aria-label="Date" locale={ko} onBlur={onBlur} />
        <button type="button">Next field</button>
      </>,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('{Tab}');
    expect(onBlur).not.toHaveBeenCalled();
    await screen.getByRole('button', { name: 'Next field' }).click();

    await expect.poll(() => onBlur.mock.calls.length).toBe(1);
  });

  it('hydrates without a mismatch', async () => {
    const { recoverableErrors, unmount } = await renderWithHydration(
      <DateField.Root aria-label="Date" locale={ko} today="2026-10-14" defaultValue="2026-10-14" />,
    );

    expect(recoverableErrors).toEqual([]);
    unmount();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/segments src/date-field`
Expected: FAIL — `Failed to resolve import "./segment-commands"` 등

- [ ] **Step 3: 세그먼트 공통 구현**

`packages/react/src/segments/segment-commands.ts`:
```ts
import type { SegmentEvent } from '@lunisolar-picker/core';

// Constraint: core는 붙여넣기를 필드별 이벤트(DateFieldEvent·TimeFieldEvent)로 둠. 세그먼트 공통 이벤트가 아니라서 여기서 합침 (M2 Task 8)
export type SegmentCommand =
  | SegmentEvent
  | { readonly type: 'text.paste'; readonly text: string }
  | { readonly type: 'leapMonth.toggle' };

export interface SegmentKeyOptions {
  readonly isRightToLeft: boolean;
  readonly canToggleLeapMonth: boolean;
}

const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['insertText', 'insertReplacementText', 'insertCompositionText']);
const DELETE_INPUT_TYPES: ReadonlySet<string> = new Set(['deleteContentBackward', 'deleteContentForward', 'deleteByCut', 'deleteWordBackward']);
const SEPARATOR_CHARACTERS: ReadonlySet<string> = new Set(['.', '-', '/', ':', ' ', ',']);
const DIGIT_PATTERN = /^\d$/;

// Constraint: 붙여넣기는 contentEditable에서 beforeinput의 data가 비어 있으므로 paste 리스너가 clipboardData로 처리함
export function commandsFromInput(inputType: string, data: string | null): readonly SegmentEvent[] {
  if (DELETE_INPUT_TYPES.has(inputType)) return [{ type: 'segment.erase' }];
  if (!TEXT_INPUT_TYPES.has(inputType) || data === null) return [];
  return Array.from(data).flatMap(characterCommands);
}

export function commandFromKey(key: string, options: SegmentKeyOptions): SegmentCommand | null {
  const backward = options.isRightToLeft ? 1 : -1;
  switch (key) {
    case 'ArrowUp':
      return { type: 'segment.step', amount: 1 };
    case 'ArrowDown':
      return { type: 'segment.step', amount: -1 };
    case 'ArrowLeft':
      return { type: 'focus.shift', amount: backward };
    case 'ArrowRight':
      return { type: 'focus.shift', amount: -backward };
    case 'Backspace':
    case 'Delete':
      return { type: 'segment.erase' };
    case 'l':
    case 'L':
      return options.canToggleLeapMonth ? { type: 'leapMonth.toggle' } : null;
    default:
      return null;
  }
}

export function readPastedText(event: ClipboardEvent): string {
  return event.clipboardData?.getData('text/plain') ?? '';
}

function characterCommands(character: string): SegmentEvent[] {
  if (DIGIT_PATTERN.test(character)) return [{ type: 'digit.type', digit: Number(character) }];
  if (SEPARATOR_CHARACTERS.has(character)) return [{ type: 'separator.type' }];
  return [];
}
```

`packages/react/src/segments/use-segmented-field.ts`:
```ts
import { type HTMLAttributes, type KeyboardEvent, type RefCallback, useCallback, useEffect, useRef } from 'react';
import { type DataAttributeProps, type PartName, partAttributes } from '../contract/data-attributes';
import { escapeHtml } from '../utilities/escape-html';
import { useLatestRef } from '../utilities/use-latest-ref';
import { type SegmentCommand, commandFromKey, commandsFromInput, readPastedText } from './segment-commands';

export interface SegmentDescription {
  readonly label: string;
  readonly displayText: string;
  readonly valueText: string;
  readonly isPlaceholder: boolean;
  readonly minValue: number;
  readonly maxValue: number;
  readonly value: number | null;
  readonly canToggleLeapMonth: boolean;
}

export interface SegmentedFieldOptions {
  readonly segmentCount: number;
  readonly focusedIndex: number | null;
  readonly describeSegment: (index: number) => SegmentDescription;
  readonly sendCommand: (command: SegmentCommand) => void;
  readonly segmentPart: PartName;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly isInvalid: boolean;
  readonly isRequired: boolean;
}

export type SegmentElementProps = HTMLAttributes<HTMLSpanElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLSpanElement>; readonly dangerouslySetInnerHTML: { readonly __html: string } };

export interface SegmentedField {
  readonly isFocusWithin: boolean;
  readonly rootRef: RefCallback<HTMLElement>;
  focusSegment(index: number): void;
  getSegmentProps(index: number): SegmentElementProps;
}

export function useSegmentedField(options: SegmentedFieldOptions): SegmentedField {
  const latest = useLatestRef(options);
  const rootRef = useRef<HTMLElement | null>(null);
  const segmentElements = useRef<Map<number, HTMLSpanElement>>(new Map());
  const segmentRefCallbacks = useRef<Map<number, RefCallback<HTMLSpanElement>>>(new Map());
  const { focusedIndex } = options;

  const focusSegment = useCallback((index: number) => {
    segmentElements.current.get(index)?.focus({ preventScroll: true });
  }, []);

  // Goal: core가 포커스 칸을 옮기면(자동 이동·←→) DOM 포커스도 따라감. 필드 밖에 포커스가 있으면 빼앗지 않음
  useEffect(() => {
    if (focusedIndex === null || !rootRef.current?.contains(document.activeElement)) return;
    const target = segmentElements.current.get(focusedIndex);
    if (target && document.activeElement !== target) target.focus({ preventScroll: true });
  }, [focusedIndex]);

  // Constraint: 네이티브 리스너는 칸마다 한 번만 붙이고 최신 상태는 ref로 읽음. ref 콜백이 매 렌더 바뀌면 리스너가 다시 붙음
  const segmentRefFor = useCallback(
    (index: number): RefCallback<HTMLSpanElement> => {
      const cached = segmentRefCallbacks.current.get(index);
      if (cached) return cached;
      const refCallback: RefCallback<HTMLSpanElement> = (element) => {
        if (!element) return;
        segmentElements.current.set(index, element);
        const release = bindSegmentElement(element, {
          sendCommands: (commands) => {
            for (const command of commands) latest.current.sendCommand(command);
          },
          readExpectedText: () => latest.current.describeSegment(index).displayText,
        });
        return () => {
          release();
          segmentElements.current.delete(index);
        };
      };
      segmentRefCallbacks.current.set(index, refCallback);
      return refCallback;
    },
    [latest],
  );

  const rootRefCallback = useCallback<RefCallback<HTMLElement>>((element) => {
    rootRef.current = element;
  }, []);

  const getSegmentProps = (index: number): SegmentElementProps => {
    const description = options.describeSegment(index);
    const isEditable = !options.isDisabled && !options.isReadOnly;
    const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
      const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl';
      const command = commandFromKey(event.key, { isRightToLeft, canToggleLeapMonth: description.canToggleLeapMonth });
      if (command === null || !isEditable) return;
      event.preventDefault();
      options.sendCommand(command);
    };
    return {
      ref: segmentRefFor(index),
      role: 'spinbutton',
      contentEditable: isEditable,
      suppressContentEditableWarning: true,
      inputMode: 'numeric',
      enterKeyHint: 'next',
      spellCheck: false,
      autoCapitalize: 'off',
      tabIndex: options.isDisabled ? -1 : 0,
      'aria-label': description.label,
      'aria-valuemin': description.minValue,
      'aria-valuemax': description.maxValue,
      'aria-valuenow': description.value ?? undefined,
      'aria-valuetext': description.valueText,
      'aria-invalid': options.isInvalid || undefined,
      'aria-readonly': options.isReadOnly || undefined,
      'aria-disabled': options.isDisabled || undefined,
      'aria-required': options.isRequired || undefined,
      onKeyDown,
      onFocus: () => options.sendCommand({ type: 'segment.focus', index }),
      onBlur: (event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!rootRef.current?.contains(nextFocus)) options.sendCommand({ type: 'segment.blur' });
      },
      // Constraint: 칸의 글자는 React 자식이 아니라 상태 기준 HTML로 고정. IME가 DOM을 먼저 바꿔도 React가 텍스트 노드를 잃지 않게 함
      dangerouslySetInnerHTML: { __html: escapeHtml(description.displayText) },
      ...partAttributes(options.segmentPart, {
        placeholder: description.isPlaceholder,
        focused: focusedIndex === index,
        invalid: options.isInvalid,
        disabled: options.isDisabled,
        readonly: options.isReadOnly,
      }),
    };
  };

  return { isFocusWithin: focusedIndex !== null, rootRef: rootRefCallback, focusSegment, getSegmentProps };
}

interface SegmentElementHandlers {
  readonly sendCommands: (commands: readonly SegmentCommand[]) => void;
  readonly readExpectedText: () => string;
}

function bindSegmentElement(element: HTMLElement, handlers: SegmentElementHandlers): () => void {
  const onBeforeInput = (event: InputEvent) => {
    if (!event.cancelable) return;
    event.preventDefault();
    handlers.sendCommands(commandsFromInput(event.inputType, event.data));
  };
  // Constraint: 안드로이드 IME 조합 입력은 beforeinput을 취소할 수 없어 DOM이 먼저 바뀜. input에서 숫자를 반영하고 글자를 상태 기준으로 되돌림 (Review Focus 1)
  const onInput = (event: Event) => {
    const inputEvent = event as InputEvent;
    handlers.sendCommands(commandsFromInput(inputEvent.inputType, inputEvent.data));
    queueMicrotask(() => restoreText(element, handlers.readExpectedText()));
  };
  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault();
    handlers.sendCommands([{ type: 'text.paste', text: readPastedText(event) }]);
  };
  element.addEventListener('beforeinput', onBeforeInput);
  element.addEventListener('input', onInput);
  element.addEventListener('paste', onPaste);
  return () => {
    element.removeEventListener('beforeinput', onBeforeInput);
    element.removeEventListener('input', onInput);
    element.removeEventListener('paste', onPaste);
  };
}

function restoreText(element: HTMLElement, expectedText: string): void {
  if (element.textContent !== expectedText) element.textContent = expectedText;
}
```

- [ ] **Step 4: DateField 구현**

`packages/react/src/date-field/use-date-field-core.ts`:
```ts
import {
  type CalendarId,
  type CalendarSystem,
  type EpochDay,
  toMonthCode,
} from '@lunisolar-picker/calendar';
import {
  type DateConstraints,
  type DateFieldEvent,
  type DateFieldResult,
  type DateFieldState,
  type DateSegmentKind,
  type PickerContext,
  type Segment,
  createDateFieldState,
  dateFieldReducer,
  dateFieldResult,
  findCalendar,
} from '@lunisolar-picker/core';
import { type ButtonHTMLAttributes, type FocusEvent, type HTMLAttributes, type RefCallback, useEffect, useMemo } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type SegmentedField, useSegmentedField } from '../segments/use-segmented-field';
import { usePickerContext } from '../settings/use-picker-context';
import type { PickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { createFocusLeaveListener } from '../utilities/focus-leave';

export interface DateFieldCoreOptions {
  readonly settings: PickerSettings;
  readonly constraints: DateConstraints;
  readonly initialEpochDay: EpochDay | null;
  readonly entryCalendarId: CalendarId;
  readonly separator: string | undefined;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly isRequired: boolean;
  readonly isInvalidFromApp: boolean;
  readonly onFocusLeave?: (() => void) | undefined;
}

export interface DateFieldCore {
  readonly state: DateFieldState;
  readonly context: PickerContext;
  readonly result: DateFieldResult;
  readonly entryCalendar: CalendarSystem;
  readonly separator: string;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly segmentedField: SegmentedField;
  send(event: DateFieldEvent): void;
  getRootProps(): HTMLAttributes<HTMLDivElement> &
    DataAttributeProps & { readonly ref: RefCallback<HTMLElement>; readonly onBlur: (event: FocusEvent<HTMLElement>) => void };
  getSeparatorProps(): HTMLAttributes<HTMLSpanElement> & DataAttributeProps;
  getLeapMonthToggleProps(): ButtonHTMLAttributes<HTMLButtonElement> & DataAttributeProps;
  isLeapMonthAvailable(): boolean;
}

const MONTH_SEGMENT_KIND: DateSegmentKind = 'month';
const YEAR_DIGITS = 4;
const MONTH_DAY_DIGITS = 2;

export function useDateFieldCore(options: DateFieldCoreOptions): DateFieldCore {
  const { settings, constraints, entryCalendarId } = options;
  const context = usePickerContext(settings, { constraints, commitMode: 'immediate', numberOfMonths: 1 });
  const { state, send } = useStoreInstance(
    () =>
      createDateFieldState(context, {
        selected: options.initialEpochDay === null ? null : { epochDay: options.initialEpochDay, calendarId: entryCalendarId },
        entryCalendarId,
      }),
    dateFieldReducer,
    context,
  );

  useEffect(() => {
    if (state.entryCalendarId !== entryCalendarId) send({ type: 'calendar.set', calendarId: entryCalendarId });
  }, [entryCalendarId, state.entryCalendarId, send]);

  const entryCalendar = findCalendar(settings.calendars, entryCalendarId);
  const result = useMemo(() => dateFieldResult(state, context), [state, context]);
  const isInvalid = options.isInvalidFromApp || (!result.validity.isValid && !result.validity.reasons.includes('incomplete'));
  const separator = options.separator ?? settings.locale.field.separator;
  const yearSegment = state.segments.find((segment) => segment.kind === 'year');
  const monthSegment = state.segments.find((segment) => segment.kind === MONTH_SEGMENT_KIND);
  const isLeapMonthAvailable = () => hasLeapMonth(entryCalendar, yearSegment?.value ?? null, monthSegment?.value ?? null);

  const segmentedField = useSegmentedField({
    segmentCount: state.segments.length,
    focusedIndex: state.focusedIndex,
    describeSegment: (index) => describeDateSegment(state, index, settings, isLeapMonthAvailable()),
    sendCommand: (command) => send(command),
    segmentPart: 'date-field-segment',
    isDisabled: options.isDisabled,
    isReadOnly: options.isReadOnly,
    isInvalid,
    isRequired: options.isRequired,
  });

  return {
    state,
    context,
    result,
    entryCalendar,
    separator,
    isInvalid,
    isDisabled: options.isDisabled,
    isReadOnly: options.isReadOnly,
    segmentedField,
    send,
    isLeapMonthAvailable,
    getRootProps: () => ({
      ref: segmentedField.rootRef,
      role: 'group',
      onBlur: createFocusLeaveListener(options.onFocusLeave),
      ...partAttributes('date-field', {
        invalid: isInvalid,
        disabled: options.isDisabled,
        readonly: options.isReadOnly,
        focused: segmentedField.isFocusWithin,
        calendar: entryCalendarId,
      }),
    }),
    getSeparatorProps: () => ({ 'aria-hidden': true, ...partAttributes('date-field-separator') }),
    getLeapMonthToggleProps: () => ({
      type: 'button',
      'aria-pressed': state.isLeapMonth,
      'aria-label': settings.locale.labels.leapMonth,
      disabled: options.isDisabled || options.isReadOnly || !isLeapMonthAvailable(),
      onClick: () => send({ type: 'leapMonth.toggle' }),
      ...partAttributes('date-field-leap-toggle', { selected: state.isLeapMonth }),
    }),
  };
}

function describeDateSegment(state: DateFieldState, index: number, settings: PickerSettings, isLeapMonthAvailable: boolean) {
  const segment = state.segments[index] as Segment<DateSegmentKind>;
  const { locale } = settings;
  const isMonth = segment.kind === MONTH_SEGMENT_KIND;
  const leapPrefix = isMonth && state.isLeapMonth ? locale.field.leapMonthPrefix : '';
  const digits = segment.kind === 'year' ? YEAR_DIGITS : MONTH_DAY_DIGITS;
  const valueDisplay = segment.value === null ? null : `${leapPrefix}${String(segment.value).padStart(digits, '0')}`;
  const placeholder = locale.field.placeholder[segment.kind];
  return {
    label: locale.labels[segment.kind],
    displayText: segment.typedText !== '' ? `${leapPrefix}${segment.typedText}` : (valueDisplay ?? placeholder),
    valueText: valueDisplay ?? placeholder,
    isPlaceholder: segment.value === null && segment.typedText === '',
    minValue: segment.minValue,
    maxValue: segment.maxValue,
    value: segment.value,
    canToggleLeapMonth: isMonth && isLeapMonthAvailable,
  };
}

function hasLeapMonth(calendar: CalendarSystem, year: number | null, month: number | null): boolean {
  if (year === null || month === null || calendar.id === 'gregory') return false;
  const isYearSupported = calendar.toEpochDay({ year, monthCode: 'M01', day: 1 }).isOk;
  return isYearSupported && calendar.monthsInYear(year).includes(toMonthCode(month, true));
}
```

`packages/react/src/date-field/use-date-field.ts`:
```ts
import { type CalendarId, type DateString, calendarIdOf, epochDayOf } from '@lunisolar-picker/calendar';
import type { DateConstraints } from '@lunisolar-picker/core';
import { useMemo, useState } from 'react';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useControllableState } from '../utilities/use-controllable-state';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';
import { type DateFieldCore, useDateFieldCore } from './use-date-field-core';

export interface UseDateFieldProps extends SharedPickerProps, DateConstraints {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: DateString | null, details: ValueChangeDetails) => void) | undefined;
  readonly entryCalendar?: CalendarId | undefined;
  readonly defaultEntryCalendar?: CalendarId | undefined;
  readonly onEntryCalendarChange?: ((calendarId: CalendarId) => void) | undefined;
  readonly separator?: string | undefined;
}

export interface DateFieldApi extends DateFieldCore {
  readonly value: DateString | null;
  readonly entryCalendarId: CalendarId;
  setEntryCalendar(calendarId: CalendarId): void;
  focus(): void;
  getHiddenInputProps(): HiddenInputProps;
}

export function useDateField(props: UseDateFieldProps): DateFieldApi {
  const settings = usePickerSettings(props);
  const controlled = useParsedValue(props.value, (input) => parseOptionalDate(input, settings.calendars), String, props.onInvalidValue);
  const [initialValue] = useStateOnce(() => controlled.value ?? parseOptionalDate(props.defaultValue, settings.calendars).value);
  const [entryCalendarId, setEntryCalendar] = useControllableState(
    props.entryCalendar,
    props.defaultEntryCalendar ?? (initialValue ? calendarIdOf(initialValue) : 'gregory'),
    props.onEntryCalendarChange,
  );
  const core = useDateFieldCore({
    settings,
    constraints: props,
    initialEpochDay: initialValue ? epochDayOf(initialValue) : null,
    entryCalendarId,
    separator: props.separator,
    isDisabled: props.disabled === true,
    isReadOnly: props.readOnly === true,
    isRequired: props.required === true,
    isInvalidFromApp: props.invalid === true,
    onFocusLeave: props.onBlur,
  });
  const value = useMemo(() => formatOrNull(core.result.epochDay, core.entryCalendar), [core.result.epochDay, core.entryCalendar]);
  const validity = core.result.validity;

  useValueBridge<DateString>({
    committedValue: value,
    controlled,
    isEqual: Object.is,
    syncStore: (next) =>
      core.send({
        type: 'value.sync',
        selected: next === null ? null : { epochDay: epochDayOf(next), calendarId: calendarIdOf(next) },
        entryCalendarId: next === null ? entryCalendarId : calendarIdOf(next),
      }),
    onValueChange: (next) => props.onValueChange?.(next, { validity }),
  });

  const focus = () => core.segmentedField.focusSegment(0);

  return {
    ...core,
    value,
    entryCalendarId,
    setEntryCalendar,
    focus,
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: value ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: focus,
    }),
  };
}

function useStateOnce<Value>(create: () => Value): readonly [Value] {
  const [value] = useState(create);
  return [value];
}
```

`packages/react/src/date-field/date-field-context.ts`:
```ts
import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { createContext, useContext } from 'react';
import type { DateFieldCore } from './use-date-field-core';

export const DateFieldContext = createContext<DateFieldCore | null>(null);

export function useDateFieldContext(): DateFieldCore {
  const field = useContext(DateFieldContext);
  if (!field) throw new LunisolarPickerError('DateField parts must be rendered inside <DateField.Root> or a DateRangeField side');
  return field;
}
```

`packages/react/src/date-field/parts.tsx`:
```tsx
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  Fragment,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput as HiddenInputElement, type HiddenInputProps } from '../value/hidden-input';
import { DateFieldContext, useDateFieldContext } from './date-field-context';
import { type DateFieldApi, type UseDateFieldProps, useDateField } from './use-date-field';

export interface DateFieldRenderState {
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
}

export interface RootProps extends UseDateFieldProps {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, DateFieldRenderState> | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly id?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly children?: ReactNode;
}

export function Root(props: RootProps): ReactElement {
  const field = useDateField(props);
  const appProps = {
    className: props.className,
    style: props.style,
    id: props.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
    children: props.children ?? <DefaultDateFieldContents field={field} />,
  };
  return (
    <DateFieldContext value={field}>
      {renderElement('div', props.render, mergeProps(field.getRootProps(), appProps), {
        isInvalid: field.isInvalid,
        isDisabled: field.isDisabled,
      })}
    </DateFieldContext>
  );
}

function DefaultDateFieldContents({ field }: { field: DateFieldApi }): ReactElement {
  return (
    <>
      {field.state.segments.map((segment, index) => (
        <Fragment key={segment.kind}>
          {index > 0 && <Separator />}
          <Segment index={index} />
        </Fragment>
      ))}
      <LeapMonthToggle />
      <HiddenInputElement {...field.getHiddenInputProps()} />
    </>
  );
}

export interface SegmentProps {
  readonly index: number;
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, { readonly index: number }> | undefined;
  readonly className?: string | undefined;
}

export function Segment({ index, render, className }: SegmentProps): ReactElement {
  const field = useDateFieldContext();
  return renderElement('span', render, mergeProps(field.segmentedField.getSegmentProps(index), { className }), { index });
}

export interface SeparatorProps extends HTMLAttributes<HTMLSpanElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, Record<string, never>> | undefined;
}

export function Separator({ render, children, ...props }: SeparatorProps): ReactElement {
  const field = useDateFieldContext();
  return renderElement('span', render, mergeProps(field.getSeparatorProps(), { ...props, children: children ?? field.separator }), {});
}

export interface LeapMonthToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, { readonly isLeapMonth: boolean }> | undefined;
}

// Goal: 음력 입력일 때만 보임. 그해 해당 달에 윤달이 없으면 비활성 (스펙 2.1, 계약 §2.7)
export function LeapMonthToggle({ render, children, ...props }: LeapMonthToggleProps): ReactElement | null {
  const field = useDateFieldContext();
  if (field.entryCalendar.id === 'gregory') return null;
  const toggleProps = mergeProps(field.getLeapMonthToggleProps(), {
    ...props,
    children: children ?? field.context.locale.labels.leapMonth,
  });
  return renderElement('button', render, toggleProps, { isLeapMonth: field.state.isLeapMonth });
}

export function HiddenInput(props: Partial<HiddenInputProps>): ReactElement | null {
  const field = useDateFieldContext() as Partial<DateFieldApi>;
  if (!field.getHiddenInputProps) return null;
  return <HiddenInputElement {...field.getHiddenInputProps()} {...props} />;
}

export { useDateFieldContext };
```

`packages/react/src/index.ts`에 추가:
```ts
export * as DateField from './date-field/parts';
export type { DateFieldApi, UseDateFieldProps } from './date-field/use-date-field';
export { useDateField } from './date-field/use-date-field';
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/segments src/date-field`
Expected: PASS. 윤달 테스트가 실패하면 M2의 윤달 토글 의미(계약 §2.7)와 키 `L` 처리 순서를 먼저 확인한다.

- [ ] **Step 6: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 숫자만 쳐서 양력·음력 날짜를 입력하는 칸 나뉜 날짜 입력 부품 지원" -m "- 휴대폰에서 숫자 키패드로 여덟 자리만 치면 끝나도록 칸마다 contentEditable spinbutton을 두고 로케일 순서·구분자를 따름.
- 안드로이드 IME가 beforeinput을 취소할 수 없어도 숫자는 상태에 반영하고 칸 글자는 상태 기준으로 되돌림.
- 음력 입력일 때만 윤달 토글을 보이고, 없는 30일은 고치지 않고 오류 상태로 둬 사용자가 친 값을 몰래 바꾸지 않음."
```

---

### Task 7: DateRangeField

> 🟡 잠정: M2 구현 결과에 따라 `validateEpochRange`·`ResolvedConstraints` 필드 이름이 바뀔 수 있음

**Files:**
- Create: `packages/react/src/date-range-field/use-date-range-field.ts`, `date-range-field-context.ts`, `parts.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/date-range-field/date-range-field.test.tsx`

**Interfaces:**
- Consumes: Task 6 `useDateFieldCore`, `DateFieldContext`, `DateField.Segment`·`Separator`; core `RangeConstraints`, `validateEpochRange`, `EpochRange`; calendar `normalizeDateRange`, `DateRangeValue`, `isSameRange`; Task 3
- Produces:
  - `interface UseDateRangeFieldProps extends SharedPickerProps, RangeConstraints { value?; defaultValue?; onValueChange?: (value: DateRangeValue | null, details: ValueChangeDetails) => void; entryCalendar?; defaultEntryCalendar?; onEntryCalendarChange?; separator?; startName?; endName? }`
  - `interface DateRangeFieldApi { readonly start: DateFieldCore; readonly end: DateFieldCore; readonly value: DateRangeValue | null; readonly validity: Validity; readonly entryCalendarId: CalendarId; setEntryCalendar(id): void; focus(): void; getRootProps(); getRangeSeparatorProps(); getHiddenInputProps(side: 'start' | 'end'): HiddenInputProps }`
  - `useDateRangeField(props): DateRangeFieldApi`
  - `DateRangeField.Root`, `DateRangeField.Start`, `DateRangeField.End`, `DateRangeField.Separator`, `useDateRangeFieldContext()`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/date-range-field/date-range-field.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import * as DateRangeField from './parts';

describe('DateRangeField', () => {
  it('moves from the completed start date to the end date while typing', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('2026101320261017');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: '2026-10-17' });
  });

  it('swaps a reversed range so the start never comes after the end', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('2026101720261013');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: '2026-10-17' });
  });

  it('emits an open-ended range only when an open end is allowed', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} isOpenEndAllowed onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('20261013');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: null });
  });

  it('flags a range longer than maxDays without changing it', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateRangeField.Root aria-label="기간" locale={ko} maxDays={3} limitMode="flag" onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('2026101320261017');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[1]?.validity.reasons).toContain('range-too-long');
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: '2026-10-17' });
    await expect.element(screen.getByRole('group', { name: '기간' })).toHaveAttribute('data-invalid', '');
  });

  it('submits each end under its own name', async () => {
    const screen = await render(
      <form aria-label="Report">
        <DateRangeField.Root aria-label="기간" locale={ko} startName="from" endName="to" defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />
      </form>,
    );
    const formData = new FormData(screen.getByRole('form').element() as HTMLFormElement);

    expect([formData.get('from'), formData.get('to')]).toEqual(['2026-10-13', '2026-10-17']);
  });

  it('has no accessibility violations', async () => {
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} />);

    await expectNoAxeViolations(screen.container);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/date-range-field`
Expected: FAIL — `Failed to resolve import "./parts"`

- [ ] **Step 3: 구현**

`packages/react/src/date-range-field/use-date-range-field.ts`:
```ts
import {
  type CalendarId,
  type DateRangeValue,
  type EpochDay,
  calendarIdOf,
  epochDayOf,
  isSameRange,
  normalizeDateRange,
} from '@lunisolar-picker/calendar';
import { type RangeConstraints, type Validity, validateEpochRange } from '@lunisolar-picker/core';
import { type FocusEvent, type HTMLAttributes, type RefCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type DateFieldCore, useDateFieldCore } from '../date-field/use-date-field-core';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useControllableState } from '../utilities/use-controllable-state';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { type DateRangeInput, parseOptionalRange } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { useValueBridge } from '../value/use-value-bridge';

export interface UseDateRangeFieldProps extends SharedPickerProps, RangeConstraints {
  readonly value?: DateRangeInput | null | undefined;
  readonly defaultValue?: DateRangeInput | null | undefined;
  readonly onValueChange?: ((value: DateRangeValue | null, details: ValueChangeDetails) => void) | undefined;
  readonly entryCalendar?: CalendarId | undefined;
  readonly defaultEntryCalendar?: CalendarId | undefined;
  readonly onEntryCalendarChange?: ((calendarId: CalendarId) => void) | undefined;
  readonly separator?: string | undefined;
  readonly startName?: string | undefined;
  readonly endName?: string | undefined;
}

export type RangeSide = 'start' | 'end';

export interface DateRangeFieldApi {
  readonly start: DateFieldCore;
  readonly end: DateFieldCore;
  readonly value: DateRangeValue | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly entryCalendarId: CalendarId;
  setEntryCalendar(calendarId: CalendarId): void;
  focus(): void;
  getRootProps(): HTMLAttributes<HTMLDivElement> &
    DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement>; readonly onBlur: (event: FocusEvent<HTMLElement>) => void };
  getRangeSeparatorProps(): HTMLAttributes<HTMLSpanElement> & DataAttributeProps;
  getHiddenInputProps(side: RangeSide): HiddenInputProps;
}

const VALID: Validity = { isValid: true, reasons: [] };

export function useDateRangeField(props: UseDateRangeFieldProps): DateRangeFieldApi {
  const settings = usePickerSettings(props);
  const describeRange = (input: DateRangeInput) => `${input.start}/${input.end ?? ''}`;
  const controlled = useParsedValue(props.value, (input) => parseOptionalRange(input, settings.calendars), describeRange, props.onInvalidValue);
  const [initialValue] = useState(() => controlled.value ?? parseOptionalRange(props.defaultValue, settings.calendars).value);
  const [entryCalendarId, setEntryCalendar] = useControllableState(
    props.entryCalendar,
    props.defaultEntryCalendar ?? (initialValue ? calendarIdOf(initialValue.start) : 'gregory'),
    props.onEntryCalendarChange,
  );
  const sharedCoreOptions = {
    settings,
    constraints: props,
    entryCalendarId,
    separator: props.separator,
    isDisabled: props.disabled === true,
    isReadOnly: props.readOnly === true,
    isRequired: props.required === true,
    isInvalidFromApp: props.invalid === true,
  };
  const start = useDateFieldCore({ ...sharedCoreOptions, initialEpochDay: initialValue ? epochDayOf(initialValue.start) : null });
  const end = useDateFieldCore({
    ...sharedCoreOptions,
    initialEpochDay: initialValue?.end ? epochDayOf(initialValue.end) : null,
  });

  const value = useMemo(
    () => combineRange(start.result.epochDay, end.result.epochDay, start, props.isOpenEndAllowed === true),
    [start.result.epochDay, end.result.epochDay, start, props.isOpenEndAllowed],
  );
  const validity = useMemo(
    () => rangeValidity(value, start, end),
    [value, start, end],
  );
  const isInvalid = props.invalid === true || !validity.isValid;

  useMoveToEndWhenStartCompletes(start, end);

  useValueBridge<DateRangeValue>({
    committedValue: value,
    controlled,
    isEqual: isSameRange,
    syncStore: (next) => {
      const calendarId = next ? calendarIdOf(next.start) : entryCalendarId;
      const startSelected = next ? { epochDay: epochDayOf(next.start), calendarId } : null;
      const endSelected = next?.end ? { epochDay: epochDayOf(next.end), calendarId } : null;
      start.send({ type: 'value.sync', selected: startSelected, entryCalendarId: calendarId });
      end.send({ type: 'value.sync', selected: endSelected, entryCalendarId: calendarId });
    },
    onValueChange: (next) => props.onValueChange?.(next, { validity }),
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const focus = () => start.segmentedField.focusSegment(0);

  return {
    start,
    end,
    value,
    validity,
    isInvalid,
    entryCalendarId,
    setEntryCalendar,
    focus,
    getRootProps: () => ({
      ref: (node) => {
        rootRef.current = node;
      },
      role: 'group',
      // Constraint: 시작·종료 칸 사이 이동은 필드 안이므로 그룹 전체를 벗어날 때만 알림
      onBlur: createFocusLeaveListener(props.onBlur),
      ...partAttributes('date-range-field', {
        invalid: isInvalid,
        disabled: props.disabled === true,
        readonly: props.readOnly === true,
        calendar: entryCalendarId,
      }),
    }),
    getRangeSeparatorProps: () => ({ 'aria-hidden': true, ...partAttributes('date-field-separator') }),
    getHiddenInputProps: (side) => {
      const sideValue = side === 'start' ? (value?.start ?? null) : (value?.end ?? null);
      return {
        name: side === 'start' ? props.startName : props.endName,
        form: props.form,
        value: sideValue ?? '',
        required: props.required === true && (side === 'start' || props.isOpenEndAllowed !== true),
        disabled: props.disabled,
        onFocusRequest: () => (side === 'start' ? start : end).segmentedField.focusSegment(0),
      };
    },
  };
}

function combineRange(startEpochDay: EpochDay | null, endEpochDay: EpochDay | null, start: DateFieldCore, isOpenEndAllowed: boolean) {
  const startValue = formatOrNull(startEpochDay, start.entryCalendar);
  if (startValue === null) return null;
  const endValue = formatOrNull(endEpochDay, start.entryCalendar);
  if (endValue === null && !isOpenEndAllowed) return null;
  const normalized = normalizeDateRange(startValue, endValue);
  return normalized.isOk ? normalized.value : null;
}

function rangeValidity(value: DateRangeValue | null, start: DateFieldCore, end: DateFieldCore): Validity {
  const fieldReasons = [...start.result.validity.reasons, ...end.result.validity.reasons];
  if (value === null) return fieldReasons.length > 0 ? { isValid: false, reasons: fieldReasons } : { isValid: false, reasons: ['incomplete'] };
  const epochRange = { start: epochDayOf(value.start), end: value.end ? epochDayOf(value.end) : null };
  const constraintValidity = validateEpochRange(epochRange, start.context.constraints);
  return constraintValidity.isValid ? VALID : constraintValidity;
}

// Goal: 시작일을 다 채우면 종료일 첫 칸으로 넘어감 (web-console DateRangeFields와 같은 흐름)
function useMoveToEndWhenStartCompletes(start: DateFieldCore, end: DateFieldCore): void {
  const previousStartEpochDay = useRef(start.result.epochDay);
  const lastSegmentIndex = start.state.segments.length - 1;
  useEffect(() => {
    const hasJustCompleted = previousStartEpochDay.current === null && start.result.epochDay !== null;
    previousStartEpochDay.current = start.result.epochDay;
    if (hasJustCompleted && start.state.focusedIndex === lastSegmentIndex) end.segmentedField.focusSegment(0);
  }, [start.result.epochDay, start.state.focusedIndex, lastSegmentIndex, end.segmentedField]);
}
```

`packages/react/src/date-range-field/date-range-field-context.ts`:
```ts
import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { createContext, useContext } from 'react';
import type { DateRangeFieldApi } from './use-date-range-field';

export const DateRangeFieldContext = createContext<DateRangeFieldApi | null>(null);

export function useDateRangeFieldContext(): DateRangeFieldApi {
  const field = useContext(DateRangeFieldContext);
  if (!field) throw new LunisolarPickerError('DateRangeField parts must be rendered inside <DateRangeField.Root>');
  return field;
}
```

`packages/react/src/date-range-field/parts.tsx`:
```tsx
import { type CSSProperties, Fragment, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { DateFieldContext } from '../date-field/date-field-context';
import { Separator as SegmentSeparator, Segment } from '../date-field/parts';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput } from '../value/hidden-input';
import { DateRangeFieldContext, useDateRangeFieldContext } from './date-range-field-context';
import { type RangeSide, type UseDateRangeFieldProps, useDateRangeField } from './use-date-range-field';

export interface RootProps extends UseDateRangeFieldProps {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, { readonly isInvalid: boolean }> | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly id?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly children?: ReactNode;
}

export function Root(props: RootProps): ReactElement {
  const field = useDateRangeField(props);
  const appProps = {
    className: props.className,
    style: props.style,
    id: props.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
    children: props.children ?? (
      <>
        <Start />
        <Separator />
        <End />
      </>
    ),
  };
  return (
    <DateRangeFieldContext value={field}>
      {renderElement('div', props.render, mergeProps(field.getRootProps(), appProps), { isInvalid: field.isInvalid })}
    </DateRangeFieldContext>
  );
}

export interface SideProps {
  readonly children?: ReactNode;
  readonly className?: string | undefined;
}

function Side({ side, children, className }: SideProps & { readonly side: RangeSide }): ReactElement {
  const range = useDateRangeFieldContext();
  const core = range[side];
  const label = side === 'start' ? core.context.locale.labels.rangeStart : core.context.locale.labels.rangeEnd;
  return (
    <DateFieldContext value={core}>
      <div {...mergeProps(core.getRootProps(), { className, 'aria-label': label })}>
        {children ??
          core.state.segments.map((segment, index) => (
            <Fragment key={segment.kind}>
              {index > 0 && <SegmentSeparator />}
              <Segment index={index} />
            </Fragment>
          ))}
        <HiddenInput {...range.getHiddenInputProps(side)} />
      </div>
    </DateFieldContext>
  );
}

export function Start(props: SideProps): ReactElement {
  return <Side side="start" {...props} />;
}

export function End(props: SideProps): ReactElement {
  return <Side side="end" {...props} />;
}

export interface SeparatorProps extends HTMLAttributes<HTMLSpanElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, Record<string, never>> | undefined;
}

export function Separator({ render, children, ...props }: SeparatorProps): ReactElement {
  const range = useDateRangeFieldContext();
  const separatorProps = mergeProps(range.getRangeSeparatorProps(), {
    ...props,
    children: children ?? range.start.context.locale.rangeSeparator,
  });
  return renderElement('span', render, separatorProps, {});
}

export { useDateRangeFieldContext };
```

`packages/react/src/index.ts`에 추가:
```ts
export * as DateRangeField from './date-range-field/parts';
export type { DateRangeFieldApi, UseDateRangeFieldProps } from './date-range-field/use-date-range-field';
export { useDateRangeField } from './date-range-field/use-date-range-field';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/date-range-field`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 시작일과 종료일을 이어서 타이핑하는 기간 입력 부품 지원" -m "- 시작일을 다 채우면 종료일 첫 칸으로 넘어가고, 뒤집힌 기간은 순서를 바꿔 내보내 앱이 정렬을 신경 쓰지 않게 함.
- 최대 기간을 넘은 경우 값을 자르지 않고 유효성 이유만 알려 경고 UI는 앱이 정하게 함.
- 시작일·종료일을 각자 이름의 숨은 입력으로 내보내 네이티브 form 제출을 받음."
```

---

### Task 8: TimeField

> 🟡 잠정: M2 구현 결과에 따라 `TimeFieldState`·`TimeFieldEvent`·`TimeFieldContext`·`createTimeFieldState`·`timeFieldReducer`·`timeFieldResult`가 바뀔 수 있음

> 정합성 조정(2026-10-14): M2 정의대로 `createTimeFieldState(initial, context)`로 부른다(시 칸 최댓값이 `24:00` 허용 여부에 따라 달라짐). `ValueChangeDetails`는 settings에서 가져오고, 필드 밖으로 포커스가 나가면 `onBlur`를 부른다.

**Files:**
- Create: `packages/react/src/time-field/use-time-field.ts`, `time-field-context.ts`, `parts.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/time-field/time-field.test.tsx`

**Interfaces:**
- Consumes: core `TimeFieldState`, `TimeFieldEvent`, `TimeFieldContext`, `TimeSegmentKind`, `Segment`, `createTimeFieldState`, `timeFieldReducer`, `timeFieldResult`, `Validity`; calendar `TimeString`; Task 1~3, Task 6 `useSegmentedField`
- Produces:
  - `interface UseTimeFieldProps extends SharedPickerProps { value?: string | null; defaultValue?: string | null; onValueChange?: (value: TimeString | null, details: ValueChangeDetails) => void; minuteStep?: number; isEndOfDayAllowed?: boolean }`
  - `interface TimeFieldApi { readonly state; readonly value: TimeString | null; readonly validity: Validity; readonly isInvalid: boolean; readonly segmentedField: SegmentedField; send(event); focus(); getRootProps(); getSeparatorProps(); getHiddenInputProps(): HiddenInputProps }`
  - `useTimeField(props): TimeFieldApi`
  - `TimeField.Root`, `TimeField.Segment`, `TimeField.Separator`, `TimeField.HiddenInput`, `useTimeFieldContext()`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/time-field/time-field.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import * as TimeField from './parts';

describe('TimeField', () => {
  it('reads 930 as 09:30', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<TimeField.Root aria-label="시각" locale={ko} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.hour }).click();
    await userEvent.keyboard('930');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:30');
  });

  it('steps minutes by the minute step', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <TimeField.Root aria-label="시각" locale={ko} defaultValue="09:30" minuteStep={5} onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.minute }).click();
    await userEvent.keyboard('{ArrowUp}');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:35');
  });

  it('shows 24-hour digits even in an English locale', async () => {
    const screen = await render(<TimeField.Root aria-label="Time" defaultValue="21:05" />);

    await expect.element(screen.getByRole('group')).toHaveTextContent('21:05');
    await expect.element(screen.getByRole('group')).not.toHaveTextContent('PM');
  });

  it('rejects 24:00 unless end of day is allowed', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<TimeField.Root aria-label="Time" onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton').first().click();
    await userEvent.keyboard('2400');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[1]?.validity.reasons).toContain('invalid-time');
    expect(onValueChange.mock.calls.at(-1)?.[0] ?? null).toBeNull();
  });

  it('accepts 24:00 when end of day is allowed', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<TimeField.Root aria-label="Time" isEndOfDayAllowed onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton').first().click();
    await userEvent.keyboard('2400');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('24:00');
  });

  it('submits the time under its name and has no accessibility violations', async () => {
    const screen = await render(
      <form aria-label="Schedule">
        <TimeField.Root aria-label="Start time" name="startTime" defaultValue="09:00" />
      </form>,
    );

    expect(new FormData(screen.getByRole('form').element() as HTMLFormElement).get('startTime')).toBe('09:00');
    await expectNoAxeViolations(screen.container);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/time-field`
Expected: FAIL — `Failed to resolve import "./parts"`

- [ ] **Step 3: 구현**

`packages/react/src/time-field/use-time-field.ts`:
```ts
import type { TimeString } from '@lunisolar-picker/calendar';
import {
  type Segment,
  type TimeFieldContext,
  type TimeFieldEvent,
  type TimeFieldState,
  type TimeSegmentKind,
  type Validity,
  createTimeFieldState,
  timeFieldReducer,
  timeFieldResult,
} from '@lunisolar-picker/core';
import { type HTMLAttributes, type RefCallback, useMemo, useState } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type SegmentedField, useSegmentedField } from '../segments/use-segmented-field';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import type { HiddenInputProps } from '../value/hidden-input';
import { parseOptionalTime } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

export interface UseTimeFieldProps extends SharedPickerProps {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: TimeString | null, details: ValueChangeDetails) => void) | undefined;
  readonly minuteStep?: number | undefined;
  readonly isEndOfDayAllowed?: boolean | undefined;
}

export interface TimeFieldApi {
  readonly state: TimeFieldState;
  readonly value: TimeString | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly segmentedField: SegmentedField;
  send(event: TimeFieldEvent): void;
  focus(): void;
  getRootProps(): HTMLAttributes<HTMLDivElement> & DataAttributeProps & { readonly ref: RefCallback<HTMLElement> };
  getSeparatorProps(): HTMLAttributes<HTMLSpanElement> & DataAttributeProps;
  getHiddenInputProps(): HiddenInputProps;
}

const DEFAULT_MINUTE_STEP = 1;
const TIME_PART_DIGITS = 2;

export function useTimeField(props: UseTimeFieldProps): TimeFieldApi {
  const settings = usePickerSettings(props);
  const isEndOfDayAllowed = props.isEndOfDayAllowed === true;
  const minuteStep = props.minuteStep ?? DEFAULT_MINUTE_STEP;
  const parseTimeInput = (input: string | null | undefined) => parseOptionalTime(input, { isEndOfDayAllowed });
  const controlled = useParsedValue(props.value, parseTimeInput, String, props.onInvalidValue);
  const [initialValue] = useState(() => controlled.value ?? parseTimeInput(props.defaultValue).value);
  const context: TimeFieldContext = useMemo(() => ({ minuteStep, isEndOfDayAllowed }), [minuteStep, isEndOfDayAllowed]);
  const { state, send } = useStoreInstance(() => createTimeFieldState(initialValue, context), timeFieldReducer, context);
  const result = useMemo(() => timeFieldResult(state, context), [state, context]);
  const isInvalid = props.invalid === true || (!result.validity.isValid && !result.validity.reasons.includes('incomplete'));
  const isDisabled = props.disabled === true;

  const segmentedField = useSegmentedField({
    segmentCount: state.segments.length,
    focusedIndex: state.focusedIndex,
    describeSegment: (index) => describeTimeSegment(state.segments[index] as Segment<TimeSegmentKind>, settings),
    sendCommand: (command) => {
      if (command.type !== 'leapMonth.toggle') send(command);
    },
    segmentPart: 'time-field-segment',
    isDisabled,
    isReadOnly: props.readOnly === true,
    isInvalid,
    isRequired: props.required === true,
  });

  useValueBridge<TimeString>({
    committedValue: result.time,
    controlled,
    isEqual: Object.is,
    syncStore: (next) => send({ type: 'value.sync', time: next }),
    onValueChange: (next) => props.onValueChange?.(next, { validity: result.validity }),
  });

  const focus = () => segmentedField.focusSegment(0);

  return {
    state,
    value: result.time,
    validity: result.validity,
    isInvalid,
    isDisabled,
    segmentedField,
    send,
    focus,
    getRootProps: () => ({
      ref: segmentedField.rootRef,
      role: 'group',
      onBlur: createFocusLeaveListener(props.onBlur),
      ...partAttributes('time-field', {
        invalid: isInvalid,
        disabled: isDisabled,
        readonly: props.readOnly === true,
        focused: segmentedField.isFocusWithin,
      }),
    }),
    getSeparatorProps: () => ({ 'aria-hidden': true, ...partAttributes('time-field-separator') }),
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: result.time ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: focus,
    }),
  };
}

function describeTimeSegment(segment: Segment<TimeSegmentKind>, settings: ReturnType<typeof usePickerSettings>) {
  const { locale } = settings;
  const valueDisplay = segment.value === null ? null : String(segment.value).padStart(TIME_PART_DIGITS, '0');
  const placeholder = locale.field.placeholder[segment.kind];
  return {
    label: locale.labels[segment.kind],
    displayText: segment.typedText !== '' ? segment.typedText : (valueDisplay ?? placeholder),
    valueText: valueDisplay ?? placeholder,
    isPlaceholder: segment.value === null && segment.typedText === '',
    minValue: segment.minValue,
    maxValue: segment.maxValue,
    value: segment.value,
    canToggleLeapMonth: false,
  };
}
```

`packages/react/src/time-field/time-field-context.ts`:
```ts
import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { createContext, useContext } from 'react';
import type { TimeFieldApi } from './use-time-field';

export const TimeFieldContext = createContext<TimeFieldApi | null>(null);

export function useTimeFieldContext(): TimeFieldApi {
  const field = useContext(TimeFieldContext);
  if (!field) throw new LunisolarPickerError('TimeField parts must be rendered inside <TimeField.Root>');
  return field;
}
```

`packages/react/src/time-field/parts.tsx`:
```tsx
import { type CSSProperties, Fragment, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput as HiddenInputElement } from '../value/hidden-input';
import { TimeFieldContext, useTimeFieldContext } from './time-field-context';
import { type UseTimeFieldProps, useTimeField } from './use-time-field';

const TIME_SEPARATOR = ':';

export interface RootProps extends UseTimeFieldProps {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, { readonly isInvalid: boolean }> | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly id?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly children?: ReactNode;
}

export function Root(props: RootProps): ReactElement {
  const field = useTimeField(props);
  const appProps = {
    className: props.className,
    style: props.style,
    id: props.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
    children: props.children ?? (
      <>
        {field.state.segments.map((segment, index) => (
          <Fragment key={segment.kind}>
            {index > 0 && <Separator />}
            <Segment index={index} />
          </Fragment>
        ))}
        <HiddenInput />
      </>
    ),
  };
  return (
    <TimeFieldContext value={field}>
      {renderElement('div', props.render, mergeProps(field.getRootProps(), appProps), { isInvalid: field.isInvalid })}
    </TimeFieldContext>
  );
}

export interface SegmentProps {
  readonly index: number;
  readonly className?: string | undefined;
}

export function Segment({ index, className }: SegmentProps): ReactElement {
  const field = useTimeFieldContext();
  return <span {...mergeProps(field.segmentedField.getSegmentProps(index), { className })} />;
}

export function Separator({ children, ...props }: HTMLAttributes<HTMLSpanElement>): ReactElement {
  const field = useTimeFieldContext();
  return <span {...mergeProps(field.getSeparatorProps(), { ...props, children: children ?? TIME_SEPARATOR })} />;
}

export function HiddenInput(): ReactElement | null {
  const field = useTimeFieldContext();
  return <HiddenInputElement {...field.getHiddenInputProps()} />;
}

export { useTimeFieldContext };
```

`packages/react/src/index.ts`에 추가:
```ts
export * as TimeField from './time-field/parts';
export type { TimeFieldApi, UseTimeFieldProps } from './time-field/use-time-field';
export { useTimeField } from './time-field/use-time-field';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/time-field`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 기기 로케일과 상관없이 24시간제로 입력하는 시간 입력 부품 지원" -m "- 네이티브 time 입력은 기기 설정에 따라 오전·오후로 바뀌어 web-console이 대체했던 문제를 피하려고 24시간제 칸 입력으로 둠.
- 분 칸은 분 간격 단위로 움직이고, 24:00은 하루 끝을 허용한 경우에만 받음."
```

---

### Task 9: Wheel, useWheel, useWheelDate

> 🟡 잠정: M2 구현 결과에 따라 `ColumnOption`·`ColumnState`·`ColumnEvent`·`columnReducer`·`buildWheelDateColumns`·`constrainDateFields`·`createVelocityTracker`·`projectInertia`·`easeOutPosition`이 바뀔 수 있음

**Files:**
- Create: `packages/react/src/wheel/wheel-geometry.ts`, `use-wheel-motion.ts`, `use-wheel.ts`, `parts.tsx`, `use-wheel-date.ts`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/wheel/wheel-geometry.test.ts`, `packages/react/src/wheel/wheel.test.tsx`, `packages/react/src/wheel/use-wheel-date.test.tsx`

**Interfaces:**
- Consumes: core `ColumnOption`, `ColumnState`, `ColumnEvent`, `createColumnState`, `columnReducer`, `buildWheelDateColumns`, `constrainDateFields`, `WheelDateColumns`, `createVelocityTracker`, `projectInertia`, `easeOutPosition`, `DateConstraints`; calendar `DateFields`, `DateString`, `MonthCode`, `CalendarId`, `epochDayOf`, `calendarIdOf`, `formatDate`; Task 1~3
- Produces:
  - `normalizeWheelDelta(deltaY: number, deltaMode: number, pageHeight: number): number`, `clampPosition(position: number, itemCount: number): number`, `nearestEnabledIndex<Value>(options: readonly ColumnOption<Value>[], index: number): number`, `renderWindowAround(centerIndex: number, itemCount: number, radius: number): { readonly start: number; readonly end: number }`
  - `interface UseWheelProps<Value> { readonly options: readonly ColumnOption<Value>[]; readonly value: Value; readonly onValueChange: (value: Value) => void; readonly isEqual?: (first: Value, second: Value) => boolean; readonly label: string; readonly disabled?: boolean }`
  - `interface WheelApi { readonly selectedIndex: number; readonly renderedRange: { start: number; end: number }; getColumnProps(); getTrackProps(); getItemProps(index: number) }`, `useWheel<Value>(props): WheelApi`
  - `Wheel.Root`, `Wheel.Column`, `Wheel.Item`, `Wheel.Highlight`
  - `interface UseWheelDateProps extends SharedPickerProps, DateConstraints { value?; defaultValue?; onValueChange?: (value: DateString | null, details) => void; entryCalendar?; defaultEntryCalendar?; onEntryCalendarChange? }`
  - `interface WheelDateApi { readonly fields: DateFields; readonly columns: WheelDateColumns; readonly value: DateString | null; readonly entryCalendarId: CalendarId; readonly labels: { readonly year: string; readonly month: string; readonly day: string }; selectYear(year: number): void; selectMonth(monthCode: MonthCode): void; selectDay(day: number): void; setEntryCalendar(calendarId: CalendarId): void }`, `useWheelDate(props): WheelDateApi`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/wheel/wheel-geometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clampPosition, nearestEnabledIndex, normalizeWheelDelta, renderWindowAround } from './wheel-geometry';

const option = (value: number, isDisabled = false) => ({ value, label: String(value), isDisabled });

describe('wheel-geometry', () => {
  it.each([
    [120, 0, 600, 120],
    [3, 1, 600, 48],
    [1, 2, 600, 600],
  ])('normalizes delta %i in mode %i to %i pixels', (deltaY, deltaMode, pageHeight, expected) => {
    expect(normalizeWheelDelta(deltaY, deltaMode, pageHeight)).toBe(expected);
  });

  it('keeps the position between the first and last item', () => {
    expect(clampPosition(-2, 10)).toBe(0);
    expect(clampPosition(12, 10)).toBe(9);
    expect(clampPosition(4.5, 10)).toBe(4.5);
  });

  it('skips disabled options toward the closest enabled one', () => {
    const options = [option(1), option(2, true), option(3, true), option(4)];

    expect(nearestEnabledIndex(options, 1)).toBe(0);
    expect(nearestEnabledIndex(options, 2)).toBe(3);
  });

  it('renders only a window of items around the center', () => {
    expect(renderWindowAround(5000, 9999, 20)).toEqual({ start: 4980, end: 5020 });
    expect(renderWindowAround(3, 9999, 20)).toEqual({ start: 0, end: 23 });
  });
});
```

`packages/react/src/wheel/wheel.test.tsx`:
```tsx
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import * as Wheel from './parts';

const years = Array.from({ length: 9999 }, (_, index) => ({ value: index + 1, label: String(index + 1), isDisabled: false }));
const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1}월`, isDisabled: index === 1 }));

function YearWheel({ onValueChange }: { onValueChange: (value: number) => void }) {
  const [value, setValue] = useState(1990);
  return (
    <Wheel.Root aria-label="Birth date">
      <Wheel.Highlight />
      <Wheel.Column
        label="Year"
        options={years}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
      />
    </Wheel.Root>
  );
}

function MonthWheel({ onValueChange }: { onValueChange: (value: number) => void }) {
  const [value, setValue] = useState(1);
  return (
    <Wheel.Root aria-label="Month">
      <Wheel.Column
        label="Month"
        options={months}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
      />
    </Wheel.Root>
  );
}

describe('Wheel', () => {
  it('exposes the column as a spinbutton with readable value text', async () => {
    const screen = await render(<MonthWheel onValueChange={vi.fn()} />);

    await expect.element(screen.getByRole('spinbutton', { name: 'Month' })).toHaveAttribute('aria-valuetext', '1월');
    await expectNoAxeViolations(screen.container);
  });

  it('steps with arrow keys and skips disabled options', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<MonthWheel onValueChange={onValueChange} />);
    await screen.getByRole('spinbutton', { name: 'Month' }).click();

    await userEvent.keyboard('{ArrowDown}');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(3);
  });

  it('jumps to the last option with End', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<MonthWheel onValueChange={onValueChange} />);
    await screen.getByRole('spinbutton', { name: 'Month' }).click();

    await userEvent.keyboard('{End}');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(12);
  });

  it('moves by whole items after a mouse wheel scroll settles', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<YearWheel onValueChange={onValueChange} />);
    const column = screen.getByRole('spinbutton', { name: 'Year' });
    const itemHeight = (document.querySelector('[data-lsp-part="wheel-item"]') as HTMLElement).getBoundingClientRect().height;

    await userEvent.wheel(column, { delta: { y: itemHeight * 3 } });

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0], { timeout: 2000 }).toBe(1993);
  });

  it('selects a later year after dragging the column upward', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<YearWheel onValueChange={onValueChange} />);
    const items = screen.getByText('1992');

    await userEvent.dragAndDrop(items, screen.getByText('1989'));

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0], { timeout: 3000 }).toBeGreaterThan(1990);
  });

  it('keeps the DOM small for long columns by rendering a window of items', async () => {
    await render(<YearWheel onValueChange={vi.fn()} />);

    expect(document.querySelectorAll('[data-lsp-part="wheel-item"]').length).toBeLessThan(100);
  });
});
```

`packages/react/src/wheel/use-wheel-date.test.tsx`:
```tsx
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { type UseWheelDateProps, useWheelDate } from './use-wheel-date';

function WheelDateProbe(props: UseWheelDateProps) {
  const wheelDate = useWheelDate(props);
  return (
    <>
      <output>{JSON.stringify({ fields: wheelDate.fields, value: wheelDate.value })}</output>
      <button type="button" onClick={() => wheelDate.selectYear(1991)}>
        1991
      </button>
      <button type="button" onClick={() => wheelDate.selectMonth('M02')}>
        February
      </button>
    </>
  );
}

async function readProbe(screen: Awaited<ReturnType<typeof render>>) {
  return JSON.parse(screen.getByRole('status').element().textContent ?? '{}') as { fields: unknown; value: unknown };
}

describe('useWheelDate', () => {
  it('replaces a leap month that disappears in the new year with its regular month', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <WheelDateProbe locale={ko} calendars={[dangi]} defaultValue="1990-06-23[u-ca=dangi]" onValueChange={onValueChange} />,
    );
    expect((await readProbe(screen)).fields).toEqual({ year: 1990, monthCode: 'M05L', day: 1 });

    await screen.getByRole('button', { name: '1991' }).click();

    await expect.poll(async () => (await readProbe(screen)).fields).toEqual({ year: 1991, monthCode: 'M05', day: 1 });
    expect(onValueChange.mock.calls.at(-1)?.[0]).toMatch(/\[u-ca=dangi\]$/);
  });

  it('moves day 31 to the last day of a shorter Gregorian month', async () => {
    const screen = await render(<WheelDateProbe defaultValue="2026-01-31" />);

    await screen.getByRole('button', { name: 'February' }).click();

    await expect.poll(async () => (await readProbe(screen)).value).toBe('2026-02-28');
  });

  it('starts from today clamped to the constraints when there is no value', async () => {
    const screen = await render(<WheelDateProbe today="2026-10-14" max="2026-01-01" />);

    expect((await readProbe(screen)).value).toBe('2026-01-01');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/wheel`
Expected: FAIL — `Failed to resolve import "./wheel-geometry"` 등

- [ ] **Step 3: 구현**

`packages/react/src/wheel/wheel-geometry.ts`:
```ts
import type { ColumnOption } from '@lunisolar-picker/core';

const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const LINE_HEIGHT_PIXELS = 16;

// Goal: 마우스 휠은 줄 단위, 트랙패드는 픽셀 단위로 보냄. 브라우저마다 다른 deltaMode를 픽셀로 맞춤 (스펙 10.3)
export function normalizeWheelDelta(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === DOM_DELTA_LINE) return deltaY * LINE_HEIGHT_PIXELS;
  if (deltaMode === DOM_DELTA_PAGE) return deltaY * pageHeight;
  return deltaY;
}

export function clampPosition(position: number, itemCount: number): number {
  return Math.min(Math.max(position, 0), Math.max(itemCount - 1, 0));
}

export function nearestEnabledIndex<Value>(options: readonly ColumnOption<Value>[], index: number): number {
  const clampedIndex = clampPosition(Math.round(index), options.length);
  for (let distance = 0; distance < options.length; distance += 1) {
    const before = options[clampedIndex - distance];
    if (before && !before.isDisabled) return clampedIndex - distance;
    const after = options[clampedIndex + distance];
    if (after && !after.isDisabled) return clampedIndex + distance;
  }
  return clampedIndex;
}

export function renderWindowAround(centerIndex: number, itemCount: number, radius: number): { readonly start: number; readonly end: number } {
  const start = Math.max(0, Math.round(centerIndex) - radius);
  const end = Math.min(itemCount - 1, Math.round(centerIndex) + radius);
  return { start, end };
}
```

`packages/react/src/wheel/use-wheel-motion.ts`:
```ts
import { easeOutPosition } from '@lunisolar-picker/core';
import { type RefObject, useCallback, useEffect, useRef } from 'react';

export const WHEEL_POSITION_PROPERTY = '--lsp-wheel-position';
const DEFAULT_ITEM_SIZE_PIXELS = 36;
const SNAP_DURATION_MILLISECONDS = 220;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface WheelMotion {
  readonly positionRef: RefObject<number>;
  setPosition(position: number): void;
  animateTo(position: number, durationMilliseconds: number | undefined, onSettle: () => void): void;
  stop(): void;
  readItemSize(): number;
}

// Goal: 휠 위치는 CSS 변수 하나(항목 단위 숫자)만 갱신해 매 프레임 React 렌더를 거치지 않음 (스펙 6.2)
// Constraint: Safari 15.5는 px끼리 나누는 calc()를 못 함 → 위치를 픽셀이 아니라 항목 수로 넘김
export function useWheelMotion(columnRef: RefObject<HTMLElement | null>): WheelMotion {
  const positionRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const setPosition = useCallback(
    (position: number) => {
      positionRef.current = position;
      columnRef.current?.style.setProperty(WHEEL_POSITION_PROPERTY, String(position));
    },
    [columnRef],
  );

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const animateTo = useCallback(
    (target: number, durationMilliseconds: number | undefined, onSettle: () => void) => {
      stop();
      const isReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      const duration = isReducedMotion ? 0 : (durationMilliseconds ?? SNAP_DURATION_MILLISECONDS);
      if (duration <= 0) {
        setPosition(target);
        onSettle();
        return;
      }
      const from = positionRef.current;
      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        setPosition(easeOutPosition(from, target, elapsed, duration));
        if (elapsed < duration) {
          frameRef.current = requestAnimationFrame(step);
          return;
        }
        frameRef.current = null;
        setPosition(target);
        onSettle();
      };
      frameRef.current = requestAnimationFrame(step);
    },
    [setPosition, stop],
  );

  const readItemSize = useCallback(() => {
    const item = columnRef.current?.querySelector<HTMLElement>('[data-lsp-part="wheel-item"]');
    return item?.getBoundingClientRect().height || DEFAULT_ITEM_SIZE_PIXELS;
  }, [columnRef]);

  useEffect(() => stop, [stop]);

  return { positionRef, setPosition, animateTo, stop, readItemSize };
}
```

`packages/react/src/wheel/use-wheel.ts`:
```ts
import {
  type ColumnOption,
  columnReducer,
  createColumnState,
  createVelocityTracker,
  projectInertia,
} from '@lunisolar-picker/core';
import {
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { useStoreInstance } from '../store/use-store-instance';
import { useLatestRef } from '../utilities/use-latest-ref';
import { useWheelMotion } from './use-wheel-motion';
import { clampPosition, nearestEnabledIndex, normalizeWheelDelta, renderWindowAround } from './wheel-geometry';

export interface UseWheelProps<Value> {
  readonly options: readonly ColumnOption<Value>[];
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
  readonly isEqual?: ((first: Value, second: Value) => boolean) | undefined;
  readonly label: string;
  readonly disabled?: boolean | undefined;
}

export interface WheelApi {
  readonly selectedIndex: number;
  readonly renderedRange: { readonly start: number; readonly end: number };
  getColumnProps(): HTMLAttributes<HTMLDivElement> & DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement> };
  getTrackProps(): HTMLAttributes<HTMLDivElement> & DataAttributeProps;
  getItemProps(index: number): HTMLAttributes<HTMLDivElement> & DataAttributeProps & { readonly style: CSSProperties };
}

const DRAG_THRESHOLD_PIXELS = 4;
const WHEEL_SETTLE_DELAY_MILLISECONDS = 120;
const PAGE_STEP = 5;
const RENDER_RADIUS = 30;
const RECENTER_DISTANCE = 10;
const WHEEL_INDEX_PROPERTY = '--lsp-wheel-index';

export function useWheel<Value>(props: UseWheelProps<Value>): WheelApi {
  const isEqual = props.isEqual ?? Object.is;
  const reducer = useMemo(() => columnReducer<Value>(isEqual), [isEqual]);
  const { state, send } = useStoreInstance(() => createColumnState(props.options, props.value, isEqual), reducer, undefined);
  const latest = useLatestRef({ props, state });
  const columnRef = useRef<HTMLDivElement | null>(null);
  const motion = useWheelMotion(columnRef);
  const [renderCenter, setRenderCenter] = useState(state.selectedIndex);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    send({ type: 'options.replace', options: props.options, preferredValue: props.value });
  }, [props.options, props.value, send]);

  const commitIndex = useCallback(
    (index: number) => {
      const { props: currentProps, state: currentState } = latest.current;
      const option = currentProps.options[index];
      isInteractingRef.current = false;
      if (!option || index === currentState.selectedIndex) return;
      send({ type: 'option.select', index });
      currentProps.onValueChange(option.value);
    },
    [latest, send],
  );

  const settleAt = useCallback(
    (position: number, durationMilliseconds?: number) => {
      const targetIndex = nearestEnabledIndex(latest.current.props.options, position);
      setRenderCenter(targetIndex);
      motion.animateTo(targetIndex, durationMilliseconds, () => commitIndex(targetIndex));
    },
    [latest, motion, commitIndex],
  );

  // Goal: 값이 밖에서 바뀌거나(제어 값·항목 교체) 처음 그릴 때 위치를 선택된 항목에 맞춤. 사용자가 끄는 중에는 건드리지 않음
  useEffect(() => {
    if (isInteractingRef.current) return;
    setRenderCenter(state.selectedIndex);
    motion.setPosition(state.selectedIndex);
  }, [state.selectedIndex, motion]);

  const maybeRecenter = (position: number) => {
    if (Math.abs(position - renderCenter) > RECENTER_DISTANCE) setRenderCenter(Math.round(position));
  };

  useNativeWheelListener(columnRef, {
    onWheel: (deltaPixels) => {
      isInteractingRef.current = true;
      motion.stop();
      const itemSize = motion.readItemSize();
      const nextPosition = clampPosition(motion.positionRef.current + deltaPixels / itemSize, latest.current.props.options.length);
      motion.setPosition(nextPosition);
      maybeRecenter(nextPosition);
    },
    onSettle: () => settleAt(motion.positionRef.current),
  });

  const pointerRef = useRef({ startY: 0, startPosition: 0, isDragging: false, tracker: createVelocityTracker() });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (props.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.stop();
    isInteractingRef.current = true;
    const pointer = pointerRef.current;
    pointer.startY = event.clientY;
    pointer.startPosition = motion.positionRef.current;
    pointer.isDragging = false;
    pointer.tracker.reset();
    pointer.tracker.add({ position: event.clientY, timeMs: event.timeStamp });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isInteractingRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const pointer = pointerRef.current;
    const deltaPixels = event.clientY - pointer.startY;
    if (!pointer.isDragging && Math.abs(deltaPixels) < DRAG_THRESHOLD_PIXELS) return;
    pointer.isDragging = true;
    pointer.tracker.add({ position: event.clientY, timeMs: event.timeStamp });
    const nextPosition = clampPosition(pointer.startPosition - deltaPixels / motion.readItemSize(), props.options.length);
    motion.setPosition(nextPosition);
    maybeRecenter(nextPosition);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const pointer = pointerRef.current;
    if (!pointer.isDragging) {
      const itemElement = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
      settleAt(itemElement ? Number(itemElement.dataset.index) : motion.positionRef.current);
      return;
    }
    const itemSize = motion.readItemSize();
    const inertia = projectInertia({
      offset: motion.positionRef.current * itemSize,
      velocity: -pointer.tracker.velocity(),
      itemSize,
      itemCount: props.options.length,
    });
    settleAt(inertia.index, inertia.durationMs);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.disabled) return;
    const targetIndex = keyboardTargetIndex(event.key, state.selectedIndex, props.options.length);
    if (targetIndex === null) return;
    event.preventDefault();
    const direction = targetIndex >= state.selectedIndex ? 1 : -1;
    settleAt(firstEnabledFrom(props.options, targetIndex, direction));
  };

  const selectedOption = props.options[state.selectedIndex];
  const renderedRange = renderWindowAround(renderCenter, props.options.length, RENDER_RADIUS);

  return {
    selectedIndex: state.selectedIndex,
    renderedRange,
    getColumnProps: () => ({
      ref: (node) => {
        columnRef.current = node;
        node?.style.setProperty('--lsp-wheel-position', String(motion.positionRef.current));
      },
      role: 'spinbutton',
      tabIndex: props.disabled ? -1 : 0,
      'aria-label': props.label,
      'aria-valuemin': 0,
      'aria-valuemax': Math.max(props.options.length - 1, 0),
      'aria-valuenow': state.selectedIndex,
      'aria-valuetext': selectedOption?.label,
      'aria-disabled': props.disabled || undefined,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
      ...partAttributes('wheel-column', { disabled: props.disabled === true }),
    }),
    getTrackProps: () => ({ 'aria-hidden': true, ...partAttributes('wheel-track') }),
    getItemProps: (index) => {
      const option = props.options[index];
      return {
        'data-index': index,
        style: { [WHEEL_INDEX_PROPERTY]: index } as CSSProperties,
        children: option?.label,
        ...partAttributes('wheel-item', { selected: index === state.selectedIndex, disabled: option?.isDisabled === true }),
      } as HTMLAttributes<HTMLDivElement> & DataAttributeProps & { readonly style: CSSProperties };
    },
  };
}

function keyboardTargetIndex(key: string, selectedIndex: number, itemCount: number): number | null {
  switch (key) {
    case 'ArrowUp':
      return selectedIndex - 1;
    case 'ArrowDown':
      return selectedIndex + 1;
    case 'PageUp':
      return selectedIndex - PAGE_STEP;
    case 'PageDown':
      return selectedIndex + PAGE_STEP;
    case 'Home':
      return 0;
    case 'End':
      return itemCount - 1;
    default:
      return null;
  }
}

function firstEnabledFrom<Value>(options: readonly ColumnOption<Value>[], index: number, direction: 1 | -1): number {
  for (let candidate = clampPosition(index, options.length); candidate >= 0 && candidate < options.length; candidate += direction) {
    if (!options[candidate]?.isDisabled) return candidate;
  }
  return nearestEnabledIndex(options, index);
}

interface NativeWheelHandlers {
  readonly onWheel: (deltaPixels: number) => void;
  readonly onSettle: () => void;
}

// Constraint: React의 onWheel은 passive라 preventDefault가 안 됨. 페이지가 같이 스크롤되지 않도록 비passive 리스너를 직접 붙임
function useNativeWheelListener(columnRef: { readonly current: HTMLElement | null }, handlers: NativeWheelHandlers): void {
  const latestHandlers = useLatestRef(handlers);
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      latestHandlers.current.onWheel(normalizeWheelDelta(event.deltaY, event.deltaMode, column.clientHeight));
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => latestHandlers.current.onSettle(), WHEEL_SETTLE_DELAY_MILLISECONDS);
    };
    column.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(settleTimer);
      column.removeEventListener('wheel', onWheel);
    };
  }, [columnRef, latestHandlers]);
}
```

`packages/react/src/wheel/parts.tsx`:
```tsx
import type { ColumnOption } from '@lunisolar-picker/core';
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { mergeProps } from '../utilities/merge-props';
import { type UseWheelProps, type WheelApi, useWheel } from './use-wheel';

export interface RootProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}

export function Root({ children, ...props }: RootProps): ReactElement {
  return <div {...mergeProps({ role: 'group', ...partAttributes('wheel') }, props)}>{children}</div>;
}

export function Highlight(props: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div {...mergeProps({ 'aria-hidden': true, ...partAttributes('wheel-highlight') }, props)} />;
}

export interface ColumnProps<Value> extends UseWheelProps<Value> {
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly renderItem?: ((option: ColumnOption<Value>, isSelected: boolean) => ReactNode) | undefined;
}

export function Column<Value>({ className, style, renderItem, ...props }: ColumnProps<Value>): ReactElement {
  const wheel = useWheel(props);
  const indexes = Array.from(
    { length: wheel.renderedRange.end - wheel.renderedRange.start + 1 },
    (_, offset) => wheel.renderedRange.start + offset,
  );
  return (
    <div {...mergeProps(wheel.getColumnProps(), { className, style })}>
      <div {...wheel.getTrackProps()}>
        {indexes.map((index) => (
          <Item key={index} wheel={wheel} index={index}>
            {renderItem && props.options[index] ? renderItem(props.options[index], index === wheel.selectedIndex) : undefined}
          </Item>
        ))}
      </div>
    </div>
  );
}

export interface ItemProps {
  readonly wheel: WheelApi;
  readonly index: number;
  readonly children?: ReactNode;
}

export function Item({ wheel, index, children }: ItemProps): ReactElement {
  const itemProps = wheel.getItemProps(index);
  return <div {...itemProps}>{children ?? itemProps.children}</div>;
}
```

`packages/react/src/wheel/use-wheel-date.ts`:
```ts
import {
  type CalendarId,
  type DateFields,
  type DateString,
  type EpochDay,
  LunisolarPickerError,
  type MonthCode,
  calendarIdOf,
  epochDayOf,
} from '@lunisolar-picker/calendar';
import {
  type DateConstraints,
  type WheelDateColumns,
  buildWheelDateColumns,
  constrainDateFields,
  findCalendar,
} from '@lunisolar-picker/core';
import { useMemo, useState } from 'react';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerContext } from '../settings/use-picker-context';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useControllableState } from '../utilities/use-controllable-state';
import { formatOrNull } from '../value/format-or-null';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

export interface UseWheelDateProps extends SharedPickerProps, DateConstraints {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: DateString | null, details: ValueChangeDetails) => void) | undefined;
  readonly entryCalendar?: CalendarId | undefined;
  readonly defaultEntryCalendar?: CalendarId | undefined;
  readonly onEntryCalendarChange?: ((calendarId: CalendarId) => void) | undefined;
}

export interface WheelDateApi {
  readonly fields: DateFields;
  readonly columns: WheelDateColumns;
  readonly value: DateString | null;
  readonly entryCalendarId: CalendarId;
  readonly labels: { readonly year: string; readonly month: string; readonly day: string };
  selectYear(year: number): void;
  selectMonth(monthCode: MonthCode): void;
  selectDay(day: number): void;
  setEntryCalendar(calendarId: CalendarId): void;
}

const VALID_DETAILS: ValueChangeDetails = { validity: { isValid: true, reasons: [] } };

export function useWheelDate(props: UseWheelDateProps): WheelDateApi {
  const settings = usePickerSettings(props);
  const controlled = useParsedValue(props.value, (input) => parseOptionalDate(input, settings.calendars), String, props.onInvalidValue);
  const [initialValue] = useState(() => controlled.value ?? parseOptionalDate(props.defaultValue, settings.calendars).value);
  const [entryCalendarId, setEntryCalendar] = useControllableState(
    props.entryCalendar,
    props.defaultEntryCalendar ?? (initialValue ? calendarIdOf(initialValue) : 'gregory'),
    props.onEntryCalendarChange,
  );
  const context = usePickerContext(settings, { constraints: props, commitMode: 'immediate', numberOfMonths: 1 });
  const calendar = findCalendar(settings.calendars, entryCalendarId);
  const [epochDay, setEpochDay] = useState<EpochDay>(() =>
    clampEpochDay(initialValue ? epochDayOf(initialValue) : settings.todayEpochDay, context.constraints),
  );
  const fields = useMemo(() => fieldsOf(calendar, epochDay), [calendar, epochDay]);
  const columns = useMemo(
    () => buildWheelDateColumns(calendar, fields, context.constraints, settings.locale),
    [calendar, fields, context.constraints, settings.locale],
  );
  const value = useMemo(() => formatOrNull(epochDay, calendar), [epochDay, calendar]);

  useValueBridge<DateString>({
    committedValue: value,
    controlled,
    isEqual: Object.is,
    syncStore: (next) => {
      if (next !== null) setEpochDay(epochDayOf(next));
    },
    onValueChange: (next) => props.onValueChange?.(next, VALID_DETAILS),
  });

  // Goal: 연·월을 바꿔 사라진 윤달·30일은 가장 가까운 날로 맞추고, 제약 범위 밖이면 경계로 붙임 (스펙 5.4, Review Focus 5)
  const selectFields = (nextFields: DateFields) => {
    const constrained = constrainDateFields(calendar, nextFields);
    const converted = calendar.toEpochDay(constrained);
    if (converted.isOk) setEpochDay(clampEpochDay(converted.value, context.constraints));
  };

  return {
    fields,
    columns,
    value,
    entryCalendarId,
    labels: { year: settings.locale.labels.year, month: settings.locale.labels.month, day: settings.locale.labels.day },
    selectYear: (year) => selectFields({ ...fields, year }),
    selectMonth: (monthCode) => selectFields({ ...fields, monthCode }),
    selectDay: (day) => selectFields({ ...fields, day }),
    setEntryCalendar,
  };
}

function fieldsOf(calendar: ReturnType<typeof findCalendar>, epochDay: EpochDay): DateFields {
  const fields = calendar.fromEpochDay(epochDay);
  if (fields.isOk) return fields.value;
  const boundary = epochDay < calendar.supportedRange.min ? calendar.supportedRange.min : calendar.supportedRange.max;
  const boundaryFields = calendar.fromEpochDay(boundary);
  if (!boundaryFields.isOk) throw new LunisolarPickerError(`calendar ${calendar.id} rejected its own supported range boundary`);
  return boundaryFields.value;
}

function clampEpochDay(epochDay: EpochDay, constraints: { readonly minEpochDay: EpochDay; readonly maxEpochDay: EpochDay }): EpochDay {
  if (epochDay < constraints.minEpochDay) return constraints.minEpochDay;
  if (epochDay > constraints.maxEpochDay) return constraints.maxEpochDay;
  return epochDay;
}
```

`packages/react/src/index.ts`에 추가:
```ts
export * as Wheel from './wheel/parts';
export type { UseWheelProps, WheelApi } from './wheel/use-wheel';
export { useWheel } from './wheel/use-wheel';
export type { UseWheelDateProps, WheelDateApi } from './wheel/use-wheel-date';
export { useWheelDate } from './wheel/use-wheel-date';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/wheel`
Expected: PASS. `dragAndDrop` 테스트가 특정 브라우저에서만 실패하면 실패한 브라우저 이름과 마지막 `onValueChange` 값을 기록하고, 드래그 판정(`DRAG_THRESHOLD_PIXELS`)이나 포인터 캡처 처리부터 확인한다. 테스트를 건너뛰게 바꾸지 않는다.

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 관성 스크롤과 키보드로 고르는 휠 부품과 휠 날짜 선택 지원" -m "- 끌기·관성·마우스 휠을 CSS 변수 하나로 움직여 매 프레임 React 렌더를 거치지 않게 하고, 9999개 연도도 주변 항목만 그림.
- 연·월을 바꿔 윤달이나 30일이 사라지면 예전 인덱스가 아니라 가장 가까운 날로 맞춰 다른 달이 선택되는 일을 막음.
- 열마다 spinbutton으로 노출하고 화살표·PageUp/Down·Home/End를 지원함."
```

---

### Task 10: theme 입력 부품 스타일, 선택자 계약 테스트, 시각 회귀

**Files:**
- Create: `packages/theme/package.json`, `packages/theme/tsconfig.json`, `packages/theme/vitest.config.ts`
- Create: `packages/theme/src/mono.css`, `packages/theme/src/bridge/shadcn.css`
- Create: `packages/theme/tests/selector-contract.test.ts`
- Create: `packages/react/vitest.visual.config.ts`, `packages/react/src/visual/inputs.visual.test.tsx`
- Create: `scripts/run-visual-tests.sh`
- Modify: 루트 `package.json`(devDependencies에 `"@lunisolar-picker/theme": "workspace:*"`), `justfile`

**Interfaces:**
- Consumes: Task 1 `DATA_ATTRIBUTES`, `PART_NAMES`(`@lunisolar-picker/react/contract`), Task 4~9 부품
- Produces:
  - `@lunisolar-picker/theme/mono.css`: `@layer lunisolar-picker` 안의 토큰과 입력·팝오버·시트·휠 스타일 (달력 부품 스타일은 M4가 같은 파일에 추가)
  - `@lunisolar-picker/theme/bridge/shadcn.css`
  - `just visual`, `just visual-update`

- [ ] **Step 1: theme 패키지 설정**

`packages/theme/package.json`:
```json
{
  "name": "@lunisolar-picker/theme",
  "version": "0.0.0",
  "description": "Mono theme for lunisolar-picker parts",
  "type": "module",
  "sideEffects": ["*.css"],
  "files": ["src"],
  "exports": {
    "./mono.css": "./src/mono.css",
    "./bridge/shadcn.css": "./src/bridge/shadcn.css",
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "package-check": "publint --strict"
  },
  "devDependencies": {
    "@lunisolar-picker/react": "workspace:*"
  }
}
```

> 정합성 조정(2026-10-14): 선택자 계약 테스트는 `@lunisolar-picker/react/contract`를 경로 별칭이 아니라 워크스페이스 의존과 `@lunisolar-picker/source` 조건으로 읽는다(모든 패키지 공통 방식).

`packages/theme/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "isolatedDeclarations": false,
    "declaration": false
  },
  "include": ["tests", "vitest.config.ts"]
}
```

`packages/theme/vitest.config.ts`:
```ts
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@lunisolar-picker/source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['@lunisolar-picker/source', ...defaultServerConditions] } },
  test: { include: ['tests/**/*.test.ts'] },
});
```

루트 `package.json`의 `devDependencies`에 `"@lunisolar-picker/theme": "workspace:*"`를 추가하고 `pnpm install`을 실행한다(react의 시각 회귀 테스트가 CSS를 import함).

- [ ] **Step 2: 실패하는 선택자 계약 테스트 작성**

`packages/theme/tests/selector-contract.test.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { DATA_ATTRIBUTES, PART_ATTRIBUTE, PART_NAMES } from '@lunisolar-picker/react/contract';
import { describe, expect, it } from 'vitest';

const THEME_FILES = ['../src/mono.css', '../src/bridge/shadcn.css'];
const ATTRIBUTE_SELECTOR_PATTERN = /\[(data-[a-z-]+)/g;
const PART_SELECTOR_PATTERN = /\[data-lsp-part=['"]?([a-z-]+)/g;
const ALLOWED_EXTRA_ATTRIBUTES = [PART_ATTRIBUTE, 'data-theme'];

async function readThemeSources(): Promise<string> {
  const sources = await Promise.all(THEME_FILES.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
  return sources.join('\n');
}

describe('theme selector contract', () => {
  it('styles only through the public data attributes', async () => {
    const css = await readThemeSources();
    const usedAttributes = new Set(Array.from(css.matchAll(ATTRIBUTE_SELECTOR_PATTERN), (match) => match[1]));
    const allowed = new Set<string>([...DATA_ATTRIBUTES, ...ALLOWED_EXTRA_ATTRIBUTES]);

    expect([...usedAttributes].filter((attribute) => attribute && !allowed.has(attribute))).toEqual([]);
  });

  it('targets only known part names', async () => {
    const css = await readThemeSources();
    const usedParts = new Set(Array.from(css.matchAll(PART_SELECTOR_PATTERN), (match) => match[1]));
    const knownParts = new Set<string>(PART_NAMES);

    expect([...usedParts].filter((part) => part && !knownParts.has(part))).toEqual([]);
  });

  it('wraps every rule in the lunisolar-picker cascade layer', async () => {
    const css = await readFile(new URL('../src/mono.css', import.meta.url), 'utf8');
    const outsideLayer = css.replace(/@layer lunisolar-picker\s*\{[\s\S]*\}\s*$/, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();

    expect(outsideLayer).toBe('');
  });

  it('avoids CSS features below the browser baseline', async () => {
    const css = await readThemeSources();

    expect(css).not.toMatch(/\babs\(/);
    expect(css).not.toMatch(/plaintext-only/);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/theme run test`
Expected: FAIL — `ENOENT ... src/mono.css`

- [ ] **Step 4: CSS 작성**

`packages/theme/src/mono.css`:
```css
/* Mono 테마: 무채색, 가는 선, 8px 라운드 (스펙 8.3). 우선순위를 0으로 두려고 모드 선택자는 :where()로 감쌈 */
@layer lunisolar-picker {
  :where(:root) {
    --lsp-bg: #ffffff;
    --lsp-surface: #ffffff;
    --lsp-fg: #09090b;
    --lsp-muted: #71717a;
    --lsp-subtle: #b4b4bb;
    --lsp-border: #e4e4e7;
    --lsp-accent: #09090b;
    --lsp-accent-fg: #ffffff;
    --lsp-range-bg: #f4f4f5;
    --lsp-ring: rgb(9 9 11 / 0.18);
    --lsp-danger: #dc2626;
    --lsp-radius: 8px;
    --lsp-cell-size: 36px;
    --lsp-wheel-item-size: 36px;
    --lsp-wheel-visible-count: 5;
    --lsp-shadow-popover: 0 8px 24px -8px rgb(0 0 0 / 0.12);
    --lsp-backdrop: rgb(9 9 11 / 0.4);
    --lsp-duration: 140ms;
    --lsp-color-scheme: light;
  }

  :where(.dark, [data-theme='dark']) {
    --lsp-bg: #09090b;
    --lsp-surface: #111113;
    --lsp-fg: #fafafa;
    --lsp-muted: #a1a1aa;
    --lsp-subtle: #52525b;
    --lsp-border: #26262a;
    --lsp-accent: #fafafa;
    --lsp-accent-fg: #09090b;
    --lsp-range-bg: #1d1d20;
    --lsp-ring: rgb(250 250 250 / 0.25);
    --lsp-danger: #f87171;
    --lsp-shadow-popover: 0 8px 24px -8px rgb(0 0 0 / 0.6);
    --lsp-backdrop: rgb(0 0 0 / 0.6);
    --lsp-color-scheme: dark;
  }

  @media (prefers-color-scheme: dark) {
    :where([data-theme='system']) {
      --lsp-bg: #09090b;
      --lsp-surface: #111113;
      --lsp-fg: #fafafa;
      --lsp-muted: #a1a1aa;
      --lsp-subtle: #52525b;
      --lsp-border: #26262a;
      --lsp-accent: #fafafa;
      --lsp-accent-fg: #09090b;
      --lsp-range-bg: #1d1d20;
      --lsp-ring: rgb(250 250 250 / 0.25);
      --lsp-danger: #f87171;
      --lsp-shadow-popover: 0 8px 24px -8px rgb(0 0 0 / 0.6);
      --lsp-backdrop: rgb(0 0 0 / 0.6);
      --lsp-color-scheme: dark;
    }
  }

  @media (pointer: coarse) {
    :where(:root) {
      --lsp-cell-size: 44px;
      --lsp-wheel-item-size: 44px;
    }
  }

  [data-lsp-part] {
    box-sizing: border-box;
  }

  [data-lsp-part='date-field'],
  [data-lsp-part='date-range-field'],
  [data-lsp-part='time-field'] {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-block-size: 40px;
    padding-inline: 12px;
    border: 1px solid var(--lsp-border);
    border-radius: var(--lsp-radius);
    background: var(--lsp-surface);
    color: var(--lsp-fg);
    font-variant-numeric: tabular-nums;
    color-scheme: var(--lsp-color-scheme);
    transition: border-color var(--lsp-duration), box-shadow var(--lsp-duration);
  }

  [data-lsp-part='date-range-field'] [data-lsp-part='date-field'] {
    min-block-size: auto;
    padding-inline: 0;
    border: 0;
    background: transparent;
  }

  [data-lsp-part='date-field']:focus-within,
  [data-lsp-part='date-range-field']:focus-within,
  [data-lsp-part='time-field']:focus-within {
    border-color: var(--lsp-muted);
    box-shadow: 0 0 0 3px var(--lsp-ring);
  }

  [data-lsp-part='date-range-field'] [data-lsp-part='date-field']:focus-within {
    box-shadow: none;
  }

  [data-lsp-part='date-field'][data-invalid],
  [data-lsp-part='date-range-field'][data-invalid],
  [data-lsp-part='time-field'][data-invalid] {
    border-color: var(--lsp-danger);
  }

  [data-lsp-part='date-field'][data-disabled],
  [data-lsp-part='date-range-field'][data-disabled],
  [data-lsp-part='time-field'][data-disabled] {
    opacity: 0.5;
  }

  [data-lsp-part='date-field-segment'],
  [data-lsp-part='time-field-segment'] {
    padding-inline: 2px;
    border-radius: 4px;
    outline: none;
    caret-color: transparent;
    white-space: nowrap;
  }

  [data-lsp-part='date-field-segment'][data-placeholder],
  [data-lsp-part='time-field-segment'][data-placeholder] {
    color: var(--lsp-subtle);
  }

  [data-lsp-part='date-field-segment'][data-focused],
  [data-lsp-part='time-field-segment'][data-focused] {
    background: var(--lsp-range-bg);
  }

  [data-lsp-part='date-field-separator'],
  [data-lsp-part='time-field-separator'] {
    color: var(--lsp-muted);
  }

  [data-lsp-part='date-field-leap-toggle'] {
    margin-inline-start: 6px;
    padding: 2px 8px;
    border: 1px solid var(--lsp-border);
    border-radius: calc(var(--lsp-radius) - 2px);
    background: transparent;
    color: var(--lsp-muted);
    font: inherit;
    font-size: 0.8em;
  }

  [data-lsp-part='date-field-leap-toggle'][data-selected] {
    border-color: var(--lsp-accent);
    background: var(--lsp-accent);
    color: var(--lsp-accent-fg);
  }

  [data-lsp-part='popover'] {
    z-index: 50;
    padding: 12px;
    border: 1px solid var(--lsp-border);
    border-radius: calc(var(--lsp-radius) + 4px);
    background: var(--lsp-surface);
    color: var(--lsp-fg);
    box-shadow: var(--lsp-shadow-popover);
    color-scheme: var(--lsp-color-scheme);
    outline: none;
    animation: lsp-popover-in var(--lsp-duration) ease-out;
  }

  [data-lsp-part='sheet-backdrop'] {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: var(--lsp-backdrop);
    animation: lsp-fade-in var(--lsp-duration) ease-out;
  }

  [data-lsp-part='sheet'] {
    inline-size: 100%;
    max-inline-size: 560px;
    max-block-size: 85dvh;
    overflow: auto;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
    border-start-start-radius: 16px;
    border-start-end-radius: 16px;
    background: var(--lsp-surface);
    color: var(--lsp-fg);
    color-scheme: var(--lsp-color-scheme);
    outline: none;
    animation: lsp-sheet-in 180ms ease-out;
  }

  [data-lsp-part='wheel'] {
    position: relative;
    display: flex;
    block-size: calc(var(--lsp-wheel-item-size) * var(--lsp-wheel-visible-count));
    overflow: hidden;
    border: 1px solid var(--lsp-border);
    border-radius: var(--lsp-radius);
    background: var(--lsp-surface);
    color: var(--lsp-muted);
    font-variant-numeric: tabular-nums;
    user-select: none;
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent);
    mask-image: linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent);
  }

  [data-lsp-part='wheel-highlight'] {
    position: absolute;
    inset-inline: 6px;
    inset-block-start: 50%;
    block-size: var(--lsp-wheel-item-size);
    transform: translateY(-50%);
    border-radius: calc(var(--lsp-radius) - 2px);
    background: var(--lsp-range-bg);
    pointer-events: none;
  }

  [data-lsp-part='wheel-column'] {
    position: relative;
    z-index: 1;
    flex: 1;
    overflow: hidden;
    cursor: grab;
    outline: none;
    touch-action: none;
    perspective: 600px;
  }

  [data-lsp-part='wheel-column']:focus-visible {
    box-shadow: inset 0 0 0 2px var(--lsp-ring);
  }

  [data-lsp-part='wheel-column'][data-disabled] {
    cursor: not-allowed;
    opacity: 0.5;
  }

  [data-lsp-part='wheel-track'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: calc(50% - var(--lsp-wheel-item-size) / 2);
    transform: translateY(calc(var(--lsp-wheel-position, 0) * var(--lsp-wheel-item-size) * -1));
    will-change: transform;
  }

  [data-lsp-part='wheel-item'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: calc(var(--lsp-wheel-index) * var(--lsp-wheel-item-size));
    display: grid;
    place-items: center;
    block-size: var(--lsp-wheel-item-size);
    font-size: 15px;
    transform: rotateX(clamp(-70deg, calc((var(--lsp-wheel-index) - var(--lsp-wheel-position, 0)) * -18deg), 70deg));
    backface-visibility: hidden;
  }

  [data-lsp-part='wheel-item'][data-selected] {
    color: var(--lsp-fg);
    font-weight: 600;
  }

  [data-lsp-part='wheel-item'][data-disabled] {
    color: var(--lsp-subtle);
    text-decoration: line-through;
  }

  @keyframes lsp-popover-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  @keyframes lsp-fade-in {
    from {
      opacity: 0;
    }
  }

  @keyframes lsp-sheet-in {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-lsp-part='popover'],
    [data-lsp-part='sheet'],
    [data-lsp-part='sheet-backdrop'] {
      animation: none;
    }

    [data-lsp-part='wheel-item'] {
      transform: none;
    }
  }

  @media (forced-colors: active) {
    [data-lsp-part='date-field-segment'][data-focused],
    [data-lsp-part='time-field-segment'][data-focused] {
      background: Highlight;
      color: HighlightText;
    }

    [data-lsp-part='wheel-highlight'] {
      border: 1px solid CanvasText;
    }

    [data-lsp-part='wheel-item'][data-selected] {
      color: Highlight;
    }
  }
}
```

`packages/theme/src/bridge/shadcn.css`:
```css
/* mono.css 뒤에 import. --lsp-* 토큰을 shadcn·Tailwind 토큰에 연결해 앱 브랜드 색을 따라감 (스펙 8장) */
@layer lunisolar-picker {
  :where(:root),
  :where(.dark, [data-theme='dark']) {
    --lsp-bg: var(--background);
    --lsp-surface: var(--popover, var(--background));
    --lsp-fg: var(--foreground);
    --lsp-muted: var(--muted-foreground);
    --lsp-subtle: var(--muted-foreground);
    --lsp-border: var(--border);
    --lsp-accent: var(--primary);
    --lsp-accent-fg: var(--primary-foreground);
    --lsp-range-bg: var(--accent, var(--muted));
    --lsp-ring: var(--ring);
    --lsp-danger: var(--destructive);
    --lsp-radius: var(--radius);
  }
}
```

- [ ] **Step 5: 선택자 계약 테스트 통과 확인**

Run: `pnpm --filter @lunisolar-picker/theme run test`
Expected: PASS

- [ ] **Step 6: 시각 회귀 설정과 테스트 작성**

`packages/react/vitest.visual.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// Constraint: 글꼴 렌더링이 OS마다 달라 기준 이미지는 Linux Docker(scripts/run-visual-tests.sh)에서만 만들고 비교함 (스펙 11장)
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['@lunisolar-picker/source', ...defaultClientConditions] },
  test: {
    include: ['src/**/*.visual.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      viewport: { width: 480, height: 640 },
    },
  },
});
```

`packages/react/src/visual/inputs.visual.test.tsx`:
```tsx
import '@lunisolar-picker/theme/mono.css';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import * as DateField from '../date-field/parts';
import * as TimeField from '../time-field/parts';
import * as Wheel from '../wheel/parts';

const THEMES = ['light', 'dark'] as const;
const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1}월`, isDisabled: false }));

function Frame({ theme, children }: { theme: (typeof THEMES)[number]; children: ReactNode }) {
  return (
    <div data-testid="frame" data-theme={theme} style={{ padding: 24, background: 'var(--lsp-bg)', fontFamily: 'sans-serif' }}>
      {children}
    </div>
  );
}

describe.each(THEMES)('inputs in %s mode', (theme) => {
  it('date field: filled, placeholder, and invalid', async () => {
    const screen = await render(
      <Frame theme={theme}>
        <DateField.Root aria-label="filled" locale={ko} today="2026-10-14" defaultValue="2026-10-14" />
        <DateField.Root aria-label="placeholder" locale={ko} today="2026-10-14" />
        <DateField.Root aria-label="lunar" locale={ko} today="2026-10-14" calendars={[dangi]} defaultValue="1990-06-23[u-ca=dangi]" />
        <DateField.Root aria-label="invalid" locale={ko} today="2026-10-14" invalid defaultValue="2026-10-14" />
      </Frame>,
    );

    await expect.element(screen.getByTestId('frame')).toMatchScreenshot(`date-field-${theme}`);
  });

  it('time field and wheel', async () => {
    const screen = await render(
      <Frame theme={theme}>
        <TimeField.Root aria-label="time" defaultValue="14:30" />
        <Wheel.Root aria-label="month">
          <Wheel.Highlight />
          <Wheel.Column label="month" options={months} value={10} onValueChange={() => {}} />
        </Wheel.Root>
      </Frame>,
    );

    await expect.element(screen.getByTestId('frame')).toMatchScreenshot(`time-and-wheel-${theme}`);
  });
});
```

`scripts/run-visual-tests.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

# Goal: 기준 이미지를 OS와 상관없이 같은 Linux·글꼴 환경에서 만들고 비교함 (스펙 11장)
IMAGE="mcr.microsoft.com/playwright:v1.64.0-noble"
VITEST_EXTRA_ARGUMENTS="${1:-}"
REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker run --rm --ipc=host \
  -v "${REPOSITORY_ROOT}:/work" -w /work \
  -v lsp-visual-root-modules:/work/node_modules \
  -v lsp-visual-calendar-modules:/work/packages/calendar/node_modules \
  -v lsp-visual-core-modules:/work/packages/core/node_modules \
  -v lsp-visual-react-modules:/work/packages/react/node_modules \
  -v lsp-visual-theme-modules:/work/packages/theme/node_modules \
  "${IMAGE}" \
  bash -c "corepack enable && corepack prepare pnpm@11.28.2 --activate && pnpm install --frozen-lockfile && pnpm --filter @lunisolar-picker/react exec vitest run --config vitest.visual.config.ts ${VITEST_EXTRA_ARGUMENTS}"
```
`node_modules`를 Docker 볼륨으로 분리하는 이유는 macOS용 네이티브 바이너리(esbuild 등)가 Linux 컨테이너에 섞이지 않게 하기 위해서다.

`justfile`에 추가:
```make
visual:
    bash scripts/run-visual-tests.sh

visual-update:
    bash scripts/run-visual-tests.sh --update
```

- [ ] **Step 7: 기준 이미지 생성**

Run: `chmod +x scripts/run-visual-tests.sh && just visual-update`
Expected: `packages/react/src/visual/__screenshots__/`에 라이트·다크 기준 이미지 4장 생성. Docker가 없거나 이미지를 받을 수 없으면 여기서 멈추고 사용자에게 알린다. 생성된 이미지를 열어 스펙 8.3의 Mono 시안(무채색, 8px 라운드, 음력 칸은 회색 작은 글자만)과 맞는지 확인한다.

Run: `just visual`
Expected: PASS (방금 만든 기준과 일치)

- [ ] **Step 8: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과. 시각 회귀 테스트는 기본 `just test`에 포함되지 않는다.

- [ ] **Step 9: 커밋**

```bash
git add package.json pnpm-lock.yaml justfile scripts/run-visual-tests.sh packages/theme packages/react/vitest.visual.config.ts packages/react/src/visual
ALLOW_COMMIT=1 git commit -m "feat: 입력 부품을 Mono 테마로 그리고 화면 변화를 기준 이미지로 감시" -m "- Tailwind 유틸리티로 덮어쓸 수 있게 전체를 @layer lunisolar-picker에 넣고, 모드 선택자는 :where()로 우선순위를 0으로 둬 .dark·data-theme·시스템 설정을 모두 따름.
- theme이 공개 data-* 속성과 부품 이름만 쓰는지 테스트로 묶어 부품과 CSS가 어긋나지 않게 함.
- OS마다 글꼴 렌더링이 달라 기준 이미지는 Linux Docker에서만 만들고 비교함."
```

---

## 완료 기준

- `just check && just test && just package-check` 통과(react `package-check`는 `"use client"` 검사 포함), `just visual` 통과
- 세 브라우저에서 입력 부품의 키보드·포인터·IME·붙여넣기·폼 제출·SSR hydration·axe 테스트 통과
- M4(달력 부품·완성형)가 쓸 공개 API: `LunisolarProvider`, `usePickerSettings`, `usePickerContext`, `useStoreInstance`, `useParsedValue`, `useValueBridge`, `HiddenInput`, `renderElement`, `mergeProps`, `partAttributes`, `Popover.*`, `Sheet.*`, `usePresentation`, `DateField.*`, `DateRangeField.*`, `TimeField.*`, `Wheel.*`, `useWheelDate`, `focusInitialElement`
