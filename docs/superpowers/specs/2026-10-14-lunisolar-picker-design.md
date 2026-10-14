# lunisolar-picker 설계 스펙

- 작성일: 2026-10-14
- 상태: 승인됨 (브레인스토밍 세션에서 섹션별 합의)
- 범위: v1 (0.x 릴리스 라인)

## 1. 목적

모던하고 깔끔한 **범용 날짜 picker 라이브러리**를 만든다. react-day-picker·shadcn Calendar와 같은 급의 완성도를 목표로 한다.

차별점은 하나다. **옵션 하나로 한국 음력(윤달·30일 포함) 입력과 표시를 지원한다.** 2026-10 기준 npm·GitHub를 조사한 결과, 웹에서 이를 제대로 지원하는 라이브러리는 없다.

### 1.1 원칙

- **양력 picker로서 먼저 훌륭해야 한다.** 음력은 소수 사용자를 위한 선택 기능이다. 기본값은 꺼짐이고, 시각적으로 강조하지 않는다.
- **특정 앱의 요구를 라이브러리에 굳히지 않는다.** 사주 전용 기능(12시진, "시간 모름")이나 앱 고유 UI 정책(경고 문구, 프리셋 종류, "조회" 버튼)은 앱이 만든다.
- **교체 가능성이 기준이다.** 아래 세 소비자 앱이 지금 쓰는 기능을 하나도 잃지 않고 이 라이브러리로 옮길 수 있어야 한다.

### 1.2 소비자

| 앱 | 스택 | 현재 picker | 주요 요구 |
|---|---|---|---|
| saju-pictures | Astro 7 island, React 19, Tailwind 4, Cloudflare SSR, 카카오톡 인앱 트래픽 | 브라우저 기본 `<input type="date/time">` | 생년월일(음력·윤달·30일), 모바일 휠 |
| web-console | Next 16, React 19, Tailwind 4, ko/en/ja | react-day-picker 10.0.1에 자체 래퍼 | 범위·프리셋·최대 기간·확인 후 반영·드래그·두 달 표시·공휴일 셀·월 선택·5분 간격 시간 |
| back-office | Vite, React 19, Tailwind 4, shadcn, react-hook-form | react-day-picker 10.0.1 래퍼 1개와 기본 입력 | 범위·프리셋·최대 기간·확인 후 반영·RHF 연동·HH:mm |

### 1.3 비목표 (v1)

- 중국 농력, 베트남 음력. 역법 인터페이스는 공개하므로 나중에 구현체만 추가하면 된다.
- 12시진, "시간 모름", 사주 전용 라벨
- 공휴일 데이터 조회, 국가 선택 UI
- 영구송출 배지 같은 앱 고유 표시. 라이브러리는 종료일 없는 범위(`isOpenEndAllowed`)만 지원한다.
- 요일별 시간대 편성기 (web-console `TimePicker`)
- URL 쿼리 동기화. 제어 컴포넌트로 앱이 처리한다.
- 여러 날짜 선택, 주·분기 선택, 직전 기간 비교, 초 단위, 12시간제, 날짜+시간 한 칸 입력
- Vue·Svelte 바인딩. 구조는 대비하되 v1에는 넣지 않는다.
- React 18 지원
- 시트 쓸어내려 닫기

## 2. 기능 요구사항 (v1)

### 2.1 picker 형태

| 형태 | 설명 |
|---|---|
| 달력 격자 (단일) | 월 격자에서 날짜 하나를 선택. 음력을 켜면 칸에 음력 날짜를 작게 표시 |
| 범위 달력 | 시작·종료 선택. 마우스·펜 드래그, 끝점 잡아 늘이기·줄이기, 드래그 중 가장자리에 머물면 월 넘김 |
| 세그먼트 입력 | `2026. 10. 14`처럼 연·월·일 칸에 숫자를 타이핑. 팝오버 달력과 조합 |
| 휠 | 연·월·일 드럼 휠. 관성 스크롤, 마우스 휠, 키보드 |
| 월 선택 | 달력 헤더를 누르면 월 격자 → 연 격자로 전환. 월만 고르는 모드 |
| 시간 | `HH:mm` 입력. 분 간격, `24:00` 허용 옵션, 기기 로케일과 상관없이 24시간제 표시 |

### 2.2 공통 기능

