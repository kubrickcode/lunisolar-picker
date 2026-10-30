# 모달 dialog 안 시트·팝오버 포털 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 열린 모달 `<dialog>` 안의 트리거로 연 시트·팝오버를 그 dialog 안에 그려, 브라우저 최상위 층 위에서 보이고 조작되게 하고, 시트 안 Esc는 picker만 닫게 한다.

**Architecture:** 포털 위치 결정을 내부 모듈 `src/utilities/portal-container.ts` 하나로 모은다. `Sheet.Content`·`Popover.Content`는 열려 있는 동안 제자리에 보이지 않는 `<template>` 앵커를 그리고, 앵커가 붙으면 `resolvePortalContainer(anchor)`로 가장 가까운 모달 dialog(없으면 `document.body`)를 구해 그곳에 포털한다. 시트에는 트리거 부품이 없어 앵커 방식이 두 부품을 같은 방법으로 다룰 수 있는 유일한 길이다. `makeSiblingsInert`는 body 직계 형제만이 아니라 컨테이너에서 body까지 올라가며 각 단계의 형제를 막도록 넓힌다. 나중에 Radix 같은 비네이티브 모달을 지원할 때는 이 resolver 앞에 공개 prop만 얹는다.

**Tech Stack:** React 19.3.0, vitest 5.0.4 브라우저 모드(Chromium·Firefox·WebKit) + `vitest-browser-react` 2.3.0, Astro(docs), changesets

**Spec:** 별도 스펙 문서 없음. 2026-10-30 브레인스토밍에서 채팅으로 승인한 설명이 기준이다(아래 Global Constraints에 옮김).

## Global Constraints

- **작업 위치**: 새 git worktree에 브랜치 `fix/dialog-portal`을 `origin/main`에서 만든다(`git worktree add -b fix/dialog-portal ../lunisolar-picker-worktrees/dialog-portal origin/main` 뒤 `--no-track` 상태 유지). 이 플랜 파일은 main 작업 폴더에서 커밋하지 않은 상태라 worktree로 복사해 Task 1 전에 `docs:` 커밋 하나로 넣는다. push와 PR은 사용자가 따로 허락할 때만 한다. 사용자 확정 (2026-10-30 플랜 브리핑).
- M1·M4 계획의 Global Constraints를 그대로 따른다. 정확한 버전, ESM, 이름 규칙, `// Goal:`·`// Constraint:` WHY 주석, `ALLOW_COMMIT=1 git commit`, Conventional Commits 형식에 한국어 제목과 본문을 쓴다.
- **공개 API를 늘리지 않는다.** `resolvePortalContainer`·`usePortalContainer`는 `src/index.ts`나 어떤 공개 진입점에서도 export하지 않는다. `SheetApi`·`PopoverApi`·부품 props 타입도 바꾸지 않는다. changesets가 `fixed` 그룹이라 공개 API가 늘면 minor로 네 패키지가 함께 오르기 때문이다.
- 지원 대상은 네이티브 `dialog`를 `showModal()`로 연 경우뿐이다. Radix 등 `aria-modal` 컨테이너, `show()`로 연 비모달 dialog는 지금처럼 `document.body`에 그린다.
- 지원 브라우저 하한은 Safari·iOS 15.5+, Chrome 99+, Firefox 112+이다. `:modal`은 Chrome 105·Safari 15.6부터라, `CSS.supports('selector(:modal)')`가 거짓이면 `dialog[open]`으로 대신 찾는다.
- body scroll lock(`lockBodyScroll`)은 바꾸지 않는다.
- 같은 커밋에서 dialog와 함께 이미 열린 채로 마운트되는 picker(`defaultOpen`)는 앵커가 붙는 시점에 dialog가 아직 모달이 아니어서 body로 간다. 이번에는 다루지 않는다. 사용자 확정 (2026-10-30 플랜 브리핑).
- 사용자에게 보이는 새 문자열은 없다. 테스트 픽스처 라벨은 기존처럼 테스트 파일 상수로 둔다.
- 단일 테스트 파일 실행: `pnpm --filter @lunisolar-picker/react exec vitest run <path>`. 경로는 `packages/react` 기준이다.

