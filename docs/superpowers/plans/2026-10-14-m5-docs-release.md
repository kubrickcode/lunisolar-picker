# M5: 소비 환경 검증, 문서, CI, 0.1.0 배포 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세 소비 환경(Next 16, Vite+react-hook-form, Astro 7)에서 라이브러리가 그대로 동작함을 CI로 보장하고, Starlight 문서·README·CI·changesets 배포 파이프라인을 갖춰 `0.1.0`을 npm에 낼 수 있는 상태로 만든다.

**Architecture:** `fixtures/*`는 배포하지 않는 private 워크스페이스 앱이다. 각 fixture는 빌드한 HTML에 기대 마크업이 있는지(`scripts/assert-markup.ts`), 정적 결과물을 브라우저로 열었을 때 hydration 오류가 없는지(`scripts/check-hydration.ts`)를 검사한다. 문서는 `apps/docs`(Starlight)에서 React island 데모로 실제 컴포넌트를 보여 준다. 배포는 changesets v3의 select-mode → version / pack → publish 분리 워크플로와 npm trusted publishing(OIDC)으로 한다.

**Tech Stack:** Next 16.4.0, Vite 8.3.4, @vitejs/plugin-react 6.1.2, react-hook-form 7.90.0, Astro 7.3.8, @astrojs/react 7.0.1, oxc-transform-react 0.145.0, @astrojs/starlight 0.42.6, React 19.3.0, playwright 1.64.0, @vitest/browser-playwright 5.0.4, vitest-browser-react 2.3.0, @changesets/cli 3.0.3, GitHub Actions(actions/checkout v7.0.1, actions/setup-node v7.1.0, pnpm/action-setup v6.1.0, extractions/setup-just v4, changesets/action v2.1.2)

**Spec:** `docs/superpowers/specs/2026-10-14-lunisolar-picker-design.md` (11장 소비 환경·실기기, 12장 빌드·배포, 13장 문서). 계약: `docs/superpowers/plans/2026-10-14-v1-interface-contract.md`. 형식 기준: `docs/superpowers/plans/2026-10-14-m1-calendar.md`

**선행 조건:** M1~M4 완료. `just check`, `just test`, `just build`, `just package-check`, `just size`가 통과하는 상태에서 시작한다.

## Global Constraints

- M1 계획의 Global Constraints를 그대로 따른다(정확한 버전, ESM 전용, 이름 규칙, WHY 주석, 테스트 형식, 커밋 규칙, `ALLOW_COMMIT=1`).
- 내부 패키지 참조는 `workspace:*`만 쓴다. pnpm이 배포할 때 정확한 버전으로 바꾼다(Task 10에서 검사).
- `fixtures/*`, `apps/docs`는 `"private": true`. 배포 대상은 `@lunisolar-picker/{calendar,core,react,theme}` 네 개뿐이다.
- 문서 사이트 본문은 **영어**로 쓴다(npm 공개 라이브러리). 저장소 내부 운영 문서(`docs/qa/`, `docs/releasing.md`)는 한국어.
- 서버 렌더 결과와 브라우저 결과가 같아야 한다. fixture는 모두 `today`를 고정한다. 문서 데모는 빌드일과 열람일이 다르므로 `client:only="react"`로 렌더한다.
- GitHub Actions는 커밋 SHA로 고정하고 뒤에 버전 주석을 단다. 워크플로 최상단 `permissions: {}`, 잡마다 필요한 권한만 준다. `id-token: write`는 publish 잡에만.
- 사용자 결정·행동 게이트(Task 11)에서는 멈추고 사용자 답을 기다린다. 라이선스, GitHub 원격 저장소, npm org·trusted publisher, 실제 배포는 에이전트가 정하지 않는다.
- 🟡 표시 Task는 M2~M4 구현 결과(부품 이름, `data-lsp-part` 값, 로케일 문구, prop 이름)에 따라 기대 문자열·예제 코드를 고쳐야 할 수 있다. 고칠 때는 계약 문서를 먼저 고친다.

## Review Focus

1. **Next 서버 컴포넌트에서 완성형을 바로 렌더할 때 `"use client"` 경계가 유지되는가.** 번들러가 지시문을 지우면 `next build`가 실패하거나 훅 오류가 난다. Task 2에서 서버 페이지가 `DatePicker`를 직접 렌더하고 빌드·마크업·hydration을 검사한다.
2. **서버 컴포넌트에서 함수가 든 로케일 객체를 넘기는 실수.** `LocaleData`에는 함수가 있어 서버→클라이언트 props로 직렬화되지 않는다. Task 2 fixture는 클라이언트 Provider 래퍼를 쓰고, Task 6의 Next 가이드가 이 규칙을 문서화한다.
3. **react-hook-form에서 값을 지웠을 때 `null`이 그대로 폼 값이 되고 `required` 검증이 걸리는가.** Task 1의 브라우저 테스트가 지우기 → 제출 → 오류, 다시 입력 → 제출 → `'1990-03-15'`를 확인한다.
4. **음력 표기 값(`[u-ca=dangi]`)이 SSR HTML과 hydration 뒤에 같은가.** Task 3의 Astro fixture가 음력 값의 hidden input 마크업과 hydration 오류 0을 확인한다.
5. **배포 tarball에 `workspace:` 참조나 소스·테스트·KASI 원본이 섞이는가.** Task 10의 `scripts/check-packed-packages.ts`가 `pnpm pack` 결과를 풀어 의존성 버전과 파일 목록을 검사한다.

---

## 파일 구조

```
pnpm-workspace.yaml                    packages/*, fixtures/*, apps/* 추가
justfile                               fixtures, docs-build, pack-check 추가
biome.json, .gitignore                 새 빌드 산출물 제외
scripts/
  assert-markup.ts                     HTML에 기대 조각이 있는지 검사
  check-hydration.ts                   정적 결과물을 띄워 브라우저 콘솔의 hydration 오류 검사
  check-packed-packages.ts             pnpm pack 결과 검사
fixtures/
  vite/    React 19 + react-hook-form, 브라우저 테스트, SSR 렌더 스크립트
  next/    Next 16 App Router, output: 'export'
  astro/   Astro 7 island + dangi
apps/docs/                             Starlight 문서
  astro.config.mjs  src/content.config.ts  src/styles/docs.css
  src/components/demos/*.tsx           React 데모
  src/content/docs/**/*.mdx            문서 본문
README.md, packages/*/README.md
docs/qa/real-device-checklist.md
docs/releasing.md
.changeset/config.json, .changeset/initial-release.md
.github/workflows/ci.yml, .github/workflows/release.yml
LICENSE (게이트 후)
```

---

### Task 1: Vite + react-hook-form fixture

> 🟡 잠정: M3·M4 구현 결과에 따라 `DatePicker`의 `ref` 동작, 지우기 버튼 이름(`ko.labels.clear`), 연도 세그먼트 접근성 이름(`ko.labels.year`), `data-lsp-part` 값이 바뀔 수 있음

> 정합성 조정(2026-10-14): `onBlur`는 계약 `SharedPickerProps`에 들어갔다(M3 Task 2). 포커스가 입력 칸 전체를 벗어날 때 한 번 불린다. `DatePicker`는 이를 입력 칸에만 넘긴다(M4 Task 8).

**Files:**
- Modify: `pnpm-workspace.yaml`, `package.json`(루트 devDependencies), `biome.json`, `.gitignore`, `justfile`
- Create: `scripts/assert-markup.ts`
- Create: `fixtures/vite/package.json`, `fixtures/vite/tsconfig.json`, `fixtures/vite/vite.config.ts`, `fixtures/vite/vitest.config.ts`, `fixtures/vite/index.html`, `fixtures/vite/src/styles.css`, `fixtures/vite/src/main.tsx`, `fixtures/vite/src/BirthDateForm.tsx`, `fixtures/vite/scripts/render-ssr.tsx`
- Test: `fixtures/vite/src/BirthDateForm.browser.test.tsx`

**Interfaces:**
- Consumes (계약 §3): `LunisolarProvider`, `DatePicker`(`@lunisolar-picker/react/pickers`), `ko`(`@lunisolar-picker/core/locales/ko`), `@lunisolar-picker/theme/mono.css`, `DatePicker` prop `value`, `onValueChange`, `name`, `required`, `invalid`, `ref`, `onBlur`(`SharedPickerProps.onBlur`)
- Produces: `scripts/assert-markup.ts <html-file> <fragment>...` (모든 조각이 있으면 0, 하나라도 없으면 1로 종료), `just fixtures`의 첫 구성원

- [ ] **Step 1: 워크스페이스·공통 설정 갱신**

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - fixtures/*
  - apps/*
```

루트 `package.json`의 `devDependencies`에 추가(알파벳 순서 유지):
```json
"playwright": "1.64.0"
```

`biome.json`의 `files.includes`를 다음으로 바꾼다:
```json
"includes": ["**", "!**/dist", "!**/dist-ssr", "!**/.cache", "!**/.next", "!**/out", "!**/.astro", "!**/*.generated.ts", "!**/data/*.json", "!**/next-env.d.ts"]
```

`.gitignore`에 추가:
```
.next/
out/
.astro/
test-results/
next-env.d.ts
```

- [ ] **Step 2: 마크업 검사 스크립트 작성**

`scripts/assert-markup.ts`:
```ts
import { readFile } from 'node:fs/promises';

const [, , htmlFilePath, ...expectedFragments] = process.argv;

async function assertMarkup(): Promise<void> {
  if (!htmlFilePath || expectedFragments.length === 0) {
    throw new Error('usage: tsx scripts/assert-markup.ts <html-file> <fragment>...');
  }
  const html = await readFile(htmlFilePath, 'utf8');
  const missingFragments = expectedFragments.filter((fragment) => !html.includes(fragment));
  if (missingFragments.length > 0) {
    throw new Error(`${htmlFilePath} is missing: ${missingFragments.join(' | ')}`);
  }
  console.info(`${htmlFilePath}: all ${expectedFragments.length} fragments present`);
}

try {
  await assertMarkup();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
```

- [ ] **Step 3: fixture 설정 파일 작성**

`fixtures/vite/package.json`:
```json
{
  "name": "@lunisolar-picker-fixtures/vite",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build && tsx scripts/render-ssr.tsx",
    "check:markup": "tsx ../../scripts/assert-markup.ts dist/ssr.html 'data-lsp-part=\"date-field\"' 'name=\"birthDate\"' 'value=\"1990-03-15\"'",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lunisolar-picker/calendar": "workspace:*",
    "@lunisolar-picker/core": "workspace:*",
    "@lunisolar-picker/react": "workspace:*",
    "@lunisolar-picker/theme": "workspace:*",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-hook-form": "7.90.0"
  },
  "devDependencies": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.2",
    "@vitest/browser-playwright": "5.0.4",
    "vite": "8.3.4",
    "vitest-browser-react": "2.3.0"
  }
}
```

`fixtures/vite/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["node", "vite/client"],
    "isolatedDeclarations": false,
    "declaration": false
  },
  "include": ["src", "scripts", "*.config.ts"]
}
```

`fixtures/vite/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
});
```

`fixtures/vite/vitest.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

`fixtures/vite/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>lunisolar-picker vite fixture</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`fixtures/vite/src/styles.css`:
```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
```

- [ ] **Step 4: 실패하는 브라우저 테스트 작성**

`fixtures/vite/src/BirthDateForm.browser.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { BirthDateForm } from './BirthDateForm';

describe('BirthDateForm with react-hook-form', () => {
  it('submits the initial date string unchanged', async () => {
    const onSubmitValues = vi.fn();
    await render(<BirthDateForm onSubmitValues={onSubmitValues} />);

    await page.getByRole('button', { name: '제출' }).click();

    expect(onSubmitValues).toHaveBeenCalledWith({ birthDate: '1990-03-15' });
  });

  it('turns a cleared picker into null and blocks submit with the required message', async () => {
    const onSubmitValues = vi.fn();
    await render(<BirthDateForm onSubmitValues={onSubmitValues} />);

    await page.getByRole('button', { name: ko.labels.clear }).click();
    await page.getByRole('button', { name: '제출' }).click();

    expect(onSubmitValues).not.toHaveBeenCalled();
    await expect.element(page.getByRole('alert')).toHaveTextContent('생년월일을 입력하세요');
  });

  it('accepts a date typed digit by digit after clearing', async () => {
    const onSubmitValues = vi.fn();
    await render(<BirthDateForm onSubmitValues={onSubmitValues} />);

    await page.getByRole('button', { name: ko.labels.clear }).click();
    await page.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('19900315');
    await page.getByRole('button', { name: '제출' }).click();

    expect(onSubmitValues).toHaveBeenCalledWith({ birthDate: '1990-03-15' });
  });
});
```

- [ ] **Step 5: 실패 확인**

Run: `pnpm install && pnpm exec playwright install chromium && pnpm --filter @lunisolar-picker-fixtures/vite exec vitest run`
Expected: FAIL — `Failed to resolve import "./BirthDateForm"`

- [ ] **Step 6: 구현**

`fixtures/vite/src/BirthDateForm.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { Controller, useForm } from 'react-hook-form';

interface BirthDateValues {
  readonly birthDate: string | null;
}

interface BirthDateFormProps {
  readonly onSubmitValues?: (values: BirthDateValues) => void;
}

// Constraint: 서버 렌더와 브라우저 렌더가 같은 '오늘'을 쓰도록 고정함 (스펙 11장)
const FIXED_TODAY = '2026-10-14';
const INITIAL_BIRTH_DATE = '1990-03-15';

export function BirthDateForm({ onSubmitValues }: BirthDateFormProps) {
  const { control, handleSubmit } = useForm<BirthDateValues>({ defaultValues: { birthDate: INITIAL_BIRTH_DATE } });
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today={FIXED_TODAY}>
      <form onSubmit={handleSubmit((values) => onSubmitValues?.(values))}>
        <Controller
          name="birthDate"
          control={control}
          rules={{ required: '생년월일을 입력하세요' }}
          render={({ field, fieldState }) => (
            <>
              <DatePicker
                ref={field.ref}
                name={field.name}
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                required
                invalid={fieldState.invalid}
                max={FIXED_TODAY}
              />
              {fieldState.error && <p role="alert">{fieldState.error.message}</p>}
            </>
          )}
        />
        <button type="submit">제출</button>
      </form>
    </LunisolarProvider>
  );
}
```

`fixtures/vite/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BirthDateForm } from './BirthDateForm';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('index.html is missing #root');

createRoot(rootElement).render(
  <StrictMode>
    <BirthDateForm onSubmitValues={(values) => console.info(values)} />
  </StrictMode>,
);
```

`fixtures/vite/scripts/render-ssr.tsx`:
```tsx
import { mkdir, writeFile } from 'node:fs/promises';
import { renderToString } from 'react-dom/server';
import { BirthDateForm } from '../src/BirthDateForm';

// Goal: Vite 앱은 브라우저 전용이지만 같은 컴포넌트가 서버 렌더에서도 깨지지 않는지 확인함 (모듈 최상위 window 접근 금지 검증)
async function renderBirthDateForm(): Promise<void> {
  await mkdir('dist', { recursive: true });
  await writeFile('dist/ssr.html', renderToString(<BirthDateForm />));
}