- 제약: `min`, `max`, `isDateDisabled(date)`. 역법 지원 범위는 자동으로 합쳐진다.
- 범위 제약: `minDays`, `maxDays`, `limitMode: 'block' | 'flag'`, `isOpenEndAllowed`
- 확정 방식: `commitMode: 'immediate' | 'confirm'`. confirm이면 임시 선택과 확정 값을 분리한다. 확정하지 않고 닫으면 임시 값을 버린다.
- 프리셋 지원 API: 범위를 넣어 선택, `validateRange`, `isSameRange`. 프리셋 버튼 UI와 라벨은 앱 몫이다.
- 오늘로 이동. "오늘"은 IANA `timeZone` 기준으로 계산하거나 `today`로 직접 주입한다.
- `numberOfMonths`, `weekStartsOn`, 로케일 ko/en/ja
- 날짜 칸 렌더링 슬롯. 공휴일·음력·배지를 같은 방식으로 처리한다.
- 폼: 제어·비제어, 빈 값 `null`, hidden input(`name`, 범위는 `startName`/`endName`), `required`, `disabled`, `readOnly`, `invalid`, react-hook-form `Controller` 호환
- clearable
- 트리거 교체 (`renderTrigger`, `render` prop)
- 라이트·다크·시스템 테마
- 모바일: 팝오버 대신 시트 (`presentation: 'auto' | 'popover' | 'sheet'`)

## 3. 아키텍처

### 3.1 패키지

pnpm workspace 모노레포.

```
packages/
  calendar/  @lunisolar-picker/calendar  날짜 타입, 문자열 값 해석·포맷, 역법 인터페이스, 양력 / subpath ./dangi
  core/      @lunisolar-picker/core      제약, 격자, store, 관성 계산, 로케일 / subpath ./locales/*
  react/     @lunisolar-picker/react     "use client" / 훅·부품 / subpath ./pickers (완성형)
  theme/     @lunisolar-picker/theme     CSS만 (mono.css, bridge/shadcn.css)
apps/
  docs/      Starlight 문서·데모
fixtures/
  next/ vite/ astro/   소비 환경 스모크 앱 (CI 빌드 전용, 배포 안 함)
```

### 3.2 의존 규칙

- `calendar ← core ← react` 한 방향만 허용한다. theme는 JS 의존 없이 `data-*` 계약에만 의존한다.
- calendar와 core는 **런타임 의존성 0**이다. react는 `@floating-ui/react-dom` 하나만 정확한 버전으로 의존한다. peer는 `react ^19.0.0`, `react-dom ^19.0.0`이다.
- core는 DOM과 React를 모른다. 포인터 입력의 해석(관성, 드래그 대상 날짜, 가장자리 머묾 판정)은 core의 순수 함수가 맡는다. 바인딩은 DOM 이벤트를 숫자·날짜 이벤트로 바꿔 전달하고 렌더링만 한다.
- core와 grid 코드 안에 `calendar === 'dangi'` 같은 분기를 두지 않는다. 역법은 `CalendarSystem` 인터페이스로만 다룬다.
- 완성형(`react/pickers`)은 부품의 공개 API만 쓴다.
- 위 규칙은 dependency-cruiser로 CI에서 강제한다.

### 3.3 데이터 흐름

```
DOM 이벤트 → react 바인딩 → store.send(event)
store: 순수 리듀서 (state, event, ctx) → 새 state → subscribe 알림
react: useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) → Context → 부품
부품: data-* 속성과 ARIA 속성 출력 → theme CSS가 data-* 기준으로 스타일
```

- `ctx`에는 역법 목록, 제약, 오늘(epoch day), 로케일을 넣는다.
- store는 컴포넌트 인스턴스마다 만든다. 모듈 전역 store는 금지한다. 서버 렌더에서 요청끼리 상태가 섞이지 않게 하기 위해서다.

## 4. 값 모델

### 4.1 공개 값은 문자열 (Temporal 문자열 형식)

| 값 | 형식 | 예 |
|---|---|---|
| 날짜 (양력 입력) | `YYYY-MM-DD` | `'2026-10-14'` |
| 날짜 (음력 입력) | `YYYY-MM-DD[u-ca=dangi]`. 앞부분은 같은 날의 양력 ISO 날짜 | `'2026-10-14[u-ca=dangi]'` |
| 범위 | `{ start: DateString; end: DateString \| null } \| null` | |
| 시간 | `HH:mm`. `24:00`은 `isEndOfDayAllowed` 옵션일 때만 | `'14:30'` |
| 월 | `YYYY-MM` | `'2026-10'` |

