import { easeOutPosition } from '@lunisolar-picker/core';
import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { PART_ATTRIBUTE } from '../contract/data-attributes';

const DEFAULT_ITEM_SIZE_PIXELS = 36;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SNAP_DURATION_MILLISECONDS = 220;
export const WHEEL_POSITION_PROPERTY = '--lsp-wheel-position';

export type WheelMotion = {
  readonly animateTo: (position: number, durationMilliseconds: number | undefined, onSettle: () => void) => void;
  readonly positionRef: RefObject<number>;
  readonly readItemSize: () => number;
  readonly setPosition: (position: number) => void;
  readonly stop: () => void;
};

// Goal: 휠 위치는 CSS 변수 하나(항목 단위 숫자)만 갱신해 매 프레임 React 렌더를 거치지 않음 (스펙 6.2)
// Constraint: Safari 15.5는 px끼리 나누는 calc()를 못 함 → 위치를 픽셀이 아니라 항목 수로 넘김
// Constraint: 돌려주는 객체는 렌더마다 같아야 함. 이 객체에 의존하는 이펙트가 애니메이션 중에 위치를 되돌리지 않게 함
export const useWheelMotion = (columnRef: RefObject<HTMLElement | null>, initialPosition: number): WheelMotion => {
  const positionRef = useRef(initialPosition);
  const frameRef = useRef<number | null>(null);

  const setPosition = useCallback(
    (position: number) => {
      // 의도적 변경: React ref 객체와 DOM 스타일은 대입·setProperty로만 갱신됨
      positionRef.current = position;
      columnRef.current?.style.setProperty(WHEEL_POSITION_PROPERTY, String(position));
    },
    [columnRef],
  );

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    frameRef.current = null;
  }, []);

  const animateTo = useCallback(
    (target: number, durationMilliseconds: number | undefined, onSettle: () => void) => {
      stop();
      const isReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      const duration = isReducedMotion ? 0 : (durationMilliseconds ?? SNAP_DURATION_MILLISECONDS);
      if (duration <= 0) {
        setPosition(target);
        onSettle();
        return;
      }
      const from = positionRef.current;
      const startTime = performance.now();
      const step = (now: number): void => {
        const elapsed = now - startTime;
        setPosition(easeOutPosition(from, target, elapsed, duration));
        if (elapsed < duration) {
          // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
          frameRef.current = requestAnimationFrame(step);
          return;
        }
        // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
        frameRef.current = null;
        setPosition(target);
        onSettle();
      };
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      frameRef.current = requestAnimationFrame(step);
    },
    [setPosition, stop],
  );

  const readItemSize = useCallback(() => {
    const item = columnRef.current?.querySelector<HTMLElement>(`[${PART_ATTRIBUTE}="wheel-item"]`);
    const height = item?.getBoundingClientRect().height ?? 0;
    return height > 0 ? height : DEFAULT_ITEM_SIZE_PIXELS;
  }, [columnRef]);

  useEffect(() => stop, [stop]);

  return useMemo(
    () => ({ animateTo, positionRef, readItemSize, setPosition, stop }),
    [animateTo, readItemSize, setPosition, stop],
  );
};