## Review Focus

1. **닫힌 뒤 포커스 복귀**: dialog 안 시트를 확인·Esc로 닫으면 포커스가 dialog 안 트리거로 돌아와야 한다. inert 해제가 포커스 복원보다 먼저여야 한다. Task 3 parity 시나리오에서 `toHaveFocus`로 고정.
2. **inert 원상 복구**: dialog 안에서 시트를 닫은 뒤 dialog 안 form과 body 형제가 모두 inert·`aria-hidden`이 풀려야 한다. Task 1 테스트로 고정.
3. **picker가 닫힌 상태의 Esc**: picker 시트가 없을 때 Esc는 지금처럼 바깥 dialog를 닫아야 한다. 이 검증이 없으면 "Esc 뒤 dialog가 열려 있음"이라는 단정이 아무것도 증명하지 못한다. Task 3 시나리오 마지막 단계로 고정.
4. **dialog 안 팝오버의 바깥 클릭**: dialog 안 다른 요소를 누르면 팝오버가 닫혀야 한다. Task 2 popover 테스트로 고정.
5. **비모달 dialog**: `show()`로 연 dialog 안 트리거는 body에 그려야 한다. Task 2 resolver 테스트로 고정.

---

### Task 1: `makeSiblingsInert`가 중첩 컨테이너의 조상 경로를 비워 두고 각 단계 형제를 막음

**Files:**
- Modify: `packages/react/src/sheet/inert-siblings.ts:11-23`
- Test: `packages/react/src/sheet/inert-siblings.test.ts`

**Interfaces:**
- Produces: `makeSiblingsInert(container: HTMLElement): () => void`. 시그니처는 그대로다. container가 body 직계 자식이면 결과도 지금과 같다.

- [ ] **Step 1: 실패하는 테스트 작성**

`describe('makeSiblingsInert')` 안에 추가한다. 만든 요소는 `afterEach`에서 제거되게 한다.

```ts
it('inerts the siblings at every level up to body while leaving the container ancestors interactive', () => {
  const dialog = createElement();
  const form = document.createElement('form');
  const nestedSheet = document.createElement('div');
  dialog.append(form, nestedSheet);

  const release = makeSiblingsInert(nestedSheet);

  expect(form.inert).toBe(true);
  expect(form.getAttribute('aria-hidden')).toBe('true');
  expect(page.inert).toBe(true);
  expect(dialog.inert).toBe(false);
  expect(nestedSheet.inert).toBe(false);

  release();
  expect(form.inert).toBe(false);
  expect(form.hasAttribute('aria-hidden')).toBe(false);
  expect(page.inert).toBe(false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/sheet/inert-siblings.test.ts`
Expected: 새 테스트 FAIL(`form.inert`가 false, `dialog.inert`가 true)

- [ ] **Step 3: 구현**

`container`에서 시작해 `parentElement`를 따라 올라가며, 각 단계에서 부모의 자식 중 자기 자신이 아닌 `HTMLElement`를 `acquire`한다. 부모가 `document.body`인 단계까지 처리하고 멈춘다. ref-count `entries`, "이미 inert면 건너뜀", 한 번만 release되는 동작은 그대로 둔다. `// Goal:` 주석에 "중첩 컨테이너(모달 dialog 안 포털)는 조상 경로를 막지 않음"을 덧붙인다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/sheet/inert-siblings.test.ts src/sheet/sheet.test.tsx`
Expected: 모두 PASS(기존 겹친 시트·`aria-hidden` 복원 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add packages/react/src/sheet/inert-siblings.ts packages/react/src/sheet/inert-siblings.test.ts
ALLOW_COMMIT=1 git commit -m "fix: 중첩된 시트 컨테이너가 조상 경로까지 inert로 막지 않게 함"
```

---

### Task 2: 포털 위치 resolver와 Sheet·Popover Content 연결