- Temporal(`Temporal.PlainDate.from`)이 그대로 읽을 수 있는 형식이다.
- 필드가 필요하면 `parseDate(value)`로 `{ calendar, year, monthCode, day }`를 얻는다. `monthCode`는 `'M01'`~`'M12'`, 윤달은 `'M04L'`처럼 표기한다.
- 연도는 해당 음력 해가 시작된 양력 연도다. 단기 연호는 쓰지 않는다.

### 4.2 무결성

- **브랜드 타입**: 출력 타입은 `DateString`, `TimeString`, `MonthString`, `DateRangeValue`다. 라이브러리 내부와 `parseDate`/`parseTime`/`parseMonth`만 이 값을 만든다.
- **입구 한 곳에서만 해석한다.** `value`/`defaultValue`는 일반 `string`도 받는다. 경계에서 한 번 해석하고, 내부는 epoch day 정수만 다룬다. 잘못된 값은 `null`로 취급하고, 개발 모드 경고와 `onInvalidValue` 콜백으로 알린다.
- **정규 형식은 하나다.** 출력은 항상 0을 채운 형식이고, 역법 표기는 `[u-ca=dangi]` 하나뿐이다. 입력도 같은 엄격한 형식만 받는다(`'2026-1-5'`는 거부). 그래서 같은 날짜·같은 역법은 항상 `===`로 같다.
- **같은 날 비교**: 입력 역법이 달라도 같은 날인지는 `isSameDay(a, b)`로 비교한다.
- **범위 불변식**: `start ≤ end`이며, 어긋나면 store가 순서를 바꾼다. `end: null`은 선택 중이거나 `isOpenEndAllowed`일 때만 허용한다. 양 끝은 같은 역법을 쓴다.
- **시간 불변식**: `24:00`은 `isEndOfDayAllowed`이고 분이 0일 때만 허용한다. 날짜와 함께 쓸 때 다음 날로 바꾸지 않는다.

### 4.3 내부 표현

- 정규 표현은 **epoch day**(1970-01-01부터의 일수, 정수)다. 비교, 제약, 범위, 역법 변환을 모두 epoch day로 계산한다.
- **화면에 보여 주는 역법과 값의 역법을 분리한다.** 양력·음력 토글은 화면만 바꾸고, 선택된 날(epoch day)은 바꾸지 않는다. 토글 상태로 바뀌는 것은 다음에 입력할 값의 역법 표기뿐이다.

## 5. 역법 (`@lunisolar-picker/calendar`)

### 5.1 인터페이스

```ts
type EpochDay = number & { readonly __brand: 'EpochDay' };
type MonthCode = `M${'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'}${'' | 'L'}`;
interface DateFields { year: number; monthCode: MonthCode; day: number }

interface CalendarSystem {
  readonly id: 'gregory' | 'dangi';
  readonly supportedRange: { min: EpochDay; max: EpochDay };
  monthsInYear(year: number): readonly MonthCode[];
  daysInMonth(year: number, month: MonthCode): number;
  toEpochDay(fields: DateFields): Result<EpochDay, ValidationReason>;
  fromEpochDay(day: EpochDay): Result<DateFields, ValidationReason>;
}
```

- `gregory`: proleptic Gregorian, 서기 1~9999년. 기본 경로에 포함된다.
- `dangi`: `@lunisolar-picker/calendar/dangi` subpath. import하지 않으면 번들에서 빠진다.
- 인터페이스는 공개 API다. 중국 농력 등은 나중에 구현체만 추가한다. Intl·Temporal·tyme4ts 어댑터는 v1에 넣지 않는다.

### 5.2 문자열 값 모듈 (`values`)

- 브랜드 타입(`DateString`, `TimeString`, `MonthString`, `DateRangeValue`)과 해석·포맷 함수를 calendar 패키지에 둔다. 서버에서 변환만 하는 소비자도 picker 없이 쓸 수 있게 하기 위해서다.
- `parseDate(value, { calendars })`: ISO 부분은 항상 양력으로 해석한다. `[u-ca=…]` 표기의 역법이 `calendars`에 없으면 `'invalid-date'`다. 필드(`year`, `monthCode`, `day`)는 표기된 역법으로 계산한다.
- `formatDate(epochDay, calendar)`, `parseTime`, `formatTime`, `parseMonth`, `formatMonth`, `isSameDay`, `isSameRange`

### 5.3 dangi 데이터

