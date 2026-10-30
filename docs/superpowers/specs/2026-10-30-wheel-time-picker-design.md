# WheelTimePicker 설계 스펙

- 작성일: 2026-10-30
- 상태: 승인됨 (2026-10-30 브리핑)
- 범위: `@lunisolar-picker/react` minor 추가 (완성형 picker 1개 + 공개 훅 1개)
- 상위 스펙: `2026-10-14-lunisolar-picker-design.md` (원칙 §1.1, 휠 접근성 §10.3, 시트 §10.4)

## 1. 목적

saju-pictures는 생년월일 입력을 `WheelDatePicker`(`presentation="sheet"`)로 옮길 예정이다. 같은 폼 바로 아래의 "태어난 시각"도 같은 모양과 같은 조작감의 휠로 받아야 한다. 지금 시간용 완제품은 `TimePicker`(세그먼트 입력칸 + 목록)뿐이라, 날짜 휠 옆에 두면 사용감이 다르다.

`WheelTimePicker`는 `WheelDatePicker`와 짝을 이루는 시·분 휠이다. 공개 계약, 시트의 초안 동작, Mono 테마 모양을 `WheelDatePicker`와 맞춘다.

### 1.1 현재 소비자 상황 (2026-10-30 조사)

- saju-pictures는 아직 lunisolar-picker에 의존하지 않는다. `src/components/solo/BirthForm.tsx`는 네이티브 `<input type="date">`와 `<input type="time">`(step 없음, 즉 1분 단위)을 쓴다.
- 폼은 한 화면이다. 생년월일, 태어난 시각, "모름" 체크박스가 세로로 쌓인다. 모바일(카카오톡 인앱 등)이 우선이다.
- "모름" 체크박스는 시각 입력의 `disabled`만 켜고 끄며, **입력해 둔 시각은 지우지 않는다**. 체크를 풀면 예전 값이 다시 보인다. 제출할 때는 앱이 모름이면 `birthTime: null`로 바꾼다.
- 시주 경계(23시 야자시 등)는 앱 계산 로직에서 처리하고, 입력 부품은 0–23 / 0–59 범위만 보장하면 된다.
- 이 레포의 `consumer-parity.test.tsx`에는 이미 saju-pictures 생년월일 시나리오(네이티브 `<form>` + `FormData`, `WheelDatePicker presentation="sheet"`)가 있다.

## 2. 목표 / 비목표 / 안티목표

### 목표

- 시(0–23)와 분 두 열의 휠. 24시간제다.
- 값은 `TimePicker`와 같은 정규 `HH:mm` 문자열(`TimeString`)이다.
- `minuteStep` prop을 둔다.
- `presentation: 'inline' | 'sheet'`. 시트에서는 휠이 초안이고, 확인하면 반영하고, 취소하면 버린다.
- `WheelDatePicker`와 같은 계약: `value`/`defaultValue`/`onValueChange`, `open`/`defaultOpen`/`onOpenChange`, `placeholder`, `renderTrigger`, `isClearable`, `ref.focus`, `name`/`form`/`required`/`disabled`/`readOnly`/`invalid`, `onBlur`, `onInvalidValue`, aria 라벨 props, `className`, `id`, `locale`.
- Mono 테마에서 `WheelDatePicker`와 같은 모양.
- 열마다 `role="spinbutton"`과 `aria-valuetext`.
- consumer-parity에 saju-pictures "시각 모름 → disabled 토글" 시나리오를 추가한다.
- 문서 페이지 `pickers/wheel-time-picker.mdx`와 changeset(minor)을 함께 만든다.

### 비목표

- 12시간제(오전/오후 열), 초 단위, 24:00(`isEndOfDayAllowed`). 상위 스펙 §1.3과 같다.
- 12시진 모드, "시각 모름" 칸 같은 사주 전용 기능. 상위 스펙 §1.1에 따라 앱이 만든다.
- `min`/`max` 시각 제약.
- 휠 순환(23 다음이 0). 현재 `useWheel`은 순환을 지원하지 않고, 이번에 넣지 않는다.
- 날짜와 시각을 한 시트에서 고르는 결합 picker.

### 안티목표 (동작은 해도 실패로 보는 것)

