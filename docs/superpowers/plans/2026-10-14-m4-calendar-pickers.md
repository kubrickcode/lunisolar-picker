# M4: 달력 부품과 완성형 picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 🟡 **잠정 계획**: M2(core)·M3(react 기반·theme·입력 부품)가 끝나기 전에 쓴 계획이다. M2·M3의 실제 이름·시그니처·파일 경로가 계약(`2026-10-14-v1-interface-contract.md`)과 다르면, 실행 전에 계약을 먼저 고치고 이 계획의 해당 import·호출부를 맞춘다. 동작·테스트 기대값은 그대로 둔다.

**Goal:** 단일·범위 달력 부품(`Calendar.*`, `RangeCalendar.Root`)과 완성형 picker 5종(`DatePicker`, `DateRangePicker`, `MonthPicker`, `WheelDatePicker`, `TimePicker`)을 만들어, web-console·back-office·saju-pictures가 쓰던 기능을 공개 API만으로 재현할 수 있게 한다.

**Architecture:** 두 달력 Root는 공통 `useCalendarFoundation`(역법·제약·navigation store·월 격자·포커스 요청) 위에 선택 store(single/range)만 바꿔 얹는다. 부품은 `CalendarViewApi` 컨텍스트 하나로 칸 상태·속성·키보드를 받는다. 범위 드래그는 `useRangePointer`가 포인터 이벤트를 날짜 이벤트로 바꿔 core store에 보내고, 가장자리 머묾 판정은 core `createEdgeDwell`이 맡는다. 완성형은 `src/pickers/`에서 공개 진입점(`src/index.ts`)과 M3 공용 모듈(`src/contract/`, `src/settings/`, `src/utilities/`)만 import한다.

**Tech Stack:** React 19.3.0, `@lunisolar-picker/core`·`calendar`(workspace), `@floating-ui/react-dom` 2.1.9(M3 Popover 내부), vitest 5.0.4 브라우저 모드 + `@vitest/browser-playwright` 5.0.4 + `vitest-browser-react` 2.3.0, axe-core 4.14.0, esbuild 0.28.2(크기 예산)

**Spec:** `docs/superpowers/specs/2026-10-14-lunisolar-picker-design.md` (2장 기능, 7장 React API, 8장 테마, 10장 접근성, 11장 테스트). 계약: `docs/superpowers/plans/2026-10-14-v1-interface-contract.md` §2·§3·§4

## Global Constraints

- M1 계획의 Global Constraints(정확한 버전, ESM 전용, 이름 규칙, WHY 주석, 테스트 규칙, 커밋 규칙, `ALLOW_COMMIT=1`)를 그대로 따른다
- React peer `^19.0.0`. `ref`는 prop으로 받는다(`forwardRef` 금지)
- 공개 prop 이름: 값 `value`/`defaultValue`/`onValueChange(value, { validity })`, 열림 `open`/`defaultOpen`/`onOpenChange`, 상태 `disabled`/`readOnly`/`required`/`invalid`(HTML 속성명이라 boolean 접두사 규칙의 예외), 폼 `name`/`form`. `onChange` 금지
- 공개 문자열 값만 내보낸다(`DateString`, `DateRangeValue`, `MonthString`, `TimeString`). 내부는 epoch day
- 부품은 클래스 이름 없이 `data-lsp-part`와 `DATA_ATTRIBUTES` 상태 속성만 붙인다. theme는 이 둘로만 선택한다
- 키보드(스펙 10.1): ←→ ±1일(RTL이면 반대), ↑↓ ±7일, Home/End 주 처음·끝, PageUp/PageDown ±1개월, Shift+PageUp/PageDown ±1년, Enter/Space 선택. Esc는 Popover·Sheet가 처리
- 드래그 범위 선택은 마우스·펜만. 터치는 탭 두 번(스펙 10.5)
- `src/pickers/**`는 `src/index.ts`, `src/contract/**`, `src/settings/**`, `src/utilities/**`, `src/pickers/**`만 import한다(dependency-cruiser로 강제)
- `'use client'`는 소스에 쓰지 않는다. M3의 tsdown `banner`가 모든 산출 청크에 붙이고 `check-use-client.ts`가 검사한다
- **M3가 만드는 모듈 경로** (정합성 조정 2026-10-14: M3 계획의 실제 이름·경로로 맞춤)

| 경로 | 이름 |
|---|---|
| `src/settings/lunisolar-provider.tsx` | `LunisolarProvider` |
| `src/settings/use-picker-settings.ts` | `usePickerSettings(props: SharedPickerProps): PickerSettings`, `PickerSettings { locale; timeZone; todayEpochDay; weekStartsOn; calendars }` (calendars[0]은 gregory) |
| `src/settings/shared-picker-props.ts` | `SharedPickerProps`(`onBlur` 포함), `ValueChangeDetails` |
| `src/utilities/render-element.ts` | `RenderProp<Props, State>`, `renderElement(tagName, render, props, state): ReactElement` |
| `src/store/use-store-instance.ts` | `useStoreInstance(createInitialState, reducer, context): { state; send }` (send는 참조 고정) |
| `src/utilities/use-controllable-state.ts` | `useControllableState(controlled, defaultValue, onChange): readonly [Value, (next) => void]` |
| `src/contract/data-attributes.ts` | `DATA_ATTRIBUTES`, `DataAttribute`, `PART_NAMES`, `PartName`, `partAttributes(part, flags?)`, `stateAttributes(flags)` (플래그 키는 `data-` 없이: `{ selected: true }`) |
| `src/presentation/use-presentation.ts` | `Presentation`, `usePresentation(presentation): 'popover' \| 'sheet'` (`src/index.ts`에서도 export) |
| `src/index.ts` | `Popover`, `Sheet`(둘 다 Content는 닫히면 언마운트), `DateField`, `DateRangeField`, `TimeField`(Root에 children이 없으면 기본 세그먼트를 그림), `Wheel`(`Wheel.Column`은 `options`·`value`·`onValueChange`·`label`을 받음), `useWheelDate(props): WheelDateApi { fields; columns; value; labels; selectYear; selectMonth; selectDay }` |
| `src/testing/expect-accessible.ts` | `expectNoAxeViolations(container: Element): Promise<void>` |
| `src/testing/expect-hydration.tsx` | `renderWithHydration(element): Promise<{ container; recoverableErrors; unmount }>` |
| `packages/react/scripts/check-use-client.ts` | dist의 모든 `.js` 첫 줄 `'use client';` 검사 (tsdown `banner`가 붙임. 소스에는 지시문을 쓰지 않음) |
| `packages/theme/src/mono.css` | `@layer lunisolar-picker` 단일 파일. 토큰(`--lsp-*`, `--lsp-cell-size` 기본 36px)과 입력 부품 스타일. 달력 스타일은 이 계획이 같은 파일 끝에 붙임 |
| `packages/theme/tests/selector-contract.test.ts` | 선택자 계약 테스트 (`@lunisolar-picker/react/contract`를 워크스페이스 의존으로 import) |

## Review Focus

1. **두 달 표시에서 겹치는 날짜**: 1월 격자의 뒤쪽 바깥 날짜와 2월 격자의 같은 날이 동시에 있어도 탭으로 들어가는 칸(tabindex=0)은 정확히 하나여야 한다. Task 2에서 고정
2. **양·음력 전환**: 토글해도 선택된 날·포커스한 날이 그대로이고 `onValueChange`가 불리지 않아야 한다. Task 3에서 고정
3. **부모가 변경을 거부한 제어 값**: `onValueChange`를 받고도 부모가 `value`를 바꾸지 않으면 화면이 부모 값으로 돌아와야 한다. Task 1에서 고정
4. **달력 밖에서 손을 뗀 드래그**: 포인터를 달력 바깥에서 놓아도 드래그 상태가 남지 않고, 다음 호버가 범위를 바꾸지 않아야 한다. Task 5에서 고정
5. **확인 모드를 바깥 클릭으로 닫은 뒤 다시 열기**: 버린 임시 범위가 아니라 확정 값이 보여야 한다. Task 9에서 고정

---

## 파일 구조

```
packages/react/
  src/
    index.ts                                  (수정) Calendar, RangeCalendar, MonthCalendar, TimeList, 훅 export
    contract/data-attributes.ts               (수정) PART_NAMES·DATA_ATTRIBUTES 항목 추가
    testing/korean-fixture.tsx                한국어 Provider와 라벨 헬퍼 (테스트 전용)
    testing/pointer.ts                        포인터 이벤트 디스패치 헬퍼 (테스트 전용)
    visual/pickers.visual.test.tsx            picker 시각 회귀 (M3 vitest.visual.config.ts로 실행)
    calendar/
      calendar-key-action.ts                  키 → navigation 이벤트
      cell-state.ts                           CellState, CellRenderInfo, 칸 data-* 계산
      cell-label.ts                           칸 접근성 이름
      parsed-selection.ts                     value prop 해석과 선택 키
      use-selection-sync.ts                   제어 값 동기화와 변경 알림
      use-calendar-foundation.ts              공통 기반 (역법·제약·navigation·격자·포커스)
      calendar-view-api.ts                    CalendarViewApi와 createCalendarViewApi
      use-calendar.ts                         단일 선택 훅
      calendar-context.ts                     컨텍스트
      split-props.ts                          훅 prop과 DOM prop 분리
      month-button-grid.tsx                   월·연 버튼 격자 (MonthGrid·YearGrid·MonthCalendar 공용)
      calendar-parts.tsx                      Header, Heading, Prev/Next/TodayButton, Grid, HeadCell, Cell
      calendar-view-parts.tsx                 CalendarToggle, ViewButton, MonthGrid, YearGrid
      calendar-layout.tsx                     기본 배치 (Calendar.Layout)
      calendar-root.tsx                       Calendar.Root
      index.ts                                Calendar 네임스페이스
    range-calendar/
      range-cell-flags.ts                     범위 칸 플래그
      range-announcement.ts                   live region 문구
      live-region.tsx
      use-range-pointer.ts                    드래그·끝점 잡기·가장자리 머묾
      use-range-calendar.ts
      range-calendar-context.ts
      range-calendar-root.tsx
      index.ts
    month-calendar/  month-calendar-root.tsx  index.ts
    time-list/       list-times.ts  time-list-root.tsx  index.ts
    pickers/
      index.ts                                'use client' 진입점
      picker-selection.ts                     usePickerSelection
      format-display-value.ts                 트리거 표시 문자열
      default-trigger.tsx                     아이콘 버튼 트리거
      picker-surface.tsx                      Popover/Sheet 분기
      picker-footer.tsx                       확인·취소
      date-picker.tsx  date-range-picker.tsx  month-picker.tsx  wheel-date-picker.tsx  time-picker.tsx
  test/size/date-picker-entry.ts              크기 예산 측정 진입점
packages/theme/src/mono.css                   (수정) 달력·picker 스타일을 같은 @layer 파일 끝에 추가
packages/theme/tests/calendar-selectors.test.ts
```

---

### Task 1: 달력 공통 기반과 `useCalendar`

> 🟡 잠정: M2의 store 이벤트 이름, `buildMonthGrid`·`resolveConstraints` 시그니처, M3의 `useStoreInstance`·`usePickerSettings`·`useControllableState` 형태에 따라 import와 호출부가 바뀔 수 있음.

> 정합성 조정(2026-10-14): M3 실제 이름(`usePickerSettings`, `useStoreInstance`, 위치 인자 `useControllableState`, `renderElement`, `partAttributes`·`stateAttributes`)과 M2 selection 모양(`SelectedDay`, `value.sync { selected }`)에 맞췄다. 컨텍스트의 제약은 양력 기준(`resolveConstraints(…, gregory, calendars)`)이고, 표시 역법 범위 밖 칸은 `cell.isOutsideSupportedRange`로 막는다. `formatDateLabel`은 M2 Task 3에 추가됐다. 테스트 헬퍼는 `src/testing/`에 둔다. 값 동기화는 부모가 변경을 거부하면 되돌리는 달력 전용 정책이라 M3 `useValueBridge`(입력 칸용, 되돌리지 않음) 대신 `useSelectionSync`를 유지한다.

**Files:**
- Create: `packages/react/src/calendar/calendar-key-action.ts`, `cell-state.ts`, `cell-label.ts`, `parsed-selection.ts`, `use-selection-sync.ts`, `use-calendar-foundation.ts`, `calendar-view-api.ts`, `use-calendar.ts`
- Create: `packages/react/src/testing/korean-fixture.tsx` (테스트 전용. 패키지 `files`에서 `src/testing`은 빠짐)
- Test: `packages/react/src/calendar/calendar-key-action.test.ts`, `cell-label.test.ts`, `use-calendar.test.tsx`

**Interfaces:**
- Consumes: core `NavigationEvent`, `NavigationState`, `createNavigationState`, `navigationReducer`, `SingleSelectionState`, `SingleSelectionEvent`, `createSingleSelectionState`, `singleSelectionReducer`, `singleValue`, `PickerContext`, `RangeConstraints`, `DateConstraints`, `resolveConstraints`, `validateEpochDay`, `Validity`, `MonthGrid`, `MonthGridCell`, `buildMonthGrid`, `shiftVisibleMonth`, `findCalendar`, `CommitMode`, `LocaleData`; calendar `parseDate`, `CalendarId`, `CalendarSystem`, `EpochDay`, `DateString`, `weekdayOf`; M3 `usePickerSettings`, `PickerSettings`, `useStoreInstance`, `useControllableState`, `stateAttributes`, `partAttributes`, `SharedPickerProps`, `ValueChangeDetails`; core `SelectedDay`, `boundsFor`
- Produces:
  - `calendarKeyAction(key: string, isShiftPressed: boolean, isRightToLeft: boolean): CalendarKeyAction | null`
  - `interface CellState { isSelected; isToday; isDisabled; isOutsideMonth; isInRange; isRangeStart; isRangeEnd; isPreview; isFocused }`, `type CellRenderInfo = MonthGridCell & CellState`, `interface CellSelectionFlags`
  - `buildCellLabel(input): string`
  - `type ParsedSelection = SelectedDay`(core), `parseSelection(input, calendars): SelectedDay | null | 'invalid'`, `selectionKey(selected: SelectedDay | null): string`
  - `useSelectionSync({ controlledKey, committedKey, syncToControlled, emitChange }): void`
  - `useCalendarFoundation(props, config, constraintsInput, initialFocusEpochDay): CalendarFoundation`, `type SlideDirection = 'previous' | 'next'`
  - `interface CalendarViewApi`, `interface CellProps { gridCell; button }`, `interface SelectionBehavior`, `createCalendarViewApi(foundation, behavior, flags): CalendarViewApi`
  - `interface UseCalendarProps`, `interface CalendarApi extends CalendarViewApi`, `useCalendar(props): CalendarApi`

- [ ] **Step 1: 테스트 픽스처 작성**

`packages/react/src/testing/korean-fixture.tsx`:
```tsx
import { type CalendarSystem, epochDayOf, gregory, parseDate, weekdayOf } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import type { Weekday } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement, ReactNode } from 'react';
import { LunisolarProvider } from '../settings/lunisolar-provider';

export const FIXED_TODAY = '2026-10-14';

export interface KoreanProviderProps {
  readonly children: ReactNode;
  readonly hasLunar?: boolean;
}

export function KoreanProvider({ children, hasLunar = false }: KoreanProviderProps): ReactElement {
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today={FIXED_TODAY} weekStartsOn={0} calendars={hasLunar ? [dangi] : []}>
      {children}
    </LunisolarProvider>
  );
}

export function dayLabel(isoDate: string, calendar: CalendarSystem = gregory): string {
  const parsed = parseDate(isoDate);
  if (!parsed.isOk) throw new Error(`fixture expects a canonical date, received ${isoDate}`);
  const fields = calendar.fromEpochDay(parsed.value.epochDay);
  if (!fields.isOk) throw new Error(`${isoDate} is outside ${calendar.id}`);
  return ko.formatDayLabel(fields.value, weekdayOf(parsed.value.epochDay) as Weekday, calendar.id);
}

export function epochDayAt(isoDate: string): ReturnType<typeof epochDayOf> {
  const parsed = parseDate(isoDate);
  if (!parsed.isOk) throw new Error(`fixture expects a canonical date, received ${isoDate}`);
  return parsed.value.epochDay;
}
```

- [ ] **Step 2: 실패하는 단위 테스트 작성**

`packages/react/src/calendar/calendar-key-action.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { calendarKeyAction } from './calendar-key-action';

describe('calendarKeyAction', () => {
  it.each([
    ['ArrowRight', false, { type: 'focus.move', unit: 'day', amount: 1 }],
    ['ArrowLeft', false, { type: 'focus.move', unit: 'day', amount: -1 }],
    ['ArrowDown', false, { type: 'focus.move', unit: 'week', amount: 1 }],
    ['ArrowUp', false, { type: 'focus.move', unit: 'week', amount: -1 }],
    ['Home', false, { type: 'focus.weekEdge', edge: 'start' }],
    ['End', false, { type: 'focus.weekEdge', edge: 'end' }],
    ['PageDown', false, { type: 'focus.move', unit: 'month', amount: 1 }],
    ['PageUp', false, { type: 'focus.move', unit: 'month', amount: -1 }],
    ['PageDown', true, { type: 'focus.move', unit: 'year', amount: 1 }],
    ['PageUp', true, { type: 'focus.move', unit: 'year', amount: -1 }],
  ])('maps %s (shift: %s) to a navigation event', (key, isShiftPressed, event) => {
    expect(calendarKeyAction(key, isShiftPressed, false)).toEqual({ kind: 'navigate', event });
  });

  it('flips horizontal arrows in right-to-left layouts', () => {
    expect(calendarKeyAction('ArrowRight', false, true)).toEqual({
      kind: 'navigate',
      event: { type: 'focus.move', unit: 'day', amount: -1 },
    });
  });

  it.each(['Enter', ' '])('treats "%s" as selection', (key) => {
    expect(calendarKeyAction(key, false, false)).toEqual({ kind: 'select' });
  });

  it.each(['Escape', 'Tab', 'a'])('leaves "%s" to the browser and surrounding parts', (key) => {
    expect(calendarKeyAction(key, false, false)).toBeNull();
  });
});
```

`packages/react/src/calendar/cell-label.test.ts`:
```ts
import { gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { buildMonthGrid } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it } from 'vitest';
import { buildCellLabel } from './cell-label';

const october = buildMonthGrid({ calendar: gregory, month: { year: 2026, monthCode: 'M10' }, weekStartsOn: 0, secondaryCalendar: dangi });
const october14 = october.weeks.flat().find((cell) => cell.date === '2026-10-14');

describe('buildCellLabel', () => {
  if (!october14) throw new Error('October 2026 grid should contain the 14th');

  it('reads only the solar date when no secondary calendar is shown', () => {
    const label = buildCellLabel({ cell: october14, calendar: gregory, secondaryCalendar: null, locale: ko, appLabel: undefined });

    expect(label).toBe(ko.formatDayLabel({ year: 2026, monthCode: 'M10', day: 14 }, 3, 'gregory'));
  });

  it('appends the lunar date and the app label in that order', () => {
    const label = buildCellLabel({ cell: october14, calendar: gregory, secondaryCalendar: dangi, locale: ko, appLabel: '사내 휴무' });

    expect(label).toBe(
      [
        ko.formatDayLabel({ year: 2026, monthCode: 'M10', day: 14 }, 3, 'gregory'),
        `${ko.calendarNames.dangi} ${ko.formatDateLabel({ year: 2026, monthCode: 'M09', day: 4 }, 'dangi')}`,
        '사내 휴무',
      ].join(', '),
    );
  });
});
```

`packages/react/src/calendar/use-calendar.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { FIXED_TODAY, KoreanProvider, epochDayAt } from '../testing/korean-fixture';
import { type UseCalendarProps, useCalendar } from './use-calendar';

function renderCalendar(initialProps: UseCalendarProps) {
  return renderHook((props: UseCalendarProps) => useCalendar(props), { initialProps, wrapper: KoreanProvider });
}

describe('useCalendar', () => {
  describe('uncontrolled', () => {
    it('emits the selected date with its validity', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({ defaultValue: null, onValueChange });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));

      expect(result.current.value).toBe('2026-10-20');
      expect(onValueChange).toHaveBeenCalledWith('2026-10-20', { validity: { isValid: true, reasons: [] } });
    });

    it('ignores a day rejected by isDateDisabled', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({ isDateDisabled: (date) => date === '2026-10-20', onValueChange });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));

      expect(result.current.value).toBeNull();
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('controlled', () => {
    it('returns to the parent value when the parent keeps it unchanged', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({ value: '2026-10-01', onValueChange });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));

      expect(onValueChange).toHaveBeenCalledWith('2026-10-20', { validity: { isValid: true, reasons: [] } });
      expect(result.current.value).toBe('2026-10-01');
    });

    it('follows a new value from the parent without emitting a change', async () => {
      const onValueChange = vi.fn();
      const { result, rerender } = await renderCalendar({ value: '2026-10-01', onValueChange });

      await rerender({ value: '2026-11-11', onValueChange });

      expect(result.current.value).toBe('2026-11-11');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('reports a non-canonical value and treats it as empty', async () => {
      const onInvalidValue = vi.fn();
      const { result } = await renderCalendar({ value: '2026-1-5', onInvalidValue });

      expect(result.current.value).toBeNull();
      expect(onInvalidValue).toHaveBeenCalledWith('2026-1-5', 'invalid-date');
    });
  });

  describe('confirm mode', () => {
    it('keeps the committed value until commit and restores it on cancel', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({ defaultValue: '2026-10-01', commitMode: 'confirm', onValueChange });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));
      expect(result.current.value).toBe('2026-10-01');
      expect(result.current.getCellState(cellOf(result.current, '2026-10-20')).isSelected).toBe(true);

      await act(() => result.current.cancel());
      expect(result.current.getCellState(cellOf(result.current, '2026-10-01')).isSelected).toBe(true);

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-21')));
      await act(() => result.current.commit());
      expect(result.current.value).toBe('2026-10-21');
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });
  });

  it('opens on the month of today when there is no value', async () => {
    const { result } = await renderCalendar({});

    expect(result.current.navigation.focusedEpochDay).toBe(epochDayAt(FIXED_TODAY));
    expect(result.current.months).toHaveLength(1);
  });

  it('builds one grid per requested month', async () => {
    const { result } = await renderCalendar({ numberOfMonths: 2 });

    expect(result.current.months.map((month) => month.month.monthCode)).toEqual(['M10', 'M11']);
  });
});

function cellOf(api: ReturnType<typeof useCalendar>, isoDate: string) {
  const cell = api.months.flatMap((month) => month.weeks.flat()).find((candidate) => candidate.date === isoDate && !candidate.isOutsideMonth);
  if (!cell) throw new Error(`${isoDate} is not visible`);
  return cell;
}
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/calendar`
Expected: FAIL — `Failed to resolve import "./calendar-key-action"`, `"./cell-label"`, `"./use-calendar"`

- [ ] **Step 4: 구현**

`packages/react/src/calendar/calendar-key-action.ts`:
```ts
import type { NavigationEvent } from '@lunisolar-picker/core';

export type CalendarKeyAction = { readonly kind: 'navigate'; readonly event: NavigationEvent } | { readonly kind: 'select' };

const SELECT_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

// Constraint: WAI-ARIA APG Date Picker Grid 키 규칙 (스펙 10.1). Esc는 Popover·Sheet가 닫기로 처리하므로 여기서 잡지 않음
export function calendarKeyAction(key: string, isShiftPressed: boolean, isRightToLeft: boolean): CalendarKeyAction | null {
  if (SELECT_KEYS.has(key)) return { kind: 'select' };
  const forward = isRightToLeft ? -1 : 1;
  const pageUnit = isShiftPressed ? 'year' : 'month';
  switch (key) {
    case 'ArrowRight':
      return navigate({ type: 'focus.move', unit: 'day', amount: forward });
    case 'ArrowLeft':
      return navigate({ type: 'focus.move', unit: 'day', amount: -forward });
    case 'ArrowDown':
      return navigate({ type: 'focus.move', unit: 'week', amount: 1 });
    case 'ArrowUp':
      return navigate({ type: 'focus.move', unit: 'week', amount: -1 });
    case 'Home':
      return navigate({ type: 'focus.weekEdge', edge: 'start' });
    case 'End':
      return navigate({ type: 'focus.weekEdge', edge: 'end' });
    case 'PageDown':
      return navigate({ type: 'focus.move', unit: pageUnit, amount: 1 });
    case 'PageUp':
      return navigate({ type: 'focus.move', unit: pageUnit, amount: -1 });
    default:
      return null;
  }
}

function navigate(event: NavigationEvent): CalendarKeyAction {
  return { kind: 'navigate', event };
}
```

