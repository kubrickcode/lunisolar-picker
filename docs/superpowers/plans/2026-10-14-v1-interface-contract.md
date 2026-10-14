# v1 인터페이스 계약

- 작성일: 2026-10-14
- 상태: **M2~M5 계획과 정합성 조정 완료** (2026-10-14). M1은 확정이고, M2 이후는 앞 단계 구현 결과에 따라 바뀔 수 있다.
- 용도: M1~M5 계획이 공유하는 단일 기준. 각 계획의 `Interfaces` 블록과 코드는 이 문서를 따른다.
- 변경 규칙: 구현 중 계약과 달라지면 **이 문서를 먼저 고치고**, 영향을 받는 뒤 단계 계획의 해당 Task에 `> 계약 변경: …` 메모를 단다. 계약과 다른 코드를 조용히 쓰지 않는다.

표기: 🔒 확정(계획에 코드까지 있고 앞 단계 의존 없음), 🟡 잠정(앞 단계 결과로 바뀔 수 있음). 각 항목의 `[M#-T#]`는 그것을 만드는 계획과 Task다.

---

## 0. 워크스페이스 공통 규칙 🔒

- **패키지 간 해석은 `@lunisolar-picker/source` export 조건으로 통일한다.** [M1-T1, M2-T2, M3-T1]
  - 모든 패키지 `exports`의 진입점마다 맨 앞에 `"@lunisolar-picker/source": "./src/…ts"`를 둔다.
  - `files`에는 `src`를 넣고 테스트·테스트 헬퍼(`src/testing`, `src/visual`, `*.test.*`)는 뺀다.
  - `tsconfig.base.json`: `"customConditions": ["@lunisolar-picker/source"]`
  - vitest: `resolve.conditions`와 `ssr.resolve.conditions` 맨 앞에 `'@lunisolar-picker/source'`. 그래서 루트 devDependency에 `vite` 8.3.4를 둔다 [M2-T2].
  - dependency-cruiser: `enhancedResolveOptions.conditionNames: ['@lunisolar-picker/source', 'import', 'types', 'default']`. 패키지 경계 규칙은 공개 진입점 파일(`src/index.ts` 등)을 허용 목록에 둔다.
  - 배포 소비자의 번들러는 `@lunisolar-picker/source`를 모르므로 `dist`를 쓴다. fixtures(M5)는 `dist`로 소비 환경을 검증한다.
  - `tsconfig` `paths`나 vitest 별칭은 쓰지 않는다.
- **`'use client'`는 소스에 쓰지 않는다.** react 패키지의 tsdown `banner`가 모든 산출 청크에 붙이고 `packages/react/scripts/check-use-client.ts`가 검사한다 [M3-T1].
- **테스트 헬퍼 위치**: 각 패키지 `src/testing/`(진입점에서 export하지 않음, 배포 `files`에서 제외). 시각 회귀는 `packages/react/src/visual/*.visual.test.tsx`이고 `just visual`·`just visual-update`(Docker)로만 돈다 [M3-T10].

---


> 계약 변경(2026-10-14, M1 전체 리뷰): ① 워크스페이스 조건 이름을 일반 이름 `source` 대신 `@lunisolar-picker/source`로 바꿨다. 소비자 모노레포가 흔히 쓰는 `customConditions: ["source"]`에 우리 `src/*.ts`가 잘못 해석되는 것을 막기 위해서다. ② `brandEpochDay(value: number): EpochDay`를 calendar 루트에서 공개한다. 정수가 아니면 `LunisolarPickerError`를 던진다. M2 이후 `as EpochDay` 캐스트 대신 이 함수를 쓴다. ③ `formatDate`와 각 역법의 `fromEpochDay`는 정수가 아닌 epoch day에 `LunisolarPickerError`를 던진다. ④ dangi 지원 범위의 실제 끝은 음력 2050년 11월 30일(양력 2051-01-12)이다.

## 1. `@lunisolar-picker/calendar` 🔒 [M1]

