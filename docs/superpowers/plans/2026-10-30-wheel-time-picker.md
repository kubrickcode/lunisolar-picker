# WheelTimePicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 날짜 휠과 같은 계약·시트·Mono 모양의 시·분 휠(`useWheelTime` 훅 + `WheelTimePicker` 완성형)을 추가해, saju-pictures가 태어난 시각을 생년월일 휠과 같은 조작감으로 받게 한다.

**Architecture:** `useWheelTime`은 `useWheelDate`처럼 React 상태 하나(보이는 시·분 + 선택 여부)를 core `buildTimeColumns` 위에 얇게 잇는 훅이다. 값은 `HH:mm`만 받고, 칸에 맞지 않는 분은 보일 때만 바로 앞 칸으로 내린다. `WheelTimePicker`는 `WheelDatePicker`의 inline/sheet 골격을 그대로 따른다. 다만 값 해석(형식 오류, `"24:00"`)은 picker 층에서 `TimePicker`와 같은 helper로 하고, 훅에는 해석된 값만 넘긴다.

**Tech Stack:** React 19.3.0, `@lunisolar-picker/core`·`calendar`(workspace), vitest 5.0.4 브라우저 모드 + `vitest-browser-react` 2.3.0, axe-core 4.14.0, Astro(docs), changesets

**Spec:** `docs/superpowers/specs/2026-10-30-wheel-time-picker-design.md`

## Global Constraints

- **작업 위치**: 새 git worktree에 브랜치 `feat/wheel-time-picker`를 `origin/main`에서 만든다(`git worktree add -b feat/wheel-time-picker ../lunisolar-picker-worktrees/wheel-time-picker origin/main`). 업스트림은 `--no-track`으로 둔다. 사용자 확정 (2026-10-30 플랜 브리핑).
- 이 플랜과 스펙(`docs/superpowers/{specs,plans}/2026-10-30-wheel-time-picker*`)은 main 작업 폴더에서 커밋하지 않은 상태다. 새 worktree로 복사해 Task 1 전에 `docs:` 커밋 하나로 넣는다. push와 PR은 사용자가 따로 허락할 때만 한다.
- 수동 확인(Task 3 Step 4의 기준 이미지 눈 확인)은 실행 에이전트가 PNG를 직접 열어 확인하고, 결과를 커밋 본문에 한 줄로 남긴다. 브리핑에서 추천안 확정.

- M1·M4 계획의 Global Constraints를 그대로 따른다. 정확한 버전, ESM, 이름 규칙, `// Goal:`·`// Constraint:` WHY 주석, `ALLOW_COMMIT=1 git commit`, Conventional Commits 형식에 한국어 제목과 본문을 쓴다.
- 공개 prop 이름: `value`/`defaultValue`/`onValueChange(value, { validity })`, `open`/`defaultOpen`/`onOpenChange`, `disabled`/`readOnly`/`required`/`invalid`, `name`/`form`. `onChange`는 쓰지 않는다.
- 공개 값은 `TimeString`(`HH:mm`, 24시간제) 또는 `null`만 쓴다.
- `minuteStep` 기본값은 **1**이다. 잘못된 step은 core `assertMinuteStep`가 `LunisolarPickerError`를 던진다.
- 빈 값일 때 휠이 보이는 시각은 **12:00**이다.
- 휠은 순환하지 않는다. 24:00, 12시간제, 초, min/max는 넣지 않는다.
- 사용자에게 보이는 문자열은 로캘 라벨(`chooseTime`, `hour`, `minute`, `confirm`, `cancel`, `clear`)만 쓴다. 새 로캘 키는 없다.
- `src/pickers/**`는 `src/index.ts`, `src/contract/**`, `src/settings/**`, `src/utilities/**`, `src/pickers/**`만 import한다(dependency-cruiser).
- 스타일은 `data-lsp-part`와 상태 속성으로만 건다. Mono 규칙은 복사하지 않고 선택자를 넓힌다.
- 단일 테스트 파일 실행: `pnpm --filter @lunisolar-picker/react exec vitest run <path>`. 패키지 경로 기준이다.

## Review Focus