`packages/react/src/calendar/cell-state.ts`:
```ts
import type { EpochDay } from '@lunisolar-picker/calendar';
import { type MonthGridCell, type ResolvedConstraints, validateEpochDay } from '@lunisolar-picker/core';
import { type DataAttributeProps, stateAttributes } from '../contract/data-attributes';

export interface CellState {
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isDisabled: boolean;
  readonly isOutsideMonth: boolean;
  readonly isInRange: boolean;
  readonly isRangeStart: boolean;
  readonly isRangeEnd: boolean;
  readonly isPreview: boolean;
  readonly isFocused: boolean;
}

export type CellRenderInfo = MonthGridCell & CellState;

export interface CellSelectionFlags {
  readonly isSelected: boolean;
  readonly isInRange: boolean;
  readonly isRangeStart: boolean;
  readonly isRangeEnd: boolean;
  readonly isPreview: boolean;
  readonly isBlocked: boolean;
}

export interface CellStateInput {
  readonly todayEpochDay: EpochDay;
  readonly focusedEpochDay: EpochDay;
  readonly constraints: ResolvedConstraints;
  readonly selection: CellSelectionFlags;
}

export function buildCellState(cell: MonthGridCell, input: CellStateInput): CellState {
  return {
    isSelected: input.selection.isSelected,
    isToday: cell.epochDay === input.todayEpochDay,
    isDisabled:
      input.selection.isBlocked || cell.isOutsideSupportedRange || !validateEpochDay(cell.epochDay, input.constraints).isValid,
    isOutsideMonth: cell.isOutsideMonth,
    isInRange: input.selection.isInRange,
    isRangeStart: input.selection.isRangeStart,
    isRangeEnd: input.selection.isRangeEnd,
    isPreview: input.selection.isPreview,
    // Constraint: 두 달을 보여 주면 같은 날이 앞 달의 바깥 날짜로도 나옴. 탭으로 들어가는 칸은 그 달 안의 칸 하나뿐이어야 함
    isFocused: cell.epochDay === input.focusedEpochDay && !cell.isOutsideMonth,
  };
}

export function cellDataAttributes(cell: MonthGridCell, state: CellState): DataAttributeProps {
  return stateAttributes({
    selected: state.isSelected,
    today: state.isToday,
    disabled: state.isDisabled,
    outside: state.isOutsideMonth,
    'in-range': state.isInRange,
    'range-start': state.isRangeStart,
    'range-end': state.isRangeEnd,
    preview: state.isPreview,
    focused: state.isFocused,
    weekday: cell.weekday,
  });
}
```

`packages/react/src/calendar/cell-label.ts`:
```ts
import type { CalendarSystem } from '@lunisolar-picker/calendar';
import type { LocaleData, MonthGridCell } from '@lunisolar-picker/core';

export interface CellLabelInput {
  readonly cell: MonthGridCell;
  readonly calendar: CalendarSystem;
  readonly secondaryCalendar: CalendarSystem | null;
  readonly locale: LocaleData;
  readonly appLabel: string | undefined;
}

const LABEL_SEPARATOR = ', ';

// Goal: 스크린리더가 전체 날짜 → 음력 → 앱 정보(공휴일 등) 순서로 읽게 함 (스펙 10.1)
export function buildCellLabel(input: CellLabelInput): string {
  const { cell, calendar, secondaryCalendar, locale, appLabel } = input;
  const primaryFields = calendar.fromEpochDay(cell.epochDay);
  const parts = [primaryFields.isOk ? locale.formatDayLabel(primaryFields.value, cell.weekday, calendar.id) : cell.date];
  const secondaryFields = secondaryCalendar?.fromEpochDay(cell.epochDay);
  if (secondaryCalendar && secondaryFields?.isOk) {
    parts.push(`${locale.calendarNames[secondaryCalendar.id]} ${locale.formatDateLabel(secondaryFields.value, secondaryCalendar.id)}`);
  }
  if (appLabel) parts.push(appLabel);
  return parts.join(LABEL_SEPARATOR);
}
```

`packages/react/src/calendar/parsed-selection.ts`:
```ts
import { type CalendarSystem, parseDate } from '@lunisolar-picker/calendar';
import type { SelectedDay } from '@lunisolar-picker/core';

export type ParsedSelection = SelectedDay;

export const INVALID_SELECTION = 'invalid';
const EMPTY_SELECTION_KEY = 'empty';

export function parseSelection(
  input: string | null | undefined,
  calendars: readonly CalendarSystem[],
): ParsedSelection | null | typeof INVALID_SELECTION {
  if (input === null || input === undefined) return null;
  const parsed = parseDate(input, { calendars });
  if (!parsed.isOk) return INVALID_SELECTION;
  return { epochDay: parsed.value.epochDay, calendarId: parsed.value.calendar };
}

export function selectionKey(selected: SelectedDay | null): string {
  return selected === null ? EMPTY_SELECTION_KEY : `${selected.calendarId}:${selected.epochDay}`;
}
```

`packages/react/src/calendar/use-selection-sync.ts`:
```ts
import { useEffect, useRef } from 'react';

export interface SelectionSyncOptions {
  readonly controlledKey: string | undefined;
  readonly committedKey: string;
  readonly syncToControlled: () => void;
  readonly emitChange: () => void;
}

// Goal: 사용자 조작으로 바뀐 확정 값만 onValueChange로 알리고, 부모 value로 맞춘 변경은 알리지 않음.
// 부모가 변경을 받아들이지 않으면(value 그대로) 다음 렌더에서 부모 값으로 되돌림 (Review Focus 3)
export function useSelectionSync(options: SelectionSyncOptions): void {
  const lastKnownKeyRef = useRef(options.committedKey);
  useEffect(() => {
    if (options.committedKey === lastKnownKeyRef.current) return;
    lastKnownKeyRef.current = options.committedKey;
    options.emitChange();
  });
  useEffect(() => {
    if (options.controlledKey === undefined || options.controlledKey === options.committedKey) return;
    lastKnownKeyRef.current = options.controlledKey;
    options.syncToControlled();
  });
}
```

`packages/react/src/calendar/use-calendar-foundation.ts`:
```ts
import { type CalendarId, type CalendarSystem, type EpochDay, gregory } from '@lunisolar-picker/calendar';
import {
  type CommitMode,
  type MonthGrid,
  type MonthGridCell,
  type NavigationEvent,
  type NavigationState,
  type PickerContext,
  type RangeConstraints,
  buildMonthGrid,
  createNavigationState,
  findCalendar,
  navigationReducer,
  resolveConstraints,
  shiftVisibleMonth,
} from '@lunisolar-picker/core';
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { compactObject } from '../utilities/compact-object';
import type { PickerSettings } from '../settings/use-picker-settings';
import type { SharedPickerProps } from '../settings/shared-picker-props';
import { useControllableState } from '../utilities/use-controllable-state';
import { useStoreInstance } from '../store/use-store-instance';

export type SlideDirection = 'previous' | 'next';

export interface CalendarFoundationProps extends SharedPickerProps {
  readonly commitMode?: CommitMode;
  readonly numberOfMonths?: number;
  readonly displayCalendar?: CalendarId;
  readonly defaultDisplayCalendar?: CalendarId;
  readonly onDisplayCalendarChange?: (calendarId: CalendarId) => void;
  readonly getCellLabel?: (cell: MonthGridCell) => string | undefined;
}

export interface CalendarFoundation {
  readonly config: PickerSettings;
  readonly context: PickerContext;
  readonly calendar: CalendarSystem;
  readonly secondaryCalendar: CalendarSystem | null;
  readonly navigation: NavigationState;
  readonly months: readonly MonthGrid[];
  readonly slideDirection: SlideDirection | null;
  readonly idPrefix: string;
  sendNavigation(event: NavigationEvent): void;
  selectDisplayCalendar(calendarId: CalendarId): void;
  requestFocus(): void;
  consumeFocusRequest(): boolean;
}

const DEFAULT_NUMBER_OF_MONTHS = 1;
const GREGORIAN_ID: CalendarId = 'gregory';

export function useCalendarFoundation(
  props: CalendarFoundationProps,
  config: PickerSettings,
  constraintsInput: RangeConstraints,
  initialFocusEpochDay: EpochDay | null,
): CalendarFoundation {
  const idPrefix = useId();
  const [displayCalendarId, setDisplayCalendarId] = useControllableState<CalendarId>(props.displayCalendar, props.defaultDisplayCalendar ?? GREGORIAN_ID, props.onDisplayCalendarChange);
  const { min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed } = constraintsInput;
  // Constraint: 컨텍스트의 제약은 양력 기준. 표시 역법의 지원 범위는 core 리듀서가 boundsFor로 겹쳐 계산하므로 역법을 바꿔도 컨텍스트를 다시 만들지 않음 (계약 §2.2)
  const context = useMemo(
    (): PickerContext => ({
      calendars: config.calendars,
      constraints: resolveConstraints(
        compactObject({ min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed }),
        gregory,
        config.calendars,
      ),
      today: config.todayEpochDay,
      weekStartsOn: config.weekStartsOn,
      locale: config.locale,
      commitMode: props.commitMode ?? 'immediate',
      numberOfMonths: props.numberOfMonths ?? DEFAULT_NUMBER_OF_MONTHS,
    }),
    [config, min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed, props.commitMode, props.numberOfMonths],
  );
  const { state: navigation, send: sendNavigation } = useStoreInstance(
    () =>
      createNavigationState(context, {
        focusedEpochDay: initialFocusEpochDay ?? config.todayEpochDay,
        displayCalendarId,
      }),
    navigationReducer,
    context,
  );
  // Constraint: 화면은 navigation이 아는 역법으로 그림. prop이 바뀐 직후 한 렌더 동안 둘이 달라도 격자와 visibleMonth가 같은 역법을 쓰게 하기 위함
  const calendar = findCalendar(config.calendars, navigation.displayCalendarId);
  const secondaryCalendar = pickSecondaryCalendar(config.calendars, calendar);

  useEffect(() => {
    if (displayCalendarId !== navigation.displayCalendarId) sendNavigation({ type: 'calendar.set', calendarId: displayCalendarId });
  }, [displayCalendarId, navigation.displayCalendarId, sendNavigation]);

  const months = useMemo(
    () =>
      Array.from({ length: context.numberOfMonths }, (_, index) =>
        buildMonthGrid({
          calendar,
          month: shiftVisibleMonth(calendar, navigation.visibleMonth, index),
          weekStartsOn: context.weekStartsOn,
          secondaryCalendar,
        }),
      ),
    [calendar, secondaryCalendar, navigation.visibleMonth, context.numberOfMonths, context.weekStartsOn],
  );
  const monthStart = calendar.toEpochDay({ ...navigation.visibleMonth, day: 1 });
  const slideDirection = useSlideDirection(monthStart.isOk ? monthStart.value : config.todayEpochDay);

  const isFocusRequestedRef = useRef(false);
  const selectDisplayCalendar = useCallback(
    (calendarId: CalendarId) => {
      setDisplayCalendarId(calendarId);
      sendNavigation({ type: 'calendar.set', calendarId });
    },
    [setDisplayCalendarId, sendNavigation],
  );

  return {
    config,
    context,
    calendar,
    secondaryCalendar,
    navigation,
    months,
    slideDirection,
    idPrefix,
    sendNavigation,
    selectDisplayCalendar,
    requestFocus: () => {
      isFocusRequestedRef.current = true;
    },
    consumeFocusRequest: () => {
      const isRequested = isFocusRequestedRef.current;
      isFocusRequestedRef.current = false;
      return isRequested;
    },
  };
}

function pickSecondaryCalendar(calendars: readonly CalendarSystem[], displayed: CalendarSystem): CalendarSystem | null {
  if (calendars.length < 2) return null;
  return calendars.find((candidate) => candidate.id !== displayed.id) ?? null;
}

// Constraint: 렌더 중 ref를 갱신하지만 같은 입력이면 같은 방향을 돌려주므로 StrictMode 이중 렌더에서도 결과가 같음
function useSlideDirection(monthStartEpochDay: EpochDay): SlideDirection | null {
  const previousStartRef = useRef(monthStartEpochDay);
  const directionRef = useRef<SlideDirection | null>(null);
  if (previousStartRef.current !== monthStartEpochDay) {
    directionRef.current = monthStartEpochDay > previousStartRef.current ? 'next' : 'previous';
    previousStartRef.current = monthStartEpochDay;
  }
  return directionRef.current;
}
```

`packages/react/src/calendar/calendar-view-api.ts`:
```ts
import type { CalendarId, CalendarSystem, EpochDay } from '@lunisolar-picker/calendar';
import type { MonthGrid, MonthGridCell, NavigationEvent, NavigationState, PickerContext } from '@lunisolar-picker/core';
import type { ButtonHTMLAttributes, KeyboardEvent, MouseEvent, TableHTMLAttributes, TdHTMLAttributes } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { calendarKeyAction } from './calendar-key-action';
import { buildCellLabel } from './cell-label';
import { type CellSelectionFlags, type CellState, buildCellState, cellDataAttributes } from './cell-state';
import type { CalendarFoundation, SlideDirection } from './use-calendar-foundation';

export interface CellProps {
  readonly gridCell: TdHTMLAttributes<HTMLTableCellElement>;
  readonly button: ButtonHTMLAttributes<HTMLButtonElement>;
}

export interface CalendarViewApi {
  readonly mode: 'single' | 'range';
  readonly context: PickerContext;
  readonly navigation: NavigationState;
  readonly months: readonly MonthGrid[];
  readonly calendar: CalendarSystem;
  readonly secondaryCalendar: CalendarSystem | null;
  readonly slideDirection: SlideDirection | null;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly isTodayVisible: boolean;
  sendNavigation(event: NavigationEvent): void;
  selectDisplayCalendar(calendarId: CalendarId): void;
  selectEpochDay(epochDay: EpochDay): void;
  getCellState(cell: MonthGridCell): CellState;
  getCellProps(cell: MonthGridCell): CellProps;
  getGridProps(monthIndex: number): TableHTMLAttributes<HTMLTableElement>;
  headingId(monthIndex: number): string;
  consumeFocusRequest(): boolean;
}

export interface SelectionBehavior {
  readonly mode: 'single' | 'range';
  selectionFlags(cell: MonthGridCell): CellSelectionFlags;
  selectEpochDay(epochDay: EpochDay): void;
  extraButtonProps?(cell: MonthGridCell): ButtonHTMLAttributes<HTMLButtonElement>;
  shouldIgnoreClick?(event: MouseEvent<HTMLButtonElement>): boolean;
}

export interface InteractionFlags {
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly getCellLabel: ((cell: MonthGridCell) => string | undefined) | undefined;
}

export function createCalendarViewApi(
  foundation: CalendarFoundation,
  behavior: SelectionBehavior,
  flags: InteractionFlags,
): CalendarViewApi {
  const { context, navigation, months, calendar, secondaryCalendar } = foundation;
  const isInteractive = !flags.isDisabled && !flags.isReadOnly;

  function getCellState(cell: MonthGridCell): CellState {
    return buildCellState(cell, {
      todayEpochDay: context.today,
      focusedEpochDay: navigation.focusedEpochDay,
      constraints: context.constraints,
      selection: behavior.selectionFlags(cell),
    });
  }

  function selectEpochDay(epochDay: EpochDay): void {
    if (!isInteractive) return;
    behavior.selectEpochDay(epochDay);
    foundation.sendNavigation({ type: 'focus.set', epochDay });
  }

  function getCellProps(cell: MonthGridCell): CellProps {
    const state = getCellState(cell);
    return {
      gridCell: {
        role: 'gridcell',
        'aria-selected': state.isSelected,
        ...(state.isDisabled ? { 'aria-disabled': true } : {}),
        ...partAttributes('calendar-cell'),
        ...cellDataAttributes(cell, state),
      },
      button: {
        type: 'button',
        tabIndex: state.isFocused ? 0 : -1,
        'aria-label': buildCellLabel({ cell, calendar, secondaryCalendar, locale: context.locale, appLabel: flags.getCellLabel?.(cell) }),
        ...(state.isToday ? { 'aria-current': 'date' as const } : {}),
        ...(state.isDisabled || !isInteractive ? { 'aria-disabled': true } : {}),
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          if (state.isDisabled || behavior.shouldIgnoreClick?.(event)) return;
          selectEpochDay(cell.epochDay);
        },
        onFocus: () => {
          if (cell.epochDay !== navigation.focusedEpochDay && !cell.isOutsideMonth) {
            foundation.sendNavigation({ type: 'focus.set', epochDay: cell.epochDay });
          }
        },
        ...behavior.extraButtonProps?.(cell),
      },
    };
  }

  return {
    mode: behavior.mode,
    context,
    navigation,
    months,
    calendar,
    secondaryCalendar,
    slideDirection: foundation.slideDirection,
    isDisabled: flags.isDisabled,
    isReadOnly: flags.isReadOnly,
    isTodayVisible: months.some((month) => month.weeks.some((week) => week.some((cell) => !cell.isOutsideMonth && cell.epochDay === context.today))),
    sendNavigation: foundation.sendNavigation,
    selectDisplayCalendar: foundation.selectDisplayCalendar,
    selectEpochDay,
    getCellState,
    getCellProps,
    getGridProps: (monthIndex) => ({
      role: 'grid',
      'aria-labelledby': `${foundation.idPrefix}-heading-${monthIndex}`,
      ...(behavior.mode === 'range' ? { 'aria-multiselectable': true } : {}),
      onKeyDown: (event: KeyboardEvent<HTMLTableElement>) => {
        const action = calendarKeyAction(event.key, event.shiftKey, isRightToLeft(event.currentTarget));
        if (!action) return;
        event.preventDefault();
        if (action.kind === 'select') {
          selectEpochDay(navigation.focusedEpochDay);
          return;
        }
        foundation.requestFocus();
        foundation.sendNavigation(action.event);
      },
    }),
    headingId: (monthIndex) => `${foundation.idPrefix}-heading-${monthIndex}`,
    consumeFocusRequest: foundation.consumeFocusRequest,
  };
}

function isRightToLeft(element: Element): boolean {
  return getComputedStyle(element).direction === 'rtl';
}
```

`packages/react/src/calendar/use-calendar.ts`:
```ts
import { type DateString, type EpochDay } from '@lunisolar-picker/calendar';
import {
  type DateConstraints,
  type SingleSelectionEvent,
  type SingleSelectionState,
  type Validity,
  createSingleSelectionState,
  singleSelectionReducer,
  singleValue,
  validateEpochDay,
} from '@lunisolar-picker/core';
import { useEffect, useMemo } from 'react';
import { usePickerSettings } from '../settings/use-picker-settings';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { useStoreInstance } from '../store/use-store-instance';
import { type CalendarViewApi, createCalendarViewApi } from './calendar-view-api';
import { INVALID_SELECTION, parseSelection, selectionKey } from './parsed-selection';
import { type CalendarFoundationProps, useCalendarFoundation } from './use-calendar-foundation';
import { useSelectionSync } from './use-selection-sync';

export interface UseCalendarProps extends CalendarFoundationProps, DateConstraints {
  readonly value?: string | null;
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: DateString | null, details: ValueChangeDetails) => void;
}

export interface CalendarApi extends CalendarViewApi {
  readonly selection: SingleSelectionState;
  readonly value: DateString | null;
  readonly validity: Validity;
  sendSelection(event: SingleSelectionEvent): void;
  commit(): void;
  cancel(): void;
}

const VALID: Validity = { isValid: true, reasons: [] };
const MISSING_REQUIRED: Validity = { isValid: false, reasons: ['incomplete'] };

export function useCalendar(props: UseCalendarProps): CalendarApi {
  const config = usePickerSettings(props);
  const isControlled = props.value !== undefined;
  const parsedInput = parseSelection(isControlled ? props.value : props.defaultValue, config.calendars);
  const parsed = parsedInput === INVALID_SELECTION ? null : parsedInput;
  const rawInput = isControlled ? props.value : props.defaultValue;

  useEffect(() => {
    if (parsedInput === INVALID_SELECTION && typeof rawInput === 'string') props.onInvalidValue?.(rawInput, 'invalid-date');
  }, [parsedInput, rawInput, props.onInvalidValue]);

  const foundation = useCalendarFoundation(
    props,
    config,
    { min: props.min, max: props.max, isDateDisabled: props.isDateDisabled },
    parsed?.epochDay ?? null,
  );
  const { state: selection, send: sendSelection } = useStoreInstance(
    () =>
      createSingleSelectionState(parsed),
    singleSelectionReducer,
    foundation.context,
  );
  const value = singleValue(selection, foundation.context);
  const validity = useMemo(() => {
    if (selection.committed === null) return props.required ? MISSING_REQUIRED : VALID;
    return validateEpochDay(selection.committed.epochDay, foundation.context.constraints);
  }, [selection.committed, props.required, foundation.context.constraints]);

  useSelectionSync({
    controlledKey: isControlled ? selectionKey(parsed) : undefined,
    committedKey: selectionKey(selection.committed),
    syncToControlled: () => sendSelection({ type: 'value.sync', selected: parsed }),
    emitChange: () => props.onValueChange?.(value, { validity }),
  });

  const viewApi = createCalendarViewApi(
    foundation,
    {
      mode: 'single',
      selectionFlags: (cell) => {
        const isSelected = selection.draft?.epochDay === cell.epochDay;
        return { isSelected, isInRange: false, isRangeStart: false, isRangeEnd: false, isPreview: false, isBlocked: false };
      },
      selectEpochDay: (epochDay: EpochDay) => {
        if (!validateEpochDay(epochDay, foundation.context.constraints).isValid) return;
        sendSelection({ type: 'date.select', epochDay, calendarId: foundation.navigation.displayCalendarId });
      },
    },
    { isDisabled: props.disabled === true, isReadOnly: props.readOnly === true, getCellLabel: props.getCellLabel },
  );

  return {
    ...viewApi,
    selection,
    value,
    validity,
    sendSelection,
    commit: () => sendSelection({ type: 'commit' }),
    cancel: () => sendSelection({ type: 'cancel' }),
  };
}
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/calendar`
Expected: PASS. `ko.formatDateLabel`이 없어 타입 오류가 나면 계약 변경 제안 1을 M2 locale에 반영한 뒤 다시 실행한다.

- [ ] **Step 6: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add packages/react/src/calendar packages/react/src/testing/korean-fixture.tsx
ALLOW_COMMIT=1 git commit -m "feat: 단일·범위 달력이 함께 쓸 달력 기반과 단일 선택 훅 도입" -m "- 역법·제약·navigation·월 격자·포커스 요청을 한곳에 모아 범위 달력이 선택 store만 바꿔 얹을 수 있게 함.
- 부모가 값을 받아들이지 않으면 화면이 부모 값으로 돌아오도록 제어 값 동기화와 변경 알림을 분리함."
```

---

### Task 2: `Calendar` 부품 (격자·칸·헤더·키보드)

> 🟡 잠정: M3 `renderElement`·`mergeProps`의 병합 규칙에 따라 앱 prop과 부품 prop의 우선순위가 바뀔 수 있음

**Files:**
- Create: `packages/react/src/calendar/calendar-context.ts`, `split-props.ts`, `calendar-parts.tsx`, `calendar-layout.tsx`, `calendar-root.tsx`, `index.ts`
- Modify: `packages/react/src/contract/data-attributes.ts` (항목 추가), `packages/react/src/index.ts`
- Test: `packages/react/src/calendar/calendar-parts.test.tsx`

**Interfaces:**
- Consumes: Task 1 전부, M3 `renderElement`, `RenderProp`, `partAttributes`, `stateAttributes`, `expectNoAxeViolations`
- Produces:
  - `CalendarViewContext`, `useCalendarView(): CalendarViewApi`, `SingleCalendarContext`, `useSingleCalendar(): CalendarApi`
  - `splitProps(props, keys): readonly [picked, rest]`
  - 부품: `CalendarHeader`, `CalendarHeading({ monthIndex? })`, `CalendarPrevButton`, `CalendarNextButton`, `CalendarTodayButton`, `CalendarGrid({ monthIndex?, children?: (cell) => ReactNode })`, `CalendarHeadCell({ weekday })`, `CalendarCell({ cell, children?: ReactNode | ((info: CellRenderInfo) => ReactNode) })`
  - `CalendarLayout({ renderCell? })`, `CalendarRoot`, `CALENDAR_PROP_NAMES`
  - `Calendar` 네임스페이스: `{ Root, Header, Heading, PrevButton, NextButton, TodayButton, Grid, HeadCell, Cell, Layout }` (Task 3에서 `CalendarToggle`, `ViewButton`, `MonthGrid`, `YearGrid` 추가)
  - `PART_NAMES`에 `'calendar-months'`, `'calendar-month'`, `'calendar-cell-secondary'`, `'live-region'` 추가, `DATA_ATTRIBUTES`에 `'data-slide'` 추가 (계약 변경 제안 2)

- [ ] **Step 1: 계약 상수에 항목 추가**

`packages/react/src/contract/data-attributes.ts`의 `DATA_ATTRIBUTES` 배열 끝에 `'data-slide',`를, `PART_NAMES` 배열 끝에 다음을 추가한다:
```ts
  'calendar-months',
  'calendar-month',
  'calendar-cell-secondary',
  'live-region',
