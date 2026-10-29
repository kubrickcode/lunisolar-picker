import { type RefObject, useLayoutEffect, useRef } from 'react';

// Goal: 이펙트·네이티브 이벤트 리스너가 다시 등록되지 않고도 최신 값과 콜백을 읽게 함
export const useLatestRef = <Value>(value: Value): RefObject<Value> => {
  const ref = useRef(value);
  useLayoutEffect(() => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    ref.current = value;
  });
  return ref;
};