1. 마운트된 채 `minuteStep`이 1→5로 바뀌고 값이 칸 밖(`09:07`)이면, 보이는 분만 05로 내려가고 `onValueChange`는 불리지 않아야 한다. → Task 1 테스트
2. `minuteStep={60}`이면 분 열에 `00` 하나만 있고, 시 열을 굴리면 `HH:00`이 나와야 한다. → Task 1 테스트
3. 비제어로 `09:30`에서 시작해 굴린 뒤 form reset을 하면 다시 `09:30`이 보이고 숨은 입력도 `09:30`이어야 한다. → Task 2 테스트
4. 시트가 열린 동안 부모가 `value`를 바꿔도 초안은 덮이지 않아야 한다. 취소하면 부모 값이 그대로 남는다. → Task 2 테스트
5. 값이 있는 채로 `disabled`가 켜졌다 꺼지는 렌더가 반복돼도 값과 `onValueChange` 호출 수가 그대로여야 한다. → Task 3 consumer-parity

## 파일 구조

| 경로 | 책임 |
|---|---|
| `packages/react/src/wheel/use-wheel-time.ts` (신규) | 시·분 휠 상태, 열, 숨은 입력·Root props |
| `packages/react/src/wheel/use-wheel-time.test.tsx` (신규) | 훅 동작 |
| `packages/react/src/index.ts` | 훅·타입 export 추가 |
| `packages/react/src/pickers/time-value.ts` (신규) | `time-picker.tsx`의 `parseTimeValue`·`publicTimeOf`·`TIME_PARSE_KEY`를 옮겨 두 picker가 공유 |
| `packages/react/src/pickers/time-picker.tsx` | 위 helper를 import로 바꿈(동작 그대로) |
| `packages/react/src/pickers/wheel-time-picker.tsx` (신규) | 완성형 |
| `packages/react/src/pickers/wheel-time-picker.test.tsx` (신규) | 완성형 동작 |
| `packages/react/src/pickers/index.ts` | 완성형 export 추가 |
| `packages/react/src/contract/data-attributes.ts` | `'wheel-time-picker'` part 추가 |
| `packages/theme/src/mono.css` | `wheel-date-picker` 선택자를 두 part 공용으로 넓힘 |
| `packages/react/src/pickers/consumer-parity.test.tsx` | saju-pictures 시각 시나리오 |
| `packages/react/src/visual/pickers.visual.test.tsx` + `__screenshots__/` | 시각 회귀 기준 |
| `apps/docs/...` | 문서 페이지, 데모, 사이드바 |
| `docs/superpowers/specs/2026-10-14-lunisolar-picker-design.md` | §7.1 `/pickers` 목록 |
| `.changeset/wheel-time-picker.md` (신규) | minor |

---

### Task 1: `useWheelTime` 훅

**Files:**
- Create: `packages/react/src/wheel/use-wheel-time.ts`
- Create: `packages/react/src/wheel/use-wheel-time.test.tsx`
- Modify: `packages/react/src/index.ts:44-45` (바로 아래에 export 추가)

**Interfaces:**
- Consumes: core `buildTimeColumns({ minuteStep, isEndOfDayAllowed: false }): WheelTimeColumns`, `VALID`, `Validity`. calendar `formatTime`, `TimeString`. react 내부 `usePickerSettings`, `useParsedValue`, `useValueBridge`, `parseOptionalTime`(`value/parse-controlled-value.ts:60`), `isVisiblyInvalid`, `createFocusLeaveListener`, `HiddenInputProps`, `SharedPickerProps`, `ValueChangeDetails`.
- Produces (`@lunisolar-picker/react`에서 export):