- **출처**: 한국천문연구원(KASI) 음양력 정보 OpenAPI (data.go.kr 15012679). 지원 범위는 **1900~2050년**이다.
- **수집**: `scripts/collect-kasi.ts`로 한 번 수집해 원본 JSON(`packages/calendar/data/kasi-dangi.json`)을 커밋한다. API 키는 환경변수로 받고 레포에 넣지 않는다.
- **생성**: 원본 JSON에서 압축 표 TS 코드(`dangi-table.generated.ts`)를 생성한다. 해마다 월 대·소 13bit, 윤달 위치 4bit, 설날 epoch day를 담는다. 목표 크기는 gzip 1KB 이하다.
- **브라우저 내장 Intl에 의존하지 않는 이유**: `Intl` `u-ca-dangi`는 엔진(ICU4C/ICU4X/AppleICU)마다 결과가 다르다. 서버(V8)와 iOS(AppleICU)가 서로 다르게 그리면 hydration mismatch가 난다. Temporal은 iOS Safari에서 아직 지원되지 않는다.
- **교차 검증**: manseryeok, korean-lunar-calendar, Node·브라우저 `Intl` dangi와 비교한 차이 리포트를 생성한다. 정보용이며 빌드를 막지 않는다.

### 5.4 없는 날짜·범위 밖 처리

| 상황 | 처리 |
|---|---|
| 음력 1900년 이전 / 2050년 이후 | `supportedRange`가 제약에 자동으로 합쳐진다. 음력 화면에서 탐색을 막는다. 이유는 `'outside-calendar-range'` |
| 없는 윤달·없는 30일 (휠·달력 조작 중) | 가장 가까운 유효한 날로 맞춘다(constrain): 윤4월 → 4월, 30일 → 29일 |
| 같은 경우 (타이핑·문자열 해석) | 고치지 않고 오류 상태로 둔다. 이유는 `'invalid-date'` |

### 5.5 오류 처리

- 예상 가능한 실패(사용자 입력, 범위 밖)는 `Result<T, ValidationReason>`로 돌려준다.
- 잘못된 API 호출(프로그래머 오류)만 `RangeError`를 상속한 `LunisolarPickerError`를 던진다. 메시지에 맥락을 담는다.

```ts
type ValidationReason =
  | 'invalid-date' | 'invalid-time' | 'incomplete'
  | 'before-min' | 'after-max' | 'disabled-date' | 'outside-calendar-range'
  | 'range-too-short' | 'range-too-long' | 'range-includes-disabled';
```

## 6. 코어 (`@lunisolar-picker/core`)

### 6.1 모듈

| 모듈 | 책임 |
|---|---|
| `constraints` | 제약 병합(역법 지원 범위 포함), `validateDate`, `validateRange` |
| `grid` | 월 격자 모델: 주 시작 요일, 앞뒤 달 날짜, 칸 메타(음력 필드 포함) |
| `stores` | `createStore` 헬퍼와 각 store의 리듀서 |
| `gestures` | 관성 계산(시각 주입 순수 함수), 가장자리 머묾 판정 헬퍼 |
| `locales` | `LocaleData` 타입, `defineLocale`, ko/en/ja (subpath별) |

### 6.2 store

모든 store는 `(state, event, ctx) → state` 순수 리듀서 위에 `subscribe`/`getSnapshot`/`send`를 씌운 얇은 래퍼다.

| store | 상태 | 주요 이벤트 |
|---|---|---|
| navigation | 보이는 월, 포커스한 날짜, 보기 단계(`days`/`months`/`years`), 화면 역법 | 월 이동, 오늘로, 포커스 이동(±1일, ±7일, 주 처음·끝, ±1월, ±1년), 보기 전환, 역법 전환 |
| selection (single) | 확정 값, 임시 값 | 선택, 확정, 취소, 지우기 |
| selection (range) | 확정 범위, 임시 범위, 시작점(anchor), 미리보기 끝점, 잡은 끝점 | 누름, 칸 진입(날짜), 뗌, 끝점 잡기, 범위 넣기, 확정, 취소, 지우기 |
| field | 칸 배열(로케일 순서), 타이핑 버퍼 | 숫자 입력, 지우기, 칸 이동, 붙여넣기, 증감 |
| column | 항목 목록(값 기준), 선택 값 | 선택, 항목 목록 교체(없어진 값은 가장 가까운 값으로 맞춤) |
| time | 시·분 | 분 간격, `isEndOfDayAllowed`. 입력 칸과 휠이 함께 쓴다 |

- 범위 드래그는 좌표가 아니라 "어느 날짜 칸에 들어왔는지"만 store로 보낸다.
- 휠 관성은 `gestures`의 순수 함수로 계산한다. 애니메이션 루프는 바인딩이 돌리고 ref로 직접 transform을 갱신한다. store에는 멈췄을 때만 반영한다.
- 변경 알림: `onValueChange(value, { validity: { isValid, reasons } })`