```ts
type EpochDay = number & { readonly [epochDayBrand]: true };
interface CivilDate { readonly year: number; readonly month: number; readonly day: number }
epochDayFromCivil(year, month, day): EpochDay
brandEpochDay(value: number): EpochDay           // 정수가 아니면 LunisolarPickerError (M1 전체 리뷰 후 공개)
civilFromEpochDay(epochDay): CivilDate
weekdayOf(epochDay): number                         // 0=일 … 6=토
isGregorianLeapYear(year): boolean; daysInGregorianMonth(year, month): number

type Result<T, E> = { readonly isOk: true; readonly value: T } | { readonly isOk: false; readonly error: E };
ok(value), err(error)
class LunisolarPickerError extends RangeError

VALIDATION_REASONS; type ValidationReason
type MonthCode; isMonthCode, toMonthCode(month, isLeapMonth), parseMonthCode(code): { month, isLeapMonth }

type CalendarId = 'gregory' | 'dangi';
interface DateFields { readonly year: number; readonly monthCode: MonthCode; readonly day: number }
interface SupportedRange { readonly min: EpochDay; readonly max: EpochDay }
interface CalendarSystem {
  readonly id: CalendarId; readonly supportedRange: SupportedRange;
  monthsInYear(year): readonly MonthCode[]; daysInMonth(year, monthCode): number;
  toEpochDay(fields): Result<EpochDay, ValidationReason>; fromEpochDay(epochDay): Result<DateFields, ValidationReason>;
}
isWithinSupportedRange(calendar, epochDay): boolean
gregory: CalendarSystem                              // '@lunisolar-picker/calendar'
dangi: CalendarSystem                                // '@lunisolar-picker/calendar/dangi'

type DateString; interface ParseDateOptions { readonly calendars?: readonly CalendarSystem[] }
parseDate(input, options?): Result<ParsedDate, ValidationReason>
formatDate(epochDay, calendar = gregory): Result<DateString, ValidationReason>
epochDayOf(value): EpochDay; calendarIdOf(value): CalendarId; isSameDay(a, b): boolean
addDays(value: DateString, amount: number, options?: ParseDateOptions): Result<DateString, ValidationReason>   // [M1-T3] 입력의 역법 표기 유지, 표기 역법이 calendars에 없으면 'invalid-date', 범위 밖이면 'outside-calendar-range', amount가 정수가 아니면 LunisolarPickerError
type TimeString; parseTime(input, { isEndOfDayAllowed? }); formatTime(hour, minute, { isEndOfDayAllowed? })
type MonthString; parseMonth(input); formatMonth(year, month)
interface DateRangeValue { readonly start: DateString; readonly end: DateString | null }
normalizeDateRange(start, end): Result<DateRangeValue, ValidationReason>; isSameRange(a, b): boolean
```

`padNumber`는 calendar 내부 모듈이다. core는 자체 `padDigits`를 쓴다.

---

## 2. `@lunisolar-picker/core` 🟡 [M2]

런타임 의존성은 `@lunisolar-picker/calendar`(workspace) 하나. DOM·`console`·타이머를 쓰지 않는다. 시각은 `nowMs` 인자로 받는다.

### 2.1 store 기반 [M2-T2]

```ts
export type Reducer<State, Event, Context> = (state: State, event: Event, context: Context) => State;
export interface Store<State, Event> { getSnapshot(): State; subscribe(listener: () => void): () => void; send(event: Event): void }
export interface CreateStoreOptions<State, Event, Context> {
  readonly initialState: State;
  readonly reducer: Reducer<State, Event, Context>;
  readonly readContext: () => Context;              // 바인딩이 최신 prop을 ref로 넘김
}
export function createStore<State, Event, Context>(options: CreateStoreOptions<State, Event, Context>): Store<State, Event>;
```

- 리듀서가 같은 참조를 돌려주면 알리지 않는다.
- 변경 알림(`onValueChange`)은 바인딩이 이전·다음 확정 값을 비교해 부른다.

### 2.2 공통 타입과 컨텍스트 [M2-T2, M2-T4]

```ts
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;  toWeekday(value): Weekday
export type CommitMode = 'immediate' | 'confirm';
export type DateSegmentKind = 'year' | 'month' | 'day';  export type TimeSegmentKind = 'hour' | 'minute';
export interface Validity { readonly isValid: boolean; readonly reasons: readonly ValidationReason[] }
export const VALID: Validity;  invalidBecause(reasons: Iterable<ValidationReason>): Validity
export interface VisibleMonth { readonly year: number; readonly monthCode: MonthCode }
export interface SecondaryDateLabel { calendarId; monthCode; day; isLeapMonth; isFirstDayOfMonth }
export interface EpochRange { readonly start: EpochDay; readonly end: EpochDay | null }   // types.ts (constraints·selection 공용)

export interface PickerContext {
  readonly calendars: readonly CalendarSystem[];     // [0]은 항상 gregory
  readonly constraints: ResolvedConstraints;          // 양력 기준으로 해석한 제약
  readonly today: EpochDay;
  readonly weekStartsOn: Weekday;
  readonly locale: LocaleData;
  readonly commitMode: CommitMode;
  readonly numberOfMonths: number;
}
export function findCalendar(calendars, calendarId): CalendarSystem;   // 없으면 LunisolarPickerError
```

- **`PickerContext.constraints`는 양력 기준이다.** 표시 역법의 지원 범위는 리듀서와 바인딩이 `boundsFor(calendar, constraints)`로 겹쳐 계산한다. 그래서 바인딩은 역법을 바꿔도 컨텍스트를 다시 만들지 않는다 [M2-T4, M3-T3, M4-T1].

### 2.3 제약 [M2-T4]

