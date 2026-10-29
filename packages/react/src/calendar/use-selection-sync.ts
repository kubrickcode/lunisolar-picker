import { useCallback, useEffect, useMemo, useRef } from 'react';

export type SelectionSync = {
  readonly isReported: (key: string) => boolean;
  // Goal: 호출 시점에 이미 알린 확정 값을 표시해 다음 이펙트가 같은 값을 다시 알리지 않게 함 (M4 preflight 1.4)
  readonly markReported: (key: string) => void;
};

export type SelectionSyncOptions = {
  readonly committedKey: string;
  // Constraint: 비제어면 undefined
  readonly controlledKey: string | undefined;
  readonly emitChange: () => void;
  // Goal: 역법 구성이 바뀌어 store를 다시 만든 렌더의 확정 값 변화(빠진 역법의 값을 양력으로 다시 적음)는 사용자 조작이 아니므로 알리지 않음
  readonly resetKey: string;
  readonly syncToControlled: () => void;
};

// Goal: 사용자 조작으로 바뀐 확정 값만 onValueChange로 알리고, 부모 value로 맞춘 변경은 알리지 않음.
// 부모가 변경을 받아들이지 않으면(value 그대로) 다음 렌더에서 부모 값으로 되돌림 (Review Focus 3, 계약 §3.1)
// Constraint: 입력 칸의 useValueBridge는 거부해도 되돌리지 않지만 달력은 되돌림. 화면에 고른 날이 부모 값과 다르게 남지 않게 하기 위함
export const useSelectionSync = (options: SelectionSyncOptions): SelectionSync => {
  // Goal: 부모가 알고 있는 확정 값(부모가 준 값이나 마지막으로 알린 값)의 key
  const reportedKeyRef = useRef(options.committedKey);
  const resetKeyRef = useRef(options.resetKey);

  useEffect(() => {
    if (resetKeyRef.current !== options.resetKey) {
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      resetKeyRef.current = options.resetKey;
      reportedKeyRef.current = options.committedKey;
      return;
    }
    if (options.committedKey === reportedKeyRef.current) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    reportedKeyRef.current = options.committedKey;
    options.emitChange();
  });

  useEffect(() => {
    if (options.controlledKey === undefined || options.controlledKey === options.committedKey) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    reportedKeyRef.current = options.controlledKey;
    options.syncToControlled();
  });

  const isReported = useCallback((key: string) => key === reportedKeyRef.current, []);
  const markReported = useCallback((key: string) => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    reportedKeyRef.current = key;
  }, []);
  return useMemo(() => ({ isReported, markReported }), [isReported, markReported]);
};