- 날짜 휠 바로 아래 놓았을 때 크기, 간격, 하이라이트, 트리거, 시트 푸터가 날짜 휠과 달라 보이는 것.
- `disabled`가 켜지면 값이 지워지는 것. 체크를 풀면 예전 값이 그대로 돌아와야 한다.
- 시트에서 굴리기만 해도 폼 값이 바뀌는 것.
- 사용자에게 보이는 문자열을 하드코딩하는 것. 로캘 라벨만 쓴다.

## 3. 공개 API

### 3.1 완성형: `WheelTimePicker` (`@lunisolar-picker/react/pickers`)

```ts
export interface WheelTimePickerProps extends UseWheelTimeProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  readonly isClearable?: boolean | undefined;      // 기본 true
  readonly placeholder?: string | undefined;
  readonly presentation?: 'inline' | 'sheet' | undefined; // 기본 'inline'
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
}
```

- `WheelDatePickerProps`에서 `separator`만 뺀 모양이다. `TriggerRenderProps`, `PickerOpenProps`는 기존 타입을 그대로 쓴다.
- `onPick`은 넣지 않는다. 휠은 "골랐다"는 순간이 따로 없기 때문이다(`WheelDatePicker`와 같음).

### 3.2 훅: `useWheelTime` (`@lunisolar-picker/react`)

ADR 0001의 레이어(훅 → 부품 → 완성형)를 따라, `useWheelDate` 옆에 공개 훅을 둔다. 완성형은 이 훅과 `Wheel.*` 부품만으로 조립한다.

```ts
export interface UseWheelTimeProps
  extends Omit<SharedPickerProps, 'calendars' | 'timeZone' | 'today' | 'weekStartsOn'> {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: TimeString | null, details: ValueChangeDetails) => void) | undefined;
  readonly minuteStep?: number | undefined; // 기본 1
}

export interface WheelTimeApi {
  readonly fields: { readonly hour: number; readonly minute: number }; // 휠에 보이는 칸
  readonly columns: WheelTimeColumns;     // core buildTimeColumns 결과
  readonly value: TimeString | null;      // 공개 값
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly labels: { readonly hour: string; readonly minute: string };
  selectHour(hour: number): void;
  selectMinute(minute: number): void;
  focus(): void;
  getWheelRootProps(): WheelTimeRootProps; // WheelDateRootProps와 같은 모양
  getHiddenInputProps(): HiddenInputProps;
}
```

- `SharedPickerProps`에서 역법·날짜 관련 props는 받지 않는다. 시각과 상관없기 때문이다. 정확한 `Omit` 목록은 구현자가 정한다(§7).
- 열 생성에는 이미 있는 core `buildTimeColumns({ minuteStep, isEndOfDayAllowed: false })`를 그대로 쓴다. `minuteStep` 검증(1–60 정수이면서 60의 약수, 아니면 `LunisolarPickerError`)도 거기서 이미 한다.

## 4. 동작

### 4.1 값과 표시 위치

- 공개 값은 `HH:mm`이거나 `null`이다. 상태는 `WheelDatePicker`처럼 `useControllableState`로 제어/비제어를 함께 다룬다.
- **휠은 값이 없어도 늘 어떤 시각을 보여 준다.** 사용자가 굴리기 전까지 공개 값은 `null`로 둔다(`useWheelDate`와 같은 규칙).
- **빈 값일 때 보이는 시각은 12:00이다.** (§8) 하루의 가운데라 어느 시각이든 평균 이동 거리가 가장 짧다. "지금 시각"과 달리 서버 렌더와 hydration 사이에 바뀌지 않는다. saju-pictures의 계산 로직도 시각을 모를 때 12:00을 쓴다. `minuteStep`과 상관없이 00분은 늘 칸에 있다.
- **칸에 맞지 않는 값**(예: step 5에서 `09:07`)은 바로 앞 칸(`09:05`)에 맞춰 보여 준다. (내 판단, `TimeList`의 `indexAtOrBefore`와 같은 규칙) 공개 값은 사용자가 굴리기 전까지 바꾸지 않는다. 유효성은 `TimeField`와 같이 VALID로 둔다. 현재 `Wheel.Column`은 맞는 칸이 없으면 0번 칸을 보여 주므로, 훅이 맞출 칸을 계산해 열에 넘겨야 한다.
- **형식이 틀린 값**(예: `"25:00"`, `"abc"`)은 `TimePicker`와 같은 규칙을 따른다. 제어 값이면 `onInvalidValue(input, reason)`으로 한 번 알리고, 휠은 빈 값처럼 12:00을 보이며, 숨은 입력은 빈 문자열이다.
- **`"24:00"`**은 `TimePicker`처럼 형식은 맞지만 허용되지 않는 값으로 다룬다(`parseTime(..., { isEndOfDayAllowed: true })` 후 `publicTimeOf`와 같은 규칙, 내 판단). `onInvalidValue`는 부르지 않는다. validity는 `invalid-time`, 루트는 `data-invalid`, 트리거 글자는 `"24:00"`, 지우기 버튼은 보이고, 숨은 입력은 빈 문자열이다. 휠에는 24시 칸이 없으므로 빈 값처럼 12:00을 보이고, 시트에서 확인하면 그 보이는 값이 들어간다.
- 시 열은 `00`–`23`, 분 열은 `00`부터 step 간격으로 두 자리 라벨을 쓴다. 이미 `buildTimeColumns`가 이렇게 만든다.