try {
  await renderBirthDateForm();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
```

- [ ] **Step 7: 통과 확인**

Run: `pnpm --filter @lunisolar-picker-fixtures/vite exec vitest run`
Expected: PASS (3개). 접근성 이름이 달라 실패하면 M3·M4가 실제로 쓴 `ko.labels` 키를 확인하고 계약 문서를 먼저 고친 뒤 테스트를 맞춘다.

- [ ] **Step 8: 빌드와 마크업 검사**

`justfile`에 추가:
```make
fixtures: build
    pnpm -r --filter "./fixtures/**" run build
    pnpm -r --filter "./fixtures/**" run check:markup
    pnpm -r --filter "./fixtures/**" run check:hydration
```

Run: `just fixtures`
Expected: `dist/ssr.html: all 3 fragments present`. (hydration 검사 스크립트가 있는 fixture가 아직 없어 세 번째 줄은 아무것도 실행하지 않는다)

- [ ] **Step 9: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 10: 커밋**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml biome.json .gitignore justfile scripts/assert-markup.ts fixtures/vite
ALLOW_COMMIT=1 git commit -m "test: react-hook-form 폼에서 날짜를 지우면 null로 검증되는지 실제 앱 구성으로 검증" -m "- back-office처럼 Controller로 연결했을 때 빈 값이 null로 넘어가 required 검증이 걸리는지 브라우저 테스트로 고정함.
- 같은 컴포넌트를 서버 렌더해 마크업을 검사하고, 다른 fixture도 쓰도록 마크업 검사 스크립트를 루트에 둠."
```

---

### Task 2: Next 16 App Router fixture

> 🟡 잠정: M3·M4 구현 결과에 따라 `DateRangePicker`의 `startName`·`endName`, `usePickerSelection` 반환 모양, `data-lsp-part` 값이 바뀔 수 있음

**Files:**
- Create: `scripts/check-hydration.ts`
- Create: `fixtures/next/package.json`, `fixtures/next/tsconfig.json`, `fixtures/next/next.config.ts`, `fixtures/next/app/globals.css`, `fixtures/next/app/layout.tsx`, `fixtures/next/app/page.tsx`, `fixtures/next/app/providers.tsx`, `fixtures/next/app/period-filter.tsx`

**Interfaces:**
- Consumes: `LunisolarProvider`, `DatePicker`, `DateRangePicker`, `usePickerSelection()`(`@lunisolar-picker/react/pickers`, 반환 `{ draftRange; validity; setRange; commit; cancel }`, M4 Task 9), `validateRange`, `isSameRange`, `parseDate`, `formatDate`, `epochDayOf`, `ko`
- Produces: `scripts/check-hydration.ts <static-dir> <page-path>` (정적 서버를 띄워 Chromium으로 열고 콘솔·페이지 오류 중 hydration 관련이 있거나 `[data-lsp-part]`가 없으면 1로 종료)

- [ ] **Step 1: hydration 검사 스크립트 작성**

`scripts/check-hydration.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const HYDRATION_ERROR_PATTERN = /hydrat|did not match|server rendered|text content does not match/i;
const SETTLE_MILLISECONDS = 500;

const [, , staticDirectoryArgument, pagePath = '/'] = process.argv;

function resolveFilePath(rootDirectory: string, requestUrl: string): string {
  const urlPath = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relativePath = urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath;
  const filePath = path.join(rootDirectory, relativePath);
  if (!filePath.startsWith(rootDirectory)) throw new Error(`refusing path outside ${rootDirectory}: ${urlPath}`);
  return path.extname(filePath) === '' ? `${filePath}.html` : filePath;
}

function startStaticServer(rootDirectory: string): Promise<Server> {
  const server = createServer(async (request, response) => {
    try {
      const filePath = resolveFilePath(rootDirectory, request.url ?? '/');
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
      response.end(body);
    } catch (error) {
      response.writeHead(404);
      response.end(String(error));
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Goal: 정적 빌드 결과를 실제 브라우저로 열어 서버 HTML과 첫 클라이언트 렌더가 어긋나지 않는지 확인함 (스펙 11장 소비 환경)
async function checkHydration(): Promise<void> {
  if (!staticDirectoryArgument) throw new Error('usage: tsx scripts/check-hydration.ts <static-dir> [page-path]');
  const rootDirectory = path.resolve(staticDirectoryArgument);
  const server = await startStaticServer(rootDirectory);
  const browser = await chromium.launch();
  try {
    const { port } = server.address() as AddressInfo;
    const page = await browser.newPage();
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && HYDRATION_ERROR_PATTERN.test(message.text())) problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(SETTLE_MILLISECONDS);
    if ((await page.locator('[data-lsp-part]').count()) === 0) problems.push('no [data-lsp-part] element rendered');
    if (problems.length > 0) throw new Error(`hydration problems on ${pagePath}:\n${problems.join('\n')}`);
    console.info(`${rootDirectory}${pagePath}: hydrated without errors`);
  } finally {
    await browser.close();
    server.close();
  }
}

try {
  await checkHydration();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
```

- [ ] **Step 2: fixture 설정 파일 작성**

`fixtures/next/package.json`:
```json
{
  "name": "@lunisolar-picker-fixtures/next",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "next build",
    "check:markup": "tsx ../../scripts/assert-markup.ts out/index.html 'data-lsp-part=\"date-field\"' 'name=\"installedAt\"' 'value=\"2026-10-14\"' 'name=\"periodStart\"' 'name=\"periodEnd\"'",
    "check:hydration": "tsx ../../scripts/check-hydration.ts out /"
  },
  "dependencies": {
    "@lunisolar-picker/calendar": "workspace:*",
    "@lunisolar-picker/core": "workspace:*",
    "@lunisolar-picker/react": "workspace:*",
    "@lunisolar-picker/theme": "workspace:*",
    "next": "16.4.0",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0"
  }
}
```

`fixtures/next/tsconfig.json` (Next가 요구하는 형태. `next build`가 내용을 바꾸면 바뀐 내용을 그대로 커밋한다):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`fixtures/next/next.config.ts`:
```ts
import type { NextConfig } from 'next';

// Goal: 정적 내보내기로 서버 렌더 HTML을 파일로 남겨 마크업·hydration을 서버 없이 검사함
const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
```

`fixtures/next/app/globals.css`:
```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
```

- [ ] **Step 3: 앱 코드 작성**

`fixtures/next/app/providers.tsx`:
```tsx
'use client';

import { ko } from '@lunisolar-picker/core/locales/ko';
import { LunisolarProvider } from '@lunisolar-picker/react';
import type { ReactNode } from 'react';

// Constraint: LocaleData에는 함수가 있어 서버 컴포넌트 props로 넘길 수 없음. 로케일은 클라이언트 경계 안에서 import함
export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today="2026-10-14">
      {children}
    </LunisolarProvider>
  );
}
```

`fixtures/next/app/layout.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`fixtures/next/app/period-filter.tsx`:
```tsx
'use client';

import { type DateRangeValue, addDays, isSameRange, parseDate } from '@lunisolar-picker/calendar';
import { validateRange } from '@lunisolar-picker/core';
import { DateRangePicker, usePickerSelection } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';

const TODAY = '2026-10-14';
const MAX_DAYS = 60;
const PRESET_DAY_COUNTS = [7, 30, 60] as const;

function lastDays(dayCount: number): DateRangeValue {
  const today = parseDate(TODAY);
  if (!today.isOk) throw new Error(`invalid fixture date: ${today.error}`);
  const start = addDays(today.value.value, -(dayCount - 1));
  if (!start.isOk) throw new Error(`cannot build preset of ${dayCount} days: ${start.error}`);
  return { start: start.value, end: today.value.value };
}

function RecentPresets() {
  const { draftRange, setRange } = usePickerSelection();
  return (
    <div>
      {PRESET_DAY_COUNTS.map((dayCount) => {
        const preset = lastDays(dayCount);
        const isAllowed = validateRange(preset, { max: TODAY, maxDays: MAX_DAYS }).isValid;
        return (
          <button
            key={dayCount}
            type="button"
            disabled={!isAllowed}
            aria-pressed={isSameRange(draftRange, preset)}
            onClick={() => setRange(preset)}
          >
            최근 {dayCount}일
          </button>
        );
      })}
    </div>
  );
}

export function PeriodFilter() {
  const [period, setPeriod] = useState<DateRangeValue | null>(lastDays(7));
  return (
    <DateRangePicker
      value={period}
      onValueChange={(next) => setPeriod(next)}
      startName="periodStart"
      endName="periodEnd"
      max={TODAY}
      maxDays={MAX_DAYS}
      limitMode="flag"
      commitMode="confirm"
      presets={<RecentPresets />}
    />
  );
}
```

`fixtures/next/app/page.tsx` (서버 컴포넌트):
```tsx
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { PeriodFilter } from './period-filter';

// Goal: 서버 컴포넌트가 함수 prop 없이 완성형을 직접 렌더해도 "use client" 경계가 유지되는지 확인함 (Review Focus 1)
export default function FixturePage() {
  return (
    <main>
      <h1>lunisolar-picker next fixture</h1>
      <DatePicker name="installedAt" defaultValue="2026-10-14" />
      <PeriodFilter />
    </main>
  );
}
```

- [ ] **Step 4: 빌드·검사 실행**

Run: `pnpm install && just build && NEXT_TELEMETRY_DISABLED=1 pnpm --filter @lunisolar-picker-fixtures/next run build && pnpm --filter @lunisolar-picker-fixtures/next run check:markup && pnpm --filter @lunisolar-picker-fixtures/next run check:hydration`
Expected: `next build`가 오류 없이 `out/index.html` 생성, `all 5 fragments present`, `hydrated without errors`. `next build`가 "You're importing a component that needs useState…"로 실패하면 react 패키지 산출물에서 `"use client"`가 빠진 것이다. 이 fixture를 고치지 말고 M3의 빌드 검사를 고쳐야 한다.

- [ ] **Step 5: just fixtures 전체 실행**

Run: `NEXT_TELEMETRY_DISABLED=1 just fixtures`
Expected: vite·next 모두 통과

- [ ] **Step 6: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add scripts/check-hydration.ts fixtures/next pnpm-lock.yaml
ALLOW_COMMIT=1 git commit -m "test: Next 서버 컴포넌트에서 picker를 써도 클라이언트 경계와 hydration이 깨지지 않는지 검증" -m "- 번들러가 \"use client\"를 지우면 서버 컴포넌트에서 바로 깨지므로 서버 페이지가 완성형을 직접 렌더하는 구성을 고정함.
- 로케일 객체는 함수를 담아 서버 props로 넘길 수 없어 클라이언트 Provider 래퍼를 쓰고, 정적 결과물을 브라우저로 열어 hydration 오류를 검사함."
```

---

### Task 3: Astro 7 island fixture (음력)

> 🟡 잠정: M3·M4 구현 결과에 따라 `defaultDisplayCalendar` prop 이름과 음력 보조 표기 마크업이 바뀔 수 있음

**Files:**
- Create: `fixtures/astro/package.json`, `fixtures/astro/tsconfig.json`, `fixtures/astro/astro.config.mjs`, `fixtures/astro/src/styles/global.css`, `fixtures/astro/src/components/LunarBirthDate.tsx`, `fixtures/astro/src/pages/index.astro`

**Interfaces:**
- Consumes: `LunisolarProvider`(`calendars`), `DatePicker`(`defaultDisplayCalendar`), `dangi`(`@lunisolar-picker/calendar/dangi`), `ko`, `scripts/assert-markup.ts`, `scripts/check-hydration.ts`
- Produces: `just fixtures`의 세 번째 구성원

- [ ] **Step 1: fixture 파일 작성**

`fixtures/astro/package.json`:
```json
{
  "name": "@lunisolar-picker-fixtures/astro",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "astro build",
    "check:markup": "tsx ../../scripts/assert-markup.ts dist/index.html '<astro-island' 'data-lsp-part=\"date-field\"' 'value=\"1990-06-23[u-ca=dangi]\"'",
    "check:hydration": "tsx ../../scripts/check-hydration.ts dist /",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@astrojs/react": "7.0.1",
    "@lunisolar-picker/calendar": "workspace:*",
    "@lunisolar-picker/core": "workspace:*",
    "@lunisolar-picker/react": "workspace:*",
    "@lunisolar-picker/theme": "workspace:*",
    "astro": "7.3.8",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "oxc-transform-react": "0.145.0"
  }
}
```

`fixtures/astro/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src", ".astro/types.d.ts"],
  "exclude": ["dist"]
}
```

`fixtures/astro/astro.config.mjs`:
```js
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [react()],
});
```

`fixtures/astro/src/styles/global.css`:
```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
```

`fixtures/astro/src/components/LunarBirthDate.tsx`:
```tsx
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker } from '@lunisolar-picker/react/pickers';

// Goal: saju-pictures와 같은 구성(Astro island + 음력 입력)에서 음력 표기 값이 SSR과 hydration 뒤에 같은지 확인함 (Review Focus 4)
export function LunarBirthDate() {
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today="2026-10-14" calendars={[dangi]}>
      <DatePicker name="birthDate" defaultValue="1990-06-23[u-ca=dangi]" defaultDisplayCalendar="dangi" max="2026-10-14" />
    </LunisolarProvider>
  );
}
```

`fixtures/astro/src/pages/index.astro`:
```astro
---
import { LunarBirthDate } from '../components/LunarBirthDate';
import '../styles/global.css';
---

<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lunisolar-picker astro fixture</title>
  </head>
  <body>
    <main>
      <h1>음력 생년월일</h1>
      <LunarBirthDate client:load />
    </main>
  </body>
</html>
```

- [ ] **Step 2: 빌드·검사 실행**

Run: `pnpm install && just build && pnpm --filter @lunisolar-picker-fixtures/astro run build && pnpm --filter @lunisolar-picker-fixtures/astro run check:markup && pnpm --filter @lunisolar-picker-fixtures/astro run check:hydration`
Expected: `dist/index.html` 생성, `all 3 fragments present`, `hydrated without errors`

- [ ] **Step 3: 품질 게이트**

Run: `NEXT_TELEMETRY_DISABLED=1 just fixtures && just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 4: 커밋**

```bash
git add fixtures/astro pnpm-lock.yaml
ALLOW_COMMIT=1 git commit -m "test: Astro island에서 음력 날짜 값이 서버 렌더와 hydration 뒤에 같은지 검증" -m "첫 소비자인 사주픽처스와 같은 Astro island + 음력 입력 구성을 고정해, 음력 표기 문자열이 SSR HTML에 그대로 나오고 브라우저에서 hydration 오류가 없는지 확인함."
```

---

### Task 4: 문서 사이트 뼈대, 시작하기, 테마 문서

> 🟡 잠정: M3·M4 구현 결과에 따라 데모 prop, 토큰 이름·기준값, `data-lsp-part` 값이 바뀔 수 있음

**Files:**
- Create: `apps/docs/package.json`, `apps/docs/tsconfig.json`, `apps/docs/astro.config.mjs`, `apps/docs/src/content.config.ts`, `apps/docs/src/styles/docs.css`
- Create: `apps/docs/src/components/demos/DemoProvider.tsx`, `apps/docs/src/components/demos/DatePickerDemo.tsx`
- Create: `apps/docs/src/content/docs/index.mdx`, `apps/docs/src/content/docs/getting-started.mdx`, `apps/docs/src/content/docs/theming.mdx`
- Modify: `justfile`

**Interfaces:**
- Consumes: 계약 §3 완성형·Provider, §4 theme 파일 경로·토큰, 스펙 8장 Mono 기준값
- Produces: `just docs-build`, 데모 공통 래퍼 `DemoProvider({ children, locale?, calendars? })`

- [ ] **Step 1: 문서 앱 설정**

`apps/docs/package.json`:
```json
{
  "name": "@lunisolar-picker/docs",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@astrojs/react": "7.0.1",
    "@astrojs/starlight": "0.42.6",
    "@lunisolar-picker/calendar": "workspace:*",
    "@lunisolar-picker/core": "workspace:*",
    "@lunisolar-picker/react": "workspace:*",
    "@lunisolar-picker/theme": "workspace:*",
    "astro": "7.3.8",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "oxc-transform-react": "0.145.0"
  }
}
```

`apps/docs/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src", ".astro/types.d.ts"],
  "exclude": ["dist"]
}
```

`apps/docs/astro.config.mjs`:
```js
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'lunisolar-picker',
      description: 'Modern, accessible date pickers for React with optional Korean lunisolar calendar support.',
      customCss: ['./src/styles/docs.css'],
      sidebar: [
        { label: 'Start here', items: ['getting-started', 'theming'] },
        {
          label: 'Pickers',
          items: [
            'pickers/date-picker',
            'pickers/date-range-picker',
            'pickers/month-picker',
            'pickers/wheel-date-picker',
            'pickers/time-picker',
          ],
        },
        {
          label: 'Parts',
          items: ['parts/calendar', 'parts/date-field', 'parts/wheel', 'parts/time-field', 'parts/popover-and-sheet'],
        },
        {
          label: 'Guides',
          items: [
            'guides/customizing-pickers',
            'guides/lunar-calendar',
            'guides/forms',
            'guides/nextjs',
            'guides/accessibility',
            'guides/migrating-from-react-day-picker',
          ],
        },
      ],
    }),
    react(),
  ],
});
```

`apps/docs/src/content.config.ts`:
```ts
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
```

`apps/docs/src/styles/docs.css`:
```css
/* Constraint: Starlight가 자기 스타일을 starlight 레이어에 두므로 picker 테마를 그 뒤에 두어 데모가 Starlight 기본 버튼 스타일에 덮이지 않게 함 */
@layer starlight, lunisolar-picker;
@import '@lunisolar-picker/theme/mono.css';

