import { useEffect, useMemo, useRef } from 'react';
import type { SharedPickerProps } from '../settings/shared-picker-props';
import { isDevelopment } from '../utilities/is-development';
import { useLatestRef } from '../utilities/use-latest-ref';
import type { ParsedControlledValue } from './parse-controlled-value';

export type ControlledInput<Value> = {
  readonly isControlled: boolean;
  readonly value: Value | null;
};

// Goal: 잘못된 제어 값을 던지지 않고 빈 값으로 다루며, 같은 입력에 대해 알림을 한 번만 보냄 (스펙 4.2)
// Constraint: 범위처럼 객체로 오는 값은 매 렌더 새 참조일 수 있으므로 describeInput 문자열을 기준으로 다시 해석함
export const useParsedValue = <Input, Value>(
  input: Input | null | undefined,
  parse: (input: Input | null | undefined) => ParsedControlledValue<Value>,
  describeInput: (input: Input) => string,
  onInvalidValue: SharedPickerProps['onInvalidValue'],
): ControlledInput<Value> => {
  const inputKey = input === undefined || input === null ? input : describeInput(input);
  const latest = useLatestRef({ onInvalidValue });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 입력의 문자열 표현이 같으면 다시 해석하지 않음. 인라인 parse·객체 입력은 렌더마다 새 참조라서 deps에 넣으면 매번 다시 해석함
  const parsed = useMemo(() => parse(input), [inputKey]);
  // Constraint: StrictMode는 마운트 이펙트를 두 번 실행함. 이미 알린 해석 결과면 다시 알리지 않음
  const reportedRef = useRef<ParsedControlledValue<Value> | null>(null);
  useEffect(() => {
    if (parsed.invalidReason === null || typeof inputKey !== 'string' || reportedRef.current === parsed) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    reportedRef.current = parsed;
    latest.current.onInvalidValue?.(inputKey, parsed.invalidReason);
    if (isDevelopment())
      console.warn(`[lunisolar-picker] ignored invalid value "${inputKey}": ${parsed.invalidReason}`);
  }, [parsed, inputKey, latest]);
  return { isControlled: input !== undefined, value: parsed.value };
};