```ts
export interface UseWheelTimeProps
  extends Omit<SharedPickerProps, 'calendars' | 'timeZone' | 'today' | 'weekStartsOn'> {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: TimeString | null, details: ValueChangeDetails) => void) | undefined;
  readonly minuteStep?: number | undefined;
}
export interface WheelTimeFields { readonly hour: number; readonly minute: number }
export interface WheelTimeApi {
  readonly fields: WheelTimeFields;          // 보이는 칸 (분은 step으로 내린 값)
  readonly columns: WheelTimeColumns;
  readonly value: TimeString | null;
  readonly validity: Validity;               // 늘 VALID
  readonly isInvalid: boolean;               // invalid prop만 반영
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly labels: { readonly hour: string; readonly minute: string };
  selectHour(hour: number): void;
  selectMinute(minute: number): void;
  focus(): void;
  getWheelRootProps(): WheelTimeRootProps;   // WheelDateRootProps와 같은 모양
  getHiddenInputProps(): HiddenInputProps;
}
export type WheelTimeRootProps = WheelDateRootProps;
export const useWheelTime: (props: UseWheelTimeProps) => WheelTimeApi;
```

규칙(구현 핵심):
- 상태는 `{ hour; minute; hasSelection }` 하나다. `useWheelDate`의 position 패턴(`use-wheel-date.ts:57-62`)과 같다. 초기값은 값이 있으면 그 시·분에 `hasSelection: true`, 없으면 `{ hour: 12, minute: 0, hasSelection: false }`다.
- 값 해석은 `parseOptionalTime(input, { isEndOfDayAllowed: false })`로 한다. 그래서 훅에 `"24:00"`이 직접 오면 형식 오류로 보고 `onInvalidValue`를 부른다. picker는 `"24:00"`을 훅에 넘기지 않는다(Task 2).
- `fields.minute = Math.floor(state.minute / minuteStep) * minuteStep`. `value`는 `hasSelection`이면 **내리지 않은** `state`로 `formatTime`한 값이다. 그래서 `09:07`은 굴리기 전까지 그대로 남는다.
- `selectHour(h)`는 `{ hour: h, minute: fields.minute, hasSelection: true }`, `selectMinute(m)`은 `{ hour: fields.hour, minute: m, hasSelection: true }`다.
- `useValueBridge` 연결, 부모가 `null`을 줄 때 위치를 유지하는 것, `resetToDefault`, `focus`, `attachRoot`, `getWheelRootProps`, `getHiddenInputProps`는 `use-wheel-date.ts:167-243`를 그대로 따른다. 역법·제약·`usePickerContext` 부분은 뺀다.
- `columns`는 `useMemo(() => buildTimeColumns({ minuteStep, isEndOfDayAllowed: false }), [minuteStep])`로 만든다.

- [x] **Step 1: 실패하는 테스트 작성** — `use-wheel-time.test.tsx`. 하네스는 `use-wheel-date.test.tsx:37-121`의 Probe 구조를 따르고, 열은 `Wheel.Root`/`Wheel.Column` 두 개로 그린다. 열 조작은 `focusDirectly(spinbutton)` → `userEvent.keyboard(...)` → `expect.element(col).toHaveAttribute('aria-valuetext', ...)` → `settleEffects()` 순서다. 모든 render는 `KoreanProvider`로 감싼다.

```ts
describe('useWheelTime', () => {
  describe('empty value', () => {
    it('rests at 12:00 without reporting a value')
      // hour aria-valuetext '12', minute '00', hidden input value '', onValueChange not called
    it('commits the shown time on the first selection')
      // hour ArrowDown → onValueChange calls [['13:00', { validity: VALID }]] (ArrowUp은 앞 칸, ArrowDown은 다음 칸)
  });
  describe('minuteStep', () => {
    it('lists minutes at the step')                       // step 5: minute column options '00'..'55' (12개)
    it('shows an off-step value at the step before without changing it')
      // defaultValue '09:07', step 5 → minute valuetext '05', hidden input '09:07', no callback
    it('commits the floored minute when the hour turns') // 위 상태에서 hour ArrowDown → '10:05'
    it('re-floors without a callback when the step changes while mounted')  // Review Focus 1: rerender step 1→5 on '09:07'
    it('offers only 00 when the step is 60')              // Review Focus 2: options ['00'], hour ArrowDown from '09:00' → '10:00'
    it('throws for a step that does not divide 60')       // step 7 → LunisolarPickerError
  });
  describe('controlled value', () => {
    it('reports a malformed value through onInvalidValue once')     // value '25:00' → [['25:00', 'invalid-time']]
    it('treats 24:00 as malformed')                                  // value '24:00' → onInvalidValue called, rests at 12:00
    it('keeps the wheel position when the parent clears the value, without reporting it')
  });
  describe('hour column', () => {
    it('stops at 23 instead of wrapping')                 // value '23:00', ArrowDown → valuetext stays '23', no callback
    it('exposes spinbuttons named by the locale hour and minute labels') // getByRole('spinbutton',{name: ko.labels.hour}) 등
  });
});
```

