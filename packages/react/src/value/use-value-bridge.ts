import { useEffect, useRef } from 'react';
import { useLatestRef } from '../utilities/use-latest-ref';
import type { ControlledInput } from './use-parsed-value';

export type ValueBridgeOptions<Value> = {
  readonly committedValue: Value;
  readonly controlled: ControlledInput<Value>;
  readonly isEqual: (first: Value, second: Value) => boolean;
  readonly onValueChange: ((value: Value) => void) | undefined;
  readonly syncStore: (value: Value) => void;
};

// Goal: store가 값의 단일 출처. 부모가 준 값은 store로 밀어 넣고(알림 없음), 사용자가 바꾼 값만 onValueChange로 알림 (계약 §2.1)
// Constraint: 제어 모드에서 부모가 새 값을 거부하면 다음 value 변경 때 store가 맞춰짐(semi-controlled). 입력 중인 칸을 매 렌더마다 되돌리지 않기 위함
// Constraint: syncStore(core value.sync)는 입력 중인 숫자·초안을 지우므로 부모 값이 마지막으로 알던 값과 달라질 때만 부름 (계약 §2.7 ⑤)
export const useValueBridge = <Value>(options: ValueBridgeOptions<Value | null>): void => {
  const { committedValue, controlled } = options;
  const lastKnownRef = useRef(committedValue);
  const latest = useLatestRef(options);
  const controlledValue = controlled.isControlled ? controlled.value : undefined;

  useEffect(() => {
    if (controlledValue === undefined || latest.current.isEqual(controlledValue, lastKnownRef.current)) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastKnownRef.current = controlledValue;
    latest.current.syncStore(controlledValue);
  }, [controlledValue, latest]);

  useEffect(() => {
    if (latest.current.isEqual(committedValue, lastKnownRef.current)) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastKnownRef.current = committedValue;
    latest.current.onValueChange?.(committedValue);
  }, [committedValue, latest]);
};