.demo-frame {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--sl-color-gray-5);
  border-radius: 0.5rem;
}

.demo-frame output {
  font-family: var(--sl-font-system-mono);
  font-size: var(--sl-text-sm);
  color: var(--sl-color-gray-2);
}
```

- [ ] **Step 2: 데모 공통 래퍼와 첫 데모 작성**

`apps/docs/src/components/demos/DemoProvider.tsx`:
```tsx
import type { CalendarSystem } from '@lunisolar-picker/calendar';
import type { LocaleData } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { LunisolarProvider } from '@lunisolar-picker/react';
import type { ReactNode } from 'react';

interface DemoProviderProps {
  readonly children: ReactNode;
  readonly locale?: LocaleData;
  readonly calendars?: readonly CalendarSystem[];
}

// Constraint: 문서는 빌드한 날과 읽는 날이 달라 '오늘'이 어긋나므로 데모는 client:only로만 렌더하고 브라우저 시간대를 씀
export function DemoProvider({ children, locale = en, calendars = [] }: DemoProviderProps) {
  return (
    <LunisolarProvider locale={locale} calendars={calendars}>
      <div className="demo-frame">{children}</div>
    </LunisolarProvider>
  );
}
```

`apps/docs/src/components/demos/DatePickerDemo.tsx`:
```tsx
import type { DateString } from '@lunisolar-picker/calendar';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function DatePickerDemo() {
  const [value, setValue] = useState<DateString | null>(null);
  return (
    <DemoProvider>
      <DatePicker value={value} onValueChange={(next) => setValue(next)} placeholder="Pick a date" />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
```

- [ ] **Step 3: 홈·시작하기·테마 문서 작성**

`apps/docs/src/content/docs/index.mdx`:
````mdx
---
title: lunisolar-picker
description: Modern, accessible date pickers for React with optional Korean lunisolar calendar support.
template: splash
hero:
  tagline: A calm, monochrome date picker kit for React. Solar-first, with Korean lunar dates one option away.
  actions:
    - text: Get started
      link: /getting-started/
      icon: right-arrow
    - text: Lunar calendar
      link: /guides/lunar-calendar/
      variant: minimal
---

import { CardGrid, Card } from '@astrojs/starlight/components';

<CardGrid>
  <Card title="Five pickers" icon="seti:react">
    Date, date range, month, wheel and time pickers that work with mouse, keyboard and touch.
  </Card>
  <Card title="Headless core" icon="setting">
    State lives in a framework-agnostic core. React parts render it; you can rebuild any picker from the same parts.
  </Card>
  <Card title="Strings in, strings out" icon="document">
    Values are canonical strings such as `2026-10-14`. They compare with `===`, travel through URLs and forms, and parse with Temporal.
  </Card>
  <Card title="Korean lunar dates" icon="star">
    Add `dangi` and users can enter lunar dates, leap months and 30th days. Data comes from the Korea Astronomy and Space Science Institute (KASI).
  </Card>
</CardGrid>
````

`apps/docs/src/content/docs/getting-started.mdx`:
````mdx
---
title: Getting started
description: Install lunisolar-picker, load the theme and render your first date picker.
---

import { DatePickerDemo } from '../../components/demos/DatePickerDemo';

<DatePickerDemo client:only="react" />

## Install

The React package depends on the core and calendar packages, but you import locales and the lunar calendar from them directly, so install all four:

```sh
pnpm add @lunisolar-picker/react @lunisolar-picker/core @lunisolar-picker/calendar @lunisolar-picker/theme
```

Requirements: React 19, an ESM-capable bundler, and Node 22.12 or later for server rendering.

## Load the theme

Import the stylesheet once, for example in your global CSS. The theme lives in the `lunisolar-picker` cascade layer. Declare the layer order so your utilities can still override it:

```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
```

## Render a picker

```tsx
import { en } from '@lunisolar-picker/core/locales/en';
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';

export function App() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <LunisolarProvider locale={en} timeZone="America/New_York">
      <DatePicker value={value} onValueChange={(next) => setValue(next)} />
    </LunisolarProvider>
  );
}
```

`onValueChange` receives a canonical date string such as `'2026-10-14'`, or `null` when the user clears the picker. The second argument carries `validity`, a list of reasons when the value breaks a constraint.

## Provider options

| Prop | Purpose |
|---|---|
| `locale` | Month and weekday names, field order, labels and announcements. Import `en`, `ko` or `ja` from `@lunisolar-picker/core/locales/*`. |
| `timeZone` | IANA time zone used only to decide which day is "today". Values themselves have no time zone. |
| `today` | A fixed `YYYY-MM-DD` for "today". Set it when you render on the server so the server and the browser agree. |
| `weekStartsOn` | `0` (Sunday) to `6` (Saturday). Defaults to the locale. |
| `calendars` | Extra calendar systems. Pass `[dangi]` to enable Korean lunar dates. |

Every picker also accepts these props directly, so the provider is optional.

## Next steps

- [Theming](/theming/) to match your brand and dark mode.
- [Date range picker](/pickers/date-range-picker/) for filters with presets and a confirm step.
- [Lunar calendar](/guides/lunar-calendar/) to accept Korean lunar birthdays.
````

`apps/docs/src/content/docs/theming.mdx`:
````mdx
---
title: Theming
description: Load the Mono theme, switch light and dark modes, and map tokens to your design system.
---

## Cascade layer

`@lunisolar-picker/theme/mono.css` wraps every rule in `@layer lunisolar-picker`. Rules outside a layer, and later layers, always win, so Tailwind utilities and your own CSS can override the theme without `!important`.

```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
```

## Light, dark and system

| Markup | Result |
|---|---|
| nothing | Light |
| `class="dark"` or `data-theme="dark"` on any ancestor | Dark |
| `data-theme="system"` on any ancestor | Follows the operating system (`prefers-color-scheme`) |

The theme never follows the operating system on its own. Apps that manage dark mode with a `.dark` class would otherwise see the picker turn dark while the page stays light. Each mode also sets `color-scheme`, so scrollbars and native controls match.

## Tokens

Override any token on `:root` or on a wrapper element.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--lsp-bg` | `#ffffff` | `#09090b` | Picker background |
| `--lsp-surface` | `#ffffff` | `#111113` | Popover and field surface |
| `--lsp-fg` | `#09090b` | `#fafafa` | Text |
| `--lsp-muted` | `#71717a` | `#a1a1aa` | Weekday headers, placeholders |
| `--lsp-subtle` | lunar labels, outside days | | Secondary labels |
| `--lsp-border` | `#e4e4e7` | `#26262a` | Lines |
| `--lsp-accent` | `#09090b` | `#fafafa` | Selected day fill |
| `--lsp-accent-fg` | `#ffffff` | `#09090b` | Text on the accent |
| `--lsp-range-bg` | `#f4f4f5` | `#1d1d20` | Days inside a range |
| `--lsp-ring` | focus ring | | Keyboard focus |
| `--lsp-danger` | invalid state | | Invalid fields and ranges |
| `--lsp-radius` | `8px` | `8px` | Corner radius |
| `--lsp-cell-size` | `36px` (`44px` on touch screens) | | Day cell size |
| `--lsp-shadow-popover` | popover shadow | | Popover elevation |
| `--lsp-duration` | motion length | | Transitions (zero with reduced motion) |

```css
:root {
  --lsp-accent: #4c51bf;
  --lsp-accent-fg: #ffffff;
  --lsp-radius: 12px;
}
```

## shadcn/ui and Tailwind tokens

If your app already defines shadcn tokens (`--primary`, `--border`, `--radius` and so on), load the bridge after the theme and the picker follows them, including dark mode:

```css
@import '@lunisolar-picker/theme/mono.css';
@import '@lunisolar-picker/theme/bridge/shadcn.css';
```

## Styling with state attributes

Parts expose their identity in `data-lsp-part` and their state in `data-*` attributes. Target them from CSS or Tailwind arbitrary variants.

| Attribute | Meaning |
|---|---|
| `data-selected` | Selected day |
| `data-today` | Today |
| `data-disabled` | Cannot be selected |
| `data-outside` | Belongs to the previous or next month |
| `data-in-range`, `data-range-start`, `data-range-end` | Range selection |
| `data-preview` | Range end that follows the pointer before it is fixed |
| `data-invalid` | Value breaks a constraint |
| `data-focused` | Keyboard focus |
| `data-open` | Popover or sheet is open |
| `data-placeholder` | Field segment not filled yet |
| `data-calendar` | `gregory` or `dangi` |
| `data-view` | `days`, `months` or `years` |
| `data-weekday` | `0` (Sunday) to `6` (Saturday) |

Colour weekends red and blue, as many Korean products do:

```css
[data-lsp-part='calendar-cell'][data-weekday='0'] { color: #e5484d; }
[data-lsp-part='calendar-cell'][data-weekday='6'] { color: #3b82f6; }
```

## Motion

Month transitions slide for 180 ms and popovers fade for 140 ms. Both turn off when the user asks for reduced motion. In Windows high-contrast mode (`forced-colors`) selection uses system colours.
````

`--lsp-subtle`, `--lsp-ring`, `--lsp-danger`, `--lsp-shadow-popover`, `--lsp-duration` 칸의 "Light/Dark" 값은 M3 theme 구현 후 실제 값으로 채운다. 이 Step에서는 위 문구 그대로 쓰고, Task 4 Step 5에서 M3 `mono.css`의 실제 값으로 바꾼다.

- [ ] **Step 4: docs-build 타깃 추가**

`justfile`에 추가:
```make
docs-build: build
    pnpm --filter @lunisolar-picker/docs run build
    pnpm exec tsx scripts/assert-markup.ts apps/docs/dist/getting-started/index.html '<astro-island' 'client="only"'
```

- [ ] **Step 5: 토큰 표를 실제 값으로 맞추기**

Run: `grep -E -- '--lsp-(subtle|ring|danger|shadow-popover|duration)' packages/theme/mono.css`
Expected: 라이트·다크 값 출력. 각 값을 `theming.mdx` 표의 해당 칸에 그대로 옮긴다(설명 문구 자리를 실제 값으로 교체). 파일 경로가 다르면 `packages/theme/package.json`의 `exports["./mono.css"]` 경로를 따른다.

- [ ] **Step 6: 빌드 확인**

Run: `pnpm install && just docs-build && pnpm --filter @lunisolar-picker/docs run typecheck`
Expected: 빌드 성공, `all 2 fragments present`, 타입 오류 0

- [ ] **Step 7: 커밋**

```bash
git add apps/docs justfile pnpm-lock.yaml
ALLOW_COMMIT=1 git commit -m "docs: 설치부터 테마 적용까지 바로 따라 할 수 있는 문서 사이트 도입" -m "- Starlight로 문서 사이트를 세우고 실제 컴포넌트를 client:only 데모로 보여 줘 빌드일과 열람일의 '오늘' 차이로 hydration이 어긋나지 않게 함.
- @layer 순서, 라이트·다크·시스템 전환, 토큰과 data 속성을 문서화해 Tailwind·shadcn 앱이 덮어쓰는 방법을 안내함."
```

---

### Task 5: 완성형·부품 문서와 복사 레시피

> 🟡 잠정: M3·M4 구현 결과에 따라 부품 이름, prop 표, 완성형 소스(레시피 본문)가 바뀔 수 있음. 레시피는 M4의 실제 `DateRangePicker` 소스를 그대로 옮긴다

**Files:**
- Create: `apps/docs/src/components/demos/DateRangePickerDemo.tsx`, `MonthPickerDemo.tsx`, `WheelDatePickerDemo.tsx`, `TimePickerDemo.tsx`, `HolidayCalendarDemo.tsx` (모두 `apps/docs/src/components/demos/`)
- Create: `apps/docs/src/content/docs/pickers/date-picker.mdx`, `date-range-picker.mdx`, `month-picker.mdx`, `wheel-date-picker.mdx`, `time-picker.mdx` (모두 `apps/docs/src/content/docs/pickers/`)
- Create: `apps/docs/src/content/docs/parts/calendar.mdx`, `date-field.mdx`, `wheel.mdx`, `time-field.mdx`, `popover-and-sheet.mdx` (모두 `apps/docs/src/content/docs/parts/`)
- Create: `apps/docs/src/content/docs/guides/customizing-pickers.mdx`
- Modify: `justfile`(docs-build 검사 페이지 추가)

**Interfaces:**
- Consumes: 계약 §3.3~§3.5 (`Calendar.*`, `RangeCalendar.Root`, `DateField.*`, `Wheel.*`, `TimeField.*`, `Popover.*`, `Sheet.*`, 완성형 5종, `usePickerSelection`, `CellRenderInfo`), `validateRange`, `isSameRange`, `epochDayOf`, `formatDate`
- Produces: 문서 페이지 11개, 데모 5개

- [ ] **Step 1: 데모 작성**

`apps/docs/src/components/demos/DateRangePickerDemo.tsx`:
```tsx
import { type DateRangeValue, type DateString, type EpochDay, addDays, formatDate, isSameRange } from '@lunisolar-picker/calendar';
import { type Validity, validateRange } from '@lunisolar-picker/core';
import { DateRangePicker, usePickerSelection } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

const MAX_DAYS = 14;
const PRESET_DAY_COUNTS = [7, 14, 30] as const;

function todayString(): DateString {
  const now = new Date();
  const today = formatDate(Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000) as EpochDay);
  if (!today.isOk) throw new Error(`cannot format today: ${today.error}`);
  return today.value;
}

function lastDays(today: DateString, dayCount: number): DateRangeValue {
  const start = addDays(today, -(dayCount - 1));
  if (!start.isOk) throw new Error(`cannot build a ${dayCount}-day preset: ${start.error}`);
  return { start: start.value, end: today };
}

function RecentPresets({ today }: { readonly today: DateString }) {
  const { draftRange, setRange } = usePickerSelection();
  return (
    <div role="group" aria-label="Presets">
      {PRESET_DAY_COUNTS.map((dayCount) => {
        const preset = lastDays(today, dayCount);
        return (
          <button
            key={dayCount}
            type="button"
            disabled={!validateRange(preset, { max: today, maxDays: MAX_DAYS }).isValid}
            aria-pressed={isSameRange(draftRange, preset)}
            onClick={() => setRange(preset)}
          >
            Last {dayCount} days
          </button>
        );
      })}
    </div>
  );
}

export function DateRangePickerDemo() {
  const today = todayString();
  const [range, setRange] = useState<DateRangeValue | null>(lastDays(today, 7));
  const [validity, setValidity] = useState<Validity | null>(null);
  return (
    <DemoProvider>
      <DateRangePicker
        value={range}
        onValueChange={(next, details) => {
          setRange(next);
          setValidity(details.validity);
        }}
        max={today}
        maxDays={MAX_DAYS}
        limitMode="flag"
        commitMode="confirm"
        numberOfMonths={2}
        presets={<RecentPresets today={today} />}
      />
      <output>value: {JSON.stringify(range)} · reasons: {JSON.stringify(validity?.reasons ?? [])}</output>
    </DemoProvider>
  );
}
```

`apps/docs/src/components/demos/MonthPickerDemo.tsx`:
```tsx
import type { MonthString } from '@lunisolar-picker/calendar';
import { MonthPicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function MonthPickerDemo() {
  const [value, setValue] = useState<MonthString | null>(null);
  return (
    <DemoProvider>
      <MonthPicker value={value} onValueChange={(next) => setValue(next)} min="2020-01" max="2030-12" />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
```

`apps/docs/src/components/demos/WheelDatePickerDemo.tsx`:
```tsx
import type { DateString } from '@lunisolar-picker/calendar';
import { WheelDatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function WheelDatePickerDemo() {
  const [value, setValue] = useState<DateString | null>(null);
  return (
    <DemoProvider>
      <WheelDatePicker presentation="inline" defaultValue="1990-03-15" onValueChange={(next) => setValue(next)} />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
```

`apps/docs/src/components/demos/TimePickerDemo.tsx`:
```tsx
import type { TimeString } from '@lunisolar-picker/calendar';
import { TimePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function TimePickerDemo() {
  const [value, setValue] = useState<TimeString | null>(null);
  return (
    <DemoProvider>
      <TimePicker value={value} onValueChange={(next) => setValue(next)} minuteStep={5} isEndOfDayAllowed />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
```

`apps/docs/src/components/demos/HolidayCalendarDemo.tsx`:
```tsx
import type { DateString } from '@lunisolar-picker/calendar';
import { Calendar } from '@lunisolar-picker/react';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

// Goal: 공휴일 데이터는 앱 몫이고 라이브러리는 칸 렌더링 슬롯만 준다는 경계를 보여 줌 (스펙 1.3)
const HOLIDAY_NAMES: Readonly<Record<string, string>> = {
  '2026-10-03': 'National Foundation Day',
  '2026-10-09': 'Hangul Day',
};

export function HolidayCalendarDemo() {
  const [value, setValue] = useState<DateString | null>(null);
  return (
    <DemoProvider>
      <Calendar.Root
        value={value}
        onValueChange={(next) => setValue(next)}
        defaultValue="2026-10-14"
        getCellLabel={(cell) => HOLIDAY_NAMES[cell.date]}
      >
        <Calendar.Header>
          <Calendar.PrevButton />
          <Calendar.Heading />
          <Calendar.NextButton />
        </Calendar.Header>
        <Calendar.Grid monthIndex={0}>
          {(cell) => (
            <Calendar.Cell cell={cell}>
              {(info) => (
                <>
                  <span>{info.day}</span>
                  {HOLIDAY_NAMES[info.date] && <span className="holiday-dot" aria-hidden="true" />}
                </>
              )}
            </Calendar.Cell>
          )}
        </Calendar.Grid>
      </Calendar.Root>
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
```

`apps/docs/src/styles/docs.css` 끝에 추가:
```css
.holiday-dot {
  inline-size: 4px;
  block-size: 4px;
  border-radius: 999px;
  background: #e5484d;
}
```

- [ ] **Step 2: 완성형 문서 작성**

`apps/docs/src/content/docs/pickers/date-picker.mdx`:
````mdx
---
title: DatePicker
description: A segmented date field with a calendar popover, or a bottom sheet on touch screens.
---

import { DatePickerDemo } from '../../../components/demos/DatePickerDemo';

<DatePickerDemo client:only="react" />

```tsx
import { DatePicker } from '@lunisolar-picker/react/pickers';

<DatePicker value={value} onValueChange={(next) => setValue(next)} min="2020-01-01" max="2030-12-31" />;
```

Type the date digit by digit (`20261014`), paste it (`2026-10-14`, `2026.10.14`), or open the calendar. The field uses the numeric keypad on phones.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string \| null` | | Controlled value, a canonical date string. |
| `defaultValue` | `string \| null` | `null` | Initial value for uncontrolled use. |
| `onValueChange` | `(value: DateString \| null, details: { validity }) => void` | | Called with the new value. `null` means cleared. |
| `min`, `max` | `string` | | Earliest and latest selectable dates. |
| `isDateDisabled` | `(date: DateString) => boolean` | | Disable any other day. |
| `commitMode` | `'immediate' \| 'confirm'` | `'immediate'` | With `'confirm'` the popover shows Confirm and Cancel, and closing without confirming discards the choice. |
| `numberOfMonths` | `number` | `1` | Months shown side by side. |
| `presentation` | `'auto' \| 'popover' \| 'sheet'` | `'auto'` | `'auto'` opens a bottom sheet on narrow touch screens. |
| `placeholder` | `string` | locale | Trigger text when empty. |
| `separator` | `string` | locale | Character between segments, for example `'-'`. |
| `renderTrigger` | `(props: TriggerRenderProps) => ReactElement` | | Replace the trigger, for example with a filter chip. |
| `footer` | `ReactNode` | | Extra content under the calendar. |
| `displayCalendar`, `defaultDisplayCalendar`, `onDisplayCalendarChange` | `'gregory' \| 'dangi'` | `'gregory'` | Which calendar the grid shows when lunar dates are enabled. |
| `getCellLabel` | `(cell) => string \| undefined` | | Extra words read by screen readers for a day. |
| `name`, `form`, `required`, `disabled`, `readOnly`, `invalid` | | | Same meaning as on native inputs. `name` renders a hidden input with the value. |
| `onInvalidValue` | `(input: string, reason: ValidationReason) => void` | | Called when `value` or `defaultValue` is not a canonical string. The picker treats it as empty. |

Locale, time zone, `today`, `weekStartsOn` and `calendars` can be set here or on `LunisolarProvider`.
````

`apps/docs/src/content/docs/pickers/date-range-picker.mdx`:
````mdx
---
title: DateRangePicker
description: Select a start and end date with drag, presets, length limits and an optional confirm step.
---

import { DateRangePickerDemo } from '../../../components/demos/DateRangePickerDemo';

<DateRangePickerDemo client:only="react" />

```tsx
import { DateRangePicker } from '@lunisolar-picker/react/pickers';

<DateRangePicker
  value={range}
  onValueChange={(next, { validity }) => setRange(next)}
  max={today}
  maxDays={60}
  limitMode="flag"
  commitMode="confirm"
  numberOfMonths={2}
  presets={<MyPresets />}
/>;
```

## Selecting

- Click a start day, then an end day. Clicking again after a complete range starts a new one.
- With a mouse or pen, drag across days. Grab either end of an existing range to move it. Hold the pointer at the calendar edge for half a second to turn the month.
- On touch screens, tap the start and the end. Dragging is off so the page can scroll.

## Length limits

`minDays` and `maxDays` count both ends: 13 to 17 October is 5 days.

| `limitMode` | Behaviour |
|---|---|
| `'block'` (default) | Days that would make the range too long or too short cannot be chosen. |
| `'flag'` | Any range can be chosen. `validity.reasons` contains `'range-too-long'` or `'range-too-short'` and the range gets `data-invalid`, so you can show your own warning and disable your Apply button. |

## Presets

Put your own buttons in the `presets` slot. Inside it, `usePickerSelection()` returns the working range as `draftRange` and sets it with `setRange`. Use `validateRange` to disable presets that break your limits and `isSameRange` to highlight the active one:

```tsx
import { isSameRange } from '@lunisolar-picker/calendar';
import { validateRange } from '@lunisolar-picker/core';
import { usePickerSelection } from '@lunisolar-picker/react/pickers';

function MyPresets({ presets }: { presets: { label: string; range: DateRangeValue }[] }) {
  const { draftRange, setRange } = usePickerSelection();
  return presets.map((preset) => (
    <button
      key={preset.label}
      type="button"
      disabled={!validateRange(preset.range, { maxDays: 60 }).isValid}
      aria-pressed={isSameRange(draftRange, preset.range)}
      onClick={() => setRange(preset.range)}
    >
      {preset.label}
    </button>
  ));
}
```

## Props

All [DatePicker props](/pickers/date-picker/#props) except that values are ranges, plus:

| Prop | Type | Default | Description |
|---|---|---|---|
| `value`, `defaultValue` | `{ start: string; end: string \| null } \| null` | `null` | Canonical range. |
| `onValueChange` | `(value: DateRangeValue \| null, details: { validity }) => void` | | Called when a range is complete, or on Confirm in `'confirm'` mode. |
| `minDays`, `maxDays` | `number` | | Length limits, both ends included. |
| `limitMode` | `'block' \| 'flag'` | `'block'` | See above. |
| `isOpenEndAllowed` | `boolean` | `false` | Allow `end: null` as a committed value, for "no end date". |
| `presets` | `ReactNode` | | Slot for preset buttons. |
| `startName`, `endName` | `string` | | Hidden inputs for native form submission. |
````

`apps/docs/src/content/docs/pickers/month-picker.mdx`:
````mdx
---
title: MonthPicker
description: Pick a year and month from a grid.
---

import { MonthPickerDemo } from '../../../components/demos/MonthPickerDemo';

<MonthPickerDemo client:only="react" />

```tsx
import { MonthPicker } from '@lunisolar-picker/react/pickers';

<MonthPicker value={month} onValueChange={(next) => setMonth(next)} min="2020-01" max="2030-12" />;
```

Values are `YYYY-MM` strings. Arrow keys move by month, PageUp and PageDown by year.

| Prop | Type | Description |
|---|---|---|
| `value`, `defaultValue` | `string \| null` | Canonical month such as `'2026-10'`. |
| `onValueChange` | `(value: MonthString \| null, details) => void` | Called with the new month. |
| `min`, `max` | `string` | Earliest and latest months. |
| `name`, `form`, `required`, `disabled`, `readOnly`, `invalid` | | Same as native inputs. |
````

`apps/docs/src/content/docs/pickers/wheel-date-picker.mdx`:
````mdx
---
title: WheelDatePicker
description: Year, month and day drums with momentum scrolling, mouse wheel and keyboard support.
---

import { WheelDatePickerDemo } from '../../../components/demos/WheelDatePickerDemo';

<WheelDatePickerDemo client:only="react" />

```tsx
import { WheelDatePicker } from '@lunisolar-picker/react/pickers';

<WheelDatePicker presentation="sheet" value={birthDate} onValueChange={(next) => setBirthDate(next)} />;
```

Flick a column on a phone and it keeps spinning, then settles on an item. On a desktop use the mouse wheel, drag, click an item, or focus a column and use the arrow keys, PageUp and PageDown (five items), Home and End. In the year column you can type a year.

When lunar dates are on, the month column lists leap months (for example "Leap 4") only in years that have them. If the year changes and the leap month disappears, the picker moves to the regular month. If a lunar month has 29 days, day 30 moves to 29.

| Prop | Type | Default | Description |
|---|---|---|---|
| `presentation` | `'inline' \| 'sheet'` | `'inline'` | Render in place, or in a bottom sheet with a trigger. |
| `value`, `defaultValue`, `onValueChange`, `min`, `max`, `isDateDisabled` | | | As on [DatePicker](/pickers/date-picker/). |
````

`apps/docs/src/content/docs/pickers/time-picker.mdx`:
````mdx
---
title: TimePicker
description: A 24-hour HH:mm field with minute steps and an optional 24:00.
---

import { TimePickerDemo } from '../../../components/demos/TimePickerDemo';

<TimePickerDemo client:only="react" />

```tsx
import { TimePicker } from '@lunisolar-picker/react/pickers';

<TimePicker value={time} onValueChange={(next) => setTime(next)} minuteStep={5} />;
```

The field always shows 24-hour time, whatever the device locale. Type `930` for `09:30`. Arrow keys on the minute segment move by `minuteStep`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value`, `defaultValue` | `string \| null` | `null` | Canonical `HH:mm`. |
| `onValueChange` | `(value: TimeString \| null, details) => void` | | Called with the new time. |
| `minuteStep` | `number` | `1` | Step for the minute list and arrow keys. |
| `isEndOfDayAllowed` | `boolean` | `false` | Accept `24:00` as the end of a day. It is never turned into the next day. |
| `name`, `form`, `required`, `disabled`, `readOnly`, `invalid` | | | Same as native inputs. |
````

- [ ] **Step 3: 부품 문서 작성**

`apps/docs/src/content/docs/parts/calendar.mdx`:
````mdx
---
title: Calendar parts
description: Build your own calendar from Calendar and RangeCalendar parts.
---

import { HolidayCalendarDemo } from '../../../components/demos/HolidayCalendarDemo';

<HolidayCalendarDemo client:only="react" />

## Anatomy

```tsx
import { Calendar } from '@lunisolar-picker/react';

<Calendar.Root value={value} onValueChange={(next) => setValue(next)}>
  <Calendar.Header>
    <Calendar.PrevButton />
    <Calendar.ViewButton>
      <Calendar.Heading />
    </Calendar.ViewButton>
    <Calendar.NextButton />
    <Calendar.TodayButton />
    <Calendar.CalendarToggle />
  </Calendar.Header>
  <Calendar.Grid monthIndex={0}>{(cell) => <Calendar.Cell cell={cell} />}</Calendar.Grid>
  <Calendar.MonthGrid />
  <Calendar.YearGrid />
</Calendar.Root>;
```

`RangeCalendar.Root` takes range props and accepts the same children.

| Part | Renders | Notes |
|---|---|---|
| `Root` | `div` | Owns state. Accepts every prop of `useCalendar` (`RangeCalendar.Root`: `useRangeCalendar`). |
| `Header` | `div` | Layout only. |
| `Heading` | `h2` | Month and year in the current calendar, from the locale. |
| `PrevButton`, `NextButton` | `button` | Move one month. Disabled at `min` and `max`. |
| `TodayButton` | `button` | Shows and focuses today. Hidden while today is visible. |
| `CalendarToggle` | `div[role=radiogroup]` | Switches between solar and lunar grids. Renders nothing unless `dangi` is enabled. |
| `ViewButton` | `button` | Steps the view from days to months to years. |
| `Grid` | `table[role=grid]` | `monthIndex` picks which of `numberOfMonths` months to show. Its child function receives each cell. |
| `HeadCell` | `th` | Weekday name. |
| `Cell` | `td > button` | One day. Children can be a function of `CellRenderInfo`. |
| `MonthGrid`, `YearGrid` | `div[role=grid]` | Shown when the view is `months` or `years`. |

## Rendering a day

`Calendar.Cell` children may be a function. It receives the day and its state:

```ts
interface CellRenderInfo {
  epochDay: number;
  date: DateString;          // solar 'YYYY-MM-DD'
  day: number;               // day number in the displayed calendar
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  isOutsideMonth: boolean;
  secondary: { calendarId; monthCode; day; isLeapMonth; isFirstDayOfMonth } | null; // lunar label in the solar grid
  isSelected: boolean; isToday: boolean; isDisabled: boolean; isFocused: boolean;
  isInRange: boolean; isRangeStart: boolean; isRangeEnd: boolean; isPreview: boolean;
}
```

Use it for holiday names, dots or counts. Add the same information to `getCellLabel` so screen reader users hear it.
````

`apps/docs/src/content/docs/parts/date-field.mdx`:
````mdx
---
title: DateField parts
description: Segmented date inputs that accept typing, paste and arrow keys.
---

```tsx
import { DateField } from '@lunisolar-picker/react';

<DateField.Root value={value} onValueChange={(next) => setValue(next)} name="birthDate">
  <DateField.Segment index={0} />
  <DateField.Separator />
  <DateField.Segment index={1} />
  <DateField.Separator />
  <DateField.Segment index={2} />
  <DateField.LeapMonthToggle />
  <DateField.HiddenInput />
</DateField.Root>;
```

Without children, `DateField.Root` renders the segments, separators, leap-month toggle and hidden input in the locale's order for you. `index` follows that order: in `en` index 0 is the month.

```tsx
<DateField.Root value={value} onValueChange={(next) => setValue(next)} name="birthDate" />;
```

Each segment is a `role="spinbutton"` element with the numeric keypad. Typing fills the segment and moves on when it is full or when you type `.`, `-` or `/`. Backspace clears a segment. Pasting `2026-10-14` or `2026.10.14` fills all segments.

The field never changes what you typed. If the date does not exist, for example 30 February or a leap month the year does not have, the field shows `data-invalid` and `validity.reasons` contains `'invalid-date'`. An unfinished field reports `'incomplete'`.

`DateField.LeapMonthToggle` appears only when the field is in lunar mode. Pressing <kbd>L</kbd> on the month segment toggles it too.

`DateRangeField.Root` contains `DateRangeField.Start`, `DateRangeField.Separator` and `DateRangeField.End`, each holding the same segments.

| Part | Renders | Notes |
|---|---|---|
| `Root` | `div[role=group]` | Owns state. Segment order follows the locale (`2026. 10. 14`, `10/14/2026`, `2026/10/14`). |
| `Segment` | `span[role=spinbutton]` | `index` in locale order: year, month or day. |
| `Separator` | `span[aria-hidden]` | Locale separator, or the `separator` prop. |
| `LeapMonthToggle` | `button[aria-pressed]` | Lunar mode only. |
| `HiddenInput` | `input[type=hidden]` | Submits the canonical value under `name`. |
````

`apps/docs/src/content/docs/parts/wheel.mdx`:
````mdx
---
title: Wheel parts
description: Drum columns with momentum that you can fill with any values.
---

```tsx
import { Wheel } from '@lunisolar-picker/react';

<Wheel.Root aria-label="Birth date">
  <Wheel.Column options={years} value={year} onValueChange={setYear} label="Year" />
  <Wheel.Column options={months} value={month} onValueChange={setMonth} label="Month" />
  <Wheel.Highlight />
</Wheel.Root>;
```

Each column is a `role="spinbutton"` with `aria-valuetext`, so a screen reader hears "Leap 4" rather than an index. Momentum is computed in the core and the animation writes `transform` directly, so React does not re-render on every frame. The selected value is stored when the column settles.

| Part | Renders | Notes |
|---|---|---|
| `Root` | `div` | Layout and the shared highlight band. |
| `Column` | `div[role=spinbutton]` | `options` are `{ value, label, isDisabled }`, plus `value`, `onValueChange` and `label`. Selection is kept by value when options change. Pass `renderItem` to draw an option yourself. |
| `Item` | `div` | One option. `Column` renders it for you. |
| `Highlight` | `div[aria-hidden]` | The band behind the selected row. |
````

`apps/docs/src/content/docs/parts/time-field.mdx`:
````mdx
---
title: TimeField parts
description: Hour and minute segments in 24-hour time.
---

```tsx
import { TimeField } from '@lunisolar-picker/react';

<TimeField.Root value={time} onValueChange={(next) => setTime(next)} minuteStep={5} name="startsAt">
  <TimeField.Segment index={0} />
  <TimeField.Separator />
  <TimeField.Segment index={1} />
  <TimeField.HiddenInput />
</TimeField.Root>;
```

| Part | Renders | Notes |
|---|---|---|
| `Root` | `div[role=group]` | Owns state. Accepts `minuteStep` and `isEndOfDayAllowed`. |
| `Segment` | `span[role=spinbutton]` | `index` 0 is the hour, 1 the minute. |
| `Separator` | `span[aria-hidden]` | Colon. |
| `HiddenInput` | `input[type=hidden]` | Submits `HH:mm`. |
````

`apps/docs/src/content/docs/parts/popover-and-sheet.mdx`:
````mdx
---
title: Popover and Sheet
description: Containers that open a picker next to its trigger or from the bottom of the screen.
---

```tsx
import { Popover, Sheet } from '@lunisolar-picker/react';

<Popover.Root>
  <Popover.Trigger render={<FilterChip />} />
  <Popover.Content>
    <MyCalendar />
    <Popover.Close>Done</Popover.Close>
  </Popover.Content>
</Popover.Root>;
```

| | Popover | Sheet |
|---|---|---|
| Role | `dialog` | `dialog`, `aria-modal="true"` |
| Position | Next to the trigger, flips and shifts to stay on screen | Bottom of the viewport |
| Focus | Moves to the selected day or today, trapped inside, returns to the trigger on close | Same |
| Closing | Escape, outside click, `Close` | Escape, backdrop tap, `Close` |
| Background | Interactive | `inert`, scroll locked (iOS keeps its scroll position) |

In `commitMode="confirm"` closing without confirming discards the choice. The finished pickers pick a sheet automatically on narrow touch screens (`presentation="auto"`).

Swipe-to-close is not supported, because it competes with wheel scrolling inside the sheet.
````

- [ ] **Step 4: 복사 레시피 작성**

M4의 실제 `packages/react/src/pickers/date-range-picker.tsx`를 읽고, 아래 문서의 "The source" 코드 블록에 그 파일의 JSX 본문을 그대로 붙인다. 아래 블록은 계약 §3 기준의 잠정 본문이다.

`apps/docs/src/content/docs/guides/customizing-pickers.mdx`:
````mdx
---
title: Customizing pickers
description: Copy a finished picker and change any part of it.
---

Every finished picker is a short list of parts. When a prop is not enough, copy the source into your app and edit it. The parts and their `data-*` attributes are stable; the finished pickers' markup may change in minor releases, which is why copying is safer than styling their internals.

## The source

```tsx
import {
  type UseRangeCalendarProps,
  Calendar,
  DateRangeField,
  Popover,
  RangeCalendar,
  useRangeCalendarContext,
} from '@lunisolar-picker/react';

function ConfirmButtons() {
  const calendar = useRangeCalendarContext();
  return (
    <div data-lsp-part="picker-footer">
      <Popover.Close onClick={() => calendar.cancel()}>Cancel</Popover.Close>
      <Popover.Close onClick={() => calendar.commit()}>Apply</Popover.Close>
    </div>
  );
}

export function MyDateRangePicker(props: UseRangeCalendarProps & { presets?: React.ReactNode }) {
  const { presets, ...calendarProps } = props;
  return (
    <RangeCalendar.Root {...calendarProps}>
      <Popover.Root>
        <Popover.Trigger render={<DateRangeField.Root />} />
        <Popover.Content>
          {presets && <div data-lsp-part="picker-presets">{presets}</div>}
          <Calendar.Header>
            <Calendar.PrevButton />
            <Calendar.ViewButton>
              <Calendar.Heading />
            </Calendar.ViewButton>
            <Calendar.NextButton />
            <Calendar.TodayButton />
          </Calendar.Header>
          <Calendar.Grid monthIndex={0}>{(cell) => <Calendar.Cell cell={cell} />}</Calendar.Grid>
          <Calendar.MonthGrid />
          <Calendar.YearGrid />
          <ConfirmButtons />
        </Popover.Content>
      </Popover.Root>
    </RangeCalendar.Root>
  );
}
```

## Common edits

**Holiday names in cells.** Replace `<Calendar.Cell cell={cell} />` with a render function, and pass `getCellLabel` to the root so screen readers hear the holiday:

```tsx
<RangeCalendar.Root {...calendarProps} getCellLabel={(cell) => holidays[cell.date]}>
  …
  <Calendar.Grid monthIndex={0}>
    {(cell) => (
      <Calendar.Cell cell={cell}>
        {(info) => (
          <>
            {info.day}
            {holidays[info.date] && <small>{holidays[info.date]}</small>}
          </>
        )}
      </Calendar.Cell>
    )}
  </Calendar.Grid>
</RangeCalendar.Root>
```

**A filter chip trigger.** Pass your chip to `Popover.Trigger`'s `render` prop. The chip receives the trigger's ARIA attributes and event handlers.

**Two months.** Set `numberOfMonths={2}` on the root and render `<Calendar.Grid monthIndex={1}>` next to the first grid.

**A warning for long ranges.** With `limitMode="flag"`, read `validity.reasons` from `onValueChange` and render your message in the footer. Disable your Apply button while the range is invalid.
````

- [ ] **Step 5: docs-build 검사 페이지 추가와 빌드**

`justfile`의 `docs-build` 두 번째 줄 아래에 추가:
```make
    pnpm exec tsx scripts/assert-markup.ts apps/docs/dist/pickers/date-range-picker/index.html '<astro-island' 'client="only"'
    pnpm exec tsx scripts/assert-markup.ts apps/docs/dist/parts/calendar/index.html '<astro-island' 'Rendering a day'
```

Run: `just docs-build && pnpm --filter @lunisolar-picker/docs run typecheck`
Expected: 빌드 성공, 세 페이지 모두 조각 존재, 타입 오류 0. 타입 오류가 나면 M3·M4의 실제 prop 이름을 확인하고 계약 문서를 먼저 고친 뒤 데모와 문서를 맞춘다.

- [ ] **Step 6: 데모 수동 확인**

Run: `pnpm --filter @lunisolar-picker/docs run dev`
확인: 다섯 picker 데모가 열리고 값 출력이 바뀌는지, 범위 데모에서 14일을 넘기면 `reasons`에 `range-too-long`이 나오는지, Starlight 다크 모드 전환 시 picker도 어두워지는지(Starlight는 `<html data-theme="dark">`를 쓰므로 테마의 `[data-theme="dark"]` 선택자가 그대로 맞는다). 확인 후 dev 서버를 끈다.

- [ ] **Step 7: 커밋**

```bash
git add apps/docs justfile
ALLOW_COMMIT=1 git commit -m "docs: 다섯 picker와 부품을 데모와 함께 문서화하고 복사해 고쳐 쓰는 방법 제공" -m "- 앱마다 picker를 다시 짜지 않도록 완성형이 부품을 어떻게 조합하는지 소스를 그대로 보여 주고 공휴일·칩 트리거·두 달·경고 같은 흔한 수정 예를 실음.
- 범위 길이 제한의 block·flag 차이와 프리셋 연결 방법을 실제 데모로 확인할 수 있게 함."
```

---

### Task 6: 음력·폼·Next·접근성·react-day-picker 이전 가이드

> 🟡 잠정: M2~M4 구현 결과에 따라 로케일 문구, 지원 범위 마지막 날짜, prop 이름이 바뀔 수 있음

**Files:**
- Create: `apps/docs/src/components/demos/LunarDatePickerDemo.tsx`
- Create: `apps/docs/src/content/docs/guides/lunar-calendar.mdx`, `forms.mdx`, `nextjs.mdx`, `accessibility.mdx`, `migrating-from-react-day-picker.mdx` (모두 `apps/docs/src/content/docs/guides/`)
- Modify: `justfile`

**Interfaces:**
- Consumes: `dangi.supportedRange`, `parseDate`, `isSameDay`, `formatDate`, `ko` 로케일, 스펙 4·5·10장, 계약 §3
- Produces: 가이드 5개

- [ ] **Step 1: 음력 데모와 가이드 작성**

`apps/docs/src/components/demos/LunarDatePickerDemo.tsx`:
```tsx
import type { DateString } from '@lunisolar-picker/calendar';
import { parseDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function LunarDatePickerDemo() {
  const [value, setValue] = useState<DateString | null>('1990-06-23[u-ca=dangi]' as DateString);
  const parsed = value ? parseDate(value, { calendars: [dangi] }) : null;
  return (
    <DemoProvider locale={ko} calendars={[dangi]}>
      <DatePicker value={value} onValueChange={(next) => setValue(next)} defaultDisplayCalendar="dangi" />
      <output>
        value: {JSON.stringify(value)} · fields: {parsed?.isOk ? JSON.stringify({ year: parsed.value.year, monthCode: parsed.value.monthCode, day: parsed.value.day }) : 'null'}
      </output>
    </DemoProvider>
  );
}
```

`apps/docs/src/content/docs/guides/lunar-calendar.mdx`:
````mdx
---
title: Korean lunar calendar
description: Accept and display Korean lunar dates, including leap months and 30th days.
---

import { LunarDatePickerDemo } from '../../../components/demos/LunarDatePickerDemo';

<LunarDatePickerDemo client:only="react" />

## Turn it on

Lunar support is off by default and costs nothing until you import it. Add `dangi` to `calendars`:

```tsx
import { dangi } from '@lunisolar-picker/calendar/dangi';

<LunisolarProvider calendars={[dangi]}>…</LunisolarProvider>;
```

Pickers then show a solar/lunar toggle and a small lunar date under each solar day. The `dangi` table adds about 1 KB gzipped.

## Values

A date entered in lunar mode keeps the same solar day in ISO form and adds a calendar annotation, the format Temporal uses:

| Entered as | Value |
|---|---|
| Solar 14 October 2026 | `'2026-10-14'` |
| Lunar 4 September 2026 (the same day) | `'2026-10-14[u-ca=dangi]'` |

The annotation records how the user entered the date, which matters for things like lunar birthdays. To compare days regardless of calendar, use `isSameDay`:

```ts
import { isSameDay, parseDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';

isSameDay('2026-10-14', '2026-10-14[u-ca=dangi]'); // true

const parsed = parseDate('1990-06-23[u-ca=dangi]', { calendars: [dangi] });
// parsed.value → { calendar: 'dangi', year: 1990, monthCode: 'M05L', day: 1, epochDay, value }
```

`monthCode` follows Temporal: `M05` is the fifth month and `M05L` is the leap fifth month. The year is the Gregorian year in which that lunar year began. You can read the same string with `Temporal.PlainDate.from` where Temporal is available.

## Leap months and 30th days

- A lunar year has 12 or 13 months. Leap months appear in the month lists only in the years that have them.
- Lunar months have 29 or 30 days.
- While scrolling a wheel or clicking a calendar, a date that stops existing is moved to the nearest one: a vanished leap month becomes the regular month, and day 30 becomes day 29.
- While typing, or when reading a string, the date is never changed. The field shows `data-invalid` and reports `'invalid-date'`.

## Supported range

Lunar dates are available from lunar 1 January 1900 (31 January 1900) to the last day KASI publishes, at the end of 2050. Outside that range the lunar grid stops navigating and the reason is `'outside-calendar-range'`. Solar dates cover years 1 to 9999.

## Where the data comes from

The lunar table is generated from the Korea Astronomy and Space Science Institute (KASI) lunar calendar API and checked against every published month. The library does not use the browser's `Intl` Korean calendar, because engines compute it differently: a page rendered on a server and hydrated on an iPhone could otherwise show different lunar dates.

## Server-side conversion

The calendar package has no React or DOM dependency. Use it on a server to convert values:

```ts
import { epochDayOf, formatDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';

const lunar = dangi.fromEpochDay(epochDayOf(solarValue)); // { year, monthCode, day }
const asLunarEntry = formatDate(epochDayOf(solarValue), dangi); // '2026-10-14[u-ca=dangi]'
```
````

- [ ] **Step 2: 폼 가이드 작성**

`apps/docs/src/content/docs/guides/forms.mdx`:
````mdx
---
title: Forms
description: Native form submission and react-hook-form.
---

## Native forms

Give a picker a `name` and it renders a hidden input with the canonical value. Ranges use `startName` and `endName`.

```tsx
<form action="/search">
  <DateRangePicker startName="from" endName="to" />
  <button type="submit">Search</button>
</form>
// submits ?from=2026-10-13&to=2026-10-17
```

`required`, `disabled`, `readOnly` and `form` behave as on native inputs. `invalid` marks the field invalid (`aria-invalid`) when your own validation fails.

## react-hook-form

Connect a picker with `Controller`. A cleared picker sends `null`, so `required` works without extra code.

```tsx
import { Controller, useForm } from 'react-hook-form';

const { control, handleSubmit } = useForm<{ birthDate: string | null }>({ defaultValues: { birthDate: null } });

<Controller
  name="birthDate"
  control={control}
  rules={{ required: 'Enter your birth date' }}
  render={({ field, fieldState }) => (
    <DatePicker
      ref={field.ref}
      name={field.name}
      value={field.value}
      onValueChange={(value) => field.onChange(value)}
      onBlur={field.onBlur}
      invalid={fieldState.invalid}
    />
  )}
/>;
```

`ref` focuses the first segment, so react-hook-form can move focus to the first invalid field.

## Validating constraints yourself

`onValueChange` reports why a value breaks the picker's constraints. You can run the same checks anywhere, for example in a zod refinement:

```ts
import { validateDate } from '@lunisolar-picker/core';

validateDate('2031-01-01', { max: '2030-12-31' }); // { isValid: false, reasons: ['after-max'] }
```
````

- [ ] **Step 3: Next.js 가이드 작성**

`apps/docs/src/content/docs/guides/nextjs.mdx`:
````mdx
---
title: Next.js App Router
description: Use the pickers from server components and keep server and browser renders identical.
---

Every entry of `@lunisolar-picker/react` is marked `"use client"`. A server component can render a picker directly as long as it passes only serializable props:

```tsx
// app/page.tsx (server component)
import { DatePicker } from '@lunisolar-picker/react/pickers';

export default function Page() {
  return <DatePicker name="installedAt" defaultValue="2026-10-14" />;
}
```

Callbacks such as `onValueChange` are functions, so put stateful pickers in a client component.

## Put the provider in a client component

Locale objects contain functions, so a server component cannot pass `locale={ko}` to `LunisolarProvider`. Import the locale inside a client wrapper:

```tsx
// app/providers.tsx
'use client';

import { ko } from '@lunisolar-picker/core/locales/ko';
import { LunisolarProvider } from '@lunisolar-picker/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul">
      {children}
    </LunisolarProvider>
  );
}
```

## Keep "today" stable

The server and the browser can disagree about the date near midnight or across time zones. Pass `timeZone` so both compute today in the same zone, or pass `today` from the server when the page must match exactly:

```tsx
<Providers today={todayInSeoul}>{children}</Providers>
```

After hydration the picker updates today when the date changes.

## CSS

Import the theme in `app/globals.css` with the layer order:

```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
```
````

- [ ] **Step 4: 접근성 문서 작성**

`apps/docs/src/content/docs/guides/accessibility.mdx`:
````mdx
---
title: Accessibility
description: Keyboard support, screen reader behaviour and touch targets.
---

The calendar follows the WAI-ARIA Authoring Practices date picker dialog and grid patterns. Fields and wheels use the spinbutton pattern.

## Calendar grid

Only one day is in the tab order at a time. Disabled days stay focusable so users can hear why they cannot pick them.

| Key | Action |
|---|---|
| <kbd>←</kbd> <kbd>→</kbd> | Previous or next day |
| <kbd>↑</kbd> <kbd>↓</kbd> | Same day of the previous or next week |
| <kbd>Home</kbd> <kbd>End</kbd> | First or last day of the week |
| <kbd>PageUp</kbd> <kbd>PageDown</kbd> | Previous or next month |
| <kbd>Shift</kbd>+<kbd>PageUp</kbd> <kbd>Shift</kbd>+<kbd>PageDown</kbd> | Previous or next year |
| <kbd>Enter</kbd> <kbd>Space</kbd> | Select |
| <kbd>Esc</kbd> | Close the popover or sheet |

Each day is announced as a full date, for example "Wednesday, October 14, 2026". With lunar dates on, the lunar date follows. Add your own words, such as holiday names, with `getCellLabel`.

Range selection is announced through a live region: "Start date selected. Choose an end date", then "October 13 to October 17, 5 days". When a range breaks a limit, the reason is announced in the locale's words.

## Date and time fields

| Key | Action |
|---|---|
| <kbd>0</kbd>–<kbd>9</kbd> | Type into the segment. It moves on when full. |
| <kbd>.</kbd> <kbd>-</kbd> <kbd>/</kbd> | Move to the next segment |
| <kbd>↑</kbd> <kbd>↓</kbd> | Increase or decrease (minutes move by `minuteStep`) |
| <kbd>Backspace</kbd> | Clear the segment |
| <kbd>L</kbd> | Toggle leap month on the month segment (lunar mode) |

Phones show the numeric keypad.

## Wheels

| Key | Action |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> | Previous or next item |
| <kbd>PageUp</kbd> <kbd>PageDown</kbd> | Five items |
| <kbd>Home</kbd> <kbd>End</kbd> | First or last item |
| digits | Jump to a year (year column) |

Columns announce text values such as "Leap 4".

## Popovers and sheets

Opening moves focus to the selected day, or today. Focus stays inside until the popover closes, then returns to the trigger. Sheets make the rest of the page `inert` and lock scrolling.

## Pointer, touch and motion

- Day cells are 36 px on desktops and 44 px on touch screens.
- Drag selection works with a mouse or pen. On touch screens, tap the start and the end so the page can still scroll.
- `prefers-reduced-motion` turns off month slides, popover fades and wheel momentum animation.
- In forced-colours mode the selection and range use system colours.

## Testing

Automated tests run axe and keyboard scenarios in Chromium, Firefox and WebKit. Releases are also checked by hand with VoiceOver on iOS and macOS, TalkBack and NVDA.
````

- [ ] **Step 5: react-day-picker 이전 가이드 작성**

`apps/docs/src/content/docs/guides/migrating-from-react-day-picker.mdx`:
````mdx
---
title: Migrating from react-day-picker
description: Map react-day-picker props and common custom wrappers to lunisolar-picker.
---

## Values

react-day-picker passes `Date` objects. lunisolar-picker passes canonical strings with no time zone, so you no longer need to strip times or fix off-by-one days caused by UTC conversion.

```ts
// before
const [selected, setSelected] = useState<Date | undefined>();
// after
const [value, setValue] = useState<string | null>(null);
```

## Props

| react-day-picker | lunisolar-picker |
|---|---|
| `mode="single"` | `DatePicker`, or `Calendar.Root` for an inline calendar |
| `mode="range"` | `DateRangePicker`, or `RangeCalendar.Root` |
| `mode="multiple"` | Not supported in v1 |
| `selected` | `value` (`'2026-10-14'`, or `{ start, end }` for ranges) |
| `onSelect(date)` | `onValueChange(value, { validity })` |
| `defaultMonth` / `month`, `onMonthChange` | The calendar opens on the selected day or today. Use `defaultValue` to start elsewhere. |
| `disabled={{ before: date }}` | `min` |
| `disabled={{ after: date }}` | `max` |
| `disabled={{ dayOfWeek: [0, 6] }}` | `isDateDisabled={(date) => …}` using `weekdayOf(epochDayOf(date))` |
| `disabled={(date) => …}` | `isDateDisabled={(date) => …}` (receives a date string) |
| `min` / `max` (range length) | `minDays` / `maxDays`. Both ends always count: 13 to 17 October is 5 days. Check how your react-day-picker version counted before converting numbers. |
| `excludeDisabled` | Ranges over disabled days report `'range-includes-disabled'` |
| `numberOfMonths` | `numberOfMonths` |
| `weekStartsOn` | `weekStartsOn` |
| `locale` (date-fns locale) | `locale` from `@lunisolar-picker/core/locales/en`, `ko` or `ja` |
| `timeZone` | `timeZone`. It only decides which day is today. |
| `showOutsideDays` | Always rendered, marked `data-outside` |
| `captionLayout="dropdown"` | Click the heading (`Calendar.ViewButton`) for month and year grids, or use `MonthPicker` |
| `components.DayButton` | `Calendar.Cell` with a render function |
| `components.Nav`, `components.MonthCaption` | `Calendar.Header`, `PrevButton`, `NextButton`, `Heading` |
| `modifiers` + `modifiersClassNames` | `data-*` state attributes, or a `Calendar.Cell` render function |
| `classNames` | Style `[data-lsp-part]` and state attributes, or override `--lsp-*` tokens |
| `footer` | `footer` |

## Wrapper features from our apps

**Maximum range length with a warning** (`maxRangeDays`):

```tsx
<DateRangePicker
  maxDays={60}
  limitMode="flag"
  onValueChange={(next, { validity }) => {
    setRange(next);
    setIsTooLong(validity.reasons.includes('range-too-long'));
  }}
/>
```

**Recent-days presets** that disable themselves when they exceed the limit and highlight the active one: put buttons in `presets` and use `usePickerSelection`, `validateRange` and `isSameRange`. See [DateRangePicker presets](/pickers/date-range-picker/#presets).

**Draft selection applied with a button** (the "조회" button, with Escape and outside click restoring the previous range): `commitMode="confirm"`. Your `onValueChange` runs only when the user confirms.

**Go to today**: `Calendar.TodayButton`, included in every finished picker. Pass `timeZone` (for example the project's time zone) so "today" matches your data.

**Holiday names and dots**: render them in a `Calendar.Cell` function and add them to `getCellLabel`. Fetching holidays stays in your app. See [Calendar parts](/parts/calendar/#rendering-a-day).

**Saturday blue, Sunday red**: style `[data-weekday='6']` and `[data-weekday='0']`. See [Theming](/theming/#styling-with-state-attributes).

**Open-ended schedules** ("no end date"): `isOpenEndAllowed` lets `end` stay `null`. Render your own "∞" badge with `renderTrigger`.

**Clickable segmented fields with dropdowns**: the date field accepts typing, paste and arrow keys. Pair it with the popover calendar (`DatePicker`) for pointer users.
````

- [ ] **Step 6: 빌드 확인**

`justfile`의 `docs-build`에 추가:
```make
    pnpm exec tsx scripts/assert-markup.ts apps/docs/dist/guides/lunar-calendar/index.html '<astro-island' 'M05L'
    pnpm exec tsx scripts/assert-markup.ts apps/docs/dist/guides/migrating-from-react-day-picker/index.html 'limitMode'
```

Run: `just docs-build && pnpm --filter @lunisolar-picker/docs run typecheck`
Expected: 모두 통과

- [ ] **Step 7: 지원 범위 문구 맞추기**

Run: `node --input-type=module -e "import { dangi } from '@lunisolar-picker/calendar/dangi'; import { formatDate } from '@lunisolar-picker/calendar'; console.log(formatDate(dangi.supportedRange.max))" ` (작업 디렉터리: `apps/docs`)
Expected: `{ isOk: true, value: '2051-…' }` 같은 마지막 지원일. `lunar-calendar.mdx`의 "at the end of 2050" 문장을 "to <그 날짜> (the last day KASI publishes)"로 바꾼다.

- [ ] **Step 8: 커밋**

```bash
git add apps/docs justfile
ALLOW_COMMIT=1 git commit -m "docs: 음력·폼·Next·접근성과 react-day-picker 이전 방법을 안내" -m "- web-console·back-office가 react-day-picker 위에 직접 만들었던 기간 제한·프리셋·조회 버튼·공휴일 칸을 어떤 API로 옮기는지 대응표와 예제로 정리함.
- 음력 값 형식과 윤달·30일 처리, Intl 대신 KASI 표를 쓰는 이유, 서버 컴포넌트에서 로케일을 넘기면 안 되는 이유를 문서화함."
```

---

### Task 7: README

> 🟡 잠정: M2~M4 구현 결과에 따라 패키지별 공개 API 목록이 바뀔 수 있음

**Files:**
- Modify: `README.md`
- Create: `packages/calendar/README.md`, `packages/core/README.md`, `packages/react/README.md`, `packages/theme/README.md`
- Modify: `packages/{calendar,core,react,theme}/package.json` (`files`에 `README.md`)

**Interfaces:**
- Consumes: 문서 사이트 경로
- Produces: npm 페이지에 보일 README

- [ ] **Step 1: 루트 README 작성**

`README.md` 전체:
````markdown
# lunisolar-picker

Modern, accessible date pickers for React, with optional Korean lunisolar (음력) calendar support.

- Five pickers: date, date range, month, wheel and time.
- Mouse, keyboard and touch. Bottom sheets on phones.
- Values are canonical strings (`'2026-10-14'`, `'14:30'`) that compare with `===` and parse with Temporal.
- Headless core with React parts, so you can rebuild any picker.
- Korean lunar dates with leap months and 30th days, from KASI data (1900–2050). Off unless you import it.

```sh
pnpm add @lunisolar-picker/react @lunisolar-picker/core @lunisolar-picker/calendar @lunisolar-picker/theme
```

```tsx
import { DatePicker } from '@lunisolar-picker/react/pickers';
import '@lunisolar-picker/theme/mono.css';

<DatePicker value={value} onValueChange={(next) => setValue(next)} />;
```

| Package | Contents |
|---|---|
| [`@lunisolar-picker/calendar`](packages/calendar) | Date values, Gregorian and Korean lunar calendars. No dependencies. |
| [`@lunisolar-picker/core`](packages/core) | Framework-agnostic picker state, constraints, grids and locales. |
| [`@lunisolar-picker/react`](packages/react) | React hooks, parts and finished pickers. |
| [`@lunisolar-picker/theme`](packages/theme) | The Mono theme and the shadcn token bridge. |

Documentation: see `apps/docs` (`pnpm --filter @lunisolar-picker/docs dev`).

## Development

```sh
just install   # pnpm install --frozen-lockfile
just check     # types, lint, dependency boundaries
just test      # unit, property and browser tests
just build     # build all packages
just fixtures  # build Next, Vite and Astro fixtures and check their output
just docs-build
```

한국어 안내: 이 저장소는 양력 picker를 기본으로 하고, 필요할 때 한국 음력(윤달·30일 포함) 입력을 켤 수 있는 React 날짜 picker 라이브러리다. 설계는 `docs/superpowers/specs/`에 있다.
````

- [ ] **Step 2: 패키지 README 작성**

`packages/calendar/README.md`:
````markdown
# @lunisolar-picker/calendar

Plain-date values and calendar systems for [lunisolar-picker](../../README.md). No runtime dependencies; works on servers and in browsers.

```ts
import { epochDayOf, formatDate, isSameDay, parseDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';

parseDate('2026-10-14');                                // solar date
parseDate('1990-06-23[u-ca=dangi]', { calendars: [dangi] }); // lunar entry → { year: 1990, monthCode: 'M05L', day: 1 }
formatDate(epochDayOf('2026-10-14' as never), dangi);  // '2026-10-14[u-ca=dangi]'
isSameDay('2026-10-14', '2026-10-14[u-ca=dangi]');     // true
```

- `gregory`: proleptic Gregorian, years 1–9999.
- `dangi` (separate entry, about 1 KB gzipped): Korean lunisolar calendar from KASI data, lunar 1900 to 2050.
- Values: `DateString`, `TimeString`, `MonthString`, `DateRangeValue` with strict parse and format functions.
````

`packages/core/README.md`:
````markdown
# @lunisolar-picker/core

Framework-agnostic state for [lunisolar-picker](../../README.md): pure reducers and small stores for navigation, single and range selection, segmented fields, wheels and time, plus constraints, month grids, gesture math and locales.

```ts
import { validateRange } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';

validateRange({ start: '2026-10-01', end: '2026-12-31' }, { maxDays: 60 });
// { isValid: false, reasons: ['range-too-long'] }
```

Locales: `@lunisolar-picker/core/locales/en`, `/ko`, `/ja`. Add your own with `defineLocale`.

Most apps use this package through `@lunisolar-picker/react`.
````

`packages/react/README.md`:
````markdown
# @lunisolar-picker/react

React 19 hooks, unstyled parts and finished pickers for [lunisolar-picker](../../README.md).

```tsx
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker, DateRangePicker, MonthPicker, TimePicker, WheelDatePicker } from '@lunisolar-picker/react/pickers';
```

- Finished pickers: `DatePicker`, `DateRangePicker`, `MonthPicker`, `WheelDatePicker`, `TimePicker`.
- Parts: `Calendar`, `RangeCalendar`, `DateField`, `DateRangeField`, `Wheel`, `TimeField`, `Popover`, `Sheet`.
- Hooks: `useCalendar`, `useRangeCalendar`, `useDateField`, `useDateRangeField`, `useWheel`, `useTimeField`.

Every entry is marked `"use client"`. Parts render `data-lsp-part` and state attributes; load `@lunisolar-picker/theme` or style them yourself.
````

`packages/theme/README.md`:
````markdown
# @lunisolar-picker/theme

The Mono theme for [lunisolar-picker](../../README.md): monochrome, hairline borders, 8 px radius, light and dark.

```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
@import '@lunisolar-picker/theme/bridge/shadcn.css'; /* optional: follow shadcn/ui tokens */
```

- Everything lives in `@layer lunisolar-picker`, so your utilities override it.
- Dark mode: `.dark` or `[data-theme="dark"]` on an ancestor. Follow the OS with `[data-theme="system"]`.
- Tokens: `--lsp-bg`, `--lsp-surface`, `--lsp-fg`, `--lsp-muted`, `--lsp-subtle`, `--lsp-border`, `--lsp-accent`, `--lsp-accent-fg`, `--lsp-range-bg`, `--lsp-ring`, `--lsp-danger`, `--lsp-radius`, `--lsp-cell-size`, `--lsp-shadow-popover`, `--lsp-duration`.
````

각 패키지 `package.json`의 `files`에 `"README.md"`를 추가한다(theme은 기존 CSS 항목 유지). 예: `"files": ["dist", "README.md"]`.

- [ ] **Step 3: 확인**

Run: `just package-check`
Expected: publint·attw 통과

- [ ] **Step 4: 커밋**

```bash
git add README.md packages/*/README.md packages/*/package.json
ALLOW_COMMIT=1 git commit -m "docs: npm 페이지에서 패키지 역할과 첫 사용법을 바로 알 수 있도록 README 작성" -m "네 패키지가 각자 무엇을 담는지와 함께 설치해야 하는 이유를 루트와 패키지 README에 적고, 배포 tarball에 README가 포함되게 함."
```

---

### Task 8: 실기기 QA 체크리스트

**Files:**
- Create: `docs/qa/real-device-checklist.md`

**Interfaces:**
- Consumes: 스펙 10·11·15장
- Produces: 릴리스 전 수동 확인 문서(Task 11 게이트 D에서 사용)

- [ ] **Step 1: 체크리스트 작성**

`docs/qa/real-device-checklist.md`:
````markdown
# 실기기 QA 체크리스트

릴리스 전에 아래 기기에서 문서 사이트(`pnpm --filter @lunisolar-picker/docs dev --host`)를 같은 와이파이로 열어 확인한다. Playwright WebKit은 iOS WKWebView와 같지 않으므로 이 확인을 대신하지 못한다(스펙 11장).

## 기기와 브라우저

| ID | 환경 | 확인 방법 |
|---|---|---|
| iOS-S | iPhone, Safari 최신 | 주소 직접 입력 |
| iOS-K | iPhone, 카카오톡 인앱 브라우저 | 나와의 채팅에 링크를 보내 열기 |
| AND-C | Android, Chrome 최신 | 주소 직접 입력 |
| AND-S | Android(갤럭시), 삼성 인터넷 | 주소 직접 입력 |
| AND-K | Android(갤럭시), 카카오톡 인앱 브라우저 | 나와의 채팅에 링크를 보내 열기 |

각 환경에서 먼저 기록한다: OS 버전, 브라우저 버전, `navigator.userAgent`, `Intl.supportedValuesOf('calendar').includes('dangi')`. (스펙 15장 위험 6)

## 항목

각 항목을 환경별로 ✅/❌로 기록하고 ❌면 증상과 화면 녹화를 남긴다.

### 1. 세그먼트 입력과 키보드 (스펙 15장 위험 3)

- [ ] 연도 칸을 누르면 숫자 키패드가 뜬다.
- [ ] `19900315`를 이어 치면 `1990. 03. 15`가 되고 커서가 칸을 자동으로 넘어간다.
- [ ] 삼성 키보드(한글 입력 상태)에서도 숫자가 조합 중 상태로 남지 않고 바로 들어간다. (AND-S, AND-K)
- [ ] 지우기(백스페이스)로 칸이 비고, 이전 칸으로 돌아간다.
- [ ] `1990-03-15`를 붙여넣으면 세 칸이 모두 채워진다.
- [ ] 음력 모드에서 윤달 토글이 보이고 눌러진다.
- [ ] 시간 칸에 `930`을 치면 `09:30`이 된다.

### 2. 휠 관성 (스펙 15장 위험 4)

- [ ] 연도 열을 세게 튕기면 관성으로 여러 해를 지나 부드럽게 멈춘다.
- [ ] 멈춘 뒤 가운데 줄에 정확히 맞춰진다(반 칸 걸림 없음).
- [ ] 휠을 굴리는 동안 페이지나 시트가 같이 스크롤되지 않는다.
- [ ] 음력 모드에서 연도를 바꿔 윤달이 사라지면 월이 평달로 옮겨진다.
- [ ] 60fps에 가깝게 보인다(끊김을 느끼면 ❌). 중저가 Android 한 대 이상 포함.

### 3. 시트와 스크롤 잠금

- [ ] 좁은 화면에서 DatePicker를 열면 아래에서 시트가 올라온다.
- [ ] 시트가 열려 있는 동안 뒤 페이지가 스크롤되지 않는다.
- [ ] 시트를 닫으면 원래 스크롤 위치로 돌아온다(iOS에서 맨 위로 튀지 않음). (iOS-S, iOS-K)
- [ ] 카카오톡 인앱에서 시트 안 휠을 굴려도 인앱 브라우저의 당겨서 닫기·새로고침이 일어나지 않는다. (iOS-K, AND-K)
- [ ] 화면 키보드가 올라와도 시트의 확인 버튼이 가려지지 않는다.

### 4. 범위 선택 (터치)

- [ ] 시작일과 종료일을 차례로 탭하면 범위가 선택된다.
- [ ] 달력 위에서 손가락을 끌면 범위 선택이 아니라 페이지가 스크롤된다.
- [ ] 확인 후 반영 모드에서 취소하면 원래 범위로 돌아간다.

### 5. 다크모드

- [ ] OS 다크모드에서 `data-theme="system"` 데모가 어두워진다.
- [ ] 문서 사이트 테마 전환에 맞춰 picker가 바뀐다.
- [ ] 다크모드에서 시트·팝오버 배경과 글자 대비가 충분하다(흰 배경 섬광 없음).

### 6. 접근성

- [ ] VoiceOver(iOS)로 달력 날짜를 넘기면 전체 날짜가 읽히고, 음력을 켜면 음력도 읽힌다.
- [ ] TalkBack으로 휠 열을 조작하면 "윤4월" 같은 텍스트 값이 읽힌다.
- [ ] 시스템 "동작 줄이기"를 켜면 월 전환·팝오버 애니메이션이 없다.

## 기록

| 날짜 | 버전 | 담당 | 결과 요약 | 이슈 링크 |
|---|---|---|---|---|
````

- [ ] **Step 2: 커밋**

```bash
git add docs/qa/real-device-checklist.md
ALLOW_COMMIT=1 git commit -m "docs: 자동 테스트로 못 잡는 카카오 인앱·삼성 키보드 동작을 릴리스 전에 확인하는 체크리스트 추가" -m "Playwright WebKit은 iOS WKWebView와 달라 세그먼트 입력 IME, 휠 관성, 시트 스크롤 잠금, 다크모드는 실기기로만 확인할 수 있어 기기·항목·기록 양식을 정함."
```

---

### Task 9: changesets 설정과 첫 changeset

**Files:**
- Modify: 루트 `package.json`(devDependencies, scripts)
- Create: `.changeset/config.json`, `.changeset/README.md`, `.changeset/initial-release.md`

**Interfaces:**
- Consumes: 네 공개 패키지 이름(버전 `0.0.0`)
- Produces: `pnpm changeset`, `pnpm changeset status`, `pnpm changeset version`이 동작하는 설정. 첫 버전 `0.1.0`

- [ ] **Step 1: 의존성과 스크립트 추가**

루트 `package.json`:
```json
"scripts": {
  "changeset": "changeset"
},
```
`devDependencies`에 추가: `"@changesets/cli": "3.0.3"`

Run: `pnpm install`

- [ ] **Step 2: 설정 작성**

`.changeset/config.json`:
```json
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["@lunisolar-picker/calendar", "@lunisolar-picker/core", "@lunisolar-picker/react", "@lunisolar-picker/theme"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "privatePackages": { "version": false, "tag": false },
  "ignore": []
}
```

`.changeset/README.md`:
```markdown
# Changesets