`describe` 안의 주석은 단언으로 옮겨 적는다. 값은 위에 적힌 그대로 쓴다.

- [x] **Step 2: 실패 확인** — `pnpm --filter @lunisolar-picker/react exec vitest run src/wheel/use-wheel-time.test.tsx`. 기대: FAIL(`useWheelTime` 없음).
- [x] **Step 3: `use-wheel-time.ts` 구현**. 위 Interfaces와 규칙대로 하고, `index.ts:45` 다음 줄에 `export type { UseWheelTimeProps, WheelTimeApi, WheelTimeFields, WheelTimeRootProps }`와 `export { useWheelTime }`를 추가한다.
- [x] **Step 4: 통과 확인** — 같은 명령. 기대: PASS. 이어서 `just typecheck && just lint`가 통과해야 한다.
- [x] **Step 5: 커밋**

```bash
git add packages/react/src/wheel/use-wheel-time.ts packages/react/src/wheel/use-wheel-time.test.tsx packages/react/src/index.ts
ALLOW_COMMIT=1 git commit -m "feat: 시·분 휠 훅 useWheelTime 추가" -m "- 빈 값은 12:00에 서고, 칸 밖 분은 바로 앞 칸으로 보이되 굴리기 전까지 값은 그대로 둠"
```

---

### Task 2: `WheelTimePicker` 완성형과 Mono 스타일

**Files:**
- Create: `packages/react/src/pickers/time-value.ts`
- Modify: `packages/react/src/pickers/time-picker.tsx:26-32, 234-243` (helper 이동, import로 교체)
- Create: `packages/react/src/pickers/wheel-time-picker.tsx`
- Create: `packages/react/src/pickers/wheel-time-picker.test.tsx`
- Modify: `packages/react/src/pickers/index.ts:13` (다음 줄에 export)
- Modify: `packages/react/src/contract/data-attributes.ts:68` (`'wheel-time-picker'`를 `'wheel-date-picker'` 다음에)
- Modify: `packages/theme/src/mono.css:1099, 1106, 1113, 1119, 1241`

**Interfaces:**
- Consumes: Task 1의 `useWheelTime`, `UseWheelTimeProps`, `WheelTimeApi`. 기존 `PickerOpenProps`, `TriggerRenderProps`, `PickerSurface`, `PickerFooter`, `PickerClearButton`, `ValueTrigger`, `ClockIcon`, `HiddenInput`, `useControllableState`, `useFieldRemount`, `useAppTriggerProps`, `useInvalidValueReport`, `partAttributes`.
- Produces:

```ts
// pickers/time-value.ts
export const TIME_PARSE_KEY = 'well-formed-time';
export type ParsedTimeValue = { readonly invalidReason: ValidationReason | null; readonly time: TimeString | null };
export const parseTimeValue: (value: string | null) => ParsedTimeValue;     // isEndOfDayAllowed: true
export const publicTimeOf: (time: TimeString | null, isEndOfDayAllowed: boolean) => TimeString | null;

// pickers/wheel-time-picker.tsx  (@lunisolar-picker/react/pickers)
export interface WheelTimePickerProps extends UseWheelTimeProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  readonly isClearable?: boolean | undefined;               // 기본 true
  readonly placeholder?: string | undefined;
  readonly presentation?: 'inline' | 'sheet' | undefined;   // 기본 'inline'
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
}
export const WheelTimePicker: (props: WheelTimePickerProps) => ReactElement;
```