```ts
export type RangeLimitMode = 'block' | 'flag';
export interface DateConstraints { readonly min?: string; readonly max?: string; readonly isDateDisabled?: (date: DateString) => boolean }
export interface RangeConstraints extends DateConstraints {
  readonly minDays?: number; readonly maxDays?: number;   // 양 끝 포함 일수
  readonly limitMode?: RangeLimitMode;                     // 기본 'block'
  readonly isOpenEndAllowed?: boolean;                     // 기본 false
}
export interface IgnoredConstraintInput { readonly field: 'min' | 'max'; readonly input: string; readonly reason: ValidationReason }
export interface ResolvedConstraints {
  minEpochDay; maxEpochDay; supportedRange: SupportedRange; isEpochDayDisabled(epochDay): boolean;
  minDays: number | null; maxDays: number | null; limitMode; isOpenEndAllowed; ignoredInputs: readonly IgnoredConstraintInput[];
}
export function resolveConstraints(constraints: RangeConstraints, displayCalendar?: CalendarSystem, knownCalendars?: readonly CalendarSystem[]): ResolvedConstraints;
export function validateEpochDay(epochDay, constraints): Validity;
export function validateEpochRange(range: EpochRange, constraints): Validity;
export function isEpochDayInBlockedRange(anchor, candidate, constraints): boolean;
export interface ValidationOptions { readonly calendars?: readonly CalendarSystem[] }
export function validateDate(value: string, constraints?: DateConstraints, options?: ValidationOptions): StringValidity;     // 앱용. StringValidity = Validity & { ignoredInputs } (M2-T4 리뷰: 잘못된 min/max를 조용히 버리지 않음)
export function validateRange(range: { start: string; end: string | null }, constraints?: RangeConstraints, options?: ValidationOptions): StringValidity;  // 앱용 (프리셋 비활성화)
```

- 바인딩은 `resolveConstraints(constraints, gregory, settings.calendars)`로 부른다. 세 번째 인자는 `min: '…[u-ca=dangi]'` 같은 표기를 해석하는 데 쓴다.

> 계약 변경(2026-10-14, M2 전체 리뷰): ① `validateRange`는 시작과 끝이 서로 다른 역법이면 `'invalid-date'`를 낸다. ② `validateEpochRange`는 뒤집힌 범위를 정렬해서 검사한다. ③ `'range-includes-disabled'`는 다른 사유가 하나도 없을 때만 낸다(범위가 이미 무효라서 정보 손실은 허용). ④ `'block'` 모드의 `isEpochDayInBlockedRange`는 양 끝 포함 일수가 `minDays` 미만이거나 `maxDays` 초과인 날을 막는다. anchor 자신도 포함한다.

### 2.4 격자와 날짜 계산 [M2-T5]

```ts
export interface CalendarBounds { readonly min: EpochDay; readonly max: EpochDay }
boundsFor(calendar, constraints): CalendarBounds; clampEpochDay(epochDay, bounds): EpochDay
fieldsOf(calendar, epochDay): DateFields; epochDayOfFields(calendar, fields): EpochDay
firstEpochDayOfMonth(calendar, month): EpochDay; daysInVisibleMonth(calendar, month): number
supportedYearRange(calendar): { firstYear; lastYear }
constrainDateFields(calendar, fields): DateFields        // 없는 윤달 → 평달, 없는 30일 → 29일 (스펙 5.4)

export interface MonthGridCell {
  readonly epochDay: EpochDay; readonly date: DateString; readonly day: number; readonly weekday: Weekday;
  readonly isOutsideMonth: boolean;
  readonly isOutsideSupportedRange: boolean;              // 표시 역법 범위 밖 칸. 바인딩은 비활성으로 그림
  readonly secondary: SecondaryDateLabel | null;
}
export interface MonthGrid { readonly calendarId: CalendarId; readonly month: VisibleMonth; readonly weeks: readonly (readonly MonthGridCell[])[] }  // 항상 6주
buildMonthGrid({ calendar, month, weekStartsOn, secondaryCalendar }): MonthGrid
shiftVisibleMonth(calendar, month, amount): VisibleMonth; visibleMonthOf(calendar, epochDay): VisibleMonth
compareVisibleMonths(calendar, a, b): number; isSameVisibleMonth(a, b): boolean
listMonthsOfYear(calendar, year): readonly VisibleMonth[]      // 음력은 윤달 포함
yearPageStartOf(year, pageSize): number
listYearPage(calendar, pageStart: number, pageSize: number): readonly number[]   // 두 번째 인자는 페이지 시작 연도
```

> 계약 변경(2026-10-14, M2 전체 리뷰): `shiftVisibleMonth`는 그 연도에 없는 `monthCode`를 받으면 `LunisolarPickerError`를 던진다. 호출자는 `constrainDateFields`·`visibleMonthOf`로 맞춘 월을 넘긴다.

### 2.5 navigation store [M2-T6]

```ts
export type CalendarView = 'days' | 'months' | 'years';  export type FocusUnit = 'day' | 'week' | 'month' | 'year';
export interface NavigationState { displayCalendarId; visibleMonth: VisibleMonth; focusedEpochDay: EpochDay; view: CalendarView; yearPageStart: number }
export type NavigationEvent =
  | { type: 'month.shift'; amount } | { type: 'today.go' } | { type: 'focus.set'; epochDay }
  | { type: 'focus.move'; unit: FocusUnit; amount } | { type: 'focus.weekEdge'; edge: 'start' | 'end' }
  | { type: 'view.set'; view } | { type: 'month.pick'; month: VisibleMonth } | { type: 'year.pick'; year }
  | { type: 'yearPage.shift'; amount } | { type: 'calendar.set'; calendarId };
export const YEAR_PAGE_SIZE = 12;
createNavigationState(context, initial?: { focusedEpochDay?; displayCalendarId? }): NavigationState
navigationReducer: Reducer<NavigationState, NavigationEvent, PickerContext>
```