## 7. React API (`@lunisolar-picker/react`)

### 7.1 층과 안정성

| 층 | 예 | 안정성 |
|---|---|---|
| 훅 | `useCalendar`, `useRangeCalendar`, `useDateField`, `useDateRangeField`, `useWheel`, `useTimeField` | stable |
| 부품 | `Calendar.*`, `RangeCalendar.Root`, `DateField.*`, `DateRangeField.*`, `Wheel.*`, `TimeField.*`, `Popover.*`, `Sheet.*` | 이름과 `data-*` 목록 stable |
| 완성형 (`/pickers`) | `DatePicker`, `DateRangePicker`, `MonthPicker`, `WheelDatePicker`, `TimePicker` | 조합 예시. minor 버전에서 DOM이 바뀔 수 있다 |

그 밖에 calendar 타입과 store 계약(`subscribe`/`getSnapshot`/`send`)도 stable이다. `internal/` 경로는 `exports`에 넣지 않는다.

### 7.2 Provider

```tsx
<LunisolarProvider locale={ko} timeZone="Asia/Seoul" weekStartsOn={0} calendars={[dangi]}>
```

- 모두 선택 사항이며, 컴포넌트 prop으로 덮어쓸 수 있다.
- `calendars`에 `dangi`를 넣으면 양력·음력 토글과 칸의 음력 표시가 켜진다.

### 7.3 부품

| 네임스페이스 | 부품 |
|---|---|
| `Calendar` | `Root`, `Header`, `Heading`, `PrevButton`, `NextButton`, `TodayButton`, `CalendarToggle`, `ViewButton`, `Grid`, `HeadCell`, `Cell`, `MonthGrid`, `YearGrid` |
| `RangeCalendar` | `Root` (나머지는 `Calendar.*` 공유) |
| `DateField` / `DateRangeField` | `Root`, `Segment`, `Separator`, `HiddenInput` |
| `Wheel` | `Root`, `Column`, `Item`, `Highlight` |
| `TimeField` | `Root`, `Segment`, `HiddenInput` |
| `Popover` / `Sheet` | `Root`, `Trigger`, `Content`, `Close` |

- `Calendar`와 `RangeCalendar`는 값 타입이 달라 Root를 분리한다(`mode` prop으로 합치지 않는다).
- 날짜 칸 슬롯:

```tsx
<Calendar.Cell>{(cell) => <>{cell.day}{holidays[cell.date] && <Dot />}</>}</Calendar.Cell>
// cell: { date, day, weekday, lunar?: { monthCode, day, isLeapMonth }, isToday, isSelected,
//         isInRange, isRangeStart, isRangeEnd, isPreview, isDisabled, isOutsideMonth }
```

- 요소 교체는 `render` prop으로 한다 (`<Popover.Trigger render={<FilterChip />} />`).

### 7.4 `data-*` 계약 (공개 API)

`data-selected`, `data-today`, `data-disabled`, `data-outside`, `data-in-range`, `data-range-start`, `data-range-end`, `data-preview`, `data-invalid`, `data-focused`, `data-open`, `data-placeholder`, `data-calendar`, `data-view`, `data-weekday`

- 목록은 react 패키지의 타입 하나에서만 정의한다(단일 진실 공급원). theme 테스트가 이 목록을 기준으로 선택자를 검사한다.

### 7.5 완성형

| 컴포넌트 | 구성 |
|---|---|
| `DatePicker` | DateField + Popover/Sheet + Calendar |
| `DateRangePicker` | DateRangeField + Popover/Sheet + RangeCalendar + `presets` 슬롯 + 확인·취소 영역(`commitMode="confirm"`) |
| `MonthPicker` | 필드 + MonthGrid |
| `WheelDatePicker` | 연·월·일 휠 (인라인 또는 Sheet) |
| `TimePicker` | TimeField + 분 간격 목록 |

- `presentation: 'auto' | 'popover' | 'sheet'`. `auto`는 `pointer: coarse`이면서 좁은 화면이면 Sheet로 연다.
- 완성형은 모두 부품을 JSX로 나열한 것이다. 문서에 소스를 실어 복사해서 수정할 수 있게 한다.

### 7.6 prop 규칙

- 값: `value`, `defaultValue`, `onValueChange(value, { validity })`
- 열림: `open`, `defaultOpen`, `onOpenChange`
- 상태: `disabled`, `readOnly`, `required`, `invalid`
- 폼: `name`(범위는 `startName`/`endName`), `form`. `ref`는 첫 입력 칸에 포커스한다.
- 문구: 로케일 데이터가 기본값이고, `labels`로 덮어쓴다.
- `onChange`라는 이름은 쓰지 않는다.