### 4.2 inline

- 두 열을 화면에 바로 그린다. 굴리면 바로 `onValueChange`가 불린다.
- 시 열을 굴리면 분 칸은 그대로 두고, 분 열을 굴리면 시 칸은 그대로 둔다. 둘 다 그때 보이는 칸으로 값을 만든다. 빈 값에서 시 열만 굴려도 보이는 분(00)과 합쳐 값이 생긴다.
- 지우기와 폼 reset은 `WheelDatePicker`처럼 휠을 다시 마운트해서 12:00이 보이게 한다(`useFieldRemount`).

### 4.3 sheet

- 트리거 버튼이 값(`HH:mm`)을 보여 주고, 값이 없으면 `placeholder`를 보여 준다. 기본 트리거는 `ValueTrigger`와 `ClockIcon`을 쓴다(`TimePicker`의 시계 아이콘과 같음).
- 시트 안의 휠은 `WheelDatePicker`의 `SheetWheelDraft`와 같은 방식이다. 열 때 현재 값(칸에 맞춘 값, 없으면 12:00)으로 별도 비제어 훅을 마운트하고, 닫히면 언마운트해서 초안을 버린다.
- 확인을 누르면 **보이는 칸**을 확정하고, 현재 값과 다를 때만 `onValueChange`를 부른다. 굴리지 않고 확인해도 빈 값이면 12:00이 들어가고, 칸에 맞지 않던 값이면 맞춘 값이 들어간다. 날짜 휠의 "확인은 보이는 날을 확정함"과 같다.
- 시각은 늘 유효하므로 확인 버튼은 비활성이 되지 않는다.
- 취소, 바깥 클릭, Esc는 닫기만 한다.
- 시트 라벨, 트리거 기본 aria-label: `labels.chooseTime` (ko "시간 선택"). 확인/취소 문구: `labels.confirm`/`labels.cancel`. 열 라벨: `labels.hour`/`labels.minute`. 모두 이미 en/ja/ko 로캘에 있으므로 새 문자열은 추가하지 않는다.

### 4.4 폼, 비활성, 읽기 전용

- 폼 참여는 picker의 `HiddenInput` 하나가 맡는다(`WheelDatePicker`와 같음, 계약 §3.5). `name`, `form`, `required`, `disabled`를 넘기고, `onFocusRequest`는 `focusInput`, `onFormReset`은 기본값으로 돌아가는 동작이다.
- `disabled`이면 열(inline)이나 트리거(sheet)를 조작할 수 없다. 숨은 입력도 disabled라 `FormData`에 들어가지 않고 `required`도 막지 않는다. **값은 지우지 않으며**, disabled가 풀리면 같은 값이 다시 보이고 다시 제출된다.
- `readOnly`이면 보여 주기만 하고 바꿀 수 없다. 지우기 버튼도 숨긴다.
- `invalid`는 `data-invalid`로 나타낸다.
- `ref.focus()`는 inline이면 첫 열(시), sheet이면 트리거에 포커스한다.
- `onBlur`는 포커스가 부품 전체를 벗어날 때 한 번 불린다(inline은 휠, sheet는 트리거).