> 계약 변경(2026-10-14, M2 전체 리뷰): ① `year.pick`은 고른 연도 안으로 포커스를 옮긴다(`constrainDateFields`로 맞춘 뒤 `boundsFor`로 자름). 보이는 달도 새 포커스에서 다시 정하므로 이후 `month.shift`가 그 연도에서 이어진다. ② `numberOfMonths > 1`인 `month.shift`는 마지막 보이는 달이 지원하는 마지막 달을(시작 쪽은 첫 달을) 넘지 않게 자른다. 같은 달 창이 중복해서 보이는 일이 없다.

### 2.6 selection store [M2-T7]

확정 값과 임시 값이 각각 역법을 함께 가진다.

```ts
export interface SelectedDay { readonly epochDay: EpochDay; readonly calendarId: CalendarId }
export interface SelectedRange { readonly range: EpochRange; readonly calendarId: CalendarId }
isSelectableDay(epochDay, calendar, context): boolean

export interface SingleSelectionState { readonly committed: SelectedDay | null; readonly draft: SelectedDay | null }
export type SingleSelectionEvent =
  | { type: 'date.select'; epochDay; calendarId } | { type: 'commit' } | { type: 'cancel' } | { type: 'clear' }
  | { type: 'value.sync'; selected: SelectedDay | null };
createSingleSelectionState(committed: SelectedDay | null): SingleSelectionState
singleSelectionReducer; singleValue(state, context): DateString | null; formatSelectedDay(selected, context): DateString | null

export type RangePointerPhase = 'idle' | 'pressing' | 'dragging';  export type RangeHandle = 'start' | 'end';
export interface RangeSelectionState {
  committed: SelectedRange | null; draft: SelectedRange | null; anchor: EpochDay | null; preview: EpochDay | null;
  grabbedHandle: RangeHandle | null; pointerPhase: RangePointerPhase; pendingCalendarId: CalendarId;
}
export type RangeSelectionEvent =
  | { type: 'pointer.down'; epochDay; calendarId } | { type: 'pointer.enter'; epochDay } | { type: 'pointer.up' }
  | { type: 'handle.grab'; handle } | { type: 'date.select'; epochDay; calendarId }
  | { type: 'range.set'; range: EpochRange; calendarId } | { type: 'commit' } | { type: 'cancel' } | { type: 'clear' }
  | { type: 'value.sync'; selected: SelectedRange | null };
createRangeSelectionState(committed: SelectedRange | null): RangeSelectionState
rangeSelectionReducer; displayedRange(state): EpochRange | null; rangeValidity(state, context): Validity; rangeValue(state, context): DateRangeValue | null
```

- 첫 선택 = anchor, 둘째 선택 = 반대 끝(정렬). 완성된 범위에서 다시 선택하면 새 범위를 시작한다.
- `'block'`이면 anchor 기준 `maxDays`를 넘는 날의 입력을 무시하고, `'flag'`이면 받아 두고 `'range-too-long'`을 낸다.
- immediate는 범위가 완성될 때, confirm은 `commit`에서만 committed를 갱신한다.

> 계약 변경(2026-10-14, M2 전체 리뷰): ① `'block'`은 양 끝 포함 일수가 `minDays` 미만이거나 `maxDays` 초과인 날을 막는다(anchor 자신 포함). 그래서 `minDays > 1`이면 block 모드에서 하루짜리 범위는 만들 수 없다. ② `range.set`은 끝점이 입력 역법에서 표현되지 않으면 no-op이다. 그 밖의 min/max/비활성/일수 위반은 저장하고 `rangeValidity`가 표시한다. ③ `isOpenEndAllowed`일 때 `commit`은 idle 상태(제스처 중도, 잡은 핸들도 없음)에서만 `{ anchor, null }`을 확정한다. ④ `value.sync`와 초기값은 뒤집힌 범위를 정렬해서 받는다. ⑤ 표현할 수 없는 값은 `value.sync`/초기값 경로로만 들어오므로 바인딩은 `parseDate` 결과에서 만든다. 
>
> 바인딩 주의점: (a) 그리기는 `displayedRange`로 하고, "선택 중"은 `anchor !== null`로 판단한다(`draft.end === null`이 아님). (b) `rangeValidity`는 표시·미리보기 범위의 유효성이다. `aria-invalid`는 committed 값의 유효성을 쓴다. (c) `value.sync`는 값 문자열이 바뀔 때만 보낸다. 진행 중인 anchor와 confirm 모드의 임시 draft가 지워진다. (d) 핸들을 잡은 뒤 start/end가 뒤바뀌어도 `grabbedHandle`은 처음 이름을 유지한다. (e) confirm 모드에서 닫을 때는 `cancel`을 보낸다(변화 없는 `commit`은 anchor를 남긴다).

### 2.7 field store [M2-T8]
### 2.7 field store [M2-T8]