### 7.7 사용 예

```tsx
<DateRangePicker
  value={range}
  onValueChange={(next, { validity }) => setDraft(next, validity)}
  max={today}
  maxDays={60}
  limitMode="flag"
  commitMode="confirm"
  presets={<MyPresets />}
  renderTrigger={(props) => <FilterChip {...props} />}
/>
```

## 8. 테마 (`@lunisolar-picker/theme`)

- `mono.css`: 토큰과 모든 부품 스타일. 전체를 `@layer lunisolar-picker`로 감싼다.
- `bridge/shadcn.css`: `--lsp-*` 토큰을 shadcn·Tailwind 토큰(`--primary`, `--border`, `--radius` 등)에 연결한다.
- Tailwind 4 소비자에게는 문서에서 `@layer theme, base, lunisolar-picker, components, utilities;` 선언을 안내한다.

### 8.1 토큰

`--lsp-bg`, `--lsp-surface`, `--lsp-fg`, `--lsp-muted`, `--lsp-subtle`, `--lsp-border`, `--lsp-accent`, `--lsp-accent-fg`, `--lsp-range-bg`, `--lsp-ring`, `--lsp-danger`, `--lsp-radius`, `--lsp-cell-size`, `--lsp-shadow-popover`, `--lsp-duration`

### 8.2 모드

- 기본은 라이트다.
- 다크: `:where(.dark, [data-theme="dark"])`. `:where()`로 감싸 우선순위를 0으로 둔다.
- 시스템: `[data-theme="system"]`일 때만 `prefers-color-scheme`을 따른다. 앱 테마 provider가 `.dark`를 관리하는 구조와 충돌하지 않게 하기 위해서다.
- 모드에 맞춰 `color-scheme`도 함께 설정한다.

### 8.3 Mono 디자인

- 무채색, 가는 선, 모서리 8px, 선택은 잉크색 채움, 날짜 칸 36px(터치 기기 44px)
- `tabular-nums`. 글꼴은 앱 글꼴을 상속하고 라이브러리가 싣지 않는다.
- 음력 표시는 `--lsp-subtle` 회색의 작은 숫자뿐이다. 별도 강조색은 없다.
- 모션: 월 전환 슬라이드 180ms, 팝오버 페이드·확대 140ms, 휠 관성. `prefers-reduced-motion`이면 모두 끈다.
- 논리 속성만 쓴다(RTL 대비). `forced-colors`에서는 시스템 색을 쓴다.
- 토·일 색은 기본 테마에 넣지 않는다. 앱이 `data-weekday`로 칠한다.
- 확정 시안의 기준값: 라이트 `--lsp-bg #fff`, `--lsp-fg #09090b`, `--lsp-muted #71717a`, `--lsp-border #e4e4e7`, `--lsp-range-bg #f4f4f5` / 다크 `--lsp-bg #09090b`, `--lsp-surface #111113`, `--lsp-fg #fafafa`, `--lsp-muted #a1a1aa`, `--lsp-border #26262a`, `--lsp-range-bg #1d1d20`. 강조(`--lsp-accent`)는 라이트 `#09090b`, 다크 `#fafafa`

## 9. 다국어

- 로케일은 Intl을 쓰지 않는 **데이터 객체**다. 서버와 브라우저에서 결과가 똑같다.