규칙(`wheel-date-picker.tsx`와 다른 점만):
- `parsed = parseTimeValue(currentValue)`, `publicTime = publicTimeOf(parsed.time, false)`.
- 훅에는 `value: publicTime`을 넘기고 `onInvalidValue`는 넘기지 않는다. 해석 오류 알림은 inline·sheet 모두 picker가 `useInvalidValueReport({ calendarKey: TIME_PARSE_KEY, input: currentValue || null, isEnabled: true, onInvalidValue, reason: parsed.invalidReason })`로 한다.
- `isVisiblyInvalid = invalid === true || (parsed.time !== null && publicTime === null)`. 즉 `"24:00"`일 때다.
- 트리거 글자는 `parsed.time ?? ''`(`"24:00"`도 그대로 보임), 아이콘은 `ClockIcon`, 기본 라벨은 `labels.chooseTime`이다. 지우기 버튼은 `parsed.time !== null`이면 보인다.
- 숨은 입력 값은 `publicTime ?? ''`다.
- 시트 초안은 `useWheelTime({ ...wheelProps, defaultValue: publicTime })`로 만든다. 확인 시 보이는 값은 `formatTime(wheel.fields.hour, wheel.fields.minute)`이고, `shownValue !== parsed.time`일 때만 `onValueChange(shownValue, { validity: VALID })`를 부른다. 확인 버튼은 비활성이 되지 않는다.
- `separator` prop과 `useValueOnProvidedCalendars`는 없다.
- `partAttributes('wheel-time-picker', { open, invalid, placeholder })`의 상태 규칙은 날짜와 같다.
- 공통 코드를 뽑을지는 스펙 §7대로 구현자가 판단한다. 뽑는다면 `wheel-date-picker.test.tsx`가 그대로 통과해야 한다.

Mono: 다섯 선택자를 각각 `:is([data-lsp-part="wheel-date-picker"], [data-lsp-part="wheel-time-picker"])` 꼴로 넓힌다. 288px 폭 규칙(1106)도 공유한다(스펙 §5).

- [x] **Step 1: helper 이동** — `time-value.ts`를 만들고 `time-picker.tsx`가 import하게 바꾼다. 확인 명령은 `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers/time-picker.test.tsx`, 기대는 PASS(동작 그대로)다.
- [x] **Step 2: 실패하는 테스트 작성** — `wheel-time-picker.test.tsx`. import와 헬퍼는 `wheel-date-picker.test.tsx:1-32`와 같고, `TRIGGER_NAME = endsWith(ko.labels.chooseTime)`이다.

```ts
describe('WheelTimePicker', () => {
  describe('inline', () => {
    it('reports HH:mm when a column turns')                    // defaultValue '09:30', minute ArrowDown(step 1) → '09:31'
    it('focuses the hour column through ref.focus()')
  });
  describe('sheet', () => {
    it('keeps the value when the draft is cancelled')          // '09:30' 열고 hour ArrowDown, cancel → 값·trigger '09:30', no callback
    it('commits the draft on confirm')                         // → [['10:30', { validity: VALID }]]
    it('commits 12:00 when confirming an empty value without turning')
    it('commits the floored minute for an off-step value')     // '09:07', step 5, 바로 confirm → '09:05'
    it('opens a fresh draft each time')                        // 굴리고 cancel 후 다시 열면 원래 값
    it('keeps the draft when the parent changes the value while open') // Review Focus 4: 열린 동안 rerender value '15:00', cancel → 부모 값 '15:00' 유지, 초안 '09:30'에서 굴린 값이 반영되지 않음
    it('focuses the trigger through ref.focus()')
  });
  describe('value parsing', () => {
    it('reports a malformed controlled value once and submits an empty field') // '25:00' → onInvalidValue 1회, hidden ''
    it('marks 24:00 invalid without onInvalidValue')           // data-invalid, trigger text '24:00', clear 보임, hidden ''
  });
  describe('clear', () => {
    it('clears to null and rests the inline wheel at 12:00')
  });
  describe('form', () => {
    it('blocks submit while required and empty')               // form.checkValidity() === false
    it('restores the default after reset')                     // Review Focus 3: '09:30' → 굴림 → reset → valuetext 09/30, hidden '09:30'
    it('drops the field from FormData while disabled and keeps the value')
  });
  describe('accessibility', () => {
    it('has no axe violations inline and in the open sheet')
  });
});
```