```ts
export interface SegmentLimits { minValue; maxValue; maxDigits }
export interface Segment<Kind extends string> extends SegmentLimits { kind: Kind; value: number | null; typedText: string }
export interface SegmentGroup<Kind extends string> { segments: readonly Segment<Kind>[]; focusedIndex: number | null }
export type SegmentEvent =
  | { type: 'segment.focus'; index } | { type: 'segment.blur' } | { type: 'digit.type'; digit } | { type: 'separator.type' }
  | { type: 'segment.erase' } | { type: 'segment.step'; amount } | { type: 'focus.shift'; amount };
export interface TypedDigit<Kind extends string> { segment: Segment<Kind>; shouldAdvance: boolean }
createSegment, typeDigit, eraseDigit, stepSegment

export interface DateFieldState extends SegmentGroup<DateSegmentKind> { isLeapMonth: boolean; entryCalendarId: CalendarId }
export type DateFieldEvent =
  | SegmentEvent | { type: 'text.paste'; text } | { type: 'leapMonth.toggle' } | { type: 'calendar.set'; calendarId }
  | { type: 'value.sync'; selected: SelectedDay | null; entryCalendarId: CalendarId };
export interface DateFieldResult { readonly epochDay: EpochDay | null; readonly validity: Validity }
createDateFieldState(context, initial: { selected: SelectedDay | null; entryCalendarId: CalendarId }): DateFieldState
dateFieldReducer; dateFieldResult(state, context): DateFieldResult

export interface TimeFieldContext { readonly minuteStep: number; readonly isEndOfDayAllowed: boolean }
export interface TimeFieldState extends SegmentGroup<TimeSegmentKind> {}
export type TimeFieldEvent = SegmentEvent | { type: 'text.paste'; text } | { type: 'value.sync'; time: TimeString | null };
export interface TimeFieldResult { readonly time: TimeString | null; readonly validity: Validity }
createTimeFieldState(initial: TimeString | null, context: TimeFieldContext): TimeFieldState
timeFieldReducer: Reducer<TimeFieldState, TimeFieldEvent, TimeFieldContext>; timeFieldResult(state, context): TimeFieldResult
```

> 계약 변경(2026-10-14, M2-T8): `withSegmentValue`·`focusSegmentAt`·`replaceFocusedSegment`·`reduceSegmentEvent`는 core 내부 함수로 두고 공개하지 않는다. M3~M5 계획 어디서도 쓰지 않아서다. 나중에 필요하면 공개를 더하는 것은 깨지지 않는 변경이다. 대신 `typeDigit`의 반환 타입 `TypedDigit`을 공개한다.

- 붙여넣기(`text.paste`)는 세그먼트 공통 이벤트가 아니라 필드별 이벤트다. 바인딩의 명령 타입은 둘을 합친다 [M3-T6].
- 타이핑 중에는 날짜를 고치지 않는다. 결과가 유효하지 않으면 `'invalid-date'` 또는 `'incomplete'`.

> 계약 변경(2026-10-14, M2 전체 리뷰): ① 붙여넣기 뒤 세그먼트 `value`가 `maxValue`를 넘을 수 있다. aria 값으로 쓰기 전에 자른다. ② `value.sync`의 `entryCalendarId`는 `selected`가 null일 때만 적용된다. ③ 세그먼트 순서는 생성 시점에 고정된다. 로케일이 바뀌면 새 상태를 만든다. ④ 입력 역법에서 표현할 수 없는 `selected`는 던지지 않고 빈 세그먼트가 된다. ⑤ `value.sync`는 값이 바뀔 때만 보낸다. ⑥ 시간 필드에 `"930"`을 붙여넣으면 09:30이다(3자리 한 덩어리 = 시 + 분, 4자리는 HHMM). ⑦ 연·월이 정해져 있으면 일 ↑/↓는 그 달의 일수 안에서, 연 ↑/↓는 지원 연도 범위 안에서 돈다. ⑧ 윤달 여부 판단은 역법 id 분기가 아니라 CalendarSystem에서 유도한다.

### 2.8 column store와 휠 모델 [M2-T9]

```ts
export interface ColumnOption<Value> { readonly value: Value; readonly label: string; readonly isDisabled: boolean }
export interface ColumnState<Value> { readonly options: readonly ColumnOption<Value>[]; readonly selectedIndex: number }
export type ColumnEvent<Value> =
  | { type: 'option.select'; index } | { type: 'option.step'; amount }
  | { type: 'options.replace'; options: readonly ColumnOption<Value>[]; preferredValue: Value };
createColumnState(options, selectedValue, isEqual?): ColumnState<Value>
columnReducer(isEqual?): Reducer<ColumnState<Value>, ColumnEvent<Value>, void>; selectedColumnValue(state): Value | null
export interface WheelDateColumns { years: ColumnOption<number>[]; months: ColumnOption<MonthCode>[]; days: ColumnOption<number>[] }
buildWheelDateColumns(calendar, fields, constraints, locale): WheelDateColumns
export interface WheelTimeColumns { hours: ColumnOption<number>[]; minutes: ColumnOption<number>[] }
buildTimeColumns(context: TimeFieldContext): WheelTimeColumns
```

> 계약 변경(2026-10-14, M2 전체 리뷰): ① `selectedIndex === -1`은 선택 없음(옵션이 비었거나 전부 비활성)이다. 그 밖에는 항상 활성 옵션을 가리킨다. ② `minuteStep`은 60을 나누는 정수여야 하고 아니면 `LunisolarPickerError`를 던진다. ③ 시간 휠에서 24:30이 선택될 수 있다. 바인딩이 24시일 때 분 옵션을 비활성으로 만든다. ④ 월 옵션은 범위 제약으로만 비활성이 된다. ⑤ `options.replace`에는 항상 제약을 거친 `preferredValue`를 넘긴다. 없으면 인덱스를 유지한다. ⑥ 옵션 배열은 메모이즈한다. 새 배열이면 새 상태로 취급한다.