변경이 배포 대상 패키지에 영향을 주면 `pnpm changeset`으로 변경 기록을 추가한다. 네 패키지는 `fixed` 그룹이라 항상 같은 버전으로 함께 올라간다. fixtures와 docs는 private이라 버전이 매겨지지 않는다.
```

`.changeset/initial-release.md`:
```markdown
---
"@lunisolar-picker/calendar": minor
"@lunisolar-picker/core": minor
"@lunisolar-picker/react": minor
"@lunisolar-picker/theme": minor
---

First public release. Date, date range, month, wheel and time pickers for React 19 with a headless core, the Mono theme, and optional Korean lunisolar (dangi) dates from KASI data.
```

- [ ] **Step 3: 동작 확인**

Run: `pnpm changeset status --verbose`
Expected: 네 패키지가 `minor`로 `0.1.0`이 될 예정이라고 나온다. fixtures·docs는 목록에 없다. `changelog` 경로 오류가 나면 `@changesets/cli` 3.0.3의 기본값으로 `"changelog"` 항목을 지우고 다시 확인한다.

실제 버전 올리기(`changeset version`)는 release 워크플로의 version 잡이 하므로 여기서 실행하지 않는다.

- [ ] **Step 4: 품질 게이트와 커밋**

Run: `just fix && just check`

```bash
git add package.json pnpm-lock.yaml .changeset
ALLOW_COMMIT=1 git commit -m "chore: 네 패키지를 같은 버전으로 함께 배포하도록 changesets 구성" -m "- 패키지끼리 workspace로 서로 의존하므로 버전이 어긋나지 않게 fixed 그룹으로 묶고 fixtures·docs는 버전 대상에서 뺌.
- 첫 공개 버전 0.1.0으로 올라가도록 첫 변경 기록을 추가함."
```

---

### Task 10: CI 워크플로와 배포 tarball 검사

**Files:**
- Create: `scripts/check-packed-packages.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `justfile`