**Files:**
- Create: `packages/react/src/utilities/portal-container.ts`
- Create: `packages/react/src/utilities/portal-container.test.ts`
- Modify: `packages/react/src/sheet/parts.tsx:36-44`
- Modify: `packages/react/src/popover/parts.tsx:40-49`
- Test: `packages/react/src/sheet/sheet.test.tsx`, `packages/react/src/popover/popover.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `makeSiblingsInert`(시그니처 그대로, `use-sheet.ts`는 바꾸지 않음)
- Produces (내부 전용, 공개 export 금지):
  - `resolvePortalContainer(anchor: Element): HTMLElement`: 가장 가까운 모달 dialog, 없으면 `anchor.ownerDocument.body`
  - `usePortalContainer(): PortalContainer`
  - `type PortalContainer = { readonly anchorRef: RefCallback<HTMLTemplateElement>; readonly container: HTMLElement | null }`

- [ ] **Step 1: resolver 실패 테스트 작성** (`portal-container.test.ts`)

```ts
describe('resolvePortalContainer', () => {
  it('returns the nearest dialog opened with showModal', () => {
    // given: body > dialog(showModal) > div > anchor
    expect(resolvePortalContainer(anchor)).toBe(dialog);
  });
  it('returns body for a dialog opened with show()', () => {
    expect(resolvePortalContainer(anchor)).toBe(document.body);
  });
  it('returns body when no dialog contains the anchor', () => {
    expect(resolvePortalContainer(anchor)).toBe(document.body);
  });
});
```

각 테스트가 끝나면 dialog를 `close()`하고 제거한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/utilities/portal-container.test.ts`
Expected: FAIL(모듈 없음)

- [ ] **Step 3: `portal-container.ts` 구현**

- `resolvePortalContainer`: `CSS.supports('selector(:modal)')`이면 `'dialog:modal'`을, 아니면 `'dialog[open]'`을 선택자로 써서 `anchor.closest()`로 찾는다. 판정은 SSR 안전을 위해 함수 안에서 한다. 하한 브라우저 사유는 `// Constraint:` 주석으로 남긴다.
- `usePortalContainer`: `useState<HTMLElement | null>`과 `useCallback`으로 한 번만 만든 ref 콜백을 쓴다. 노드가 붙으면 `resolvePortalContainer(node)`를, 떨어지면 `null`을 넣는다. 열릴 때마다 앵커가 새로 붙으므로 위치를 매번 다시 구한다.

- [ ] **Step 4: Sheet·Popover 실패 테스트 작성**

`sheet.test.tsx`:

```ts
it('renders the sheet inside the modal dialog that contains it and keeps it interactive', async () => {
  // given: <dialog> 안에 버튼으로 open을 켜는 Sheet.Root/Content(안에 버튼 하나). dialog.showModal() 뒤 열기 버튼 클릭
  const backdrop = document.querySelector('[data-lsp-part="sheet-backdrop"]');
  expect(backdrop?.parentElement).toBe(dialog);
  await expect.element(screen.getByRole('button', { name: INNER_BUTTON_LABEL })).toHaveFocus(); // 첫 포커스 = inert 아님
  expect(dialog.inert).toBe(false);
});
it('keeps rendering at the end of body outside any dialog', async () => {
  expect(document.querySelector('[data-lsp-part="sheet-backdrop"]')?.parentElement).toBe(document.body);
});
```

`popover.test.tsx`:

```ts
it('renders inside the modal dialog that contains the trigger', async () => {
  // given: dialog.showModal() 안에 Popover.Root/Trigger/Content와 바깥 버튼. 트리거 클릭
  expect(document.querySelector('[data-lsp-part="popover"]')?.parentElement).toBe(dialog);
});
it('closes when another element inside the dialog is pressed', async () => {
  await screen.getByRole('button', { name: DIALOG_OTHER_BUTTON_LABEL }).click();
  await expect.element(screen.getByRole('dialog', { name: POPOVER_LABEL })).not.toBeInTheDocument();
});
```

모든 테스트는 정리 단계에서 dialog를 `close()`한다.