### 2.9 gestures [M2-T10]

```ts
export interface PointerSample { position; timeMs }  export interface VelocityTracker { add(sample); velocity(): number; reset() }
createVelocityTracker(): VelocityTracker
export interface InertiaInput { offset; velocity; itemSize; itemCount }  export interface InertiaTarget { index; durationMs }
projectInertia(input): InertiaTarget; easeOutPosition(from, to, elapsedMs, durationMs): number
export type EdgeDirection = 'previous' | 'next';
export interface EdgeDwell { enter(direction, nowMs); leave(); poll(nowMs): EdgeDirection | null }
export const EDGE_DWELL_DELAY_MS = 500; createEdgeDwell(delayMs?): EdgeDwell
```

> 계약 변경(2026-10-14, M2 전체 리뷰): ① 속도의 부호는 샘플 축을 따른다. ② 바인딩은 손을 뗄 때 마지막 샘플을 한 번 더 넣는다. ③ `itemSize <= 0`이면 `LunisolarPickerError`를 던진다. ④ `itemCount`가 0이면 `index`는 -1이다.

### 2.10 locales [M2-T3]

```ts
export interface LocaleData {
  readonly id: string;
  readonly months: { long; short }; readonly weekdays: { narrow; short; long };
  readonly field: { order: readonly DateSegmentKind[]; separator: string; leapMonthPrefix: string; placeholder: Record<DateSegmentKind | TimeSegmentKind, string> };
  readonly weekStartsOn: Weekday; readonly rangeSeparator: string;
  formatHeading(month: VisibleMonth, calendarId): string;
  formatMonthName(month: VisibleMonth, calendarId): string;
  formatDayLabel(fields: DateFields, weekday: Weekday, calendarId): string;     // 접근성 이름 (역법 접두 + 요일 포함)
  formatDateLabel(fields: DateFields, calendarId): string;                      // 요일·역법 이름 없는 날짜 (칸 이름의 보조 역법 부분) [M4 제안 1]
  formatSecondaryLabel(label: SecondaryDateLabel): string;
  readonly calendarNames: Record<CalendarId, string>;
  readonly labels: LocaleLabels;   // 계약 원안 그대로 (previousMonth … validation)
}
defineLocale(locale): LocaleData
formatDateForField(epochDay, calendar, locale, separator?): string
// subpath: '@lunisolar-picker/core/locales/{ko,en,ja}' → ko, en, ja
```

---

## 3. `@lunisolar-picker/react` 🟡 [M3, M4]

peer `react ^19.0.0`, `react-dom ^19.0.0`. 의존성 core·calendar(`workspace:*`), `@floating-ui/react-dom` 2.1.9.

진입점: `.`(훅·부품), `./contract`(`DATA_ATTRIBUTES`·`PART_NAMES` 등. React 없이 import 가능, theme 테스트가 씀) [M3-T1], `./pickers`(완성형) [M4-T11].

### 3.1 공통 [M3-T1, M3-T2, M3-T3]

```ts
export function LunisolarProvider(props: { locale?; timeZone?; today?; weekStartsOn?; calendars?; children }): ReactElement;
export interface ValueChangeDetails { readonly validity: Validity }        // settings/shared-picker-props.ts
export type RenderProp<Props, State> = ReactElement | ((props: Props, state: State) => ReactElement);
export interface SharedPickerProps {        // 선택 필드는 모두 `| undefined` 허용 (exactOptionalPropertyTypes)
  locale?; timeZone?; today?; weekStartsOn?; calendars?;
  disabled?; readOnly?; required?; invalid?; name?; form?;     // HTML 속성명은 is 접두사 규칙의 예외
  onInvalidValue?: (input: string, reason: ValidationReason) => void;
  onBlur?: () => void;                      // 포커스가 부품 전체를 벗어날 때 한 번 [M5 제안 1]
}
export function useToday(timeZone, today): EpochDay;
```

내부(공개 export 아님, 다른 부품이 씀):

| 모듈 | 이름 |
|---|---|
| `settings/use-picker-settings.ts` | `usePickerSettings(props): PickerSettings { locale; timeZone; todayEpochDay; weekStartsOn; calendars }`, `withGregorian(calendars)` |
| `settings/use-picker-context.ts` | `usePickerContext(settings, { constraints, commitMode, numberOfMonths }): PickerContext` (양력 기준 제약) |
| `store/use-store-instance.ts` | `useStoreInstance(createInitialState, reducer, context): { state; send }` |
| `utilities/use-controllable-state.ts` | `useControllableState(controlled, defaultValue, onChange): [value, setValue]` |
| `utilities/render-element.ts` | `renderElement(tagName, render, props, state)` |
| `utilities/merge-props.ts` | `mergeProps(base, override)` (핸들러는 앱 먼저, `preventDefault`면 부품 동작 생략) |
| `utilities/focus-leave.ts` | `createFocusLeaveListener(onFocusLeave)` (필드 Root `onBlur`) |
| `value/*` | `parseOptionalDate`·`parseOptionalTime`·`parseOptionalRange`, `useParsedValue`, `useValueBridge`(입력 칸용: 부모가 거부해도 되돌리지 않음), `formatOrNull`, `HiddenInput` |
| `testing/*` | `expectNoAxeViolations`, `renderWithHydration`, (M4) `korean-fixture`, `pointer` |