**Interfaces:**
- Consumes: `just install/check/test/package-check/size/fixtures/docs-build`
- Produces: `just pack-check`, PR·main push마다 도는 CI

- [ ] **Step 1: tarball 검사 스크립트 작성**

`scripts/check-packed-packages.ts`:
```ts
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const runFile = promisify(execFile);

interface PackedManifest {
  readonly name: string;
  readonly license?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

const PUBLISHED_PACKAGE_DIRECTORIES = ['packages/calendar', 'packages/core', 'packages/react', 'packages/theme'] as const;
const ALLOWED_FILE_PATTERN = /^package\/(dist\/.+|[^/]+\.css|bridge\/[^/]+\.css|README\.md|LICENSE|CHANGELOG\.md|package\.json)$/;
const REQUIRED_FILES = ['package/package.json', 'package/README.md'] as const;
const WORKSPACE_PROTOCOL = 'workspace:';

async function listFilesRecursively(directory: string, prefix = 'package'): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? listFilesRecursively(path.join(directory, entry.name), `${prefix}/${entry.name}`)
        : Promise.resolve([`${prefix}/${entry.name}`]),
    ),
  );
  return nested.flat();
}

// Goal: 배포 tarball에 workspace: 참조, 소스·테스트·KASI 원본이 섞이지 않았는지 publish 전에 확인함 (Review Focus 5)
async function inspectPackage(packageDirectory: string, workDirectory: string): Promise<string[]> {
  const { stdout } = await runFile('pnpm', ['pack', '--pack-destination', workDirectory], { cwd: packageDirectory });
  const tarballPath = stdout.trim().split('\n').at(-1) ?? '';
  const extractDirectory = await mkdtemp(path.join(workDirectory, 'extract-'));
  await runFile('tar', ['-xzf', tarballPath, '-C', extractDirectory]);
  const files = await listFilesRecursively(path.join(extractDirectory, 'package'));
  const manifest = JSON.parse(await readFile(path.join(extractDirectory, 'package/package.json'), 'utf8')) as PackedManifest;
  const dependencyVersions = { ...manifest.dependencies, ...manifest.peerDependencies };
  return [
    ...files.filter((file) => !ALLOWED_FILE_PATTERN.test(file)).map((file) => `${manifest.name}: unexpected file ${file}`),
    ...REQUIRED_FILES.filter((file) => !files.includes(file)).map((file) => `${manifest.name}: missing ${file}`),
    ...(manifest.license && !files.includes('package/LICENSE') ? [`${manifest.name}: license declared but LICENSE missing`] : []),
    ...Object.entries(dependencyVersions)
      .filter(([, version]) => version.startsWith(WORKSPACE_PROTOCOL))
      .map(([dependency, version]) => `${manifest.name}: ${dependency} still uses ${version}`),
  ];
}

async function checkPackedPackages(): Promise<void> {
  const workDirectory = await mkdtemp(path.join(tmpdir(), 'lunisolar-pack-'));
  try {
    const problems: string[] = [];
    for (const packageDirectory of PUBLISHED_PACKAGE_DIRECTORIES) {
      problems.push(...(await inspectPackage(path.resolve(packageDirectory), workDirectory)));
    }
    if (problems.length > 0) throw new Error(`packed packages have problems:\n${problems.join('\n')}`);
    console.info(`${PUBLISHED_PACKAGE_DIRECTORIES.length} packed packages look publishable`);
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

try {
  await checkPackedPackages();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
```