- [x] **Step 3: 실패 확인** — `... vitest run src/pickers/wheel-time-picker.test.tsx`. 기대: FAIL.
- [x] **Step 4: 구현** — `wheel-time-picker.tsx`를 만들고, `pickers/index.ts`에 `export type { WheelTimePickerProps }`와 `export { WheelTimePicker }`를 추가한다. data-attributes에 part를 추가하고 mono.css 선택자를 넓힌다.
- [x] **Step 5: 통과 확인** — 위 테스트가 PASS여야 한다. 이어서 `pnpm --filter @lunisolar-picker/theme exec vitest run tests/selector-contract.test.ts`가 PASS, `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers/wheel-date-picker.test.tsx`가 PASS여야 하고, `just check`도 통과해야 한다.
- [x] **Step 6: 커밋**

```bash
git add packages/react/src/pickers packages/react/src/contract/data-attributes.ts packages/theme/src/mono.css
ALLOW_COMMIT=1 git commit -m "feat: 날짜 휠과 같은 모양의 시각 휠 WheelTimePicker 추가" -m "- 시트에서는 확인을 눌러야 반영되고, 24:00은 TimePicker처럼 무효로 표시" -m "- Mono 날짜 휠 규칙을 시각 휠과 공유"
```

---

### Task 3: saju-pictures 소비자 시나리오와 시각 회귀

**Files:**
- Modify: `packages/react/src/pickers/consumer-parity.test.tsx` (saju-pictures 블록 425–499에 컴포넌트와 `it` 추가)
- Modify: `packages/react/src/visual/pickers.visual.test.tsx:50` (다음 줄)
- Create: `packages/react/src/visual/__screenshots__/…wheel-time-picker…` (light, dark. `just visual-update`가 만든다)

**Interfaces:**
- Consumes: `WheelTimePicker`는 `@lunisolar-picker/react/pickers`에서 import한다. 기존 파일이 쓰는 공개 진입점 규칙과 같다. 그 외에는 `BirthDateForm` 패턴(`consumer-parity.test.tsx:38, 87-92`)을 쓴다.
- Produces: 없음

앱 모양 컴포넌트 `BirthTimeForm`:
- `form aria-label={BIRTH_FORM_LABEL}`을 쓴다.
- `WheelTimePicker presentation="sheet" name="birthTime" minuteStep={1} required aria-label="태어난 시각" disabled={isTimeUnknown}`을 둔다.
- 앱이 그린 `<input type="checkbox">` "모름"을 두고, 이 체크박스가 `isTimeUnknown` 상태를 토글한다.
- submit 시 `onSubmitBirthTime(new FormData(form).get('birthTime'))`를 부른다.
- "태어난 시각", "모름"은 앱 픽스처 문자열이다. 라이브러리 로캘이 아니다.

- [x] **Step 1: 테스트 작성**

```ts
it('birth time: an app-drawn "time unknown" checkbox toggles disabled and keeps the time', async () => {
  // 시트 열기 → hour 굴려 13 → confirm → submit                    ⇒ calls [['13:00']]
  // "모름" 체크 → trigger toBeDisabled → submit                      ⇒ 다음 호출 [null], required가 막지 않음
  // "모름" 해제 → trigger 글자 '13:00' → submit                      ⇒ 다음 호출 ['13:00']
  // Review Focus 5: 위 과정 내내 onValueChange 호출은 confirm 1회뿐
});
```

- [x] **Step 2: 실행** — `... vitest run src/pickers/consumer-parity.test.tsx`. 기대: PASS. Task 2가 끝났으므로 바로 통과해야 정상이다. 실패하면 Task 2 동작의 버그다.
- [x] **Step 3: 시각 회귀 대상 추가** — `pickers.visual.test.tsx:50` 다음 줄에 `{ name: 'wheel-time-picker', hasPopover: false, element: <WheelTimePicker defaultValue="09:30" /> }`를 추가하고, import에 `WheelTimePicker`를 더한다.
- [x] **Step 4: 기준 이미지 생성** — `just visual-update`(Linux Docker). 그다음 `just visual`. 기대: PASS. 새 이미지 두 장(light, dark)을 열어 날짜 휠 기준 이미지와 폭·하이라이트·글꼴이 같은지 눈으로 확인한다.
- [x] **Step 5: 커밋**