- 로케일 객체에는 함수가 있어 Next 서버 컴포넌트 props로 넘길 수 없다. `LunisolarProvider`는 `'use client'` providers 파일 안에서 로케일을 import해 쓴다 [M5-T2, M5-T6]. API는 바꾸지 않는다.
- 달력(M4)은 부모가 변경을 거부하면 화면을 부모 값으로 되돌리는 정책이라 `useValueBridge` 대신 자체 `useSelectionSync`를 쓴다 [M4-T1].

### 3.2 `data-*`·부품 이름 계약 [M3-T1, M4-T2·T7·T8]

```ts
export const DATA_ATTRIBUTES = [
  'data-selected', 'data-today', 'data-disabled', 'data-readonly', 'data-outside', 'data-in-range', 'data-range-start',
  'data-range-end', 'data-preview', 'data-invalid', 'data-focused', 'data-open', 'data-placeholder', 'data-calendar',
  'data-view', 'data-weekday',
  'data-slide',                                         // [M4-T2]
] as const;
export const PART_ATTRIBUTE = 'data-lsp-part';
export const PART_NAMES = [
  'calendar', 'calendar-header', 'calendar-heading', 'calendar-nav-button', 'calendar-today-button', 'calendar-toggle',
  'calendar-view-button', 'calendar-grid', 'calendar-head-cell', 'calendar-cell', 'calendar-month-grid', 'calendar-year-grid',
  'date-field', 'date-field-segment', 'date-field-separator', 'date-field-leap-toggle', 'date-range-field',
  'time-field', 'time-field-segment', 'time-field-separator',
  'wheel', 'wheel-column', 'wheel-track', 'wheel-item', 'wheel-highlight',
  'popover', 'popover-trigger', 'sheet', 'sheet-backdrop', 'picker-footer', 'picker-presets',
  'calendar-months', 'calendar-month', 'calendar-cell-secondary', 'live-region',            // [M4-T2]
  'month-calendar', 'month-calendar-header', 'time-list', 'time-option',                      // [M4-T7]
  'date-picker', 'date-range-picker', 'month-picker', 'time-picker', 'wheel-date-picker',     // [M4-T8]
] as const;
export function stateAttributes(flags: StateFlags): DataAttributeProps;           // 키는 data- 없이: { selected: true, weekday: 3 }
export function partAttributes(part: PartName, flags?: StateFlags): DataAttributeProps;
```

부품은 클래스 이름 없이 `data-lsp-part`와 상태 속성만 붙인다. theme는 이 둘과 `data-theme`, `.dark`로만 선택한다.

### 3.3 입력 부품 [M3-T6~T9]

| 공개 | 내용 |
|---|---|
| `DateField.{Root, Segment({ index }), Separator, HiddenInput, LeapMonthToggle}`, `useDateField`, `useDateFieldContext` | Root에 children이 없으면 로케일 순서로 세그먼트·구분자·윤달 토글·hidden input을 그림. `entryCalendar`·`defaultEntryCalendar`·`onEntryCalendarChange`, `separator` |
| `DateRangeField.{Root, Start, End, Separator}`, `useDateRangeField` | 시작일을 다 채우면 종료일로 이동, `startName`·`endName`, `RangeConstraints` |
| `TimeField.{Root, Segment({ index }), Separator, HiddenInput}`, `useTimeField` | `minuteStep`, `isEndOfDayAllowed` |
| `Wheel.{Root, Column, Item, Highlight}`, `useWheel` | `Wheel.Column`은 `useWheel` props(`options`, `value`, `onValueChange`, `isEqual?`, `label`, `disabled?`)와 `renderItem?`을 받음 |
| `useWheelDate(props): WheelDateApi` | `{ fields; columns: WheelDateColumns; value; entryCalendarId; labels: { year; month; day }; selectYear; selectMonth; selectDay; setEntryCalendar }` |
| `Popover.{Root, Trigger, Content, Close}`, `usePopover`, `usePopoverContext` | Content는 닫히면 언마운트. `Close`에 `onClick`을 주면 앱 핸들러가 먼저 돈 뒤 닫힘 |
| `Sheet.{Root, Content, Close}`, `useSheet`, `useSheetContext` | Trigger 없음(열림은 앱이 `open`으로 제어). Content는 닫히면 언마운트 |
| `usePresentation(presentation)`, `resolvePresentation`, `type Presentation = 'auto' \| 'popover' \| 'sheet'` | |

### 3.4 달력 부품 [M4-T1~T7]