### 4.5 접근성과 키보드

- `Wheel.Column`이 이미 제공하는 것을 그대로 쓴다: 열마다 `role="spinbutton"`, `aria-valuetext`=라벨(`"09"`, `"05"`), 열 aria-label(시/분), 화살표, PageUp/PageDown(±5칸), Home/End, 라벨 앞부분 타입어헤드.
- 알려진 한계 (이번 범위 밖, 내 판단): 타입어헤드는 라벨 앞부분으로 맞추는데 시 라벨이 `"09"`처럼 0으로 채워져 있어, "9"를 치면 아무 칸에도 맞지 않고 "1"을 치면 `"10"`으로 간다. 고치려면 `WheelDatePicker`도 쓰는 공개 훅 `useWheel`을 바꿔야 하므로 이번에는 손대지 않고 후속 과제로 남긴다. 문서의 키보드 설명에도 적는다.
- `Wheel.Root`에는 picker의 aria-label(기본 `chooseTime`)을 둔다.
- axe 검사를 테스트에 넣는다(`wheel-date-picker.test.tsx`의 axe 블록과 같게).

## 5. 스타일 (Mono 테마)

- 새 part 이름 `wheel-time-picker`를 `contract/data-attributes.ts`에 등록한다. 루트에 `open`, `invalid`, `placeholder` 상태를 `WheelDatePicker`와 같은 규칙으로 붙인다.
- `packages/theme/src/mono.css`에서 `wheel-date-picker` 규칙을 공유 선택자로 넓혀 같은 모양을 내게 한다. 규칙을 복붙하지 않는다. 휠 크기 변수(`--lsp-wheel-item-size`, `--lsp-wheel-visible-count`)도 같은 것을 쓴다.
- 폭: inline 휠의 전체 폭을 날짜 휠과 같게 둔다(현재 `[wheel-date-picker] > [wheel] { inline-size: 288px }`, mono.css:1106). (내 판단) 두 휠을 위아래로 쌓았을 때 양쪽 끝이 맞는 것을 우선해서, 열 하나는 144px이 된다. 그래서 폭 규칙도 공유 선택자로 함께 넓힌다.
- `theme/tests/selector-contract.test.ts`가 새 part에 규칙이 있는지 확인하므로 그 테스트가 통과해야 한다.
- shadcn 브리지(`bridge/shadcn.css`)도 날짜 휠에 따로 규칙이 있다면 같은 방식으로 넓힌다.

## 6. 테스트, 문서, 릴리스

### 6.1 단위 테스트 (`pickers/wheel-time-picker.test.tsx`, vitest browser)

`wheel-date-picker.test.tsx`의 블록 구성(inline / sheet / clear / form / axe)을 따른다. 핵심 케이스:

- inline: 시 열이나 분 열을 굴리면 `HH:mm`이 나온다. 빈 값은 12:00을 보이고 공개 값은 null이다.
- `minuteStep`: step 5에서 분 열이 00..55다. `09:07`은 09:05에 맞춰 보이고 굴리기 전까지 값이 그대로다. 잘못된 step은 오류를 던진다.
- sheet: 굴린 뒤 취소하면 값이 그대로다. 확인하면 반영된다. 빈 값에서 바로 확인하면 12:00이 들어간다. 다시 열면 이전 초안이 남아 있지 않다.
- 형식이 틀린 제어 값은 `onInvalidValue`를 한 번 부르고 숨은 입력은 빈 문자열이다.
- `"24:00"`은 `onInvalidValue`를 부르지 않고 `data-invalid`이며 숨은 입력이 빈 문자열이다.
- 폼: `required`이면 빈 값에서 제출이 막힌다. reset하면 기본값으로 돌아간다. `disabled`이면 FormData에서 빠지고 값은 남는다.
- `ref.focus()`의 대상(inline이면 시 열, sheet이면 트리거).

### 6.2 consumer-parity (`pickers/consumer-parity.test.tsx`, saju-pictures 블록)

새 시나리오 "birth time: '시각 모름' 체크박스로 disabled 토글":

