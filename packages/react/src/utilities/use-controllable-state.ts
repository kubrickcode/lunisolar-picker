import { useCallback, useState } from 'react';
import { useLatestRef } from './use-latest-ref';

export const useControllableState = <Value>(
  controlled: Value | undefined,
  defaultValue: Value,
  onChange: ((value: Value) => void) | undefined,
): readonly [Value, (next: Value) => void] => {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const current = isControlled ? controlled : uncontrolled;
  const currentRef = useLatestRef(current);
  const onChangeRef = useLatestRef(onChange);
  const setValue = useCallback(
    (next: Value) => {
      if (Object.is(next, currentRef.current)) return;
      if (!isControlled) {
        // 의도적 변경: 같은 배치의 다음 호출이 최신 값과 비교하도록 렌더 전에 ref를 갱신함
        currentRef.current = next;
        setUncontrolled(next);
      }
      onChangeRef.current?.(next);
    },
    [isControlled, currentRef, onChangeRef],
  );
  return [current, setValue];
};