- [ ] **Step 5: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/sheet/sheet.test.tsx src/popover/popover.test.tsx`
Expected: dialog 관련 새 테스트 FAIL(부모가 body). 나머지는 PASS

- [ ] **Step 6: Content 두 곳 연결**

- 두 `Content` 모두 `usePortalContainer()`를 쓴다.
- 열려 있고 클라이언트이면 `<template ref={anchorRef} />`를 제자리에 그리고, `container`가 있으면 그 옆에 `createPortal(…, container)`을 둔다(Fragment). 닫혔거나 서버이면 지금처럼 `null`을 돌려준다.
- `// Constraint:` 주석에 두 가지를 적는다.
  - 시트에는 트리거 부품이 없어, DOM 위치를 알려면 제자리 앵커가 필요하다.
  - `<template>`은 레이아웃에 영향이 없고 표·목록 안에서도 유효하다.

- [ ] **Step 7: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/utilities/portal-container.test.ts src/sheet src/popover src/pickers`
Expected: 모두 PASS(hydration·기존 picker 테스트 포함)

- [ ] **Step 8: 커밋**

```bash
git add packages/react/src/utilities/portal-container.ts packages/react/src/utilities/portal-container.test.ts packages/react/src/sheet/parts.tsx packages/react/src/popover/parts.tsx packages/react/src/sheet/sheet.test.tsx packages/react/src/popover/popover.test.tsx
ALLOW_COMMIT=1 git commit -m "fix: 열린 모달 dialog 안에서 연 시트와 팝오버를 그 dialog 안에 그림"
```

---

### Task 3: saju-pictures 방 참가 dialog parity, Esc 검증, 문서·changeset

**Files:**
- Modify: `packages/react/src/pickers/consumer-parity.test.tsx` (`describe('saju-pictures')` 안에 시나리오 추가, 파일 위쪽에 픽스처 추가)
- 조건부 Modify: `packages/react/src/sheet/use-sheet.ts:68-78`, `packages/react/src/popover/use-popover.ts:111-121`
- Modify: `apps/docs/src/content/docs/parts/popover-and-sheet.mdx:30`
- Create: `.changeset/dialog-portal.md`

**Interfaces:**
- Consumes: Task 2의 동작(공개 진입점만 import하는 parity 규칙은 그대로)

- [ ] **Step 1: 픽스처와 시나리오 작성**

픽스처 `JoinRoomDialog`:
- `// Goal:` 주석: "saju-pictures 방 참가 시트. `showModal()`로 띄운 네이티브 dialog 안에서 생년월일·생시 시트 휠을 씀(ModalSheet, transform 없음)"
- `useEffect`에서 `showModal()`을 호출하는 `<dialog aria-label={JOIN_ROOM_LABEL}>`를 그린다.
- 그 안의 form에 `WheelDatePicker`(`BirthDateForm`과 같은 props, `defaultValue="1990-06-22[u-ca=dangi]"`)와 `WheelTimePicker`(`presentation="sheet"`, `name={BIRTH_TIME_NAME}`, `aria-label={BIRTH_TIME_LABEL}`)를 두고, submit 버튼을 둔다.
- 제출 시 `onSubmitBirth(formData.get(BIRTH_DATE_NAME), formData.get(BIRTH_TIME_NAME))`를 부른다.
- 상수는 `JOIN_ROOM_LABEL = '방 참가'`를 쓴다.

시나리오: `it('join-room dialog: picks birth date and time on sheets drawn above the modal dialog, and Escape closes only the sheet', …)`

1. `renderInLunarApp`으로 그린다. `joinDialog`는 `screen.getByRole('dialog', { name: JOIN_ROOM_LABEL }).element()`로 잡는다.
2. 생년월일 시트를 연다(`openSheet`, 첫 포커스는 연 spinbutton).
   - `document.querySelector('[data-lsp-part="sheet"]')?.closest('dialog')`가 `joinDialog`인지 단정한다.
   - 월 칸에서 `{ArrowDown}`을 눌러 `윤5월`·일 `29`을 기다린 뒤, **포인터로** 확인 버튼을 `.click()`한다(증상이 포인터 가로막힘이므로 `pressWithKeyboard`를 쓰지 않는다).
   - 시트가 사라지고 생년월일 트리거가 포커스를 받는지 단정한다.
