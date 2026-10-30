import { formatTime, parseTime, type TimeString } from '@lunisolar-picker/calendar';
import { buildTimeColumns, VALID, type Validity, type WheelTimeColumns } from '@lunisolar-picker/core';
import { type RefCallback, useCallback, useMemo, useRef, useState } from 'react';
import { PART_ATTRIBUTE } from '../contract/data-attributes';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { parseOptionalTime } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';
import type { WheelDateRootProps } from './use-wheel-date';

const DEFAULT_MINUTE_STEP = 1;
// Constraint: 해석이 역법 구성과 무관하므로 parseKey는 고정 문자열
const PARSE_KEY = 'wheel-time';
const FIRST_COLUMN_SELECTOR = `[${PART_ATTRIBUTE}="wheel-column"]`;
// Constraint: 휠은 24:00을 칸으로 두지 않음. 훅에 직접 온 24:00은 형식 오류로 봄 (스펙 §4.1)
const TIME_OPTIONS = { isEndOfDayAllowed: false } as const;
// Goal: 빈 값일 때 보이는 시각. 평균 이동 거리가 가장 짧고 SSR·hydration 사이에 바뀌지 않음 (#D1)
const RESTING_POSITION: WheelTimePosition = { hour: 12, minute: 0, hasSelection: false };

// Constraint: minute은 step으로 내리지 않은 값을 둠. 칸 밖 값(09:07)은 사용자가 굴리기 전까지 그대로 남음 (스펙 §4.1)
type WheelTimePosition = {
  readonly hasSelection: boolean;
  readonly hour: number;
  readonly minute: number;
};

export interface UseWheelTimeProps
  extends Omit<SharedPickerProps, 'calendars' | 'timeZone' | 'today' | 'weekStartsOn'> {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: TimeString | null, details: ValueChangeDetails) => void) | undefined;
  readonly minuteStep?: number | undefined;
}

export interface WheelTimeFields {
  readonly hour: number;
  readonly minute: number;
}

export interface WheelTimeApi {
  readonly fields: WheelTimeFields;
  readonly columns: WheelTimeColumns;
  readonly value: TimeString | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly labels: { readonly hour: string; readonly minute: string };
  selectHour(hour: number): void;
  selectMinute(minute: number): void;
  focus(): void;
  getWheelRootProps(): WheelTimeRootProps;
  getHiddenInputProps(): HiddenInputProps;
}

export type WheelTimeRootProps = WheelDateRootProps;

// Constraint: 시·분은 React 상태 하나로 둠. core buildTimeColumns 위의 얇은 연결이라 별도 store 없이 씀 (useWheelDate와 같은 구조)
export const useWheelTime = (props: UseWheelTimeProps): WheelTimeApi => {
  const settings = usePickerSettings(props);
  const minuteStep = props.minuteStep ?? DEFAULT_MINUTE_STEP;
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalTime(input, TIME_OPTIONS),
    String,
    props.onInvalidValue,
    PARSE_KEY,
  );
  const isDisabled = props.disabled === true;
  const isReadOnly = props.readOnly === true;
  // Constraint: 제어 중이면 부모 값만 봄. 부모가 null·해석 불가 값을 주는데 defaultValue를 골라진 값으로 알리지 않음
  const [initialPosition] = useState<WheelTimePosition>(() =>
    positionOf(controlled.isControlled ? controlled.value : parseOptionalTime(props.defaultValue, TIME_OPTIONS).value),
  );
  const [position, setPosition] = useState<WheelTimePosition>(initialPosition);
  const rootRef = useRef<HTMLElement | null>(null);
  const columns = useMemo(() => buildTimeColumns({ minuteStep, ...TIME_OPTIONS }), [minuteStep]);
  const fields = useMemo(
    () => ({ hour: position.hour, minute: floorToStep(position.minute, minuteStep) }),
    [position.hour, position.minute, minuteStep],
  );
  const value = useMemo(() => (position.hasSelection ? timeOf(position.hour, position.minute) : null), [position]);
  // Constraint: 휠에는 고를 수 없는 칸이 없어 늘 VALID. 무효 표시는 앱이 준 invalid prop만 따름
  const isInvalid = isVisiblyInvalid({ invalid: props.invalid === true, reasons: VALID.reasons });

  useValueBridge<TimeString>({
    committedValue: value,
    controlled,
    isEqual: Object.is,
    // Constraint: 부모가 null을 주면 휠 위치는 두고 공개 값만 비움. 보이던 시각을 사용자가 고른 값처럼 알리지 않음
    syncStore: (next) =>
      setPosition((previous) => {
        if (next !== null) return positionOf(next);
        return previous.hasSelection ? { ...previous, hasSelection: false } : previous;
      }),
    onValueChange: (next) => props.onValueChange?.(next, { validity: VALID }),
  });

  // Goal: 비제어일 때만 form reset으로 처음 기본값(없으면 12:00에 선 빈 휠)으로 돌아감. 제어 값은 부모가 정함
  const resetToDefault = (): void => {
    if (!controlled.isControlled) setPosition(initialPosition);
  };

  const focus = useCallback(() => {
    rootRef.current?.querySelector<HTMLElement>(FIRST_COLUMN_SELECTOR)?.focus({ preventScroll: true });
  }, []);

  const attachRoot = useCallback<RefCallback<HTMLElement>>((node) => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    rootRef.current = node;
  }, []);

  return {
    fields,
    columns,
    value,
    validity: VALID,
    isInvalid,
    isDisabled,
    isReadOnly,
    labels: { hour: settings.locale.labels.hour, minute: settings.locale.labels.minute },
    // Constraint: 한 열을 굴리면 다른 열은 보이는 칸(내린 분)으로 값을 확정함. 두 열이 한 배치에 정착해도 서로 덮지 않게 이전 상태에서 계산함
    selectHour: (hour) =>
      setPosition((previous) => ({ hour, minute: floorToStep(previous.minute, minuteStep), hasSelection: true })),
    selectMinute: (minute) => setPosition((previous) => ({ hour: previous.hour, minute, hasSelection: true })),
    focus,
    // Constraint: 열 사이 이동은 휠 안이므로 휠 전체를 벗어날 때만 onBlur를 알림
    getWheelRootProps: () => ({
      ref: attachRoot,
      disabled: isDisabled,
      readOnly: isReadOnly,
      invalid: isInvalid,
      onBlur: createFocusLeaveListener(props.onBlur),
    }),
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: value ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: focus,
      onFormReset: resetToDefault,
    }),
  };
};

const floorToStep = (minute: number, minuteStep: number): number => Math.floor(minute / minuteStep) * minuteStep;

const positionOf = (value: TimeString | null): WheelTimePosition => {
  if (value === null) return RESTING_POSITION;
  const parsed = parseTime(value, TIME_OPTIONS);
  return parsed.isOk ? { hour: parsed.value.hour, minute: parsed.value.minute, hasSelection: true } : RESTING_POSITION;
};

const timeOf = (hour: number, minute: number): TimeString | null => {
  const formatted = formatTime(hour, minute, TIME_OPTIONS);
  return formatted.isOk ? formatted.value : null;
};