```

- [ ] **Step 2: 실패하는 테스트 작성**

`packages/react/src/calendar/calendar-parts.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { KoreanProvider, dayLabel } from '../testing/korean-fixture';
import { Calendar } from './index';

async function renderCalendar(element: ReactElement) {
  return render(<KoreanProvider>{element}</KoreanProvider>);
}

describe('Calendar', () => {
  describe('grid semantics', () => {
    it('exposes a labelled grid with selected, current and disabled cells', async () => {
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20" isDateDisabled={(date) => date === '2026-10-21'} />,
      );

      const grid = screen.getByRole('grid');
      await expect.element(grid).toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory'));
      await expect.element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') })).toHaveAttribute('aria-selected', 'true');
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-14') })).toHaveAttribute('aria-current', 'date');
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-21') })).toHaveAttribute('aria-disabled', 'true');
    });

    it('keeps exactly one tabbable cell when two months share an outside day', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-31" numberOfMonths={2} />);

      const tabbable = screen.container.querySelectorAll('[data-lsp-part="calendar-cell"] > button[tabindex="0"]');
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]?.getAttribute('aria-label')).toBe(dayLabel('2026-10-31'));
      expect(screen.getByRole('grid').all()).toHaveLength(2);
    });

    it('has no axe violations', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);

      await expectNoAxeViolations(screen.container);
    });
  });

  describe('keyboard', () => {
    it.each([
      ['{ArrowRight}', '2026-10-21'],
      ['{ArrowLeft}', '2026-10-19'],
      ['{ArrowDown}', '2026-10-27'],
      ['{ArrowUp}', '2026-10-13'],
      ['{Home}', '2026-10-18'],
      ['{End}', '2026-10-24'],
      ['{PageDown}', '2026-11-20'],
      ['{PageUp}', '2026-09-20'],
      ['{Shift>}{PageDown}{/Shift}', '2027-10-20'],
      ['{Shift>}{PageUp}{/Shift}', '2025-10-20'],
    ])('moves focus with %s to %s', async (keys, expectedDate) => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);
      (screen.getByRole('button', { name: dayLabel('2026-10-20') }).element() as HTMLElement).focus();

      await userEvent.keyboard(keys);

      expect(document.activeElement?.getAttribute('aria-label')).toBe(dayLabel(expectedDate));
    });

    it('selects the focused day with Enter and Space', async () => {
      const onValueChange = vi.fn();
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" onValueChange={onValueChange} />);
      (screen.getByRole('button', { name: dayLabel('2026-10-20') }).element() as HTMLElement).focus();

      await userEvent.keyboard('{ArrowRight}{Enter}');
      await userEvent.keyboard('{ArrowRight}[Space]');

      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['2026-10-21', '2026-10-22']);
    });
  });

  describe('navigation buttons', () => {
    it('moves between months and back to today', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M11' }, 'gregory'));

      await screen.getByRole('button', { name: ko.labels.today }).click();
      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory'));
    });

    it('marks the today button disabled while today is visible', async () => {
      const screen = await renderCalendar(<Calendar.Root />);

      await expect.element(screen.getByRole('button', { name: ko.labels.today })).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('cell customization', () => {
    it('renders app content in a cell and appends the app label to its name', async () => {
      const holidays: Record<string, string> = { '2026-10-09': '한글날' };
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20" getCellLabel={(cell) => holidays[cell.date]}>
          <Calendar.Grid>
            {(cell) => (
              <Calendar.Cell key={cell.epochDay} cell={cell}>
                {(info) => (
                  <>
                    {info.day}
                    {holidays[info.date] ? <i data-testid="holiday-dot" /> : null}
                  </>
                )}
              </Calendar.Cell>
            )}
          </Calendar.Grid>
        </Calendar.Root>,
      );

      await expect.element(screen.getByRole('button', { name: `${dayLabel('2026-10-09')}, 한글날` })).toBeVisible();
      expect(screen.getByTestId('holiday-dot').all()).toHaveLength(1);
    });

    it('submits the value through a hidden input when named', async () => {
      const screen = await renderCalendar(<Calendar.Root name="installedOn" defaultValue="2026-10-20" />);

      expect(screen.container.querySelector<HTMLInputElement>('input[type="hidden"][name="installedOn"]')?.value).toBe('2026-10-20');
    });
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/calendar/calendar-parts.test.tsx`
Expected: FAIL — `Failed to resolve import "./index"`

- [ ] **Step 4: 구현**

`packages/react/src/calendar/calendar-context.ts`:
```ts
import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { createContext, useContext } from 'react';
import type { CalendarViewApi } from './calendar-view-api';
import type { CalendarApi } from './use-calendar';

export const CalendarViewContext = createContext<CalendarViewApi | null>(null);
export const SingleCalendarContext = createContext<CalendarApi | null>(null);

export function useCalendarView(): CalendarViewApi {
  const api = useContext(CalendarViewContext);
  if (!api) throw new LunisolarPickerError('Calendar parts must be rendered inside Calendar.Root or RangeCalendar.Root');
  return api;
}

export function useSingleCalendar(): CalendarApi {
  const api = useContext(SingleCalendarContext);
  if (!api) throw new LunisolarPickerError('this part must be rendered inside Calendar.Root');
  return api;
}
```

`packages/react/src/calendar/split-props.ts`:
```ts
export function splitProps<Props extends object, Key extends keyof Props>(
  props: Props,
  keys: readonly Key[],
): readonly [Pick<Props, Key>, Omit<Props, Key>] {
  const picked: Partial<Pick<Props, Key>> = {};
  const rest: Record<PropertyKey, unknown> = { ...props };
  for (const key of keys) {
    if (key in props) picked[key] = props[key];
    delete rest[key];
  }
  return [picked as Pick<Props, Key>, rest as Omit<Props, Key>];
}
```

`packages/react/src/calendar/calendar-parts.tsx`:
```tsx
import type { Weekday } from '@lunisolar-picker/core';
import { shiftVisibleMonth } from '@lunisolar-picker/core';
import { Fragment, type HTMLAttributes, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type TableHTMLAttributes } from 'react';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { useCalendarView } from './calendar-context';
import type { CalendarViewApi } from './calendar-view-api';
import type { CellRenderInfo } from './cell-state';
import type { MonthGridCell } from '@lunisolar-picker/core';

const DAYS_PER_WEEK = 7;

export interface CalendarHeaderProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, CalendarViewApi>;
}

export function CalendarHeader({ render, ...domProps }: CalendarHeaderProps): ReactElement {
  const api = useCalendarView();
  return renderElement('div', render, { ...domProps, ...partAttributes('calendar-header') }, api);
}

export interface CalendarHeadingProps extends HTMLAttributes<HTMLSpanElement> {
  readonly monthIndex?: number;
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, CalendarViewApi>;
}

export function CalendarHeading({ monthIndex = 0, render, ...domProps }: CalendarHeadingProps): ReactElement {
  const api = useCalendarView();
  const month = api.months[monthIndex];
  const text = month ? api.context.locale.formatHeading(month.month, api.calendar.id) : '';
  return renderElement('span', render, { ...domProps, id: api.headingId(monthIndex), 'aria-live': 'polite', ...partAttributes('calendar-heading'), children: text }, api);
}

type NavigationDirection = -1 | 1;

export interface CalendarNavButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, CalendarViewApi>;
}

export function CalendarPrevButton(props: CalendarNavButtonProps): ReactElement {
  return <CalendarNavButton {...props} direction={-1} />;
}

export function CalendarNextButton(props: CalendarNavButtonProps): ReactElement {
  return <CalendarNavButton {...props} direction={1} />;
}

function CalendarNavButton({ direction, render, children, ...domProps }: CalendarNavButtonProps & { readonly direction: NavigationDirection }): ReactElement {
  const api = useCalendarView();
  const { labels } = api.context.locale;
  const isPossible = canNavigate(api, direction);
  const label = api.navigation.view === 'years'
    ? direction < 0 ? labels.previousYears : labels.nextYears
    : direction < 0 ? labels.previousMonth : labels.nextMonth;
  return renderElement('button', render, {
      ...domProps,
      type: 'button',
      'aria-label': label,
      ...(isPossible ? {} : { 'aria-disabled': true }),
      ...partAttributes('calendar-nav-button'),
      ...stateAttributes({ disabled: !isPossible }),
      onClick: () => {
        if (isPossible) navigateBy(api, direction);
      },
      children: children ?? <span aria-hidden="true">{direction < 0 ? '‹' : '›'}</span>,
    }, api);
}

function canNavigate(api: CalendarViewApi, direction: NavigationDirection): boolean {
  const { navigation, calendar } = api;
  if (navigation.view === 'days') {
    const shifted = shiftVisibleMonth(calendar, navigation.visibleMonth, direction);
    return shifted.year !== navigation.visibleMonth.year || shifted.monthCode !== navigation.visibleMonth.monthCode;
  }
  const firstYear = calendar.fromEpochDay(calendar.supportedRange.min);
  const lastYear = calendar.fromEpochDay(calendar.supportedRange.max);
  if (!firstYear.isOk || !lastYear.isOk) return false;
  const pivot = navigation.view === 'months' ? navigation.visibleMonth.year : navigation.yearPageStart;
  return direction < 0 ? pivot > firstYear.value.year : pivot < lastYear.value.year;
}

function navigateBy(api: CalendarViewApi, direction: NavigationDirection): void {
  const { navigation } = api;
  if (navigation.view === 'days') api.sendNavigation({ type: 'month.shift', amount: direction });
  else if (navigation.view === 'months') api.sendNavigation({ type: 'year.pick', year: navigation.visibleMonth.year + direction });
  else api.sendNavigation({ type: 'yearPage.shift', amount: direction });
}

export function CalendarTodayButton({ render, children, ...domProps }: CalendarNavButtonProps): ReactElement {
  const api = useCalendarView();
  return renderElement('button', render, {
      ...domProps,
      type: 'button',
      ...(api.isTodayVisible ? { 'aria-disabled': true } : {}),
      ...partAttributes('calendar-today-button'),
      ...stateAttributes({ disabled: api.isTodayVisible }),
      onClick: () => {
        if (!api.isTodayVisible) api.sendNavigation({ type: 'today.go' });
      },
      children: children ?? api.context.locale.labels.today,
    }, api);
}

export interface CalendarGridProps extends Omit<TableHTMLAttributes<HTMLTableElement>, 'children'> {
  readonly monthIndex?: number;
  readonly children?: (cell: MonthGridCell) => ReactNode;
  readonly render?: RenderProp<TableHTMLAttributes<HTMLTableElement>, CalendarViewApi>;
}

export function CalendarGrid({ monthIndex = 0, children, render, ...domProps }: CalendarGridProps): ReactElement | null {
  const api = useCalendarView();
  const month = api.months[monthIndex];
  if (api.navigation.view !== 'days' || !month) return null;
  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, offset) => ((api.context.weekStartsOn + offset) % DAYS_PER_WEEK) as Weekday);
  return renderElement('table', render, {
      ...domProps,
      ...api.getGridProps(monthIndex),
      ...partAttributes('calendar-grid'),
      children: (
        <>
          <thead>
            <tr>
              {weekdays.map((weekday) => (
                <CalendarHeadCell key={weekday} weekday={weekday} />
              ))}
            </tr>
          </thead>
          {/* Constraint: 달이 바뀔 때마다 tbody를 다시 마운트해야 CSS 슬라이드 애니메이션이 다시 시작됨 */}
          <tbody key={`${month.month.year}-${month.month.monthCode}`} {...stateAttributes({ slide: api.slideDirection ?? undefined })}>
            {month.weeks.map((week) => (
              <tr key={week[0]?.epochDay}>
                {week.map((cell) =>
                  children ? <Fragment key={cell.epochDay}>{children(cell)}</Fragment> : <CalendarCell key={cell.epochDay} cell={cell} />,
                )}
              </tr>
            ))}
          </tbody>
        </>
      ),
    }, api);
}

export interface CalendarHeadCellProps extends HTMLAttributes<HTMLTableCellElement> {
  readonly weekday: Weekday;
}

export function CalendarHeadCell({ weekday, ...domProps }: CalendarHeadCellProps): ReactElement {
  const { weekdays } = useCalendarView().context.locale;
  return (
    <th scope="col" abbr={weekdays.long[weekday]} {...domProps} {...partAttributes('calendar-head-cell')} {...stateAttributes({ weekday: weekday })}>
      {weekdays.narrow[weekday]}
    </th>
  );
}

export interface CalendarCellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly cell: MonthGridCell;
  readonly children?: ReactNode | ((info: CellRenderInfo) => ReactNode);
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, CellRenderInfo>;
}

export function CalendarCell({ cell, children, render, ...buttonProps }: CalendarCellProps): ReactElement {
  const api = useCalendarView();
  const state = api.getCellState(cell);
  const info: CellRenderInfo = { ...cell, ...state };
  const { gridCell, button } = api.getCellProps(cell);
  const content = typeof children === 'function' ? children(info) : (children ?? <DefaultCellContent info={info} />);
  const focusOnRequest = (element: HTMLButtonElement | null): void => {
    if (element && state.isFocused && api.consumeFocusRequest()) element.focus();
  };
  return (
    <td {...gridCell}>
      {renderElement('button', render, { ...buttonProps, ...button, ref: focusOnRequest, children: content }, info)}
    </td>
  );
}

function DefaultCellContent({ info }: { readonly info: CellRenderInfo }): ReactElement {
  const { locale } = useCalendarView().context;
  return (
    <>
      <span>{info.day}</span>
      {info.secondary ? (
        <span aria-hidden="true" {...partAttributes('calendar-cell-secondary')}>
          {locale.formatSecondaryLabel(info.secondary)}
        </span>
      ) : null}
    </>
  );
}
```

`packages/react/src/calendar/calendar-layout.tsx`:
```tsx
import type { ReactElement, ReactNode } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { useCalendarView } from './calendar-context';
import {
  CalendarCell,
  CalendarGrid,
  CalendarHeader,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
  CalendarTodayButton,
} from './calendar-parts';
import type { CellRenderInfo } from './cell-state';

export interface CalendarLayoutProps {
  readonly renderCell?: (info: CellRenderInfo) => ReactNode;
}

// Goal: 완성형과 Root 기본 화면이 같은 배치를 쓰고, 앱은 이 소스를 복사해 고쳐 쓸 수 있음 (스펙 7.5)
export function CalendarLayout({ renderCell }: CalendarLayoutProps): ReactElement {
  const api = useCalendarView();
  return (
    <>
      <CalendarHeader>
        <CalendarPrevButton />
        <CalendarHeading />
        <CalendarNextButton />
        <CalendarTodayButton />
      </CalendarHeader>
      <div {...partAttributes('calendar-months')}>
        {api.months.map((month, monthIndex) => (
          <div key={`${month.month.year}-${month.month.monthCode}`} {...partAttributes('calendar-month')}>
            {monthIndex > 0 ? <CalendarHeading monthIndex={monthIndex} /> : null}
            <CalendarGrid monthIndex={monthIndex}>
              {renderCell
                ? (cell) => (
                    <CalendarCell key={cell.epochDay} cell={cell}>
                      {renderCell}
                    </CalendarCell>
                  )
                : undefined}
            </CalendarGrid>
          </div>
        ))}
      </div>
    </>
  );
}
```

`packages/react/src/calendar/calendar-root.tsx`:
```tsx
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { CalendarViewContext, SingleCalendarContext } from './calendar-context';
import { CalendarLayout } from './calendar-layout';
import { splitProps } from './split-props';
import { type CalendarApi, type UseCalendarProps, useCalendar } from './use-calendar';

export const CALENDAR_PROP_NAMES = [
  'locale', 'timeZone', 'today', 'weekStartsOn', 'calendars', 'disabled', 'readOnly', 'required', 'invalid', 'name', 'form',
  'onInvalidValue', 'min', 'max', 'isDateDisabled', 'value', 'defaultValue', 'onValueChange', 'commitMode', 'numberOfMonths',
  'displayCalendar', 'defaultDisplayCalendar', 'onDisplayCalendarChange', 'getCellLabel',
] as const satisfies readonly (keyof UseCalendarProps)[];

type MissingCalendarPropName = Exclude<keyof UseCalendarProps, (typeof CALENDAR_PROP_NAMES)[number]>;
// Constraint: 훅 prop을 하나라도 빠뜨리면 DOM으로 새어 나가므로 컴파일 시점에 목록 완전성을 검사함
const isCalendarPropListComplete: [MissingCalendarPropName] extends [never] ? true : false = true;
void isCalendarPropListComplete;

export type CalendarRootProps = UseCalendarProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof UseCalendarProps | 'children'> & {
    readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, CalendarApi>;
    readonly children?: ReactNode;
  };

export function CalendarRoot(props: CalendarRootProps): ReactElement {
  const [hookProps, { render, children, ...domProps }] = splitProps(props, CALENDAR_PROP_NAMES);
  const api = useCalendar(hookProps);
  return (
    <CalendarViewContext.Provider value={api}>
      <SingleCalendarContext.Provider value={api}>
        {renderElement('div', render, {
            ...domProps,
            ...partAttributes('calendar'),
            ...stateAttributes({
              calendar: api.navigation.displayCalendarId,
              view: api.navigation.view,
              disabled: api.isDisabled,
              invalid: hookProps.invalid === true || !api.validity.isValid,
            }),
            children: (
              <>
                {children ?? <CalendarLayout />}
                {hookProps.name ? <input type="hidden" name={hookProps.name} form={hookProps.form} value={api.value ?? ''} /> : null}
              </>
            ),
          }, api)}
      </SingleCalendarContext.Provider>
    </CalendarViewContext.Provider>
  );
}
```

`packages/react/src/calendar/index.ts`:
```ts
import { CalendarCell, CalendarGrid, CalendarHeadCell, CalendarHeader, CalendarHeading, CalendarNextButton, CalendarPrevButton, CalendarTodayButton } from './calendar-parts';
import { CalendarLayout } from './calendar-layout';
import { CalendarRoot } from './calendar-root';

export const Calendar = {
  Root: CalendarRoot,
  Header: CalendarHeader,
  Heading: CalendarHeading,
  PrevButton: CalendarPrevButton,
  NextButton: CalendarNextButton,
  TodayButton: CalendarTodayButton,
  Grid: CalendarGrid,
  HeadCell: CalendarHeadCell,
  Cell: CalendarCell,
  Layout: CalendarLayout,
} as const;

export type { CalendarApi, UseCalendarProps } from './use-calendar';
export type { CalendarViewApi, CellProps } from './calendar-view-api';
export type { CellRenderInfo, CellState } from './cell-state';
export type { CalendarRootProps } from './calendar-root';
export type { CalendarLayoutProps } from './calendar-layout';
export { useCalendar } from './use-calendar';
export { useCalendarView, useSingleCalendar } from './calendar-context';
```

`packages/react/src/index.ts` 끝에 추가:
```ts
export * from './calendar/index';
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/calendar`
Expected: PASS

- [ ] **Step 6: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 키보드와 스크린리더로 조작할 수 있는 단일 달력 부품 제공" -m "- APG 날짜 격자 규칙대로 roving tabindex와 키 이동을 넣고, 두 달 표시에서도 탭으로 들어가는 칸이 하나뿐이게 함.
- 공휴일 표시처럼 앱이 칸 내용과 접근성 이름을 덧붙일 수 있도록 칸 렌더 함수와 getCellLabel을 열어 둠."
```

---

### Task 3: 양·음력 토글, 월·연 보기, 월 전환 모션

> 🟡 잠정: M2 navigation의 `view.set`·`month.pick`·`year.pick`·`yearPage.shift` 동작(보기 전환 규칙)과 `listMonthsOfYear`·`listYearPage` 반환 형태에 따라 바뀔 수 있음

**Files:**
- Create: `packages/react/src/calendar/month-button-grid.tsx`, `packages/react/src/calendar/calendar-view-parts.tsx`
- Modify: `packages/react/src/calendar/calendar-layout.tsx`, `packages/react/src/calendar/index.ts`
- Test: `packages/react/src/calendar/calendar-view-parts.test.tsx`

**Interfaces:**
- Consumes: Task 1·2, core `listMonthsOfYear`, `listYearPage`, `YEAR_PAGE_SIZE`, `VisibleMonth`
- Produces:
  - `interface ButtonGridItem { key; label; accessibleName; isSelected; isDisabled; onPick() }`, `MonthButtonGrid({ items, columnCount, label, part })`
  - `CalendarToggle`, `CalendarViewButton`, `CalendarMonthGrid`, `CalendarYearGrid`
  - `Calendar.CalendarToggle`, `Calendar.ViewButton`, `Calendar.MonthGrid`, `Calendar.YearGrid`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/calendar/calendar-view-parts.test.tsx`:
```tsx
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { KoreanProvider, dayLabel } from '../testing/korean-fixture';
import { Calendar } from './index';