3. 생시 시트를 연다(첫 포커스는 시 spinbutton).
   - 시 칸에서 `{ArrowDown}`을 눌러 `aria-valuetext` `'13'`을 기다린 뒤, 확인을 `.click()`한다.
4. 생시 시트를 다시 열고 `userEvent.keyboard('{Escape}')`를 누른다.
   - 시트가 사라지고 `joinDialog.open === true`, 생시 트리거에 포커스가 있는지 단정한다.
5. 제출 버튼을 누른다. `onSubmitBirth.mock.calls`가 `[['1990-07-21[u-ca=dangi]', '13:00']]`인지 단정한다.
6. 대조군: picker가 닫힌 상태에서 `{Escape}`를 누르면 `joinDialog.open === false`가 되어야 한다. 이 브라우저에서 Esc가 dialog까지 닿는다는 증명이다.

- [ ] **Step 2: 세 브라우저에서 실행**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers/consumer-parity.test.tsx`
Expected: Chromium·Firefox·WebKit 모두 PASS.

회귀 확인을 한 번 한다.
- `git checkout HEAD~1 -- packages/react/src/sheet/parts.tsx packages/react/src/popover/parts.tsx`로 Task 2 연결만 잠시 되돌린다.
- 같은 명령을 다시 실행해 시나리오가 2단계(시트 첫 포커스 또는 `closest('dialog')`)에서 FAIL하는지 본다.
- `git checkout HEAD -- <같은 두 파일>`로 복원하고, 결과를 커밋 본문에 한 줄로 남긴다.

- [ ] **Step 3 (조건부): 4단계에서 dialog가 닫히는 브라우저가 있을 때만**

`use-sheet.ts`·`use-popover.ts`의 Esc effect 옆에, 열려 있는 동안만 `document`에 capture 단계 `cancel` 리스너를 단다. `cancel`은 버블되지 않으므로 capture 단계여야 한다. 이 리스너는 `event.target`이 표면 요소(backdrop/content)를 품은 `HTMLDialogElement`일 때 `preventDefault()`한다. 어느 브라우저 때문에 넣었는지 `// Constraint:` 주석으로 남긴다. 모두 통과했다면 이 단계는 건너뛰고, 건너뛴 사실을 커밋 본문에 적는다.

- [ ] **Step 4: 문서 갱신** (`popover-and-sheet.mdx:30`)

첫 문장을 다음 뜻으로 바꾼다. "Content is rendered in a portal at the end of `body`, or at the end of the open modal `<dialog>` (opened with `showModal()`) that contains it so it stays above the dialog and usable, and unmounted when closed, …" 이어지는 테마 상속 문장은 유지한다. `.dark`/`data-theme`를 `html`/`body`에 두라는 안내가 dialog 안에서도 성립하기 때문이다.

- [ ] **Step 5: changeset 추가** (`.changeset/dialog-portal.md`)

```md
---
"@lunisolar-picker/react": patch
---

Sheets and popovers opened from inside a modal `<dialog>` (opened with `showModal()`) now render inside that dialog, so they appear above it and respond to pointer and keyboard input. Escape closes only the picker and leaves the dialog open.
```

- [ ] **Step 6: 전체 검증**

Run: `just check test docs-build size`
Expected: typecheck·lint·deps·전체 테스트·docs 빌드·번들 크기 모두 PASS. `src/index.ts`에 새 export가 없음을 `git diff origin/main -- packages/react/src/index.ts`가 비어 있는 것으로 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add packages/react/src/pickers/consumer-parity.test.tsx apps/docs/src/content/docs/parts/popover-and-sheet.mdx .changeset/dialog-portal.md
# Step 3을 했다면 use-sheet.ts, use-popover.ts도 추가
ALLOW_COMMIT=1 git commit -m "test: saju-pictures 방 참가 dialog 안 시트 휠 사용을 parity로 고정하고 patch 변경 기록 추가"
```