- 앱처럼 생긴 폼: 기존 생년월일 `WheelDatePicker` 옆에 `WheelTimePicker presentation="sheet" name="birthTime" minuteStep={1}`과 앱이 그린 "모름" 체크박스(`disabled={isTimeUnknown}`)를 둔다.
- 시트에서 시각을 고르고 확인하면 FormData에 `HH:mm`이 들어간다.
- "모름"을 체크하면 트리거가 비활성이고, FormData에 `birthTime`이 없으며, `required`여도 제출이 막히지 않는다.
- 체크를 풀면 예전 값이 그대로 보이고 다시 제출된다.
- 공개 진입점(`@lunisolar-picker/react/pickers` 등)만 쓴다. 기존 시나리오의 규칙과 같다.
- 테스트 안의 "모름" 같은 앱 문구는 앱 쪽 픽스처 문자열이므로 라이브러리 로캘에 넣지 않는다.

### 6.3 시각 회귀

- `visual/pickers.visual.test.tsx`의 `SUBJECTS`에 wheel-time-picker(inline, 값 있음)를 라이트·다크 모두 추가한다.
- 기준 이미지는 Linux Docker에서만 만든다(`just visual-update`).

### 6.4 문서

- `apps/docs/src/content/docs/pickers/wheel-time-picker.mdx`를 기존 `wheel-date-picker.mdx`와 같은 구성(데모, tsx 예제, 동작 설명, props 표)으로 만든다. 문서 사이트 언어(영어)를 따른다.
- 데모 `components/demos/WheelTimePickerDemo.tsx`를 만들고, `astro.config.mjs` 사이드바에 넣는다.
- 동작 설명에는 빈 값 12:00, 칸 맞춤 규칙, 시트 초안, 24:00·12시간제 미지원을 적는다.
- 상위 스펙 §7.1 표의 `/pickers` 목록에 `WheelTimePicker`를 추가한다.

### 6.5 릴리스

- `.changeset/`에 minor changeset을 추가한다. 패키지들이 `fixed` 그룹이라 함께 올라간다. 대상은 실제로 바뀐 패키지(`@lunisolar-picker/react`, `@lunisolar-picker/theme`)로 한다.
- `just size`의 번들 크기 한도를 확인하고, 넘으면 한도를 근거와 함께 조정한다.

## 7. 구현자에게 맡기는 것

- `useWheelTime`이 내부에서 core store를 새로 둘지, React 상태로 충분할지.
- `SharedPickerProps`에서 뺄 props의 정확한 목록과 타입 모양(`Omit` 또는 별도 타입).
- `WheelDatePicker`와 겹치는 picker 조립 코드(트리거 렌더, 시트 초안 골격, 지우기)를 공통 모듈로 뽑을지. 뽑는다면 `WheelDatePicker`의 동작과 테스트는 바뀌지 않아야 한다.
- Mono CSS 선택자를 넓히는 구체적인 방식.

## 8. 결정 기록

| 결정 | 내용 | 확정 |
|---|---|---|
| 공개 훅 | `useWheelTime`을 공개 훅으로 내보낸다 | 사용자 확정 (2026-10-30) |
| `minuteStep` 기본값 | 1. `TimeField`와 같고, `TimePicker`(30)와는 다르다 | 사용자 확정 (2026-10-30) |
| 빈 값일 때 보이는 시각 | 12:00 | 사용자 확정 (2026-10-30) |
| 칸에 맞지 않는 값 | 바로 앞 칸으로 맞춰 보이고, 확인하거나 굴리기 전까지 공개 값은 그대로 둔다 | 브리핑에서 추천안 확정 |
| 범위 밖 | 24:00, 12시간제, 휠 순환, min/max는 넣지 않는다. `"24:00"` 값은 `TimePicker`처럼 형식은 맞지만 허용되지 않는 값으로 다룬다 | 브리핑에서 추천안 확정 |
| inline 폭 | 전체 폭을 날짜 휠과 같게 둔다(288px, 열 하나 144px) | 브리핑에서 추천안 확정 |
| 시 타입어헤드 | 0으로 채운 라벨 때문에 어긋나는 문제는 후속 과제로 남긴다 | 브리핑에서 추천안 확정 |
