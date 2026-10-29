import { useEffect, useRef } from 'react';
import { isDevelopment } from '../utilities/is-development';
import { useLatestRef } from '../utilities/use-latest-ref';
import type { ControlledInput } from './use-parsed-value';

export type ValueBridgeOptions<Value> = {
  readonly committedValue: Value;
  readonly controlled: ControlledInput<Value>;
  readonly isEqual: (first: Value, second: Value) => boolean;
  readonly onValueChange: ((value: Value) => void) | undefined;
  readonly syncStore: (value: Value) => void;
  // Goal: store 공간 값과 공개 값이 다를 때(범위 필드의 반쪽 범위 → null) 공개 값으로 알리고, 부모가 되돌려 준 공개 값을 메아리로 보아 store를 지우지 않음. 생략하면 그대로 씀
  readonly toPublic?: ((value: Value) => Value) | undefined;
};

// Goal: store가 값의 단일 출처. 부모가 준 값은 store로 밀어 넣고(알림 없음), 사용자가 바꾼 값만 onValueChange로 알림 (계약 §2.1)
// Constraint: 제어 모드에서 부모가 새 값을 거부하면 다음 value 변경 때 store가 맞춰짐(semi-controlled). 입력 중인 칸을 매 렌더마다 되돌리지 않기 위함
// Constraint: syncStore(core value.sync)는 입력 중인 숫자·초안을 지우므로 부모 값이 마지막으로 알던 값과 달라질 때만 부름 (계약 §2.7 ⑤)
// Constraint: 사용자 확정과 부모 값 변경이 같은 렌더에 겹치면 부모 값을 먼저 store에 넣고 사용자 값을 알린 뒤, store가 부모 값으로 바뀐 다음 렌더에서 부모 값을 한 번 더 알림. 마지막 알림이 부모 값이라 부모와 store가 부모 값으로 수렴함
export const useValueBridge = <Value>(options: ValueBridgeOptions<Value | null>): void => {
  const { committedValue, controlled } = options;
  const lastKnownRef = useRef(committedValue);
  // Goal: 부모가 알고 있는 공개 값(부모가 준 값이나 마지막으로 알린 값). 메아리 판정은 store 값의 공개 형태가 아니라 이 값으로 해야 알린 적 없는 공개 형태(반쪽 범위 → null)로의 재설정을 놓치지 않음
  const lastPublicRef = useRef((options.toPublic ?? keepValue)(committedValue));
  const latest = useLatestRef(options);
  const controlledValue = controlled.isControlled ? controlled.value : undefined;
  const wasControlledRef = useRef(controlled.isControlled);

  useEffect(() => {
    if (wasControlledRef.current === controlled.isControlled) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    wasControlledRef.current = controlled.isControlled;
    if (isDevelopment()) console.warn(describeModeSwitch(controlled.isControlled));
  }, [controlled.isControlled]);

  useEffect(() => {
    if (controlledValue === undefined) return;
    const { isEqual } = latest.current;
    if (isEqual(controlledValue, lastPublicRef.current)) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastPublicRef.current = controlledValue;
    if (isEqual(controlledValue, lastKnownRef.current)) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastKnownRef.current = controlledValue;
    latest.current.syncStore(controlledValue);
  }, [controlledValue, latest]);

  useEffect(() => {
    const { isEqual, toPublic = keepValue } = latest.current;
    if (isEqual(committedValue, lastKnownRef.current)) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastKnownRef.current = committedValue;
    const publicValue = toPublic(committedValue);
    if (isEqual(publicValue, lastPublicRef.current)) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastPublicRef.current = publicValue;
    latest.current.onValueChange?.(publicValue);
  }, [committedValue, latest]);
};

const describeModeSwitch = (isControlled: boolean): string => {
  const [from, to] = isControlled ? ['uncontrolled', 'controlled'] : ['controlled', 'uncontrolled'];
  return `[lunisolar-picker] a component switched from ${from} to ${to}. Keep value defined (null for empty) for its whole lifetime.`;
};

const keepValue = <Value>(value: Value): Value => value;