```bash
git add packages/react/src/pickers/consumer-parity.test.tsx packages/react/src/visual
ALLOW_COMMIT=1 git commit -m "test: saju-pictures '시각 모름' 흐름과 시각 휠 기준 이미지 추가"
```

---

### Task 4: 문서, 상위 스펙, changeset

**Files:**
- Create: `apps/docs/src/content/docs/pickers/wheel-time-picker.mdx`
- Create: `apps/docs/src/components/demos/WheelTimePickerDemo.tsx`
- Modify: `apps/docs/astro.config.mjs:19` (다음 줄에 `'pickers/wheel-time-picker',`)
- Modify: `docs/superpowers/specs/2026-10-14-lunisolar-picker-design.md` §7.1 표(`/pickers` 행에 `WheelTimePicker`)
- Create: `.changeset/wheel-time-picker.md`

**Interfaces:**
- Consumes: `WheelTimePicker`(`@lunisolar-picker/react/pickers`)
- Produces: 없음

- [x] **Step 1: 데모와 페이지** — 데모는 `WheelDatePickerDemo.tsx`와 같은 모양으로 `<WheelTimePicker defaultValue="09:30" minuteStep={5} />` 하나를 그린다. mdx는 `wheel-date-picker.mdx`의 구성(frontmatter, 데모, tsx 예제, 동작 설명, props 표)을 따르고 영어로 쓴다. 동작 설명에 넣을 것:
  - 빈 값은 12:00에서 시작한다.
  - step 밖의 분은 바로 앞 칸으로 보이고, 굴리거나 확인하기 전까지 값은 바뀌지 않는다.
  - sheet는 확인을 눌러야 반영되고 취소하면 버린다.
  - `disabled`이면 값은 남고 폼 제출에서 빠진다.
  - 24:00, 12시간제, 순환은 지원하지 않는다.
  - 키보드 한계: 시 열 타입어헤드는 `"09"`처럼 두 자리로 쳐야 한다.
- [x] **Step 2: 상위 스펙 표 갱신, changeset 작성** — changeset 내용:

```md
---
"@lunisolar-picker/react": minor
"@lunisolar-picker/theme": minor
---

Add `WheelTimePicker` and the `useWheelTime` hook: hour and minute drums that match `WheelDatePicker` in props, sheet draft behaviour and the Mono theme. Values are 24-hour `HH:mm` strings, `minuteStep` defaults to 1, and an empty picker rests at 12:00.
```

- [x] **Step 3: 검증** — `just docs-build`가 PASS, `just test`가 PASS, `just size`가 한도 안이어야 한다. 넘으면 근거를 적고 한도를 조정한다.
- [x] **Step 4: 커밋**

```bash
git add apps/docs docs/superpowers/specs/2026-10-14-lunisolar-picker-design.md .changeset/wheel-time-picker.md
ALLOW_COMMIT=1 git commit -m "docs: WheelTimePicker 문서와 minor changeset 추가"
```

---

## Self-Review 메모

- 스펙 대응:
  - §3.1 → T2
  - §3.2 → T1
  - §4.1 → T1(칸 맞춤, 12:00) + T2(형식 오류, 24:00)
  - §4.2·§4.3·§4.4 → T2
  - §4.5 → T1·T2(axe)
  - §5 → T2
  - §6.1 → T1·T2
  - §6.2 → T3
  - §6.3 → T3
  - §6.4·§6.5 → T4
- 타입 이름: `UseWheelTimeProps`, `WheelTimeApi`, `WheelTimeFields`, `WheelTimeRootProps`, `WheelTimePickerProps`, `parseTimeValue`, `publicTimeOf`, `TIME_PARSE_KEY`는 Task 사이에서 일치한다.
- 열린 판단: picker 골격을 공통 모듈로 뽑을지는 스펙 §7대로 구현자가 정한다.