describe('Calendar views', () => {
  describe('lunar toggle', () => {
    it('shows the toggle only when a second calendar is provided', async () => {
      const solarOnly = await render(<KoreanProvider><Calendar.Root /></KoreanProvider>);
      expect(solarOnly.container.querySelector('[data-lsp-part="calendar-toggle"]')).toBeNull();

      const withLunar = await render(<KoreanProvider hasLunar><Calendar.Root /></KoreanProvider>);
      await expect.element(withLunar.getByRole('button', { name: ko.calendarNames.dangi })).toBeVisible();
    });

    it('keeps the selected and focused day and emits nothing when switching calendars', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root defaultValue="2026-10-14" onValueChange={onValueChange} />
        </KoreanProvider>,
      );

      await screen.getByRole('button', { name: ko.calendarNames.dangi }).click();

      const lunarHeading = ko.formatHeading({ year: 2026, monthCode: 'M09' }, 'dangi');
      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(lunarHeading);
      const selected = screen.container.querySelector('[data-lsp-part="calendar-cell"][data-selected] > button');
      expect(selected?.getAttribute('aria-label')).toContain(dayLabel('2026-10-14', dangi));
      expect(selected?.getAttribute('tabindex')).toBe('0');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('prints the secondary date under each in-month day', async () => {
      const screen = await render(<KoreanProvider hasLunar><Calendar.Root defaultValue="2026-10-14" /></KoreanProvider>);

      const secondaryLabels = screen.container.querySelectorAll('[data-lsp-part="calendar-cell-secondary"]');
      expect(secondaryLabels.length).toBeGreaterThanOrEqual(31);
    });
  });

  describe('month and year views', () => {
    it('drills from days to months to years and back to days', async () => {
      const screen = await render(<KoreanProvider><Calendar.Root defaultValue="2026-10-14" /></KoreanProvider>);

      await screen.getByRole('button', { name: ko.labels.chooseMonth }).click();
      await expect.element(screen.getByRole('grid', { name: ko.labels.chooseMonth })).toBeVisible();

      await screen.getByRole('button', { name: ko.labels.chooseMonth }).click();
      await screen.getByRole('button', { name: '2031' }).click();
      await screen.getByRole('button', { name: ko.formatMonthName({ year: 2031, monthCode: 'M03' }, 'gregory') }).click();

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(ko.formatHeading({ year: 2031, monthCode: 'M03' }, 'gregory'));
    });

    it('lists the leap month in the lunar month view', async () => {
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root defaultValue="2025-08-01" defaultDisplayCalendar="dangi" />
        </KoreanProvider>,
      );

      await screen.getByRole('button', { name: ko.labels.chooseMonth }).click();

      await expect.element(screen.getByRole('button', { name: ko.formatMonthName({ year: 2025, monthCode: 'M06L' }, 'dangi') })).toBeVisible();
    });

    it('moves focus between month buttons with arrow keys', async () => {
      const screen = await render(<KoreanProvider><Calendar.Root defaultValue="2026-10-14" /></KoreanProvider>);
      await screen.getByRole('button', { name: ko.labels.chooseMonth }).click();
      (screen.getByRole('button', { name: ko.formatMonthName({ year: 2026, monthCode: 'M07' }, 'gregory') }).element() as HTMLElement).focus();

      await userEvent.keyboard('{ArrowDown}{ArrowRight}');

      expect(document.activeElement?.getAttribute('aria-label')).toBe(ko.formatMonthName({ year: 2026, monthCode: 'M11' }, 'gregory'));
    });
  });

  describe('month transition', () => {
    it('marks the grid body with the slide direction after moving forward', async () => {
      const screen = await render(<KoreanProvider><Calendar.Root defaultValue="2026-10-14" /></KoreanProvider>);

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();

      expect(screen.container.querySelector('tbody')?.getAttribute('data-slide')).toBe('next');
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/calendar/calendar-view-parts.test.tsx`
Expected: FAIL — 토글·보기 버튼을 찾지 못함

- [ ] **Step 3: 구현**

`packages/react/src/calendar/month-button-grid.tsx`:
```tsx
import { type KeyboardEvent, type ReactElement, useState } from 'react';
import { partAttributes, type PartName, stateAttributes } from '../contract/data-attributes';

export interface ButtonGridItem {
  readonly key: string;
  readonly label: string;
  readonly accessibleName: string;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
  onPick(): void;
}

export interface MonthButtonGridProps {
  readonly items: readonly ButtonGridItem[];
  readonly columnCount: number;
  readonly label: string;
  readonly part: PartName;
}

const HOME_INDEX = 0;

// Goal: 월·연 격자도 날짜 격자처럼 화살표로 이동하는 roving tabindex를 씀 (스펙 10.1)
export function MonthButtonGrid({ items, columnCount, label, part }: MonthButtonGridProps): ReactElement {
  const selectedIndex = Math.max(HOME_INDEX, items.findIndex((item) => item.isSelected));
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex);
  const rows = Array.from({ length: Math.ceil(items.length / columnCount) }, (_, rowIndex) =>
    items.slice(rowIndex * columnCount, (rowIndex + 1) * columnCount),
  );

  function moveFocus(event: KeyboardEvent<HTMLTableElement>): void {
    const offsetByKey: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columnCount, ArrowUp: -columnCount };
    const nextIndex =
      event.key === 'Home' ? HOME_INDEX : event.key === 'End' ? items.length - 1 : focusedIndex + (offsetByKey[event.key] ?? Number.NaN);
    if (Number.isNaN(nextIndex) || nextIndex < 0 || nextIndex >= items.length) return;
    event.preventDefault();
    setFocusedIndex(nextIndex);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[nextIndex]?.focus();
  }

  return (
    <table role="grid" aria-label={label} onKeyDown={moveFocus} {...partAttributes(part)}>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={row[0]?.key ?? rowIndex}>
            {row.map((item, columnIndex) => {
              const index = rowIndex * columnCount + columnIndex;
              return (
                <td key={item.key} role="gridcell" aria-selected={item.isSelected} {...stateAttributes({ selected: item.isSelected, disabled: item.isDisabled })}>
                  <button
                    type="button"
                    tabIndex={index === focusedIndex ? 0 : -1}
                    aria-label={item.accessibleName}
                    {...(item.isDisabled ? { 'aria-disabled': true } : {})}
                    onFocus={() => setFocusedIndex(index)}
                    onClick={() => {
                      if (!item.isDisabled) item.onPick();
                    }}
                  >
                    {item.label}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`packages/react/src/calendar/calendar-view-parts.tsx`:
```tsx
import { type CalendarId, isWithinSupportedRange } from '@lunisolar-picker/calendar';
import { YEAR_PAGE_SIZE, listMonthsOfYear, listYearPage } from '@lunisolar-picker/core';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement } from 'react';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { useCalendarView } from './calendar-context';
import type { CalendarViewApi } from './calendar-view-api';
import { MonthButtonGrid } from './month-button-grid';

const MONTH_COLUMN_COUNT = 3;
const YEAR_COLUMN_COUNT = 4;

export interface CalendarToggleProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, CalendarViewApi>;
}

export function CalendarToggle({ render, ...domProps }: CalendarToggleProps): ReactElement | null {
  const api = useCalendarView();
  const calendarIds = api.context.calendars.map((calendar) => calendar.id);
  if (calendarIds.length < 2) return null;
  return renderElement('div', render, {
      ...domProps,
      role: 'group',
      ...partAttributes('calendar-toggle'),
      children: calendarIds.map((calendarId: CalendarId) => (
        <button
          key={calendarId}
          type="button"
          aria-pressed={api.navigation.displayCalendarId === calendarId}
          onClick={() => api.selectDisplayCalendar(calendarId)}
        >
          {api.context.locale.calendarNames[calendarId]}
        </button>
      )),
    }, api);
}

export interface CalendarViewButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, CalendarViewApi>;
}

export function CalendarViewButton({ render, ...domProps }: CalendarViewButtonProps): ReactElement {
  const api = useCalendarView();
  const { navigation, context, calendar } = api;
  const text =
    navigation.view === 'days'
      ? context.locale.formatHeading(navigation.visibleMonth, calendar.id)
      : navigation.view === 'months'
        ? String(navigation.visibleMonth.year)
        : `${navigation.yearPageStart} – ${navigation.yearPageStart + YEAR_PAGE_SIZE - 1}`;
  return renderElement('button', render, {
      ...domProps,
      type: 'button',
      'aria-label': context.locale.labels.chooseMonth,
      ...partAttributes('calendar-view-button'),
      ...stateAttributes({ view: navigation.view }),
      onClick: () => api.sendNavigation({ type: 'view.set', view: navigation.view === 'days' ? 'months' : 'years' }),
      children: <span id={api.headingId(0)}>{text}</span>,
    }, api);
}

export function CalendarMonthGrid(): ReactElement | null {
  const api = useCalendarView();
  const { navigation, calendar, context } = api;
  if (navigation.view !== 'months') return null;
  const items = listMonthsOfYear(calendar, navigation.visibleMonth.year).map((month) => {
    const name = context.locale.formatMonthName(month, calendar.id);
    const firstDay = calendar.toEpochDay({ ...month, day: 1 });
    return {
      key: month.monthCode,
      label: name,
      accessibleName: name,
      isSelected: month.monthCode === navigation.visibleMonth.monthCode,
      isDisabled: !firstDay.isOk || !isWithinSupportedRange(calendar, firstDay.value),
      onPick: () => api.sendNavigation({ type: 'month.pick', month }),
    };
  });
  return <MonthButtonGrid items={items} columnCount={MONTH_COLUMN_COUNT} label={context.locale.labels.chooseMonth} part="calendar-month-grid" />;
}

export function CalendarYearGrid(): ReactElement | null {
  const api = useCalendarView();
  const { navigation, calendar, context } = api;
  if (navigation.view !== 'years') return null;
  const items = listYearPage(calendar, navigation.yearPageStart, YEAR_PAGE_SIZE).map((year) => ({
    key: String(year),
    label: String(year),
    accessibleName: String(year),
    isSelected: year === navigation.visibleMonth.year,
    isDisabled: false,
    onPick: () => api.sendNavigation({ type: 'year.pick', year }),
  }));
  return <MonthButtonGrid items={items} columnCount={YEAR_COLUMN_COUNT} label={context.locale.labels.year} part="calendar-year-grid" />;
}
```

`packages/react/src/calendar/calendar-layout.tsx`의 `CalendarHeader` 블록을 다음으로 바꾸고, `calendar-months` div 다음에 월·연 격자를 추가한다:
```tsx
      <CalendarHeader>
        <CalendarPrevButton />
        <CalendarViewButton />
        <CalendarNextButton />
        <CalendarToggle />
        <CalendarTodayButton />
      </CalendarHeader>
```
```tsx
      <CalendarMonthGrid />
      <CalendarYearGrid />
```
import에 `import { CalendarMonthGrid, CalendarToggle, CalendarViewButton, CalendarYearGrid } from './calendar-view-parts';`를 추가하고 `CalendarHeading` import는 그대로 둔다(둘째 달부터 쓴다). 첫 달의 제목은 `CalendarViewButton` 안의 `span`(id = `headingId(0)`)이 맡으므로 격자 이름도 그 텍스트가 된다.

`packages/react/src/calendar/index.ts`의 `Calendar` 객체에 추가:
```ts
  CalendarToggle,
  ViewButton: CalendarViewButton,
  MonthGrid: CalendarMonthGrid,
  YearGrid: CalendarYearGrid,
```
와 import `import { CalendarMonthGrid, CalendarToggle, CalendarViewButton, CalendarYearGrid } from './calendar-view-parts';`

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/calendar`
Expected: PASS (Task 2 테스트 포함. Task 2의 "moves between months" 테스트는 이제 제목이 ViewButton 안에 있어도 격자 이름으로 확인하므로 그대로 통과해야 한다)

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src/calendar
ALLOW_COMMIT=1 git commit -m "feat: 음력 보기 전환과 월·연 단위 이동 지원" -m "- 음력을 켠 앱만 양·음력 토글이 보이게 하고, 전환해도 선택한 날과 포커스가 그대로 남도록 epoch day 기준으로 유지함.
- 생년월일처럼 먼 연도로 가야 하는 입력을 위해 헤더에서 월 격자·연 격자로 내려가 고를 수 있게 함."
```

---

### Task 4: `useRangeCalendar`와 `RangeCalendar.Root` (탭·키보드·제약·안내)

> 🟡 잠정: M2 range store의 이벤트 처리(`date.select`로 끝점 완성, 완성된 범위에서 새 범위 시작, block 무시)와 `displayedRange`·`rangeValidity`·`rangeValue` 시그니처에 따라 바뀔 수 있음

**Files:**
- Create: `packages/react/src/range-calendar/range-cell-flags.ts`, `range-announcement.ts`, `live-region.tsx`, `use-range-calendar.ts`, `range-calendar-context.ts`, `range-calendar-root.tsx`, `index.ts`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/range-calendar/range-announcement.test.ts`, `packages/react/src/range-calendar/range-calendar.test.tsx`

**Interfaces:**
- Consumes: Task 1·2, core `RangeSelectionState`, `RangeSelectionEvent`, `createRangeSelectionState`, `rangeSelectionReducer`, `displayedRange`, `rangeValidity`, `rangeValue`, `EpochRange`, `isEpochDayInBlockedRange`, `RangeConstraints`; calendar `DateRangeValue`, `formatDate`, `weekdayOf`
- Produces:
  - `rangeCellFlags(epochDay, selection, context): CellSelectionFlags`
  - `describeRangeAnnouncement({ selection, validity, locale, calendar }): string`
  - `LiveRegion({ message })`
  - `interface RangeValueInput { readonly start: string; readonly end: string | null }`, `interface UseRangeCalendarProps`, `interface RangeCalendarApi extends CalendarViewApi { selection; value; draftValue; validity; announcement; rootRef; sendSelection; setRange; commit; cancel }`, `useRangeCalendar(props): RangeCalendarApi`
  - `RangeCalendarContext`, `useRangeCalendarContext(): RangeCalendarApi`
  - `RangeCalendar = { Root }`, `RANGE_CALENDAR_PROP_NAMES`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/range-calendar/range-announcement.test.ts`:
```ts
import { gregory } from '@lunisolar-picker/calendar';
import { type RangeSelectionState, createRangeSelectionState } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it } from 'vitest';
import { dayLabel, epochDayAt } from '../testing/korean-fixture';
import { describeRangeAnnouncement } from './range-announcement';

const empty = createRangeSelectionState(null);
const VALID = { isValid: true, reasons: [] } as const;

describe('describeRangeAnnouncement', () => {
  it('stays silent with nothing selected', () => {
    expect(describeRangeAnnouncement({ selection: empty, validity: VALID, locale: ko, calendar: gregory })).toBe('');
  });

  it('announces the chosen start while waiting for an end', () => {
    const selecting: RangeSelectionState = {
      ...empty,
      anchor: epochDayAt('2026-10-13'),
      draft: { range: { start: epochDayAt('2026-10-13'), end: null }, calendarId: 'gregory' },
    };

    expect(describeRangeAnnouncement({ selection: selecting, validity: VALID, locale: ko, calendar: gregory })).toBe(
      ko.labels.formatRangeStartSelected(dayLabel('2026-10-13')),
    );
  });

  it('summarises a complete range with its inclusive day count', () => {
    const complete: RangeSelectionState = {
      ...empty,
      draft: { range: { start: epochDayAt('2026-10-13'), end: epochDayAt('2026-10-17') }, calendarId: 'gregory' },
    };

    expect(describeRangeAnnouncement({ selection: complete, validity: VALID, locale: ko, calendar: gregory })).toBe(
      ko.labels.formatRangeSummary(dayLabel('2026-10-13'), dayLabel('2026-10-17'), 5),
    );
  });

  it('reads the validation messages for an invalid range', () => {
    const complete: RangeSelectionState = {
      ...empty,
      draft: { range: { start: epochDayAt('2026-10-01'), end: epochDayAt('2026-10-10') }, calendarId: 'gregory' },
    };

    expect(
      describeRangeAnnouncement({ selection: complete, validity: { isValid: false, reasons: ['range-too-long'] }, locale: ko, calendar: gregory }),
    ).toBe(ko.labels.validation['range-too-long']);
  });
});
```

`packages/react/src/range-calendar/range-calendar.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { Calendar } from '../calendar/index';
import { KoreanProvider, dayLabel } from '../testing/korean-fixture';
import { RangeCalendar, useRangeCalendarContext } from './index';

async function tapDay(screen: Awaited<ReturnType<typeof render>>, isoDate: string): Promise<void> {
  const button = screen.getByRole('button', { name: dayLabel(isoDate) }).element() as HTMLElement;
  button.focus();
  await userEvent.keyboard('{Enter}');
}

describe('RangeCalendar', () => {
  it('completes a range with two selections and emits it once', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><RangeCalendar.Root defaultValue={null} onValueChange={onValueChange} /></KoreanProvider>);

    await tapDay(screen, '2026-10-17');
    await tapDay(screen, '2026-10-13');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: { isValid: true, reasons: [] } });
    const inRange = screen.container.querySelectorAll('[data-lsp-part="calendar-cell"][data-in-range]:not([data-outside])');
    expect(inRange).toHaveLength(5);
  });

  it('announces the start and then the summary in a polite live region', async () => {
    const screen = await render(<KoreanProvider><RangeCalendar.Root /></KoreanProvider>);
    const region = screen.getByRole('status');

    await tapDay(screen, '2026-10-13');
    await expect.element(region).toHaveTextContent(ko.labels.formatRangeStartSelected(dayLabel('2026-10-13')));

    await tapDay(screen, '2026-10-17');
    await expect.element(region).toHaveTextContent(ko.labels.formatRangeSummary(dayLabel('2026-10-13'), dayLabel('2026-10-17'), 5));
  });

  describe('maxDays', () => {
    it('disables days beyond the limit while selecting in block mode', async () => {
      const screen = await render(<KoreanProvider><RangeCalendar.Root maxDays={3} limitMode="block" /></KoreanProvider>);

      await tapDay(screen, '2026-10-13');

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-15') })).not.toHaveAttribute('aria-disabled');
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-16') })).toHaveAttribute('aria-disabled', 'true');
    });

    it('accepts a longer range in flag mode and reports it as invalid', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<KoreanProvider><RangeCalendar.Root maxDays={3} limitMode="flag" onValueChange={onValueChange} /></KoreanProvider>);

      await tapDay(screen, '2026-10-01');
      await tapDay(screen, '2026-10-10');

      expect(onValueChange).toHaveBeenCalledWith(
        { start: '2026-10-01', end: '2026-10-10' },
        { validity: { isValid: false, reasons: ['range-too-long'] } },
      );
      expect(screen.container.querySelector('[data-lsp-part="calendar"]')?.hasAttribute('data-invalid')).toBe(true);
    });
  });

  describe('confirm mode', () => {
    function ConfirmButton() {
      const api = useRangeCalendarContext();
      return (
        <button type="button" onClick={() => api.commit()}>
          {ko.labels.confirm}
        </button>
      );
    }

    it('keeps the committed range until commit', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <KoreanProvider>
          <RangeCalendar.Root commitMode="confirm" onValueChange={onValueChange}>
            <Calendar.Layout />
            <ConfirmButton />
          </RangeCalendar.Root>
        </KoreanProvider>,
      );

      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      expect(onValueChange).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: ko.labels.confirm }).click();
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: { isValid: true, reasons: [] } });
    });

    it('selects a preset range through setRange', async () => {
      function PresetButton() {
        const api = useRangeCalendarContext();
        return (
          <button type="button" onClick={() => api.setRange({ start: '2026-10-08', end: '2026-10-14' })}>
            preset
          </button>
        );
      }
      const screen = await render(
        <KoreanProvider>
          <RangeCalendar.Root commitMode="confirm">
            <Calendar.Layout />
            <PresetButton />
          </RangeCalendar.Root>
        </KoreanProvider>,
      );

      await screen.getByRole('button', { name: 'preset' }).click();

      const inRange = screen.container.querySelectorAll('[data-lsp-part="calendar-cell"][data-in-range]:not([data-outside])');
      expect(inRange).toHaveLength(7);
    });
  });

  it('has no axe violations with a selected range', async () => {
    const screen = await render(<KoreanProvider><RangeCalendar.Root defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} /></KoreanProvider>);

    await expectNoAxeViolations(screen.container);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/range-calendar`
Expected: FAIL — `Failed to resolve import "./range-announcement"`, `"./index"`

- [ ] **Step 3: 구현**

`packages/react/src/range-calendar/range-cell-flags.ts`:
```ts
import type { EpochDay } from '@lunisolar-picker/calendar';
import { type PickerContext, type RangeSelectionState, displayedRange, isEpochDayInBlockedRange } from '@lunisolar-picker/core';
import type { CellSelectionFlags } from '../calendar/cell-state';

export function rangeCellFlags(epochDay: EpochDay, selection: RangeSelectionState, context: PickerContext): CellSelectionFlags {
  const range = displayedRange(selection);
  const end = range?.end ?? range?.start ?? null;
  const isInRange = range !== null && end !== null && epochDay >= range.start && epochDay <= end;
  const isRangeStart = range !== null && epochDay === range.start;
  const isRangeEnd = end !== null && epochDay === end;
  const isSelecting = selection.anchor !== null && selection.draft?.range.end === null;
  const isBlocked =
    isSelecting && selection.anchor !== null && context.constraints.limitMode === 'block' && isEpochDayInBlockedRange(selection.anchor, epochDay, context.constraints);
  return {
    isSelected: isRangeStart || isRangeEnd,
    isInRange,
    isRangeStart,
    isRangeEnd,
    isPreview: selection.preview !== null && isInRange,
    isBlocked,
  };
}
```

`packages/react/src/range-calendar/range-announcement.ts`:
```ts
import { type CalendarSystem, type EpochDay, formatDate, weekdayOf } from '@lunisolar-picker/calendar';
import { type LocaleData, type RangeSelectionState, type Validity, type Weekday, displayedRange } from '@lunisolar-picker/core';

export interface RangeAnnouncementInput {
  readonly selection: RangeSelectionState;
  readonly validity: Validity;
  readonly locale: LocaleData;
  readonly calendar: CalendarSystem;
}

const MESSAGE_SEPARATOR = ' ';

// Goal: 시작일 선택·범위 완성·무효 이유만 알리고, 호버 미리보기 중에는 조용히 함 (스펙 10.1 live region)
export function describeRangeAnnouncement({ selection, validity, locale, calendar }: RangeAnnouncementInput): string {
  const range = displayedRange(selection);
  if (range === null || selection.preview !== null) return '';
  if (range.end === null) return locale.labels.formatRangeStartSelected(labelOf(range.start, locale, calendar));
  if (!validity.isValid) return validity.reasons.map((reason) => locale.labels.validation[reason]).join(MESSAGE_SEPARATOR);
  return locale.labels.formatRangeSummary(labelOf(range.start, locale, calendar), labelOf(range.end, locale, calendar), range.end - range.start + 1);
}

function labelOf(epochDay: EpochDay, locale: LocaleData, calendar: CalendarSystem): string {
  const fields = calendar.fromEpochDay(epochDay);
  if (fields.isOk) return locale.formatDayLabel(fields.value, weekdayOf(epochDay) as Weekday, calendar.id);
  const fallback = formatDate(epochDay);
  return fallback.isOk ? fallback.value : String(epochDay);
}
```

`packages/react/src/range-calendar/live-region.tsx`:
```tsx
import type { ReactElement } from 'react';
import { partAttributes } from '../contract/data-attributes';

export function LiveRegion({ message }: { readonly message: string }): ReactElement {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" {...partAttributes('live-region')}>
      {message}
    </div>
  );
}
```

`packages/react/src/range-calendar/use-range-calendar.ts`:
```ts
import { type DateRangeValue, type EpochDay, formatDate } from '@lunisolar-picker/calendar';
import {
  type EpochRange,
  type RangeConstraints,
  type RangeSelectionEvent,
  type RangeSelectionState,
  type SelectedRange,
  type Validity,
  createRangeSelectionState,
  findCalendar,
  rangeSelectionReducer,
  rangeValidity,
  rangeValue,
  validateEpochDay,
} from '@lunisolar-picker/core';
import { type RefObject, useEffect, useRef } from 'react';
import { type CalendarViewApi, createCalendarViewApi } from '../calendar/calendar-view-api';
import { INVALID_SELECTION, parseSelection, selectionKey } from '../calendar/parsed-selection';
import { type CalendarFoundationProps, useCalendarFoundation } from '../calendar/use-calendar-foundation';
import { useSelectionSync } from '../calendar/use-selection-sync';
import { usePickerSettings } from '../settings/use-picker-settings';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { useStoreInstance } from '../store/use-store-instance';
import { describeRangeAnnouncement } from './range-announcement';
import { rangeCellFlags } from './range-cell-flags';
import { useRangePointer } from './use-range-pointer';

export interface RangeValueInput {
  readonly start: string;
  readonly end: string | null;
}

export interface UseRangeCalendarProps extends CalendarFoundationProps, RangeConstraints {
  readonly startName?: string;
  readonly endName?: string;
  readonly value?: RangeValueInput | null;
  readonly defaultValue?: RangeValueInput | null;
  readonly onValueChange?: (value: DateRangeValue | null, details: ValueChangeDetails) => void;
}

export interface RangeCalendarApi extends CalendarViewApi {
  readonly selection: RangeSelectionState;
  readonly value: DateRangeValue | null;
  readonly draftValue: DateRangeValue | null;
  readonly validity: Validity;
  readonly announcement: string;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  sendSelection(event: RangeSelectionEvent): void;
  setRange(range: RangeValueInput | null): void;
  commit(): void;
  cancel(): void;
}

type ParsedRange = SelectedRange;

export function useRangeCalendar(props: UseRangeCalendarProps): RangeCalendarApi {
  const config = usePickerSettings(props);
  const isControlled = props.value !== undefined;
  const rawInput = isControlled ? props.value : props.defaultValue;
  const parsedInput = parseRange(rawInput, config.calendars);
  const parsed = parsedInput === INVALID_SELECTION ? null : parsedInput;

  useEffect(() => {
    if (parsedInput === INVALID_SELECTION && rawInput) props.onInvalidValue?.(`${rawInput.start}/${rawInput.end ?? ''}`, 'invalid-date');
  }, [parsedInput, rawInput, props.onInvalidValue]);

  const foundation = useCalendarFoundation(
    props,
    config,
    {
      min: props.min,
      max: props.max,
      isDateDisabled: props.isDateDisabled,
      minDays: props.minDays,
      maxDays: props.maxDays,
      limitMode: props.limitMode,
      isOpenEndAllowed: props.isOpenEndAllowed,
    },
    parsed?.range.start ?? null,
  );
  const { state: selection, send: sendSelection } = useStoreInstance(
    () => createRangeSelectionState(parsed),
    rangeSelectionReducer,
    foundation.context,
  );
  const value = rangeValue(selection, foundation.context);
  const validity = rangeValidity(selection, foundation.context);

  useSelectionSync({
    controlledKey: isControlled ? rangeKey(parsed) : undefined,
    committedKey: rangeKey(selection.committed),
    syncToControlled: () => sendSelection({ type: 'value.sync', selected: parsed }),
    emitChange: () => props.onValueChange?.(value, { validity }),
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const isInteractive = props.disabled !== true && props.readOnly !== true;
  const pointer = useRangePointer({
    rootRef,
    isInteractive,
    selection,
    displayCalendarId: foundation.navigation.displayCalendarId,
    sendSelection,
    sendNavigation: foundation.sendNavigation,
  });

  const viewApi = createCalendarViewApi(
    foundation,
    {
      mode: 'range',
      selectionFlags: (cell) => rangeCellFlags(cell.epochDay, selection, foundation.context),
      selectEpochDay: (epochDay: EpochDay) => {
        if (!validateEpochDay(epochDay, foundation.context.constraints).isValid) return;
        sendSelection({ type: 'date.select', epochDay, calendarId: foundation.navigation.displayCalendarId });
      },
      extraButtonProps: pointer.cellButtonProps,
      shouldIgnoreClick: pointer.shouldIgnoreClick,
    },
    { isDisabled: props.disabled === true, isReadOnly: props.readOnly === true, getCellLabel: props.getCellLabel },
  );

  return {
    ...viewApi,
    selection,
    value,
    draftValue: selection.draft === null ? null : toRangeValue(selection.draft.range, findCalendar(config.calendars, selection.draft.calendarId)),
    validity,
    announcement: describeRangeAnnouncement({ selection, validity, locale: foundation.context.locale, calendar: foundation.calendar }),
    rootRef,
    sendSelection,
    setRange: (range) => {
      const next = parseRange(range, config.calendars);
      if (next === INVALID_SELECTION) {
        if (range) props.onInvalidValue?.(`${range.start}/${range.end ?? ''}`, 'invalid-date');
        return;
      }
      if (next === null) {
        sendSelection({ type: 'clear' });
        return;
      }
      sendSelection({ type: 'range.set', range: next.range, calendarId: next.calendarId });
      foundation.sendNavigation({ type: 'focus.set', epochDay: next.range.start });
    },
    commit: () => sendSelection({ type: 'commit' }),
    cancel: () => sendSelection({ type: 'cancel' }),
  };
}

function parseRange(
  input: RangeValueInput | null | undefined,
  calendars: Parameters<typeof parseSelection>[1],
): ParsedRange | null | typeof INVALID_SELECTION {
  if (input === null || input === undefined) return null;
  const start = parseSelection(input.start, calendars);
  const end = input.end === null ? null : parseSelection(input.end, calendars);
  if (start === null || start === INVALID_SELECTION || end === INVALID_SELECTION) return INVALID_SELECTION;
  if (end !== null && end.calendarId !== start.calendarId) return INVALID_SELECTION;
  const isReversed = end !== null && end.epochDay < start.epochDay;
  return {
    range: isReversed ? { start: end.epochDay, end: start.epochDay } : { start: start.epochDay, end: end?.epochDay ?? null },
    calendarId: start.calendarId,
  };
}

function rangeKey(selected: SelectedRange | null): string {
  if (selected === null) return selectionKey(null);
  return `${selected.calendarId}:${selected.range.start}-${selected.range.end ?? ''}`;
}

function toRangeValue(range: EpochRange | null, calendar: Parameters<typeof formatDate>[1]): DateRangeValue | null {
  if (range === null) return null;
  const start = formatDate(range.start, calendar);
  const end = range.end === null ? null : formatDate(range.end, calendar);
  if (!start.isOk || (end !== null && !end.isOk)) return null;
  return { start: start.value, end: end?.isOk ? end.value : null };
}
```

이 Task에서 `use-range-pointer.ts`는 아직 없다. 탭·키보드만 먼저 통과시키기 위해 다음 최소 구현을 만든다(Task 5에서 전체 구현으로 바꾼다):

`packages/react/src/range-calendar/use-range-pointer.ts`:
```ts
import type { CalendarId } from '@lunisolar-picker/calendar';
import type { MonthGridCell, NavigationEvent, RangeSelectionEvent, RangeSelectionState } from '@lunisolar-picker/core';
import type { ButtonHTMLAttributes, MouseEvent, RefObject } from 'react';

export interface RangePointerOptions {
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly isInteractive: boolean;
  readonly selection: RangeSelectionState;
  readonly displayCalendarId: CalendarId;
  sendSelection(event: RangeSelectionEvent): void;
  sendNavigation(event: NavigationEvent): void;
}

export interface RangePointerHandlers {
  cellButtonProps(cell: MonthGridCell): ButtonHTMLAttributes<HTMLButtonElement>;
  shouldIgnoreClick(event: MouseEvent<HTMLButtonElement>): boolean;
}

export function useRangePointer(_options: RangePointerOptions): RangePointerHandlers {
  return { cellButtonProps: () => ({}), shouldIgnoreClick: () => false };
}
```

`packages/react/src/range-calendar/range-calendar-context.ts`:
```ts
import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { createContext, useContext } from 'react';
import type { RangeCalendarApi } from './use-range-calendar';

export const RangeCalendarContext = createContext<RangeCalendarApi | null>(null);

export function useRangeCalendarContext(): RangeCalendarApi {
  const api = useContext(RangeCalendarContext);
  if (!api) throw new LunisolarPickerError('this part must be rendered inside RangeCalendar.Root');
  return api;
}
```

`packages/react/src/range-calendar/range-calendar-root.tsx`:
```tsx
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { CalendarViewContext } from '../calendar/calendar-context';
import { CalendarLayout } from '../calendar/calendar-layout';
import { splitProps } from '../calendar/split-props';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { LiveRegion } from './live-region';
import { RangeCalendarContext } from './range-calendar-context';
import { type RangeCalendarApi, type UseRangeCalendarProps, useRangeCalendar } from './use-range-calendar';

export const RANGE_CALENDAR_PROP_NAMES = [
  'locale', 'timeZone', 'today', 'weekStartsOn', 'calendars', 'disabled', 'readOnly', 'required', 'invalid', 'name', 'form',
  'onInvalidValue', 'min', 'max', 'isDateDisabled', 'minDays', 'maxDays', 'limitMode', 'isOpenEndAllowed', 'value', 'defaultValue',
  'onValueChange', 'commitMode', 'numberOfMonths', 'displayCalendar', 'defaultDisplayCalendar', 'onDisplayCalendarChange', 'getCellLabel',
  'startName', 'endName',
] as const satisfies readonly (keyof UseRangeCalendarProps)[];

type MissingRangePropName = Exclude<keyof UseRangeCalendarProps, (typeof RANGE_CALENDAR_PROP_NAMES)[number]>;
// Constraint: 훅 prop을 하나라도 빠뜨리면 DOM으로 새어 나가므로 컴파일 시점에 목록 완전성을 검사함
const isRangePropListComplete: [MissingRangePropName] extends [never] ? true : false = true;
void isRangePropListComplete;

export type RangeCalendarRootProps = UseRangeCalendarProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof UseRangeCalendarProps | 'children'> & {
    readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, RangeCalendarApi>;
    readonly children?: ReactNode;
  };

export function RangeCalendarRoot(props: RangeCalendarRootProps): ReactElement {
  const [hookProps, { render, children, ...domProps }] = splitProps(props, RANGE_CALENDAR_PROP_NAMES);
  const api = useRangeCalendar(hookProps);
  return (
    <CalendarViewContext.Provider value={api}>
      <RangeCalendarContext.Provider value={api}>
        {renderElement('div', render, {
            ...domProps,
            ref: api.rootRef,
            ...partAttributes('calendar'),
            ...stateAttributes({
              calendar: api.navigation.displayCalendarId,
              view: api.navigation.view,
              disabled: api.isDisabled,
              invalid: hookProps.invalid === true || !api.validity.isValid,
            }),
            children: (
              <>
                {children ?? <CalendarLayout />}
                <LiveRegion message={api.announcement} />
                {hookProps.startName ? <input type="hidden" name={hookProps.startName} form={hookProps.form} value={api.value?.start ?? ''} /> : null}
                {hookProps.endName ? <input type="hidden" name={hookProps.endName} form={hookProps.form} value={api.value?.end ?? ''} /> : null}
              </>
            ),
          }, api)}
      </RangeCalendarContext.Provider>
    </CalendarViewContext.Provider>
  );
}
```

`packages/react/src/range-calendar/index.ts`:
```ts
import { RangeCalendarRoot } from './range-calendar-root';

export const RangeCalendar = { Root: RangeCalendarRoot } as const;

export type { RangeCalendarApi, RangeValueInput, UseRangeCalendarProps } from './use-range-calendar';
export type { RangeCalendarRootProps } from './range-calendar-root';
export { useRangeCalendar } from './use-range-calendar';
export { useRangeCalendarContext } from './range-calendar-context';
```

`packages/react/src/index.ts` 끝에 추가:
```ts
export * from './range-calendar/index';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/range-calendar src/calendar`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 기간 제한과 확인 후 반영을 지원하는 범위 달력 제공" -m "- 두 앱이 쓰던 '넘겨도 고르게 두고 경고' 방식과 rdp의 '아예 막기' 방식을 limitMode로 모두 지원하고, 무효 이유를 함께 알림.
- 시작일 선택·범위 요약·무효 이유를 live region으로 읽어 줘 화면을 보지 않아도 범위를 고를 수 있게 함."
```

---

### Task 5: 범위 드래그, 끝점 잡기, 가장자리 머묾 월 넘김

> 🟡 잠정: M2 range store의 `pointer.*`·`handle.grab` 처리와 core `createEdgeDwell`·`EDGE_DWELL_DELAY_MS`에 따라 바뀔 수 있음

**Files:**
- Modify: `packages/react/src/range-calendar/use-range-pointer.ts` (전체 교체)
- Create: `packages/react/src/testing/pointer.ts`
- Test: `packages/react/src/range-calendar/range-pointer.test.tsx`

**Interfaces:**
- Consumes: core `createEdgeDwell`, `EDGE_DWELL_DELAY_MS`, `EdgeDirection`, `displayedRange`
- Produces: `useRangePointer(options): RangePointerHandlers` (Task 4와 같은 시그니처), 테스트 헬퍼 `dispatchPointer(target, type, init)`

- [ ] **Step 1: 포인터 헬퍼 작성**

`packages/react/src/testing/pointer.ts`:
```ts
export interface PointerInit {
  readonly pointerType?: 'mouse' | 'pen' | 'touch';
  readonly clientX?: number;
  readonly clientY?: number;
}

// Goal: 달력 밖으로 나가 머무는 드래그처럼 Playwright 고수준 API로 만들 수 없는 순서를 직접 재현함
export function dispatchPointer(target: EventTarget, type: string, init: PointerInit = {}): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      isPrimary: true,
      pointerType: init.pointerType ?? 'mouse',
      clientX: init.clientX ?? 0,
      clientY: init.clientY ?? 0,
    }),
  );
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`packages/react/src/range-calendar/range-pointer.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { KoreanProvider, dayLabel } from '../testing/korean-fixture';
import { dispatchPointer } from '../testing/pointer';
import { RangeCalendar } from './index';

const EDGE_WAIT_MS = 800;

function inRangeCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-lsp-part="calendar-cell"][data-in-range]:not([data-outside])').length;
}

describe('RangeCalendar pointer', () => {
  it('selects a range by dragging with a mouse', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><RangeCalendar.Root onValueChange={onValueChange} /></KoreanProvider>);

    await userEvent.dragAndDrop(screen.getByRole('button', { name: dayLabel('2026-10-06') }), screen.getByRole('button', { name: dayLabel('2026-10-09') }));

    expect(onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-06', end: '2026-10-09' }, { validity: { isValid: true, reasons: [] } });
  });

  it('resizes a complete range by grabbing its end', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <RangeCalendar.Root defaultValue={{ start: '2026-10-06', end: '2026-10-09' }} onValueChange={onValueChange} />
      </KoreanProvider>,
    );

    await userEvent.dragAndDrop(screen.getByRole('button', { name: dayLabel('2026-10-09') }), screen.getByRole('button', { name: dayLabel('2026-10-12') }));

    expect(onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-06', end: '2026-10-12' }, { validity: { isValid: true, reasons: [] } });
  });

  it('moves to the next month after dwelling outside the right edge while dragging', async () => {
    const screen = await render(<KoreanProvider><RangeCalendar.Root /></KoreanProvider>);
    const root = screen.container.querySelector<HTMLElement>('[data-lsp-part="calendar"]');
    const startButton = screen.getByRole('button', { name: dayLabel('2026-10-28') }).element();
    if (!root) throw new Error('calendar root should render');
    const { right, top } = root.getBoundingClientRect();

    dispatchPointer(startButton, 'pointerdown');
    dispatchPointer(window, 'pointermove', { clientX: right + 20, clientY: top + 10 });
    await new Promise((resolve) => setTimeout(resolve, EDGE_WAIT_MS));
    dispatchPointer(window, 'pointerup', { clientX: right + 20, clientY: top + 10 });

    await expect.element(screen.getByRole('grid')).toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M11' }, 'gregory'));
  });

  it('forgets the drag when released outside the calendar so later hovering changes nothing', async () => {
    const screen = await render(<KoreanProvider><RangeCalendar.Root /></KoreanProvider>);
    const startButton = screen.getByRole('button', { name: dayLabel('2026-10-06') }).element();
    const laterButton = screen.getByRole('button', { name: dayLabel('2026-10-20') }).element();

    dispatchPointer(startButton, 'pointerdown');
    dispatchPointer(window, 'pointerup', { clientX: -50, clientY: -50 });
    const countAfterRelease = inRangeCount(screen.container);
    dispatchPointer(laterButton, 'pointerover');

    expect(inRangeCount(screen.container)).toBe(countAfterRelease);
  });

  it('uses two taps instead of dragging on touch screens', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><RangeCalendar.Root onValueChange={onValueChange} /></KoreanProvider>);
    const first = screen.getByRole('button', { name: dayLabel('2026-10-06') }).element();
    const second = screen.getByRole('button', { name: dayLabel('2026-10-08') }).element();

    for (const button of [first, second]) {
      dispatchPointer(button, 'pointerdown', { pointerType: 'touch' });
      dispatchPointer(button, 'pointerup', { pointerType: 'touch' });
      (button as HTMLButtonElement).click();
    }

    expect(onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-06', end: '2026-10-08' }, { validity: { isValid: true, reasons: [] } });
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/range-calendar/range-pointer.test.tsx`
Expected: FAIL — 드래그·가장자리 테스트가 실패(최소 구현이라 포인터를 처리하지 않음). 터치 테스트는 이미 통과할 수 있다.

- [ ] **Step 4: 구현**

`packages/react/src/range-calendar/use-range-pointer.ts` 전체를 다음으로 바꾼다:
```ts
import type { CalendarId, EpochDay } from '@lunisolar-picker/calendar';
import {
  EDGE_DWELL_DELAY_MS,
  type EdgeDirection,
  type MonthGridCell,
  type NavigationEvent,
  type RangeHandle,
  type RangeSelectionEvent,
  type RangeSelectionState,
  createEdgeDwell,
  displayedRange,
} from '@lunisolar-picker/core';
import { type ButtonHTMLAttributes, type MouseEvent, type PointerEvent, type RefObject, useEffect, useRef } from 'react';

export interface RangePointerOptions {
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly isInteractive: boolean;
  readonly selection: RangeSelectionState;
  readonly displayCalendarId: CalendarId;
  sendSelection(event: RangeSelectionEvent): void;
  sendNavigation(event: NavigationEvent): void;
}

export interface RangePointerHandlers {
  cellButtonProps(cell: MonthGridCell): ButtonHTMLAttributes<HTMLButtonElement>;
  shouldIgnoreClick(event: MouseEvent<HTMLButtonElement>): boolean;
}

const DRAG_POINTER_TYPES: ReadonlySet<string> = new Set(['mouse', 'pen']);
const PRIMARY_BUTTON = 0;
const EDGE_POLL_INTERVAL_MS = 100;
const KEYBOARD_CLICK_DETAIL = 0;

// Goal: 마우스·펜만 드래그로 범위를 고름. 터치는 페이지 스크롤과 부딪혀 탭 두 번으로 고름 (스펙 10.5)
export function useRangePointer(options: RangePointerOptions): RangePointerHandlers {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const lastPointerTypeRef = useRef<string>('');
  const stopDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopDragRef.current?.(), []);

  function startDrag(): void {
    stopDragRef.current?.();
    const dwell = createEdgeDwell(EDGE_DWELL_DELAY_MS);
    let currentDirection: EdgeDirection | null = null;

    const trackEdge = (event: globalThis.PointerEvent): void => {
      const root = optionsRef.current.rootRef.current;
      if (!root) return;
      const { left, right } = root.getBoundingClientRect();
      const direction: EdgeDirection | null = event.clientX < left ? 'previous' : event.clientX > right ? 'next' : null;
      if (direction === currentDirection) return;
      currentDirection = direction;
      if (direction) dwell.enter(direction, performance.now());
      else dwell.leave();
    };
    const pollEdge = window.setInterval(() => {
      const direction = dwell.poll(performance.now());
      if (direction) optionsRef.current.sendNavigation({ type: 'month.shift', amount: direction === 'next' ? 1 : -1 });
    }, EDGE_POLL_INTERVAL_MS);
    // Constraint: 달력 밖에서 손을 떼도 드래그가 끝나야 하므로 pointerup은 window에서 받음 (Review Focus 4)
    const finishDrag = (): void => {
      optionsRef.current.sendSelection({ type: 'pointer.up' });
      stop();
    };
    const stop = (): void => {
      window.clearInterval(pollEdge);
      window.removeEventListener('pointermove', trackEdge);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      stopDragRef.current = null;
    };
    window.addEventListener('pointermove', trackEdge);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    stopDragRef.current = stop;
  }

  function handleAt(epochDay: EpochDay): RangeHandle | null {
    const range = displayedRange(optionsRef.current.selection);
    if (range === null || range.end === null) return null;
    if (epochDay === range.start) return 'start';
    if (epochDay === range.end) return 'end';
    return null;
  }

  return {
    cellButtonProps: (cell) => ({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        lastPointerTypeRef.current = event.pointerType;
        const current = optionsRef.current;
        if (!DRAG_POINTER_TYPES.has(event.pointerType) || event.button !== PRIMARY_BUTTON || !current.isInteractive) return;
        const handle = handleAt(cell.epochDay);
        if (handle) current.sendSelection({ type: 'handle.grab', handle });
        else current.sendSelection({ type: 'pointer.down', epochDay: cell.epochDay, calendarId: current.displayCalendarId });
        startDrag();
      },
      onPointerEnter: () => {
        if (stopDragRef.current === null) return;
        optionsRef.current.sendSelection({ type: 'pointer.enter', epochDay: cell.epochDay });
      },
    }),
    shouldIgnoreClick: (event) => event.detail !== KEYBOARD_CLICK_DETAIL && DRAG_POINTER_TYPES.has(lastPointerTypeRef.current),
  };
}
```

`onPointerEnter`는 React가 `pointerover`로 합성하므로 테스트의 `pointerover` 디스패치로 확인한다. 드래그가 끝난 뒤(`stopDragRef.current === null`) 들어오는 호버는 무시한다.

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/range-calendar`
Expected: PASS

- [ ] **Step 6: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add packages/react/src/range-calendar packages/react/src/testing/pointer.ts
ALLOW_COMMIT=1 git commit -m "feat: 마우스로 범위를 끌어 고르고 끝점을 잡아 늘일 수 있도록 지원" -m "- web-console에서 쓰던 드래그 선택·끝점 조정·달력 밖 머묾 월 넘김을 공개 부품만으로 재현함.
- 달력 밖에서 손을 떼도 드래그가 남지 않도록 pointerup을 window에서 받고, 터치는 스크롤과 부딪히지 않게 탭 두 번으로 고르게 함."
```

---

### Task 6: 달력 테마 (Mono)

> 🟡 잠정: M3 `mono.css`의 토큰 이름이 바뀌면 아래 CSS의 `var(--lsp-*)`를 맞춘다.

> 정합성 조정(2026-10-14): M3 theme은 `src/mono.css` 단일 파일이고 테스트는 `tests/`에 있다. 그래서 달력 스타일은 별도 파일·`@import` 대신 `mono.css` 끝에 같은 이름의 `@layer lunisolar-picker` 블록으로 붙인다(같은 이름의 layer 블록은 하나로 합쳐짐). 계약 상수는 `@lunisolar-picker/react/contract`에서 읽는다.

**Files:**
- Modify: `packages/theme/src/mono.css` (끝에 달력 블록 추가)
- Test: `packages/theme/tests/calendar-selectors.test.ts`

**Interfaces:**
- Consumes: Task 2·3의 `data-lsp-part` 이름, `DATA_ATTRIBUTES`(`data-slide` 포함), M3 토큰 `--lsp-*`
- Produces: 달력 부품 스타일

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/theme/tests/calendar-selectors.test.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { PART_NAMES } from '@lunisolar-picker/react/contract';
import { describe, expect, it } from 'vitest';

const CALENDAR_PARTS = PART_NAMES.filter((part) => part.startsWith('calendar') || part === 'live-region');

function selectorValues(css: string, attribute: string): string[] {
  return [...css.matchAll(new RegExp(`\\[${attribute}=['"]([^'"]+)['"]\\]`, 'g'))].map((match) => match[1] ?? '');
}

async function readMonoCss(): Promise<string> {
  return readFile(new URL('../src/mono.css', import.meta.url), 'utf8');
}

// Constraint: 계약 밖 선택자·layer 밖 규칙 검사는 M3 selector-contract.test.ts가 이미 함. 여기서는 달력 부품이 빠짐없이 꾸며졌는지만 봄
describe('mono.css calendar parts', () => {
  it('styles every calendar part', async () => {
    const styledParts = new Set(selectorValues(await readMonoCss(), 'data-lsp-part'));

    expect(CALENDAR_PARTS.filter((part) => !styledParts.has(part))).toEqual([]);
  });

  it('turns the month slide off on request', async () => {
    const css = await readMonoCss();

    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('[data-slide');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/theme exec vitest run tests/calendar-selectors.test.ts`
Expected: FAIL — `styles every calendar part`가 꾸며지지 않은 달력 부품 목록을 보여 줌

- [ ] **Step 3: 구현**

`packages/theme/src/mono.css` 끝에 추가(기존 내용은 그대로 둔다):
```css
@layer lunisolar-picker {
  [data-lsp-part='calendar'] {
    display: inline-flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--lsp-surface);
    color: var(--lsp-fg);
    border: 1px solid var(--lsp-border);
    border-radius: var(--lsp-radius);
    font-variant-numeric: tabular-nums;
  }

  [data-lsp-part='calendar-header'] {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  [data-lsp-part='calendar-heading'] {
    font-size: 13.5px;
    font-weight: 600;
  }

  [data-lsp-part='calendar-view-button'] {
    margin-inline-end: auto;
    padding: 4px 6px;
    border: 0;
    border-radius: calc(var(--lsp-radius) - 2px);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }

  [data-lsp-part='calendar-nav-button'],
  [data-lsp-part='calendar-today-button'] {
    min-inline-size: 26px;
    block-size: 26px;
    padding-inline: 6px;
    display: inline-grid;
    place-items: center;
    border: 1px solid var(--lsp-border);
    border-radius: calc(var(--lsp-radius) - 2px);
    background: transparent;
    color: var(--lsp-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  [data-lsp-part='calendar-nav-button'][data-disabled] {
    opacity: 0.4;
    cursor: default;
  }

  [data-lsp-part='calendar-today-button'][data-disabled] {
    display: none;
  }

  [data-lsp-part='calendar-toggle'] {
    display: inline-flex;
    padding: 2px;
    border-radius: calc(var(--lsp-radius) - 1px);
    background: var(--lsp-range-bg);
  }

  [data-lsp-part='calendar-toggle'] > button {
    padding: 3px 9px;
    border: 0;
    border-radius: calc(var(--lsp-radius) - 3px);
    background: transparent;
    color: var(--lsp-muted);
    font: inherit;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }

  [data-lsp-part='calendar-toggle'] > button[aria-pressed='true'] {
    background: var(--lsp-surface);
    color: var(--lsp-fg);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
  }

  [data-lsp-part='calendar-months'] {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  [data-lsp-part='calendar-month'] {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  [data-lsp-part='calendar-grid'] {
    border-collapse: separate;
    border-spacing: 0 2px;
  }

  [data-lsp-part='calendar-head-cell'] {
    padding-block-end: 6px;
    color: var(--lsp-muted);
    font-size: 10.5px;
    font-weight: 400;
    text-align: center;
  }

  [data-lsp-part='calendar-cell'] {
    padding: 0;
    text-align: center;
  }

  [data-lsp-part='calendar-cell'] > button {
    inline-size: var(--lsp-cell-size);
    block-size: var(--lsp-cell-size);
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 0;
    border: 0;
    border-radius: calc(var(--lsp-radius) - 2px);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
  }

  [data-lsp-part='calendar-cell'] > button:hover {
    background: var(--lsp-range-bg);
  }

  [data-lsp-part='calendar-cell'] > button:focus-visible {
    outline: 2px solid var(--lsp-ring);
    outline-offset: 1px;
  }

  [data-lsp-part='calendar-cell'][data-outside] > button {
    color: var(--lsp-subtle);
  }

  [data-lsp-part='calendar-cell'][data-disabled] > button {
    color: var(--lsp-subtle);
    opacity: 0.5;
    cursor: default;
  }

  [data-lsp-part='calendar-cell'][data-today] > button {
    box-shadow: inset 0 0 0 1px var(--lsp-muted);
  }

  [data-lsp-part='calendar-cell'][data-in-range] {
    background: var(--lsp-range-bg);
  }

  [data-lsp-part='calendar-cell'][data-range-start] {
    border-start-start-radius: calc(var(--lsp-radius) - 2px);
    border-end-start-radius: calc(var(--lsp-radius) - 2px);
  }

  [data-lsp-part='calendar-cell'][data-range-end] {
    border-start-end-radius: calc(var(--lsp-radius) - 2px);
    border-end-end-radius: calc(var(--lsp-radius) - 2px);
  }

  [data-lsp-part='calendar-cell'][data-selected] > button {
    background: var(--lsp-accent);
    color: var(--lsp-accent-fg);
  }

  [data-lsp-part='calendar'][data-invalid] [data-lsp-part='calendar-cell'][data-in-range] {
    background: color-mix(in srgb, var(--lsp-danger) 12%, transparent);
  }

  [data-lsp-part='calendar'][data-invalid] [data-lsp-part='calendar-cell'][data-selected] > button {
    background: var(--lsp-danger);
  }

  [data-lsp-part='calendar-cell-secondary'] {
    color: var(--lsp-subtle);
    font-size: 8.5px;
    font-weight: 400;
  }

  [data-lsp-part='calendar-cell'][data-selected] [data-lsp-part='calendar-cell-secondary'] {
    color: inherit;
    opacity: 0.7;
  }

  [data-lsp-part='calendar-month-grid'],
  [data-lsp-part='calendar-year-grid'] {
    border-spacing: 4px;
  }

  [data-lsp-part='calendar-month-grid'] button,
  [data-lsp-part='calendar-year-grid'] button {
    min-inline-size: 64px;
    block-size: 36px;
    border: 0;
    border-radius: calc(var(--lsp-radius) - 2px);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }

  [data-lsp-part='calendar-month-grid'] [data-selected] button,
  [data-lsp-part='calendar-year-grid'] [data-selected] button {
    background: var(--lsp-accent);
    color: var(--lsp-accent-fg);
  }

  [data-lsp-part='calendar-month-grid'] [data-disabled] button {
    opacity: 0.4;
    cursor: default;
  }

  [data-lsp-part='calendar-grid'] > tbody[data-slide='next'] {
    animation: lsp-slide-from-end var(--lsp-duration) ease-out;
  }

  [data-lsp-part='calendar-grid'] > tbody[data-slide='previous'] {
    animation: lsp-slide-from-start var(--lsp-duration) ease-out;
  }

  [data-lsp-part='live-region'] {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (pointer: coarse) {
    :where([data-lsp-part='calendar']) {
      --lsp-cell-size: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-lsp-part='calendar-grid'] > tbody[data-slide] {
      animation: none;
    }
  }

  @media (forced-colors: active) {
    [data-lsp-part='calendar-cell'][data-selected] > button {
      background: Highlight;
      color: HighlightText;
    }

    [data-lsp-part='calendar-cell'][data-in-range] {
      outline: 1px solid Highlight;
    }
  }

  @keyframes lsp-slide-from-end {
    from {
      opacity: 0;
      translate: 8px 0;
    }
  }

  @keyframes lsp-slide-from-start {
    from {
      opacity: 0;
      translate: -8px 0;
    }
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/theme exec vitest run`
Expected: PASS (M3의 선택자 계약 테스트 포함)

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/theme
ALLOW_COMMIT=1 git commit -m "feat: 달력 부품에 Mono 기본 디자인 적용" -m "- 선택은 잉크색 채움, 범위는 옅은 배경, 오늘은 얇은 링, 음력은 회색 작은 숫자로만 보여 양력 picker로서 먼저 깔끔하게 보이게 함.
- 선택자를 data-lsp-part와 상태 속성으로만 써서 Tailwind 유틸리티가 덮어쓸 수 있고, 동작 줄이기·고대비 모드도 따르게 함."
```

---

### Task 7: `MonthCalendar`와 `TimeList` 부품

> 🟡 잠정: 계약 §3.4에 없는 새 공개 부품(계약 변경 제안 3). M2 `formatMonth`·`parseMonth`·`formatTime`·`parseTime` 사용 방식은 M1 확정 API라 바뀌지 않음

**Files:**
- Create: `packages/react/src/month-calendar/month-calendar-root.tsx`, `index.ts`, `packages/react/src/time-list/list-times.ts`, `time-list-root.tsx`, `index.ts`
- Modify: `packages/react/src/index.ts`, `packages/react/src/contract/data-attributes.ts` (`'month-calendar'`, `'month-calendar-header'`, `'time-list'`, `'time-option'` 추가)
- Test: `packages/react/src/month-calendar/month-calendar.test.tsx`, `packages/react/src/time-list/time-list.test.tsx`

**Interfaces:**
- Consumes: Task 3 `MonthButtonGrid`, calendar `parseMonth`, `formatMonth`, `MonthString`, `parseTime`, `formatTime`, `TimeString`, `toMonthCode`; M3 `usePickerSettings`, `useControllableState`, `SharedPickerProps`, `ValueChangeDetails`
- Produces:
  - `MonthCalendar = { Root }`, `interface MonthCalendarRootProps { value?; defaultValue?; onValueChange?(value: MonthString | null, details); min?: string; max?: string } & SharedPickerProps`
  - `listTimes(minuteStep: number, isEndOfDayAllowed: boolean): readonly TimeString[]`
  - `TimeList = { Root }`, `interface TimeListRootProps { value?; defaultValue?; onValueChange?(value: TimeString, details); minuteStep?; isEndOfDayAllowed?; 'aria-label' }`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/month-calendar/month-calendar.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { KoreanProvider } from '../testing/korean-fixture';
import { MonthCalendar } from './index';

const monthName = (month: number) => ko.formatMonthName({ year: 2026, monthCode: `M${String(month).padStart(2, '0')}` as 'M01' }, 'gregory');

describe('MonthCalendar', () => {
  it('emits the picked month as a canonical month string', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><MonthCalendar.Root defaultValue="2026-10" onValueChange={onValueChange} /></KoreanProvider>);

    await screen.getByRole('button', { name: monthName(11) }).click();

    expect(onValueChange).toHaveBeenCalledWith('2026-11', { validity: { isValid: true, reasons: [] } });
  });

  it('disables months outside min and max', async () => {
    const screen = await render(<KoreanProvider><MonthCalendar.Root defaultValue="2026-10" min="2026-03" max="2026-10" /></KoreanProvider>);

    await expect.element(screen.getByRole('button', { name: monthName(2) })).toHaveAttribute('aria-disabled', 'true');
    await expect.element(screen.getByRole('button', { name: monthName(11) })).toHaveAttribute('aria-disabled', 'true');
    await expect.element(screen.getByRole('button', { name: monthName(3) })).not.toHaveAttribute('aria-disabled');
  });

  it('moves between years', async () => {
    const screen = await render(<KoreanProvider><MonthCalendar.Root defaultValue="2026-10" /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.nextYears }).click();

    await expect.element(screen.getByText('2027')).toBeVisible();
  });
});
```

`packages/react/src/time-list/time-list.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { KoreanProvider } from '../testing/korean-fixture';
import { TimeList, listTimes } from './index';

describe('listTimes', () => {
  it('lists every step of the day and adds 24:00 only when allowed', () => {
    expect(listTimes(5, false)).toHaveLength(288);
    expect(listTimes(30, true).at(-1)).toBe('24:00');
    expect(listTimes(30, false).at(-1)).toBe('23:30');
  });
});

describe('TimeList', () => {
  it('selects an option by click and by keyboard', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <TimeList.Root aria-label="시작 시각" minuteStep={5} defaultValue="09:30" onValueChange={onValueChange} />
      </KoreanProvider>,
    );

    await screen.getByRole('option', { name: '09:35' }).click();
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['09:35', '09:40']);
    await expect.element(screen.getByRole('option', { name: '09:40' })).toHaveAttribute('aria-selected', 'true');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/month-calendar src/time-list`
Expected: FAIL — 모듈을 찾지 못함

- [ ] **Step 3: 구현**

`packages/react/src/contract/data-attributes.ts`의 `PART_NAMES` 끝에 추가:
```ts
  'month-calendar',
  'month-calendar-header',
  'time-list',
  'time-option',
```

`packages/react/src/month-calendar/month-calendar-root.tsx`:
```tsx
import { type MonthString, civilFromEpochDay, formatMonth, parseMonth, toMonthCode } from '@lunisolar-picker/calendar';
import type { HTMLAttributes, ReactElement } from 'react';
import { useState } from 'react';
import { MonthButtonGrid } from '../calendar/month-button-grid';
import { usePickerSettings } from '../settings/use-picker-settings';
import { partAttributes } from '../contract/data-attributes';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { useControllableState } from '../utilities/use-controllable-state';

export interface MonthCalendarRootProps extends SharedPickerProps, Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  readonly value?: string | null;
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: MonthString | null, details: ValueChangeDetails) => void;
  readonly min?: string;
  readonly max?: string;
}

const MONTHS_PER_YEAR = 12;
const MONTH_COLUMN_COUNT = 3;
const VALID = { isValid: true, reasons: [] } as const;

export function MonthCalendarRoot(props: MonthCalendarRootProps): ReactElement {
  const {
    value, defaultValue, onValueChange, min, max, locale: _locale, timeZone: _timeZone, today: _today, weekStartsOn: _weekStartsOn,
    calendars: _calendars, disabled, readOnly, required: _required, invalid: _invalid, name, form, onInvalidValue: _onInvalidValue, ...domProps
  } = props;
  const config = usePickerSettings(props);
  const [selected, setSelected] = useControllableState<string | null>(value, defaultValue ?? null, undefined);
  const parsedSelected = selected === null ? null : parseMonth(selected);
  const selectedMonth = parsedSelected?.isOk ? parsedSelected.value : null;
  const [year, setYear] = useState(selectedMonth?.year ?? civilFromEpochDay(config.todayEpochDay).year);
  const minMonth = min ? parseMonth(min) : null;
  const maxMonth = max ? parseMonth(max) : null;
  const isInteractive = disabled !== true && readOnly !== true;

  const items = Array.from({ length: MONTHS_PER_YEAR }, (_, index) => {
    const month = index + 1;
    const candidate = formatMonth(year, month);
    const candidateValue = candidate.isOk ? candidate.value : null;
    const isBeforeMin = minMonth?.isOk === true && candidateValue !== null && candidateValue < minMonth.value.value;
    const isAfterMax = maxMonth?.isOk === true && candidateValue !== null && candidateValue > maxMonth.value.value;
    const name = config.locale.formatMonthName({ year, monthCode: toMonthCode(month, false) }, 'gregory');
    return {
      key: String(month),
      label: name,
      accessibleName: name,
      isSelected: selectedMonth?.year === year && selectedMonth.month === month,
      isDisabled: !isInteractive || candidateValue === null || isBeforeMin || isAfterMax,
      onPick: () => {
        if (candidateValue === null) return;
        setSelected(candidateValue);
        onValueChange?.(candidateValue, { validity: VALID });
      },
    };
  });

  return (
    <div {...domProps} {...partAttributes('month-calendar')}>
      <div {...partAttributes('month-calendar-header')}>
        <button type="button" aria-label={config.locale.labels.previousYears} onClick={() => setYear(year - 1)} {...partAttributes('calendar-nav-button')}>
          <span aria-hidden="true">‹</span>
        </button>
        <span {...partAttributes('calendar-heading')}>{year}</span>
        <button type="button" aria-label={config.locale.labels.nextYears} onClick={() => setYear(year + 1)} {...partAttributes('calendar-nav-button')}>
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <MonthButtonGrid items={items} columnCount={MONTH_COLUMN_COUNT} label={config.locale.labels.chooseMonth} part="calendar-month-grid" />
      {name ? <input type="hidden" name={name} form={form} value={selectedMonth?.value ?? ''} /> : null}
    </div>
  );
}
```

`packages/react/src/month-calendar/index.ts`:
```ts
import { MonthCalendarRoot } from './month-calendar-root';

export const MonthCalendar = { Root: MonthCalendarRoot } as const;
export type { MonthCalendarRootProps } from './month-calendar-root';
```

`packages/react/src/time-list/list-times.ts`:
```ts
import { type TimeString, formatTime } from '@lunisolar-picker/calendar';

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;
const END_OF_DAY_HOUR = 24;

export function listTimes(minuteStep: number, isEndOfDayAllowed: boolean): readonly TimeString[] {
  const times: TimeString[] = [];
  for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += minuteStep) {
    const time = formatTime(Math.floor(minutes / MINUTES_PER_HOUR), minutes % MINUTES_PER_HOUR);
    if (time.isOk) times.push(time.value);
  }
  const endOfDay = formatTime(END_OF_DAY_HOUR, 0, { isEndOfDayAllowed: true });
  if (isEndOfDayAllowed && endOfDay.isOk) times.push(endOfDay.value);
  return times;
}
```

`packages/react/src/time-list/time-list-root.tsx`:
```tsx
import { type TimeString, parseTime } from '@lunisolar-picker/calendar';
import { type HTMLAttributes, type KeyboardEvent, type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { useControllableState } from '../utilities/use-controllable-state';
import { listTimes } from './list-times';

export interface TimeListRootProps extends Omit<HTMLAttributes<HTMLUListElement>, 'defaultValue' | 'onChange'> {
  readonly value?: string | null;
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: TimeString, details: ValueChangeDetails) => void;
  readonly minuteStep?: number;
  readonly isEndOfDayAllowed?: boolean;
  readonly 'aria-label': string;
}

const DEFAULT_MINUTE_STEP = 30;
const VALID = { isValid: true, reasons: [] } as const;

export function TimeListRoot({
  value,
  defaultValue,
  onValueChange,
  minuteStep = DEFAULT_MINUTE_STEP,
  isEndOfDayAllowed = false,
  ...domProps
}: TimeListRootProps): ReactElement {
  const times = useMemo(() => listTimes(minuteStep, isEndOfDayAllowed), [minuteStep, isEndOfDayAllowed]);
  const [selected, setSelected] = useControllableState<string | null>(value, defaultValue ?? null, undefined);
  const parsedSelected = selected === null ? null : parseTime(selected, { isEndOfDayAllowed });
  const selectedTime = parsedSelected?.isOk ? parsedSelected.value.value : null;
  const [focusedIndex, setFocusedIndex] = useState(Math.max(0, selectedTime === null ? 0 : times.indexOf(selectedTime)));
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    listRef.current?.querySelectorAll<HTMLLIElement>('[role="option"]')[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  function choose(time: TimeString, index: number): void {
    setFocusedIndex(index);
    setSelected(time);
    onValueChange?.(time, { validity: VALID });
  }

  function moveFocus(event: KeyboardEvent<HTMLUListElement>): void {
    const offsetByKey: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const time = times[focusedIndex];
      if (time) choose(time, focusedIndex);
      return;
    }
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? times.length - 1 : focusedIndex + (offsetByKey[event.key] ?? Number.NaN);
    if (Number.isNaN(nextIndex) || nextIndex < 0 || nextIndex >= times.length) return;
    event.preventDefault();
    setFocusedIndex(nextIndex);
    listRef.current?.querySelectorAll<HTMLLIElement>('[role="option"]')[nextIndex]?.focus();
  }

  return (
    <ul {...domProps} ref={listRef} role="listbox" onKeyDown={moveFocus} {...partAttributes('time-list')}>
      {times.map((time, index) => (
        <li
          key={time}
          role="option"
          aria-selected={time === selectedTime}
          tabIndex={index === focusedIndex ? 0 : -1}
          onClick={() => choose(time, index)}
          {...partAttributes('time-option')}
          {...stateAttributes({ selected: time === selectedTime, focused: index === focusedIndex })}
        >
          {time}
        </li>
      ))}
    </ul>
  );
}
```

`packages/react/src/time-list/index.ts`:
```ts
import { TimeListRoot } from './time-list-root';

export const TimeList = { Root: TimeListRoot } as const;
export type { TimeListRootProps } from './time-list-root';
export { listTimes } from './list-times';
```

`packages/react/src/index.ts` 끝에 추가:
```ts
export * from './month-calendar/index';
export * from './time-list/index';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/month-calendar src/time-list`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 월 단위 선택과 분 간격 시간 목록 부품 제공" -m "- BI 대시보드의 월 선택과 편성표의 5분 간격 시간 선택을 브라우저 기본 select 없이 같은 디자인으로 쓸 수 있게 함.
- 완성형 picker가 공개 부품만 조합하도록 월 격자·시간 목록을 부품으로 먼저 열어 둠."
```

---

### Task 8: picker 공통 뼈대와 `DatePicker`

> 🟡 잠정: M3 `Popover`·`Sheet`의 open 제어 prop 이름, `Popover.Trigger`의 `render` 함수 인자, Content 언마운트 여부, `usePresentation`, `DateField.Root`의 기본 렌더에 따라 바뀔 수 있음

**Files:**
- Create: `packages/react/src/pickers/trigger-render-props.ts`, `format-display-value.ts`, `default-trigger.tsx`, `picker-surface.tsx`, `picker-footer.tsx`, `date-picker.tsx`, `index.ts`
- Modify: `packages/react/src/contract/data-attributes.ts` (`'date-picker'`, `'date-range-picker'`, `'month-picker'`, `'time-picker'`, `'wheel-date-picker'` 추가)
- Test: `packages/react/src/pickers/date-picker.test.tsx`

**Interfaces:**
- Consumes: Task 1~3 공개 API(`Calendar`, `useSingleCalendar`, `UseCalendarProps`, `CellRenderInfo`), M3 `Popover`, `Sheet`, `usePresentation`, `DateField`, `usePickerSettings`, `useControllableState`, `Presentation`, `TriggerRenderProps`, core `formatDateForField`, `findCalendar`
- Produces:
  - `formatDisplayDate(value, config, separator?): string`, `formatDisplayRange(value, config, separator?): string`
  - `DefaultTrigger({ triggerProps, label, icon })`, `CalendarIcon`, `ClockIcon`
  - `PickerSurface({ presentation, isOpen, onOpenChange, label, renderTrigger, children })`
  - `PickerFooter({ onConfirm, onCancel, isConfirmDisabled })`
  - `interface PickerOpenProps { open?; defaultOpen?; onOpenChange? }`
  - `DatePicker(props: DatePickerProps)`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/pickers/date-picker.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { KoreanProvider, dayLabel } from '../testing/korean-fixture';
import { DatePicker } from './index';

describe('DatePicker', () => {
  it('opens the calendar from the trigger, selects a day and closes', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><DatePicker presentation="popover" onValueChange={onValueChange} /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
    await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();

    expect(onValueChange).toHaveBeenCalledWith('2026-10-20', { validity: { isValid: true, reasons: [] } });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for the confirm button in confirm mode', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <DatePicker presentation="popover" commitMode="confirm" defaultValue="2026-10-01" onValueChange={onValueChange} />
      </KoreanProvider>,
    );

    await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
    await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();
    expect(onValueChange).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: ko.labels.confirm }).click();
    expect(onValueChange).toHaveBeenCalledWith('2026-10-20', { validity: { isValid: true, reasons: [] } });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders an app trigger with the formatted value', async () => {
    const screen = await render(
      <KoreanProvider>
        <DatePicker
          presentation="popover"
          defaultValue="2026-10-20"
          separator="-"
          renderTrigger={({ displayValue, triggerProps }) => (
            <button {...triggerProps} type="button">
              {`설치일 ${displayValue}`}
            </button>
          )}
        />
      </KoreanProvider>,
    );

    await expect.element(screen.getByRole('button', { name: '설치일 2026-10-20' })).toBeVisible();
  });

  it('opens as a sheet when asked', async () => {
    const screen = await render(<KoreanProvider><DatePicker presentation="sheet" /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseDate }).click();

    await expect.element(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers/date-picker.test.tsx`
Expected: FAIL — `Failed to resolve import "./index"`

- [ ] **Step 3: 구현**

`packages/react/src/contract/data-attributes.ts`의 `PART_NAMES` 끝에 추가:
```ts
  'date-picker',
  'date-range-picker',
  'month-picker',
  'time-picker',
  'wheel-date-picker',
```

`packages/react/src/pickers/format-display-value.ts`:
```ts
import { calendarIdOf, epochDayOf, parseDate } from '@lunisolar-picker/calendar';
import { findCalendar, formatDateForField } from '@lunisolar-picker/core';
import type { PickerSettings } from '../settings/use-picker-settings';

export function formatDisplayDate(value: string | null | undefined, config: PickerSettings, separator?: string): string {
  if (!value) return '';
  const parsed = parseDate(value, { calendars: config.calendars });
  if (!parsed.isOk) return '';
  const calendar = findCalendar(config.calendars, calendarIdOf(parsed.value.value));
  return formatDateForField(epochDayOf(parsed.value.value), calendar, config.locale, separator);
}

export function formatDisplayRange(
  value: { readonly start: string; readonly end: string | null } | null | undefined,
  config: PickerSettings,
  separator?: string,
): string {
  if (!value) return '';
  const start = formatDisplayDate(value.start, config, separator);
  const end = formatDisplayDate(value.end, config, separator);
  return end ? `${start}${config.locale.rangeSeparator}${end}` : start;
}
```

`packages/react/src/pickers/default-trigger.tsx`:
```tsx
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { partAttributes } from '../contract/data-attributes';

export interface DefaultTriggerProps {
  readonly triggerProps: ButtonHTMLAttributes<HTMLButtonElement>;
  readonly label: string;
  readonly icon: ReactNode;
}

export function DefaultTrigger({ triggerProps, label, icon }: DefaultTriggerProps): ReactElement {
  return (
    <button {...triggerProps} type="button" aria-label={label} {...partAttributes('popover-trigger')}>
      {icon}
    </button>
  );
}

export function CalendarIcon(): ReactElement {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

export function ClockIcon(): ReactElement {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}
```

`packages/react/src/pickers/trigger-render-props.ts`:
```ts
import type { ButtonHTMLAttributes } from 'react';

// Goal: 필터 칩처럼 앱 고유 트리거를 그릴 때 표시 문자열·열림 상태·버튼 속성을 한 번에 넘김 (계약 §3.5)
export interface TriggerRenderProps {
  readonly displayValue: string;
  readonly isOpen: boolean;
  readonly placeholder: string;
  readonly triggerProps: ButtonHTMLAttributes<HTMLButtonElement>;
}
```

`packages/react/src/pickers/picker-surface.tsx`:
```tsx
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { Popover, Sheet, usePresentation } from '../index';
import type { Presentation } from '../index';

export interface PickerSurfaceProps {
  readonly presentation: Presentation;
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly label: string;
  readonly renderTrigger: (triggerProps: ButtonHTMLAttributes<HTMLButtonElement>) => ReactElement;
  readonly children: ReactNode;
}

// Constraint: Content는 닫히면 언마운트되므로 확인 모드에서 확정하지 않고 닫으면 임시 선택이 자연히 버려짐 (Review Focus 5)
export function PickerSurface({ presentation, isOpen, onOpenChange, label, renderTrigger, children }: PickerSurfaceProps): ReactElement {
  const resolved = usePresentation(presentation);
  if (resolved === 'sheet') {
    return (
      <>
        {renderTrigger({ type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': isOpen, onClick: () => onOpenChange(true) })}
        <Sheet.Root open={isOpen} onOpenChange={onOpenChange}>
          <Sheet.Content aria-label={label}>{children}</Sheet.Content>
        </Sheet.Root>
      </>
    );
  }
  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger render={(triggerProps) => renderTrigger(triggerProps as ButtonHTMLAttributes<HTMLButtonElement>)} />
      <Popover.Content aria-label={label}>{children}</Popover.Content>
    </Popover.Root>
  );
}
```

`packages/react/src/pickers/picker-footer.tsx`:
```tsx
import type { ReactElement } from 'react';
import { usePickerSettings } from '../settings/use-picker-settings';
import { partAttributes } from '../contract/data-attributes';

export interface PickerFooterProps {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isConfirmDisabled: boolean;
}

export function PickerFooter({ onConfirm, onCancel, isConfirmDisabled }: PickerFooterProps): ReactElement {
  const { locale } = usePickerSettings({});
  return (
    <div {...partAttributes('picker-footer')}>
      <button type="button" onClick={onCancel}>
        {locale.labels.cancel}
      </button>
      <button type="button" onClick={onConfirm} disabled={isConfirmDisabled}>
        {locale.labels.confirm}
      </button>
    </div>
  );
}
```

`packages/react/src/pickers/date-picker.tsx`:
```tsx
import type { DateString } from '@lunisolar-picker/calendar';
import type { ReactElement, ReactNode } from 'react';
import { Calendar, type CellRenderInfo, DateField, type UseCalendarProps, useSingleCalendar } from '../index';
import { usePickerSettings } from '../settings/use-picker-settings';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import type { Presentation } from '../index';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import type { TriggerRenderProps } from './trigger-render-props';
import { useControllableState } from '../utilities/use-controllable-state';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { formatDisplayDate } from './format-display-value';
import { PickerFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';

export interface PickerOpenProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
}

export interface DatePickerProps extends UseCalendarProps, PickerOpenProps {
  readonly presentation?: Presentation;
  readonly placeholder?: string;
  readonly separator?: string;
  readonly renderTrigger?: (props: TriggerRenderProps) => ReactElement;
  readonly renderCell?: (info: CellRenderInfo) => ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function DatePicker(props: DatePickerProps): ReactElement {
  const {
    presentation = 'auto', placeholder = '', separator, renderTrigger, renderCell, footer, className,
    open, defaultOpen, onOpenChange, value, defaultValue, onValueChange, onBlur, ...calendarProps
  } = props;
  const config = usePickerSettings(props);
  const [currentValue, setCurrentValue] = useControllableState<string | null>(value, defaultValue ?? null, undefined);
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const isConfirmMode = calendarProps.commitMode === 'confirm';

  function changeValue(next: DateString | null, details: ValueChangeDetails): void {
    setCurrentValue(next);
    onValueChange?.(next, details);
  }

  const displayValue = formatDisplayDate(currentValue, config, separator);
  return (
    <div className={className} {...partAttributes('date-picker')} {...stateAttributes({ open: isOpen, invalid: calendarProps.invalid === true })}>
      {renderTrigger ? null : (
        <DateField.Root {...calendarProps} value={currentValue} onValueChange={changeValue} onBlur={onBlur} {...(separator ? { separator } : {})} />
      )}
      <PickerSurface
        presentation={presentation}
        isOpen={isOpen}
        onOpenChange={setOpen}
        label={config.locale.labels.chooseDate}
        renderTrigger={(triggerProps) =>
          renderTrigger
            ? renderTrigger({ displayValue, isOpen, placeholder, triggerProps })
            : <DefaultTrigger triggerProps={triggerProps} label={config.locale.labels.chooseDate} icon={<CalendarIcon />} />
        }
      >
        <Calendar.Root
          {...calendarProps}
          value={currentValue}
          onValueChange={(next, details) => {
            changeValue(next, details);
            if (!isConfirmMode) setOpen(false);
          }}
        >
          <Calendar.Layout {...(renderCell ? { renderCell } : {})} />
          {footer}
          {isConfirmMode ? <SingleConfirmFooter onClose={() => setOpen(false)} /> : null}
        </Calendar.Root>
      </PickerSurface>
    </div>
  );
}

function SingleConfirmFooter({ onClose }: { readonly onClose: () => void }): ReactElement {
  const calendar = useSingleCalendar();
  return (
    <PickerFooter
      isConfirmDisabled={calendar.selection.draft === null}
      onCancel={onClose}
      onConfirm={() => {
        calendar.commit();
        onClose();
      }}
    />
  );
}
```

`packages/react/src/pickers/index.ts`:
```ts
export type { TriggerRenderProps } from './trigger-render-props';
export { DatePicker } from './date-picker';
export type { DatePickerProps, PickerOpenProps } from './date-picker';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src
ALLOW_COMMIT=1 git commit -m "feat: 입력 칸과 팝오버 달력을 묶은 DatePicker 제공" -m "- 데스크톱은 팝오버, 좁은 터치 화면은 시트로 열고 확인 모드에서는 확정 전까지 값이 바뀌지 않게 함.
- 필터 칩처럼 앱 고유 트리거를 쓰는 화면을 위해 표시 문자열과 트리거 속성을 renderTrigger로 넘김."
```

---

### Task 9: `DateRangePicker`와 `usePickerSelection`

> 🟡 잠정: M3 `DateRangeField.Root`의 prop(`value: { start; end }`, `onValueChange`)과 Popover Content 언마운트 동작에 따라 바뀔 수 있음

**Files:**
- Create: `packages/react/src/pickers/picker-selection.ts`, `packages/react/src/pickers/date-range-picker.tsx`
- Modify: `packages/react/src/pickers/index.ts`
- Test: `packages/react/src/pickers/date-range-picker.test.tsx`

**Interfaces:**
- Consumes: Task 4 `RangeCalendar`, `useRangeCalendarContext`, `UseRangeCalendarProps`, `RangeValueInput`, Task 8 뼈대, M3 `DateRangeField`
- Produces:
  - `interface PickerSelection { draftRange: DateRangeValue | null; validity: Validity; setRange(range: RangeValueInput | null): void; commit(): void; cancel(): void }`
  - `PickerSelectionContext`, `usePickerSelection(): PickerSelection`
  - `DateRangePicker(props: DateRangePickerProps)` (`presets?: ReactNode`)

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/pickers/date-range-picker.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { KoreanProvider, dayLabel } from '../testing/korean-fixture';
import { DateRangePicker, usePickerSelection } from './index';

async function tapDay(screen: Awaited<ReturnType<typeof render>>, isoDate: string): Promise<void> {
  await screen.getByRole('button', { name: dayLabel(isoDate) }).click();
}

describe('DateRangePicker', () => {
  it('closes after the second day in immediate mode', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><DateRangePicker presentation="popover" onValueChange={onValueChange} /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
    await tapDay(screen, '2026-10-13');
    await tapDay(screen, '2026-10-17');

    expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: { isValid: true, reasons: [] } });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the committed range again after closing a confirm-mode draft by clicking outside', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <p>outside</p>
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          defaultValue={{ start: '2026-10-01', end: '2026-10-03' }}
          onValueChange={onValueChange}
        />
      </KoreanProvider>,
    );

    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
    await tapDay(screen, '2026-10-13');
    await tapDay(screen, '2026-10-17');
    await screen.getByText('outside').click();
    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();

    const selected = [...screen.container.ownerDocument.querySelectorAll('[data-lsp-part="calendar-cell"][data-selected] > button')].map(
      (button) => button.getAttribute('aria-label'),
    );
    expect(selected).toEqual([dayLabel('2026-10-01'), dayLabel('2026-10-03')]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('lets preset buttons in the presets slot set the draft range', async () => {
    function LastWeekPreset() {
      const selection = usePickerSelection();
      return (
        <button type="button" onClick={() => selection.setRange({ start: '2026-10-08', end: '2026-10-14' })}>
          지난 7일
        </button>
      );
    }
    const onValueChange = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <DateRangePicker presentation="popover" commitMode="confirm" presets={<LastWeekPreset />} onValueChange={onValueChange} />
      </KoreanProvider>,
    );

    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
    await screen.getByRole('button', { name: '지난 7일' }).click();
    await screen.getByRole('button', { name: ko.labels.confirm }).click();

    expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-08', end: '2026-10-14' }, { validity: { isValid: true, reasons: [] } });
  });

  it('disables confirm while the draft breaks maxDays in flag mode', async () => {
    const screen = await render(<KoreanProvider><DateRangePicker presentation="popover" commitMode="confirm" maxDays={3} limitMode="flag" /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
    await tapDay(screen, '2026-10-01');
    await tapDay(screen, '2026-10-10');

    await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeDisabled();
  });

  it('closes with Escape and keeps the committed value', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <DateRangePicker presentation="popover" commitMode="confirm" defaultValue={{ start: '2026-10-01', end: '2026-10-03' }} onValueChange={onValueChange} />
      </KoreanProvider>,
    );

    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
    await tapDay(screen, '2026-10-20');
    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers/date-range-picker.test.tsx`
Expected: FAIL — `DateRangePicker`, `usePickerSelection`이 export되지 않음

- [ ] **Step 3: 구현**

`packages/react/src/pickers/picker-selection.ts`:
```ts
import { type DateRangeValue, LunisolarPickerError } from '@lunisolar-picker/calendar';
import type { Validity } from '@lunisolar-picker/core';
import { createContext, useContext } from 'react';
import type { RangeValueInput } from '../index';

export interface PickerSelection {
  readonly draftRange: DateRangeValue | null;
  readonly validity: Validity;
  setRange(range: RangeValueInput | null): void;
  commit(): void;
  cancel(): void;
}

export const PickerSelectionContext = createContext<PickerSelection | null>(null);

// Goal: 프리셋 버튼 종류·라벨은 앱이 정하고, 라이브러리는 '범위를 넣어 선택'하는 통로만 줌 (스펙 2.2)
export function usePickerSelection(): PickerSelection {
  const selection = useContext(PickerSelectionContext);
  if (!selection) throw new LunisolarPickerError('usePickerSelection must be used inside DateRangePicker presets or footer');
  return selection;
}
```

`packages/react/src/pickers/date-range-picker.tsx`:
```tsx
import type { DateRangeValue } from '@lunisolar-picker/calendar';
import type { ReactElement, ReactNode } from 'react';
import {
  Calendar,
  type CellRenderInfo,
  DateRangeField,
  RangeCalendar,
  type RangeValueInput,
  type UseRangeCalendarProps,
  useRangeCalendarContext,
} from '../index';
import { usePickerSettings } from '../settings/use-picker-settings';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import type { Presentation } from '../index';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import type { TriggerRenderProps } from './trigger-render-props';
import { useControllableState } from '../utilities/use-controllable-state';
import type { PickerOpenProps } from './date-picker';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { formatDisplayRange } from './format-display-value';
import { PickerFooter } from './picker-footer';
import { PickerSelectionContext } from './picker-selection';
import { PickerSurface } from './picker-surface';

export interface DateRangePickerProps extends UseRangeCalendarProps, PickerOpenProps {
  readonly presentation?: Presentation;
  readonly placeholder?: string;
  readonly separator?: string;
  readonly renderTrigger?: (props: TriggerRenderProps) => ReactElement;
  readonly renderCell?: (info: CellRenderInfo) => ReactNode;
  readonly presets?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function DateRangePicker(props: DateRangePickerProps): ReactElement {
  const {
    presentation = 'auto', placeholder = '', separator, renderTrigger, renderCell, presets, footer, className,
    open, defaultOpen, onOpenChange, value, defaultValue, onValueChange, onBlur, ...calendarProps
  } = props;
  const config = usePickerSettings(props);
  const [currentValue, setCurrentValue] = useControllableState<RangeValueInput | null>(value, defaultValue ?? null, undefined);
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const isConfirmMode = calendarProps.commitMode === 'confirm';

  function changeValue(next: DateRangeValue | null, details: ValueChangeDetails): void {
    setCurrentValue(next);
    onValueChange?.(next, details);
  }

  const displayValue = formatDisplayRange(currentValue, config, separator);
  return (
    <div className={className} {...partAttributes('date-range-picker')} {...stateAttributes({ open: isOpen, invalid: calendarProps.invalid === true })}>
      {renderTrigger ? null : (
        <DateRangeField.Root {...calendarProps} value={currentValue} onValueChange={changeValue} onBlur={onBlur} {...(separator ? { separator } : {})} />
      )}
      <PickerSurface
        presentation={presentation}
        isOpen={isOpen}
        onOpenChange={setOpen}
        label={config.locale.labels.chooseDateRange}
        renderTrigger={(triggerProps) =>
          renderTrigger
            ? renderTrigger({ displayValue, isOpen, placeholder, triggerProps })
            : <DefaultTrigger triggerProps={triggerProps} label={config.locale.labels.chooseDateRange} icon={<CalendarIcon />} />
        }
      >
        <RangeCalendar.Root
          {...calendarProps}
          value={currentValue}
          onValueChange={(next, details) => {
            changeValue(next, details);
            if (!isConfirmMode && next?.end) setOpen(false);
          }}
        >
          <SelectionBridge onClose={() => setOpen(false)}>
            {presets ? <div {...partAttributes('picker-presets')}>{presets}</div> : null}
            <Calendar.Layout {...(renderCell ? { renderCell } : {})} />
            {footer}
            {isConfirmMode ? <RangeConfirmFooter onClose={() => setOpen(false)} /> : null}
          </SelectionBridge>
        </RangeCalendar.Root>
      </PickerSurface>
    </div>
  );
}

function SelectionBridge({ onClose, children }: { readonly onClose: () => void; readonly children: ReactNode }): ReactElement {
  const range = useRangeCalendarContext();
  return (
    <PickerSelectionContext.Provider
      value={{
        draftRange: range.draftValue,
        validity: range.validity,
        setRange: range.setRange,
        commit: () => {
          range.commit();
          onClose();
        },
        cancel: () => {
          range.cancel();
          onClose();
        },
      }}
    >
      {children}
    </PickerSelectionContext.Provider>
  );
}

function RangeConfirmFooter({ onClose }: { readonly onClose: () => void }): ReactElement {
  const range = useRangeCalendarContext();
  return (
    <PickerFooter
      isConfirmDisabled={range.draftValue?.end == null || !range.validity.isValid}
      onCancel={onClose}
      onConfirm={() => {
        range.commit();
        onClose();
      }}
    />
  );
}
```

`packages/react/src/pickers/index.ts`에 추가:
```ts
export { DateRangePicker } from './date-range-picker';
export type { DateRangePickerProps } from './date-range-picker';
export { usePickerSelection } from './picker-selection';
export type { PickerSelection } from './picker-selection';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src/pickers
ALLOW_COMMIT=1 git commit -m "feat: 프리셋 슬롯과 확인 후 반영을 갖춘 DateRangePicker 제공" -m "- 두 앱의 '조회' 버튼 흐름을 commitMode confirm으로 옮기고, 확정 없이 닫으면 이전 범위로 돌아가게 함.
- 최근 N일 같은 프리셋은 앱이 usePickerSelection으로 범위를 넣게 해 라벨·종류가 라이브러리에 굳지 않게 함."
```

---

### Task 10: `MonthPicker`, `WheelDatePicker`, `TimePicker`

> 🟡 잠정: M3 `useWheelDate`의 입력 prop, `TimeField.Root`의 prop(`minuteStep`, `isEndOfDayAllowed`)에 따라 바뀔 수 있음

> 정합성 조정(2026-10-14): 휠은 M3 API대로 `Wheel.Column`에 `options`·`value`·`onValueChange`·`label`을 넘기고, `useWheelDate`의 `columns`·`fields`·`select*`를 쓴다.

**Files:**
- Create: `packages/react/src/pickers/month-picker.tsx`, `wheel-date-picker.tsx`, `time-picker.tsx`
- Modify: `packages/react/src/pickers/index.ts`
- Test: `packages/react/src/pickers/other-pickers.test.tsx`

**Interfaces:**
- Consumes: Task 7 `MonthCalendar`, `TimeList`, Task 8 뼈대, M3 `Wheel`, `useWheelDate`, `TimeField`, `Sheet`
- Produces: `MonthPicker`, `WheelDatePicker` (`presentation: 'inline' | 'sheet'`), `TimePicker`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/react/src/pickers/other-pickers.test.tsx`:
```tsx
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { KoreanProvider } from '../testing/korean-fixture';
import { MonthPicker, TimePicker, WheelDatePicker } from './index';

describe('MonthPicker', () => {
  it('picks a month and shows it in the trigger', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><MonthPicker presentation="popover" defaultValue="2026-10" onValueChange={onValueChange} /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseMonth }).click();
    await screen.getByRole('button', { name: ko.formatMonthName({ year: 2026, monthCode: 'M11' }, 'gregory') }).click();

    expect(onValueChange).toHaveBeenCalledWith('2026-11', { validity: { isValid: true, reasons: [] } });
    await expect.element(screen.getByRole('button', { name: ko.labels.chooseMonth })).toHaveTextContent(
      ko.formatHeading({ year: 2026, monthCode: 'M11' }, 'gregory'),
    );
  });
});

describe('TimePicker', () => {
  it('offers five-minute steps and fills the field from the list', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><TimePicker presentation="popover" minuteStep={5} onValueChange={onValueChange} /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseTime }).click();
    expect(screen.getByRole('option').all()).toHaveLength(288);
    await screen.getByRole('option', { name: '09:35' }).click();

    expect(onValueChange).toHaveBeenCalledWith('09:35', { validity: { isValid: true, reasons: [] } });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('WheelDatePicker', () => {
  it('renders year, month and day columns inline', async () => {
    const screen = await render(<KoreanProvider><WheelDatePicker defaultValue="1990-03-15" /></KoreanProvider>);

    expect(screen.getByRole('spinbutton').all()).toHaveLength(3);
  });

  it('applies the wheel draft only after confirm in a sheet', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><WheelDatePicker presentation="sheet" defaultValue="1990-03-15" onValueChange={onValueChange} /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
    const yearColumn = screen.getByRole('spinbutton').first().element() as HTMLElement;
    yearColumn.focus();
    yearColumn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(onValueChange).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: ko.labels.confirm }).click();
    expect(onValueChange).toHaveBeenCalledWith('1989-03-15', { validity: { isValid: true, reasons: [] } });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers/other-pickers.test.tsx`
Expected: FAIL — export 없음

- [ ] **Step 3: 구현**

`packages/react/src/pickers/month-picker.tsx`:
```tsx
import { type MonthString, parseMonth, toMonthCode } from '@lunisolar-picker/calendar';
import type { ReactElement } from 'react';
import { MonthCalendar, type MonthCalendarRootProps } from '../index';
import { usePickerSettings } from '../settings/use-picker-settings';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import type { Presentation } from '../index';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import type { TriggerRenderProps } from './trigger-render-props';
import { useControllableState } from '../utilities/use-controllable-state';
import type { PickerOpenProps } from './date-picker';
import { PickerSurface } from './picker-surface';

export interface MonthPickerProps extends Omit<MonthCalendarRootProps, 'children'>, PickerOpenProps {
  readonly presentation?: Presentation;
  readonly placeholder?: string;
  readonly renderTrigger?: (props: TriggerRenderProps) => ReactElement;
}

export function MonthPicker(props: MonthPickerProps): ReactElement {
  const { presentation = 'auto', placeholder = '', renderTrigger, open, defaultOpen, onOpenChange, value, defaultValue, onValueChange, className, ...calendarProps } = props;
  const config = usePickerSettings(props);
  const [currentValue, setCurrentValue] = useControllableState<string | null>(value, defaultValue ?? null, undefined);
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const parsed = currentValue ? parseMonth(currentValue) : null;
  const displayValue = parsed?.isOk ? config.locale.formatHeading({ year: parsed.value.year, monthCode: toMonthCode(parsed.value.month, false) }, 'gregory') : '';

  function changeValue(next: MonthString | null, details: ValueChangeDetails): void {
    setCurrentValue(next);
    onValueChange?.(next, details);
    setOpen(false);
  }

  return (
    <div className={className} {...partAttributes('month-picker')} {...stateAttributes({ open: isOpen, placeholder: displayValue === '' })}>
      <PickerSurface
        presentation={presentation}
        isOpen={isOpen}
        onOpenChange={setOpen}
        label={config.locale.labels.chooseMonth}
        renderTrigger={(triggerProps) =>
          renderTrigger ? (
            renderTrigger({ displayValue, isOpen, placeholder, triggerProps })
          ) : (
            <button {...triggerProps} type="button" aria-label={config.locale.labels.chooseMonth} {...partAttributes('popover-trigger')}>
              {displayValue || placeholder}
            </button>
          )
        }
      >
        <MonthCalendar.Root {...calendarProps} value={currentValue} onValueChange={changeValue} />
      </PickerSurface>
    </div>
  );
}
```

`packages/react/src/pickers/time-picker.tsx`:
```tsx
import type { TimeString } from '@lunisolar-picker/calendar';
import type { ReactElement } from 'react';
import { TimeField, TimeList } from '../index';
import { usePickerSettings } from '../settings/use-picker-settings';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import type { Presentation } from '../index';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import type { TriggerRenderProps } from './trigger-render-props';
import { useControllableState } from '../utilities/use-controllable-state';
import type { PickerOpenProps } from './date-picker';
import { ClockIcon, DefaultTrigger } from './default-trigger';
import { PickerSurface } from './picker-surface';

export interface TimePickerProps extends SharedPickerProps, PickerOpenProps {
  readonly value?: string | null;
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: TimeString | null, details: ValueChangeDetails) => void;
  readonly minuteStep?: number;
  readonly isEndOfDayAllowed?: boolean;
  readonly presentation?: Presentation;
  readonly placeholder?: string;
  readonly renderTrigger?: (props: TriggerRenderProps) => ReactElement;
  readonly className?: string;
}

const DEFAULT_MINUTE_STEP = 30;

export function TimePicker(props: TimePickerProps): ReactElement {
  const {
    value, defaultValue, onValueChange, minuteStep = DEFAULT_MINUTE_STEP, isEndOfDayAllowed = false, presentation = 'auto',
    placeholder = '', renderTrigger, className, open, defaultOpen, onOpenChange, ...fieldProps
  } = props;
  const config = usePickerSettings(props);
  const [currentValue, setCurrentValue] = useControllableState<string | null>(value, defaultValue ?? null, undefined);
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);

  function changeValue(next: TimeString | null, details: ValueChangeDetails): void {
    setCurrentValue(next);
    onValueChange?.(next, details);
  }

  return (
    <div className={className} {...partAttributes('time-picker')} {...stateAttributes({ open: isOpen })}>
      {renderTrigger ? null : (
        <TimeField.Root {...fieldProps} value={currentValue} onValueChange={changeValue} minuteStep={minuteStep} isEndOfDayAllowed={isEndOfDayAllowed} />
      )}
      <PickerSurface
        presentation={presentation}
        isOpen={isOpen}
        onOpenChange={setOpen}
        label={config.locale.labels.chooseTime}
        renderTrigger={(triggerProps) =>
          renderTrigger
            ? renderTrigger({ displayValue: currentValue ?? '', isOpen, placeholder, triggerProps })
            : <DefaultTrigger triggerProps={triggerProps} label={config.locale.labels.chooseTime} icon={<ClockIcon />} />
        }
      >
        <TimeList.Root
          aria-label={config.locale.labels.chooseTime}
          value={currentValue}
          minuteStep={minuteStep}
          isEndOfDayAllowed={isEndOfDayAllowed}
          onValueChange={(next, details) => {
            changeValue(next, details);
            setOpen(false);
          }}
        />
      </PickerSurface>
    </div>
  );
}
```

`packages/react/src/pickers/wheel-date-picker.tsx`:
```tsx
import type { DateString } from '@lunisolar-picker/calendar';
import type { DateConstraints } from '@lunisolar-picker/core';
import { type ReactElement, useState } from 'react';
import { Wheel, useWheelDate } from '../index';
import { usePickerSettings } from '../settings/use-picker-settings';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import type { TriggerRenderProps } from './trigger-render-props';
import { useControllableState } from '../utilities/use-controllable-state';
import type { PickerOpenProps } from './date-picker';
import { formatDisplayDate } from './format-display-value';
import { PickerFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';

export interface WheelDatePickerProps extends SharedPickerProps, Omit<DateConstraints, 'isDateDisabled'>, PickerOpenProps {
  readonly value?: string | null;
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: DateString | null, details: ValueChangeDetails) => void;
  readonly presentation?: 'inline' | 'sheet';
  readonly placeholder?: string;
  readonly separator?: string;
  readonly renderTrigger?: (props: TriggerRenderProps) => ReactElement;
  readonly className?: string;
}

export function WheelDatePicker(props: WheelDatePickerProps): ReactElement {
  const {
    value, defaultValue, onValueChange, presentation = 'inline', placeholder = '', separator, renderTrigger, className,
    open, defaultOpen, onOpenChange, ...wheelProps
  } = props;
  const config = usePickerSettings(props);
  const [currentValue, setCurrentValue] = useControllableState<string | null>(value, defaultValue ?? null, undefined);
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);

  function changeValue(next: DateString | null, details: ValueChangeDetails): void {
    setCurrentValue(next);
    onValueChange?.(next, details);
  }

  if (presentation === 'inline') {
    return (
      <div className={className} {...partAttributes('wheel-date-picker')}>
        <WheelDateColumns {...wheelProps} value={currentValue} onValueChange={changeValue} />
      </div>
    );
  }

  const displayValue = formatDisplayDate(currentValue, config, separator);
  return (
    <div className={className} {...partAttributes('wheel-date-picker')} {...stateAttributes({ open: isOpen })}>
      <PickerSurface
        presentation="sheet"
        isOpen={isOpen}
        onOpenChange={setOpen}
        label={config.locale.labels.chooseDate}
        renderTrigger={(triggerProps) =>
          renderTrigger ? (
            renderTrigger({ displayValue, isOpen, placeholder, triggerProps })
          ) : (
            <button {...triggerProps} type="button" aria-label={config.locale.labels.chooseDate} {...partAttributes('popover-trigger')}>
              {displayValue || placeholder}
            </button>
          )
        }
      >
        <SheetWheelDraft
          wheelProps={wheelProps}
          initialValue={currentValue}
          onConfirm={(next, details) => {
            changeValue(next, details);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </PickerSurface>
    </div>
  );
}

type WheelColumnsProps = Omit<WheelDatePickerProps, 'presentation' | 'placeholder' | 'separator' | 'renderTrigger' | 'className' | keyof PickerOpenProps>;

function WheelDateColumns(props: WheelColumnsProps): ReactElement {
  const config = usePickerSettings(props);
  const wheel = useWheelDate(props);
  return (
    <Wheel.Root aria-label={config.locale.labels.chooseDate}>
      <Wheel.Column options={wheel.columns.years} value={wheel.fields.year} onValueChange={wheel.selectYear} label={wheel.labels.year} />
      <Wheel.Column
        options={wheel.columns.months}
        value={wheel.fields.monthCode}
        onValueChange={wheel.selectMonth}
        label={wheel.labels.month}
      />
      <Wheel.Column options={wheel.columns.days} value={wheel.fields.day} onValueChange={wheel.selectDay} label={wheel.labels.day} />
      <Wheel.Highlight />
    </Wheel.Root>
  );
}

// Goal: 시트 안 휠은 굴리는 동안 값을 바꾸지 않고 확인을 눌러야 반영함. 시트가 닫히면 언마운트되어 임시 값도 버려짐
function SheetWheelDraft({
  wheelProps,
  initialValue,
  onConfirm,
  onCancel,
}: {
  readonly wheelProps: WheelColumnsProps;
  readonly initialValue: string | null;
  readonly onConfirm: (value: DateString | null, details: ValueChangeDetails) => void;
  readonly onCancel: () => void;
}): ReactElement {
  const [draft, setDraft] = useState<{ value: DateString | null; details: ValueChangeDetails } | null>(null);
  return (
    <>
      <WheelDateColumns {...wheelProps} value={draft?.value ?? initialValue} onValueChange={(value, details) => setDraft({ value, details })} />
      <PickerFooter
        isConfirmDisabled={false}
        onCancel={onCancel}
        onConfirm={() => {
          if (draft) onConfirm(draft.value, draft.details);
          else onCancel();
        }}
      />
    </>
  );
}
```

`packages/react/src/pickers/index.ts`에 추가:
```ts
export { MonthPicker } from './month-picker';
export type { MonthPickerProps } from './month-picker';
export { TimePicker } from './time-picker';
export type { TimePickerProps } from './time-picker';
export { WheelDatePicker } from './wheel-date-picker';
export type { WheelDatePickerProps } from './wheel-date-picker';
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers`
Expected: PASS

- [ ] **Step 5: 품질 게이트**

Run: `just fix && just check && just test`
Expected: 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/react/src/pickers
ALLOW_COMMIT=1 git commit -m "feat: 월·휠 날짜·시간 picker 완성형 제공" -m "- BI 월 선택, 모바일 생년월일 휠, 편성표 시간 입력을 같은 디자인과 같은 prop 규칙으로 바로 쓸 수 있게 함.
- 시트 안 휠은 확인을 눌러야 반영해 굴리는 도중 값이 바뀌어 폼이 흔들리지 않게 함."
```

---

### Task 11: `pickers` 진입점 빌드, 의존 경계, 크기 예산

> 🟡 잠정: M3의 `packages/react/tsdown.config.ts`·`package.json` exports 형태에 따라 수정 위치가 바뀔 수 있음

> 정합성 조정(2026-10-14): M3 `packages/react/scripts/check-use-client.ts`가 dist의 모든 `.js`를 검사하고, tsdown `banner`가 모든 청크에 `'use client';`를 붙이므로 새 검사 스크립트를 만들지 않는다. `exports`에는 다른 진입점처럼 `@lunisolar-picker/source` 조건을 둔다.

**Files:**
- Modify: `packages/react/tsdown.config.ts`, `packages/react/package.json`, `.dependency-cruiser.cjs`, `scripts/check-bundle-size.ts`
- Create: `packages/react/test/size/date-picker-entry.ts`

**Interfaces:**
- Consumes: Task 8~10 `src/pickers/index.ts`
- Produces: `@lunisolar-picker/react/pickers` 진입점, 크기 예산 `DatePicker ≤ 15360 B gzip`

- [ ] **Step 1: 빌드 진입점 추가**

`packages/react/tsdown.config.ts`의 `entry`에 `pickers: 'src/pickers/index.ts'`를 추가한다(`banner`는 그대로 둔다):
```ts
  entry: { index: 'src/index.ts', contract: 'src/contract.ts', pickers: 'src/pickers/index.ts' },
```

`packages/react/package.json`의 `exports`에 추가:
```json
    "./pickers": { "@lunisolar-picker/source": "./src/pickers/index.ts", "types": "./dist/pickers.d.ts", "default": "./dist/pickers.js" },
```

Run: `pnpm --filter @lunisolar-picker/react run build && pnpm --filter @lunisolar-picker/react exec tsx scripts/check-use-client.ts`
Expected: `"use client" is the first statement in all <N> files` (`pickers.js` 포함)

- [ ] **Step 2: 완성형 의존 경계 규칙 추가**

`.dependency-cruiser.cjs`의 `forbidden` 배열에 추가:
```js
    {
      name: 'pickers-public-api-only',
      comment: '완성형이 부품 내부에 기대면 앱이 복사해 고쳐 쓸 수 없으므로 공개 진입점과 공용 유틸만 쓰게 함 (스펙 7.5)',
      severity: 'error',
      from: { path: '^packages/react/src/pickers/', pathNot: '\\.test\\.tsx?$' },
      to: { path: '^packages/react/src/(?!pickers/|index\\.ts$|contract/|settings/|utilities/)' },
    },
```

Run: `just deps`
Expected: 위반 0

- [ ] **Step 3: 크기 예산 추가**

`packages/react/test/size/date-picker-entry.ts`:
```ts
export { DatePicker } from '../../dist/pickers.js';
```

`scripts/check-bundle-size.ts`에서 `SizeBudget`에 `external` 필드를 추가하고, `build` 호출에 넘기고, 예산 항목을 추가한다(M1·M3에서 넣은 항목은 그대로 둔다):
```ts
interface SizeBudget {
  readonly label: string;
  readonly entry: string;
  readonly maxGzipBytes: number;
  readonly external?: readonly string[];
}
```
```ts
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    external: [...(budget.external ?? [])],
  });
```
(`measureGzipBytes`의 인자를 `entry: string`에서 `budget: SizeBudget`으로 바꾸고 `entryPoints: [budget.entry]`를 쓴다. 호출부도 `measureGzipBytes(budget)`로 바꾼다.)
```ts
  {
    label: '@lunisolar-picker/react/pickers DatePicker',
    entry: 'packages/react/test/size/date-picker-entry.ts',
    maxGzipBytes: 15360,
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  },
```

- [ ] **Step 4: 전체 게이트**

Run: `just fix && just check && just test && just package-check && just size`
Expected: 모두 통과. `DatePicker` 크기가 15360 B를 넘으면 예산을 바꾸지 말고 측정값과 큰 모듈(esbuild `metafile`로 확인)을 사용자에게 보고한다.

- [ ] **Step 5: 커밋**

```bash
git add packages/react/tsdown.config.ts packages/react/package.json packages/react/test/size .dependency-cruiser.cjs scripts
ALLOW_COMMIT=1 git commit -m "chore: 완성형 picker를 별도 진입점으로 배포하고 크기 예산 안에 묶음" -m "- 부품만 쓰는 앱이 완성형 코드를 받지 않도록 /pickers 진입점을 나누고, 서버 컴포넌트에서도 import되도록 \"use client\" 보존을 검사함.
- 완성형이 공개 API만 쓰는지 의존 규칙으로 막고, DatePicker 전체를 gzip 15KB 예산으로 측정함."
```

---

### Task 12: 소비 앱 기능 재현, SSR hydration, 시각 회귀

> 🟡 잠정: M3의 시각 회귀 설정(Docker 기준 이미지, `toMatchScreenshot` 옵션)과 Popover 포털 위치에 따라 스크린샷 대상 locator가 바뀔 수 있음

**Files:**
- Test: `packages/react/src/pickers/consumer-parity.test.tsx`, `packages/react/src/pickers/hydration.test.tsx`, `packages/react/src/visual/pickers.visual.test.tsx`

**Interfaces:**
- Consumes: 완성형 전부, `usePickerSelection`, core `validateRange`, calendar `isSameRange`, `formatDate`, `parseDate`
- Produces: `renderWithHydration(element): Promise<{ container: HTMLElement; recoverableErrors: readonly unknown[] }>` (M3에 같은 헬퍼가 있으면 그것을 쓰고 이 파일은 만들지 않는다)

- [ ] **Step 1: hydration 헬퍼 작성**

> 정합성 조정(2026-10-14): SSR hydration 헬퍼는 M3 `src/testing/expect-hydration.tsx`의 `renderWithHydration`을 쓴다. 이 Task에서 새로 만들지 않는다.

- [ ] **Step 2: 소비 앱 기능 재현 테스트 작성**

`packages/react/src/pickers/consumer-parity.test.tsx`:
```tsx
import { type DateRangeValue, type EpochDay, formatDate, isSameRange } from '@lunisolar-picker/calendar';
import { validateRange } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FIXED_TODAY, KoreanProvider, dayLabel, epochDayAt } from '../testing/korean-fixture';
import { Calendar } from '../index';
import { DateRangePicker, MonthPicker, TimePicker, usePickerSelection } from './index';

const RECENT_DAY_COUNTS = [1, 3, 7] as const;

function recentRange(dayCount: number): DateRangeValue {
  const end = epochDayAt(FIXED_TODAY);
  const start = formatDate((end - dayCount + 1) as EpochDay);
  const endValue = formatDate(end);
  if (!start.isOk || !endValue.isOk) throw new Error('recent range must stay inside the Gregorian range');
  return { start: start.value, end: endValue.value };
}

// Goal: web-console·back-office의 '최근 N일' 프리셋을 앱 코드로 재현할 수 있는지 확인 (기간 초과 비활성, 선택 중 강조)
function RecentDaysPresets({ maxDays }: { readonly maxDays: number }) {
  const selection = usePickerSelection();
  return (
    <>
      {RECENT_DAY_COUNTS.map((dayCount) => {
        const range = recentRange(dayCount);
        const isAllowed = validateRange(range, { max: FIXED_TODAY, maxDays, limitMode: 'flag' }).isValid;
        return (
          <button
            key={dayCount}
            type="button"
            disabled={!isAllowed}
            aria-pressed={isSameRange(selection.draftRange, range)}
            onClick={() => selection.setRange(range)}
          >
            {`최근 ${dayCount}일`}
          </button>
        );
      })}
    </>
  );
}

function RangeWarning() {
  const { validity } = usePickerSelection();
  return validity.isValid ? null : <p role="alert">{validity.reasons.map((reason) => ko.labels.validation[reason]).join(' ')}</p>;
}

describe('consumer parity', () => {
  it('back-office stats replay: recent-day presets, maxDays 3, confirm to apply', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          max={FIXED_TODAY}
          maxDays={3}
          limitMode="flag"
          presets={<RecentDaysPresets maxDays={3} />}
          footer={<RangeWarning />}
          onValueChange={onValueChange}
        />
      </KoreanProvider>,
    );

    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
    await expect.element(screen.getByRole('button', { name: '최근 7일' })).toBeDisabled();
    await screen.getByRole('button', { name: '최근 3일' }).click();
    await expect.element(screen.getByRole('button', { name: '최근 3일' })).toHaveAttribute('aria-pressed', 'true');
    await screen.getByRole('button', { name: ko.labels.confirm }).click();

    expect(onValueChange).toHaveBeenCalledWith(recentRange(3), { validity: { isValid: true, reasons: [] } });
  });

  it('web-console report: an over-long range shows the app warning and blocks confirm', async () => {
    const screen = await render(
      <KoreanProvider>
        <DateRangePicker presentation="popover" commitMode="confirm" maxDays={3} limitMode="flag" footer={<RangeWarning />} />
      </KoreanProvider>,
    );

    await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
    await screen.getByRole('button', { name: dayLabel('2026-10-01') }).click();
    await screen.getByRole('button', { name: dayLabel('2026-10-10') }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent(ko.labels.validation['range-too-long']);
    await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeDisabled();
  });

  it('web-console schedule: two months side by side with holiday marks in cells', async () => {
    const holidays: Readonly<Record<string, string>> = { '2026-10-09': '한글날' };
    const screen = await render(
      <KoreanProvider>
        <DateRangePicker
          presentation="popover"
          defaultOpen
          numberOfMonths={2}
          getCellLabel={(cell) => holidays[cell.date]}
          renderCell={(info) => (
            <>
              {info.day}
              {holidays[info.date] ? <i data-testid="holiday-dot" /> : null}
            </>
          )}
        />
      </KoreanProvider>,
    );

    expect(screen.getByRole('grid').all()).toHaveLength(2);
    await expect.element(screen.getByRole('button', { name: `${dayLabel('2026-10-09')}, 한글날` })).toBeVisible();
  });

  it('back-office range picker: jump back to today after browsing other months', async () => {
    const screen = await render(
      <KoreanProvider>
        <DateRangePicker presentation="popover" defaultOpen />
      </KoreanProvider>,
    );

    await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
    await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
    await screen.getByRole('button', { name: ko.labels.today }).click();

    await expect.element(screen.getByRole('grid')).toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory'));
  });

  it('web-console BI dashboard: pick a month', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<KoreanProvider><MonthPicker presentation="popover" min="2026-01" max="2026-10" onValueChange={onValueChange} /></KoreanProvider>);

    await screen.getByRole('button', { name: ko.labels.chooseMonth }).click();
    await screen.getByRole('button', { name: ko.formatMonthName({ year: 2026, monthCode: 'M09' }, 'gregory') }).click();

    expect(onValueChange).toHaveBeenCalledWith('2026-09', { validity: { isValid: true, reasons: [] } });
  });

  it('web-console timetable: five-minute steps with 24:00 allowed', async () => {
    const screen = await render(<KoreanProvider><TimePicker presentation="popover" minuteStep={5} isEndOfDayAllowed defaultOpen /></KoreanProvider>);

    await expect.element(screen.getByRole('option', { name: '24:00' })).toBeVisible();
    expect(screen.getByRole('option').all()).toHaveLength(289);
  });

  it('standalone calendar keeps working inside app layouts', async () => {
    const screen = await render(<KoreanProvider><Calendar.Root defaultValue="2026-10-20" /></KoreanProvider>);

    await expect.element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') })).toHaveAttribute('aria-selected', 'true');
  });
});
```

`packages/react/src/pickers/hydration.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { KoreanProvider } from '../testing/korean-fixture';
import { renderWithHydration } from '../testing/expect-hydration';
import { Calendar, RangeCalendar } from '../index';
import { DatePicker, DateRangePicker, MonthPicker, TimePicker } from './index';

describe('server rendering', () => {
  it.each([
    ['Calendar', <Calendar.Root key="calendar" defaultValue="2026-10-20" />],
    ['RangeCalendar with lunar labels', <RangeCalendar.Root key="range" defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />],
    ['DatePicker', <DatePicker key="date" presentation="popover" defaultValue="2026-10-20" />],
    ['DateRangePicker', <DateRangePicker key="range-picker" presentation="popover" />],
    ['MonthPicker', <MonthPicker key="month" presentation="popover" defaultValue="2026-10" />],
    ['TimePicker', <TimePicker key="time" presentation="popover" defaultValue="09:30" />],
  ])('hydrates %s without mismatches when today is fixed', async (_, element) => {
    const { recoverableErrors } = await renderWithHydration(<KoreanProvider hasLunar>{element}</KoreanProvider>);

    expect(recoverableErrors).toEqual([]);
  });
});
```

`packages/react/src/visual/pickers.visual.test.tsx`:
```tsx
import '@lunisolar-picker/theme/mono.css';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { Calendar, RangeCalendar } from '../index';
import { DatePicker, DateRangePicker, MonthPicker, TimePicker, WheelDatePicker } from '../pickers/index';
import { KoreanProvider } from '../testing/korean-fixture';

const THEMES = ['light', 'dark'] as const;

const SUBJECTS: readonly (readonly [string, ReactElement])[] = [
  ['calendar', <Calendar.Root defaultValue="2026-10-20" />],
  ['range-calendar', <RangeCalendar.Root defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />],
  ['date-picker', <DatePicker presentation="popover" defaultOpen defaultValue="2026-10-20" />],
  ['date-range-picker', <DateRangePicker presentation="popover" defaultOpen numberOfMonths={2} defaultValue={{ start: '2026-10-13', end: '2026-11-03' }} />],
  ['month-picker', <MonthPicker presentation="popover" defaultOpen defaultValue="2026-10" />],
  ['time-picker', <TimePicker presentation="popover" defaultOpen minuteStep={30} defaultValue="09:30" />],
  ['wheel-date-picker', <WheelDatePicker defaultValue="1990-03-15" />],
];

describe('visual regression', () => {
  for (const theme of THEMES) {
    for (const [name, element] of SUBJECTS) {
      it(`${name} in ${theme}`, async () => {
        await render(
          <div data-theme={theme} data-testid="stage" style={{ padding: 16, minHeight: 480, background: 'var(--lsp-bg)' }}>
            <KoreanProvider hasLunar>{element}</KoreanProvider>
          </div>,
        );

        await expect(page.getByTestId('stage')).toMatchScreenshot(`${name}-${theme}`);
      });
    }
  }
});
```

- [ ] **Step 3: 실행**

Run: `pnpm --filter @lunisolar-picker/react exec vitest run src/pickers/consumer-parity.test.tsx src/pickers/hydration.test.tsx`
Expected: PASS. 실패하면 해당 기능을 공개 API만으로 재현하지 못한다는 뜻이므로, 원인이 된 Task의 구현을 고친다(테스트 기대값을 바꾸지 않는다).

Run: `just visual-update`
Expected: M3의 Docker 기준 환경(`scripts/run-visual-tests.sh`)에서 이 파일의 기준 이미지 14장이 `packages/react/src/visual/__screenshots__/`에 생성됨. 생성된 이미지를 열어 Mono 시안(스펙 8.3)과 다르면 Task 6 CSS를 고친다. Docker를 쓸 수 없으면 여기서 멈추고 사용자에게 알린다.

Run: `just visual`
Expected: PASS

- [ ] **Step 4: 품질 게이트**

Run: `just fix && just check && just test && just package-check && just size`
Expected: 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add packages/react/src/pickers packages/react/src/visual
ALLOW_COMMIT=1 git commit -m "test: 기존 앱 기능을 공개 API만으로 재현할 수 있음을 고정" -m "- 최근 N일 프리셋·기간 초과 경고·확인 후 반영·두 달 표시·공휴일 칸·월 선택·5분 간격 시간을 앱 코드로 다시 만들어 교체 가능성을 확인함.
- 오늘을 고정한 SSR hydration과 picker별 라이트·다크 스크린샷으로 서버·브라우저 불일치와 디자인 회귀를 막음."
```

---

## Self-Review 메모

- 스펙 2.1 picker 형태: 달력 격자(Task 2·3), 범위 달력(Task 4·5), 세그먼트+팝오버(Task 8 DatePicker, 세그먼트 자체는 M3), 휠(Task 10, 휠 자체는 M3), 월 선택(Task 3·7·10), 시간(Task 7·10)
- 스펙 2.2 공통 기능: min/max/isDateDisabled(Task 1), 범위 제약·limitMode(Task 4), commitMode(Task 1·4·8·9), 프리셋 API(Task 9·12), 오늘로 이동(Task 2·12), numberOfMonths(Task 1·12), weekStartsOn·로케일(Provider), 칸 렌더 슬롯(Task 2·12), 폼 hidden input(Task 2·4·7), renderTrigger(Task 8~10), presentation(Task 8)
- 스펙 10장: 키보드(Task 2), 칸 이름(Task 1·2), live region(Task 4), 드래그·터치(Task 5), 44px·reduced-motion·forced-colors(Task 6)
- 스펙 11장: 키보드·드래그(Task 2·5), axe(Task 2·4), SSR(Task 12), 시각 회귀(Task 12), 크기(Task 11)

## 계약 변경 제안 (정합성 조정에서 1~5 수락·반영, 6은 M3 실제 이름으로 대체됨)

1. `LocaleData.formatDateLabel(fields: DateFields, calendarId: CalendarId): string` 추가 — 요일 없는 날짜 이름(칸 이름의 음력 부분)
2. `PART_NAMES`에 `calendar-months`, `calendar-month`, `calendar-cell-secondary`, `live-region`, `month-calendar`, `month-calendar-header`, `time-list`, `time-option`, `date-picker`, `date-range-picker`, `month-picker`, `time-picker`, `wheel-date-picker` 추가. `DATA_ATTRIBUTES`에 `data-slide` 추가
3. 새 공개 부품 `Calendar.Layout`(`renderCell`), `MonthCalendar.Root`, `TimeList.Root`, 훅 `useCalendarView`, `useSingleCalendar`, `useRangeCalendarContext`
4. `CalendarViewApi.getCellProps(cell)`는 `{ gridCell, button }`을 돌려준다(계약 §3.3은 단일 객체). `selectEpochDay(epochDay)`, `isTodayVisible`, `rootRef`(범위) 추가
5. 완성형에 `renderCell`, `open`/`defaultOpen`/`onOpenChange` prop 추가. 범위의 hidden input은 스펙 7.6대로 `startName`/`endName`을 `UseRangeCalendarProps`에 추가(계약 §3.3에 없음)
6. (정합성 조정으로 해소) M3 실제 이름을 쓴다: `usePickerSettings`, `useStoreInstance`, `useControllableState`(위치 인자), `renderElement`, `partAttributes`·`stateAttributes`, `usePresentation`, `useWheelDate`(`WheelDateApi`), Popover·Sheet Content 언마운트, `DateField.Root`·`TimeField.Root` 기본 렌더