```ts
interface LocaleData {
  months: { long: readonly string[]; short: readonly string[] };
  weekdays: { narrow: readonly string[]; short: readonly string[]; long: readonly string[] };
  field: { order: readonly ('year' | 'month' | 'day')[]; separator: string; placeholder: Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> };
  formatHeading(year: number, month: number): string;
  formatCellLabel(date: DateFields, weekday: number): string;
  rangeSeparator: string;
  lunar: { calendarName: string; formatLeapMonth(month: number): string };
  labels: {
    previousMonth: string; nextMonth: string; previousYear: string; nextYear: string;
    today: string; clear: string; confirm: string; cancel: string; close: string;
    chooseDate: string; chooseDateRange: string; chooseMonth: string; chooseTime: string;
    year: string; month: string; day: string; hour: string; minute: string;
    gregorianCalendar: string; rangeStart: string; rangeEnd: string;
    formatRangeSummary(startLabel: string, endLabel: string, days: number): string;
    validation: Record<ValidationReason, string>;
  };
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

| 로케일 | 입력 칸 | 제목 | 윤달 | 주 시작 |
|---|---|---|---|---|
| ko | `2026. 10. 14` | 2026년 10월 | 윤4월 | 일요일 |
| en | `10/14/2026` | October 2026 | Leap 4 | 일요일 |
| ja | `2026/10/14` | 2026年10月 | 閏4月 | 일요일 |

- `separator` prop으로 구분자를 바꾼다(두 앱의 `2026-10-14` 형식).
- `defineLocale()`로 직접 추가한다. 빠진 키가 있으면 타입 오류가 난다.

## 10. 접근성과 입력

기준은 WAI-ARIA APG의 Date Picker Dialog 패턴과 Grid 패턴이다.

### 10.1 달력 격자

- 구조: `role="grid"`, roving tabindex. `aria-selected`, `aria-current="date"`, `aria-disabled`(포커스는 받음)
- 키보드

| 키 | 동작 |
|---|---|
| ←→ | ±1일 |
| ↑↓ | ±7일 |
| Home / End | 주 처음 / 끝 |
| PageUp / PageDown | ±1개월 |
| Shift+PageUp / Shift+PageDown | ±1년 |
| Enter / Space | 선택 |
| Esc | 닫기 |

- 칸 이름: 로케일 전체 날짜 + (음력을 켰으면) 음력 날짜 + 앱의 `getCellLabel` 추가 정보
- 범위 안내는 live region으로 알린다(시작일 선택됨, 기간과 일수, 무효 이유).

### 10.2 세그먼트 입력

- 칸마다 `role="spinbutton"` `contentEditable`, `inputmode="numeric"`. `beforeinput`으로 숫자만 받는다.
- ↑↓ 증감, 칸이 차거나 `. - /`를 치면 다음 칸, Backspace로 지움, 붙여넣기는 숫자만 추려 해석
- 시간: `930` → `09:30`, ↑↓는 분 간격 단위

### 10.3 휠

- 열마다 `role="spinbutton"`, `aria-valuetext`(예: "윤4월")
- 키보드: ↑↓, PageUp/PageDown(±5), Home/End, 연도 열 숫자 타이핑으로 이동
- 포인터: 터치·펜 끌기와 관성, 마우스 휠·트랙패드(`deltaMode` 정규화), 항목 클릭 선택, `touch-action: none`

### 10.4 팝오버·시트

- 팝오버: `role="dialog"`. 열면 선택된 날(없으면 오늘)에 포커스, 포커스 가두기, Esc로 닫고 트리거로 포커스 복귀, 바깥 클릭으로 닫힘(confirm 모드면 임시 값 버림)
- 시트: 모달, 배경 `inert`, 스크롤 잠금(iOS는 body 고정 후 위치 복원), 닫기 버튼과 배경 탭으로 닫음

### 10.5 기타

- 드래그 범위 선택은 마우스·펜에서만 한다. 터치는 탭 두 번으로 선택한다.
- 터치 기기에서 날짜 칸 44px
- 수동 검증: VoiceOver(iOS·macOS), TalkBack, NVDA

## 11. 테스트

| 대상 | 방법 |
|---|---|
| calendar | KASI 정답 데이터(1900~2050 모든 달 1일과 윤달). 성질 테스트: epoch day ↔ 필드 왕복, 달 길이 ∈ {29, 30}, 한 해 윤달 ≤ 1, 날짜 단조 증가, 문자열 정규 형식 왕복. Intl 차이 리포트(정보용) |
| core | 리듀서 단위 테스트(Given-When-Then). 성질 테스트: store가 내보내는 값은 항상 `parse` 통과, 범위 불변식 |
| react | vitest 브라우저 모드(Chromium, Firefox, WebKit): 키보드, 드래그, 휠, 타이핑, 팝오버 포커스. 고정 `today`로 SSR 후 hydration 불일치 없음 |
| 접근성 | 브라우저 테스트 안에서 axe 검사 |
| 시각 회귀 | `toMatchScreenshot`, picker별 라이트·다크. 기준 이미지는 Docker에서 생성 |
| theme | CSS 선택자가 `data-*` 계약과 일치 |
| 소비 환경 | `fixtures/` Next 16 App Router, Vite, Astro island를 CI에서 빌드. `"use client"`와 SSR 확인 |
| 번들 크기 | gzip 상한: calendar 2KB, dangi 표 1KB, `DatePicker` 전체 15KB (실측 후 조정) |
| 실기기 | iOS Safari, iOS 카카오톡 인앱, Android Chrome, 삼성 인터넷, Android 카카오톡 인앱 |

## 12. 빌드·배포

- pnpm workspace, tsdown, ESM 전용, `isolatedDeclarations`
- `justfile`: `just check`(typecheck, lint, 의존 경계), `just test`, `just build`
- Biome(lint, 포맷), dependency-cruiser(의존 경계)
- 의존성은 뼈대를 만들 때 최신 버전을 확인해 **정확한 버전으로 고정**한다. CI는 `--frozen-lockfile`
- `exports`에 `types` 조건, `sideEffects: false`(theme는 `["*.css"]`), react 엔트리 `"use client"` 보존 검사, publint와 `@arethetypeswrong/cli`
- 지원 브라우저: Safari·iOS 15.5+, Chrome 99+, Firefox 112+ (`@layer`, `inert`, `:where` 기준선)
- Node 22.12+ (ESM `require` 지원)
- changesets로 네 패키지 버전 고정 연동(fixed). GitHub Actions에서 npm provenance로 배포
- 세 앱이 교체를 마칠 때까지 0.x로 두고, 그 뒤 1.0을 낸다.

## 13. 문서

- Starlight (`apps/docs`): 실제로 조작할 수 있는 데모, 완성형 복사 레시피, react-day-picker 이전 가이드(prop 대응표)
- 문서 배포 위치는 나중에 정한다.

## 14. 구현 순서

| 마일스톤 | 내용 |
|---|---|
| M1 | 모노레포 뼈대, `calendar`(gregory, dangi, KASI 수집·생성 스크립트, 정답 테스트) |
| M2 | `core`(values, constraints, grid, stores, gestures, locales) |
| M3 | `react` 기반(Provider, store 연결, Popover/Sheet), `theme` Mono, DateField·Wheel·TimeField 부품 |
| M4 | Calendar·RangeCalendar·MonthGrid 부품, 완성형 5종 |
| M5 | 문서, 이전 가이드, fixtures, 0.1 배포 |

세 앱의 교체 작업은 이 스펙의 범위가 아니다. 앱마다 별도로 진행한다.

## 15. 검증이 필요한 위험

1. KASI OpenAPI의 실제 제공 범위와 호출 한도. 1900~2050년을 다 받을 수 있는지 M1 첫 작업에서 확인한다.
2. 브라우저 `Intl` dangi와 KASI가 다른 연도. 차이 리포트로 기록한다.
3. 세그먼트 `contentEditable` 입력의 삼성 키보드·카카오 인앱 동작
4. 직접 구현한 휠 관성의 iOS 체감 품질
5. tsdown 0.x의 변경, `"use client"` 보존, TypeScript 버전과 d.ts 생성 경로 호환
6. 카카오 인앱의 실제 WebView 버전과 지원 브라우저 기준선

## 16. 결정 기록

| 결정 | 이유 |
|---|---|
| 순수 TS 코어 + React 바인딩 우선 | 어떤 프로젝트에서도 쓰는 범용성. 상태 로직을 프레임워크와 무관하게 테스트 |
| 층 구조 API(훅 → 부품 → 완성형) | 두 앱이 rdp의 슬롯만으로 부족해 대부분을 다시 짰음. 완성형으로 시작하고 막히면 부품으로 내려감 |
| 음력은 dangi만, 1900~2050년 | 공식 데이터(KASI) 범위만 지원해 정확성 확보 |
| 내장 압축 표 | Intl 엔진마다 결과가 다르고 Temporal은 iOS 미지원 |
| 공개 값은 문자열, 내부는 epoch day | 앱들이 이미 문자열로 저장. 비교·URL·폼·RSC props에 그대로 사용 |
| calendar 패키지 분리 | 서버 변환 전용 소비자, KASI 정정 별도 릴리스, 나중 분리 시 breaking |
| 앱 고유 UI 정책은 라이브러리 밖 | 특정 앱의 방식이 라이브러리에 굳지 않게 함 |
| React `^19.0.0` | 소비자 모두 19. 18 지원은 `forwardRef`와 테스트 비용이 큼 |
| `@floating-ui/react-dom` | 위치 계산은 검증된 라이브러리. anchor positioning은 iOS 인앱 보장 불가 |
| 기본 테마 Mono | 범용 라이브러리 기본값은 어떤 브랜드에도 어울려야 함 |
| 시스템 테마는 `data-theme="system"`일 때만 | 앱 테마 provider의 `.dark`와 충돌 방지 |

ADR로 남길 항목(PRICE): 코어+층 구조와 calendar 패키지 분리(R, I), 내장 KASI 표와 1900~2050(C, E), 문자열 공개 값과 epoch day(R, I)