`justfile`에 추가:
```make
pack-check: build
    pnpm exec tsx scripts/check-packed-packages.ts
```

- [ ] **Step 2: 검사 실행**

Run: `just pack-check`
Expected: `4 packed packages look publishable`. theme의 CSS 경로가 `ALLOWED_FILE_PATTERN`과 다르면(예: `dist/mono.css`가 아니라 다른 폴더) M3 theme의 실제 `files` 구성을 보고 패턴을 그 경로로 좁혀 고친다. 패턴을 `.*`처럼 넓히지 않는다.

- [ ] **Step 3: CI 워크플로 작성**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions: {}

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    env:
      NEXT_TELEMETRY_DISABLED: '1'
    steps:
      - name: Check out repo
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Set up pnpm
        uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - name: Set up Node.js
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24.14.0
          cache: pnpm
      - name: Set up just
        uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3 # v4
        with:
          just-version: 1.48.1
      - name: Install dependencies
        run: just install
      - name: Install browsers for browser tests
        run: pnpm exec playwright install --with-deps chromium firefox webkit
      - name: Types, lint, dependency boundaries
        run: just check
      - name: Tests
        run: just test
      - name: Package format
        run: just package-check
      - name: Bundle size budget
        run: just size
      - name: Packed tarballs
        run: just pack-check
      - name: Consumer fixtures
        run: just fixtures
      - name: Documentation build
        run: just docs-build