| 공개 | 내용 |
|---|---|
| `Calendar.{Root, Header, Heading, PrevButton, NextButton, TodayButton, CalendarToggle, ViewButton, Grid, HeadCell, Cell, MonthGrid, YearGrid, Layout}` | `Grid({ monthIndex?, children?: (cell: MonthGridCell) => ReactNode })`, `Cell({ cell, children?: ReactNode \| ((info: CellRenderInfo) => ReactNode) })`, `Layout({ renderCell? })` |
| `useCalendar(props): CalendarApi`, `useCalendarView(): CalendarViewApi`, `useSingleCalendar(): CalendarApi` | `CalendarViewApi.getCellProps(cell)`는 `{ gridCell, button }`, `selectEpochDay`, `isTodayVisible` |
| `RangeCalendar.Root`, `useRangeCalendar(props): RangeCalendarApi`, `useRangeCalendarContext()` | `RangeCalendarApi`: `selection`, `value`, `draftValue`, `validity`, `announcement`, `rootRef`, `setRange`, `commit`, `cancel`. 범위 props에 `startName`·`endName` |
| `MonthCalendar.Root`, `TimeList.Root`, `listTimes(minuteStep, isEndOfDayAllowed)` | |
| `type CellRenderInfo = MonthGridCell & CellState` | `CellState { isSelected; isToday; isDisabled; isOutsideMonth; isInRange; isRangeStart; isRangeEnd; isPreview; isFocused }` |

`UseCalendarProps`: `SharedPickerProps & DateConstraints & { value?; defaultValue?; onValueChange?; commitMode?; numberOfMonths?; displayCalendar?; defaultDisplayCalendar?; onDisplayCalendarChange?; getCellLabel? }`

### 3.5 완성형 (`@lunisolar-picker/react/pickers`) [M4-T8~T10]

```ts
interface TriggerRenderProps { readonly displayValue: string; readonly isOpen: boolean; readonly placeholder: string; readonly triggerProps: ButtonHTMLAttributes<HTMLButtonElement> }
interface PickerOpenProps { open?; defaultOpen?; onOpenChange? }

DatePicker: UseCalendarProps & PickerOpenProps & { presentation?; placeholder?; separator?; renderTrigger?; renderCell?; footer?; className? }
DateRangePicker: UseRangeCalendarProps & PickerOpenProps & { presentation?; placeholder?; separator?; renderTrigger?; renderCell?; presets?: ReactNode; footer?; className? }
MonthPicker: { value?; defaultValue?; onValueChange?: (value: MonthString | null, details) => void; min?; max? } & SharedPickerProps & PickerOpenProps & { presentation?; renderTrigger? }
WheelDatePicker: SharedPickerProps & DateConstraints(isDateDisabled 제외) & PickerOpenProps & { value?; defaultValue?; onValueChange?; presentation?: 'inline' | 'sheet'; renderTrigger? }
TimePicker: SharedPickerProps & PickerOpenProps & { value?; defaultValue?; onValueChange?: (value: TimeString | null, details) => void; minuteStep?; isEndOfDayAllowed?; renderTrigger? }

interface PickerSelection { readonly draftRange: DateRangeValue | null; readonly validity: Validity; setRange(range: { start: string; end: string | null } | null): void; commit(): void; cancel(): void }
usePickerSelection(): PickerSelection     // DateRangePicker의 presets·footer 안에서만 [M4-T9, M5 제안 3]
```

- 완성형은 `onBlur`를 입력 칸에만 넘긴다(react-hook-form 연결용) [M4-T8·T9].
- 확인 모드의 확인·취소는 완성형 footer가 그린다. 직접 조립할 때는 `Popover.Close onClick={() => calendar.commit()}`처럼 쓴다 [M5-T5].
- `src/pickers/**`는 `src/index.ts`, `src/contract/**`, `src/settings/**`, `src/utilities/**`, `src/pickers/**`만 import한다(dependency-cruiser) [M4-T11].

---

## 4. `@lunisolar-picker/theme` 🟡 [M3-T10, M4-T6]

```
@lunisolar-picker/theme/mono.css           @layer lunisolar-picker 단일 파일. 입력 부품(M3) + 달력·picker(M4, 같은 이름의 layer 블록을 끝에 덧붙임)
@lunisolar-picker/theme/bridge/shadcn.css  --lsp-* → shadcn 토큰
```

- 테스트는 `packages/theme/tests/`. 선택자 계약(`selector-contract.test.ts`, M3)과 달력 부품 누락 검사(`calendar-selectors.test.ts`, M4)가 `@lunisolar-picker/react/contract`를 워크스페이스 devDependency로 import한다.
- 토큰 목록과 Mono 기준값은 스펙 8장.

---

## 5. 버전 (2026-10-14 npm 확인)

| 패키지 | 버전 | 도입 |
|---|---|---|
| typescript | 6.0.3 | M1 |
| tsdown | 0.23.1 | M1 |
| vitest | 5.0.4 | M1 |
| vite | 8.3.4 | M2 (vitest 설정의 기본 조건 목록) |
| react, react-dom, @types/react, @types/react-dom | 19.3.0 | M3 |
| @floating-ui/react-dom | 2.1.9 | M3 |
| @vitest/browser-playwright | 5.0.4 | M3 |
| vitest-browser-react | 2.3.0 | M3 |
| playwright | 1.64.0 | M3 |
| axe-core | 4.14.0 | M3 |
| @vitejs/plugin-react | 6.1.2 | M3 |
| @astrojs/starlight | 0.42.6 | M5 |
| astro | 7.3.8 | M5 |
| @astrojs/react | 7.0.1 | M5 |
| next | 16.4.0 | M5 |
| react-hook-form | 7.90.0 | M5 |
| @changesets/cli | 3.0.3 | M5 |