```

`pnpm/action-setup`은 루트 `package.json`의 `packageManager`(`pnpm@11.28.2`)를 읽는다.

- [ ] **Step 4: 워크플로 문법 확인**

Run: `pnpm dlx @action-validator/cli@0.6.0 .github/workflows/ci.yml`
Expected: 오류 없음. (`@action-validator/cli` 0.6.0은 2026-10-14 기준 최신이며, 이 검사에만 쓰고 의존성에 넣지 않는다)

- [ ] **Step 5: 로컬에서 CI와 같은 순서로 실행**

Run: `NEXT_TELEMETRY_DISABLED=1 just install && just check && just test && just package-check && just size && just pack-check && just fixtures && just docs-build`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add scripts/check-packed-packages.ts .github/workflows/ci.yml justfile
ALLOW_COMMIT=1 git commit -m "ci: PR마다 타입·테스트·크기·소비 환경·문서 빌드를 검증하는 CI 도입" -m "- 로컬 just 게이트와 같은 순서를 CI에서 돌리고, 액션은 커밋 SHA로 고정해 태그가 바뀌어도 같은 코드가 실행되게 함.
- 배포 tarball을 풀어 workspace: 참조와 소스·테스트·KASI 원본이 섞이지 않았는지 publish 전에 검사함."
```

---

### Task 11: release 워크플로와 0.1.0 배포 (사용자 게이트 포함)

**Files:**
- Create: `.github/workflows/release.yml`, `docs/releasing.md`
- 게이트 결과에 따라: `LICENSE`, `packages/*/LICENSE`, `packages/*/package.json`(`license`, `repository`, `homepage`, `files`)

**Interfaces:**
- Consumes: Task 9 changesets 설정, Task 10 CI, Task 8 QA 체크리스트
- Produces: main에 changeset이 있으면 Version Packages PR, 없으면 승인 후 publish

- [ ] **Step 1: release 워크플로 작성**

changesets v3 공식 권장(trusted publishing은 select-mode·version·pack·publish 하위 액션으로 나눠 `id-token: write`를 publish 잡에만 둠)을 pnpm에 맞춘 구성이다.

`.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    branches: [main]

permissions: {}

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}

jobs:
  select-mode:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    outputs:
      mode: ${{ steps.select-mode.outputs.mode }}
      publish-plan-artifact-id: ${{ steps.select-mode.outputs.publish-plan-artifact-id }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24.14.0
          package-manager-cache: false
      - run: pnpm install --frozen-lockfile
      - id: select-mode
        uses: changesets/action/select-mode@ae32849d5ba541f9ae29e40e22a623bc13562f51 # v2.1.2

  version:
    if: needs.select-mode.outputs.mode == 'version'
    needs: select-mode
    runs-on: ubuntu-24.04
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24.14.0
          package-manager-cache: false
      - run: pnpm install --frozen-lockfile
      - uses: changesets/action/version@ae32849d5ba541f9ae29e40e22a623bc13562f51 # v2.1.2
        with:
          script: pnpm changeset version
          commit-message: 'chore: 패키지 버전과 변경 기록 갱신'
          pr-title: 'chore: release'

  pack:
    if: needs.select-mode.outputs.mode == 'publish'
    needs: select-mode
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    outputs:
      pack-dir-artifact-id: ${{ steps.pack.outputs.pack-dir-artifact-id }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24.14.0
          package-manager-cache: false
      - uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3 # v4
        with:
          just-version: 1.48.1
      - run: pnpm install --frozen-lockfile
      - run: just pack-check
      - id: pack
        uses: changesets/action/pack@ae32849d5ba541f9ae29e40e22a623bc13562f51 # v2.1.2
        with:
          publish-plan-artifact-id: ${{ needs.select-mode.outputs.publish-plan-artifact-id }}

  publish:
    needs: pack
    runs-on: ubuntu-24.04
    environment: npm-publish
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24.14.0
          package-manager-cache: false
      - name: Use an npm CLI that supports trusted publishing
        run: npm install -g npm@12.2.0
      - run: pnpm install --frozen-lockfile
      - uses: changesets/action/publish@ae32849d5ba541f9ae29e40e22a623bc13562f51 # v2.1.2
        with:
          pack-dir-artifact-id: ${{ needs.pack.outputs.pack-dir-artifact-id }}
          create-github-releases: true
```

- `publish` 잡의 `environment: npm-publish`에 필수 검토자를 걸어 두면 사람이 승인해야 배포된다(게이트 D).
- trusted publishing은 npm CLI 11.5.1 이상이 필요해 publish 잡에서 npm 12.2.0을 설치한다.

- [ ] **Step 2: 워크플로 문법 확인**

Run: `pnpm dlx @action-validator/cli@0.6.0 .github/workflows/release.yml`
Expected: 오류 없음

- [ ] **Step 3: 배포 절차 문서 작성**

`docs/releasing.md`:
````markdown
# 배포 절차

## 평소 흐름

1. 배포 대상 패키지를 바꾸는 PR에 `pnpm changeset`으로 변경 기록을 넣는다.
2. PR이 main에 머지되면 Release 워크플로가 "chore: release" PR을 만들거나 갱신한다(버전·CHANGELOG 반영).
3. 릴리스 전 `docs/qa/real-device-checklist.md`를 실기기로 채운다.
4. "chore: release" PR을 머지하면 Release 워크플로의 publish 잡이 `npm-publish` 환경 승인을 기다린다.
5. 승인하면 네 패키지가 trusted publishing(OIDC)으로 provenance와 함께 배포되고 GitHub Release가 생긴다.
6. 확인: `npm view @lunisolar-picker/react version`, npm 패키지 페이지의 Provenance 표시.

## 처음 한 번 필요한 설정

| 게이트 | 결정·행동 | 담당 |
|---|---|---|
| A. 라이선스 | 라이선스 종류 결정 | 사용자 |
| B. GitHub 저장소 | 원격 저장소 생성, 공개 여부 결정, `Allow GitHub Actions to create and approve pull requests` 켜기, `npm-publish` 환경과 필수 검토자 만들기 | 사용자 |
| C. npm | `lunisolar-picker` org 생성, 네 패키지에 trusted publisher 등록(저장소, 워크플로 `release.yml`, 환경 `npm-publish`) | 사용자 |
| D. 첫 배포 | 실기기 QA 통과 확인 후 publish 승인 | 사용자 |

provenance는 공개 저장소에서만 붙는다. 비공개 저장소로 시작하면 provenance 없이 배포되거나 trusted publishing 설정이 거부될 수 있다.
````

- [ ] **Step 4: 커밋 (게이트 전 단계까지)**

```bash
git add .github/workflows/release.yml docs/releasing.md
ALLOW_COMMIT=1 git commit -m "ci: changeset 기반으로 버전 PR과 승인 후 배포를 자동화하는 release 워크플로 도입" -m "- npm 토큰 없이 OIDC trusted publishing으로 배포하고, id-token 권한을 publish 잡에만 두려고 changesets 하위 액션으로 단계를 나눔.
- 실기기 QA와 사람 승인 없이 배포되지 않도록 npm-publish 환경 승인을 마지막 관문으로 둠."
```

- [ ] **Step 5: 🛑 게이트 A — 라이선스 결정 요청 (여기서 멈춤)**

사용자에게 묻는다. 에이전트가 정하지 않는다.

> 라이선스를 정해 주세요. 스펙에는 없습니다. 추천은 **MIT**입니다.
> - 이전 대상이자 비교 대상인 react-day-picker, Radix, Floating UI(우리 의존성)가 모두 MIT라 사용처가 법무 검토 없이 쓸 수 있습니다.
> - 음력 표의 원천인 KASI 공공데이터는 data.go.kr에서 이용허락범위 제한 없음으로 제공되어 MIT 배포와 충돌하지 않습니다.
> - 회사 서비스(web-console, back-office, saju-pictures)에 넣는 데 제약이 없습니다.
> 다른 선택지: Apache-2.0(특허 조항 포함, 고지 파일 의무가 조금 더 큼).

답을 받은 뒤:
- 루트 `LICENSE`에 선택한 라이선스 전문을 쓰고 저작권자는 사용자가 지정한 이름(없으면 `git config user.name`)과 `2026`으로 채운다.
- 같은 파일을 `packages/{calendar,core,react,theme}/LICENSE`로 복사한다.
- 네 `package.json`에 `"license": "<SPDX 식별자>"`, `files`에 `"LICENSE"`를 추가한다.
- Run: `just pack-check` → Expected: 통과(라이선스 선언과 LICENSE 파일이 함께 들어감)
- 커밋: `ALLOW_COMMIT=1 git commit -m "chore: 사용처가 법무 검토 없이 쓸 수 있도록 <라이선스> 라이선스 명시"`

- [ ] **Step 6: 🛑 게이트 B — GitHub 원격 저장소 (여기서 멈춤)**

사용자에게 요청한다: 저장소 이름·소유자(개인/조직), 공개 여부, 원격 생성(`gh repo create` 실행 여부를 포함해 사용자가 결정), Actions 설정의 PR 생성 허용, `npm-publish` 환경과 필수 검토자 생성. push는 사용자 지시가 있을 때만 한다.

답을 받은 뒤 네 `package.json`에 추가:
```json
"repository": { "type": "git", "url": "git+https://github.com/<owner>/<repo>.git", "directory": "packages/<name>" },
"homepage": "https://github.com/<owner>/<repo>#readme",
"bugs": { "url": "https://github.com/<owner>/<repo>/issues" }
```
- Run: `just package-check && just pack-check`
- 커밋: `ALLOW_COMMIT=1 git commit -m "chore: npm 페이지에서 저장소와 이슈로 이어지도록 저장소 정보 추가"`

- [ ] **Step 7: 🛑 게이트 C — npm org와 trusted publisher (여기서 멈춤)**

사용자에게 요청한다:
1. npmjs.com에서 `lunisolar-picker` org 생성(이름이 이미 선점되었으면 대체 scope를 정해야 하며, 그 경우 네 패키지 이름·문서·fixtures의 import 경로를 모두 바꾸는 별도 작업이 필요하다고 알린다).
2. 네 패키지 각각에 trusted publisher 등록: GitHub Actions, 저장소 `<owner>/<repo>`, 워크플로 `release.yml`, 환경 `npm-publish`.
3. npm이 아직 존재하지 않는 패키지에 trusted publisher 등록을 허용하지 않으면, 첫 배포만 사용자가 로컬에서 2FA로 직접 한다: `just build && pnpm -r --filter "./packages/**" publish --access public` (사용자가 실행). 그 뒤 trusted publisher를 등록하고 다음 배포부터 워크플로를 쓴다.

에이전트는 npm 계정 작업을 하지 않는다.

- [ ] **Step 8: 🛑 게이트 D — 첫 배포 승인 (여기서 멈춤)**

준비 확인(에이전트가 실행하고 결과를 보고):
- Run: `NEXT_TELEMETRY_DISABLED=1 just check && just test && just package-check && just size && just pack-check && just fixtures && just docs-build`
- Run: `pnpm changeset status --verbose` → 네 패키지 `0.1.0` 예정
- `docs/qa/real-device-checklist.md` 기록 표에 이번 버전 행이 있고 ❌가 없는지 확인

사용자에게 보고하고, 사용자가 main에 push → "chore: release" PR 머지 → `npm-publish` 승인을 직접 진행한다.

- [ ] **Step 9: 배포 후 확인 (사용자가 배포를 마친 뒤)**

Run: `npm view @lunisolar-picker/calendar@0.1.0 version && npm view @lunisolar-picker/core@0.1.0 version && npm view @lunisolar-picker/react@0.1.0 version && npm view @lunisolar-picker/theme@0.1.0 version`
Expected: 네 줄 모두 `0.1.0`

Run: `npm view @lunisolar-picker/react@0.1.0 dist.attestations --json`
Expected: provenance 정보가 있음(공개 저장소일 때)

Run: `cd "$(mktemp -d)" && npm init -y >/dev/null && npm install @lunisolar-picker/react@0.1.0 @lunisolar-picker/core@0.1.0 @lunisolar-picker/calendar@0.1.0 @lunisolar-picker/theme@0.1.0 react@19.3.0 react-dom@19.3.0 && node --input-type=module -e "import('@lunisolar-picker/calendar').then((m) => console.log(m.parseDate('2026-10-14').isOk))"`
Expected: `true`. 끝나면 임시 폴더를 지운다.

---

## 완료 기준

- `just fixtures`, `just docs-build`, `just pack-check`가 로컬과 CI에서 통과
- 문서 사이트에 시작하기·테마·완성형 5·부품 5·가이드 6 페이지와 데모가 있음
- changesets로 네 패키지가 `0.1.0`으로 함께 올라갈 준비가 됨
- 게이트 A~D에서 사용자 결정을 받았고, 사용자가 배포를 마치면 Step 9로 확인
