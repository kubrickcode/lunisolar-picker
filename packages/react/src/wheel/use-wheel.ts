import {
  type ColumnOption,
  columnReducer,
  createColumnState,
  createVelocityTracker,
  projectInertia,
} from '@lunisolar-picker/core';
import {
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type RefCallback,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type DataAttributeProps, PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import { useStoreInstance } from '../store/use-store-instance';
import { useLatestRef } from '../utilities/use-latest-ref';
import { useWheelMotion, WHEEL_POSITION_PROPERTY } from './use-wheel-motion';
import { clampPosition, nearestEnabledIndex, normalizeWheelDelta, renderWindowAround } from './wheel-geometry';

const DRAG_THRESHOLD_PIXELS = 4;
const PAGE_STEP = 5;
const RECENTER_DISTANCE = 10;
const RENDER_RADIUS = 30;
const WHEEL_INDEX_PROPERTY = '--lsp-wheel-index';
const WHEEL_SETTLE_DELAY_MILLISECONDS = 120;

type FirstEnabledOptions<Value> = {
  readonly direction: 1 | -1;
  readonly index: number;
  readonly options: readonly ColumnOption<Value>[];
};

type GesturePointerEvent = {
  readonly clientY: number;
  readonly pointerId: number;
  readonly timeStamp: number;
};

type GesturePointerListeners = {
  readonly onCancel: () => void;
  readonly onMove: (event: GesturePointerEvent) => void;
  readonly onUp: (event: GesturePointerEvent) => void;
};

type NativeWheelHandlers = {
  readonly isDisabled: boolean;
  readonly onSettle: () => void;
  readonly onWheel: (deltaPixels: number) => void;
};

type PointerGesture = {
  readonly isDragging: boolean;
  // Goal: 탭한 항목. 손가락이 조금 움직여도 누른 항목을 고르도록 누를 때 기억함
  readonly pressedIndex: number | null;
  readonly startPosition: number;
  readonly startY: number;
};

export interface UseWheelProps<Value> {
  readonly options: readonly ColumnOption<Value>[];
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
  readonly isEqual?: ((first: Value, second: Value) => boolean) | undefined;
  readonly label: string;
  readonly disabled?: boolean | undefined;
}

export interface WheelApi {
  readonly selectedIndex: number;
  readonly renderedRange: { readonly start: number; readonly end: number };
  getColumnProps(): HTMLAttributes<HTMLDivElement> &
    DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement>; readonly style: CSSProperties };
  getTrackProps(): HTMLAttributes<HTMLDivElement> & DataAttributeProps;
  getItemProps(index: number): HTMLAttributes<HTMLDivElement> & DataAttributeProps & { readonly style: CSSProperties };
}

// Goal: 끌기·관성·마우스 휠 중에는 CSS 변수만 움직이고, 멈춘 항목만 column store에 확정함 (스펙 6.2)
export const useWheel = <Value>(props: UseWheelProps<Value>): WheelApi => {
  const isDisabled = props.disabled === true;
  // Constraint: store는 처음 받은 리듀서를 계속 씀. isEqual은 마운트 때 값으로 고정됨
  const [reducer] = useState(() => columnReducer<Value>(props.isEqual ?? Object.is));
  const { state, send } = useStoreInstance(
    () => createColumnState(props.options, props.value, props.isEqual ?? Object.is),
    reducer,
    undefined,
  );
  const latest = useLatestRef({ props, state });
  const columnRef = useRef<HTMLDivElement | null>(null);
  // Constraint: 선택 없음(-1)이어도 위치는 첫 항목에 둠
  const selectedPosition = Math.max(state.selectedIndex, 0);
  const motion = useWheelMotion(columnRef, selectedPosition);
  const [renderCenter, setRenderCenter] = useState(selectedPosition);
  const [velocityTracker] = useState(createVelocityTracker);
  const isInteractingRef = useRef(false);
  const gestureRef = useRef<PointerGesture | null>(null);
  // Goal: 정착 애니메이션이 향하는 항목. 키를 누르고 있어 애니메이션이 끝나기 전에 다음 키가 와도 그 다음 항목으로 넘어감
  const settlingIndexRef = useRef<number | null>(null);

  useEffect(() => {
    send({ type: 'options.replace', options: props.options, preferredValue: props.value });
  }, [props.options, props.value, send]);

  const commitIndex = useCallback(
    (index: number) => {
      const { props: currentProps, state: currentState } = latest.current;
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      isInteractingRef.current = false;
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      settlingIndexRef.current = null;
      const option = currentProps.options[index];
      // Constraint: 전부 비활성인 열에서 멈춘 항목도 비활성일 수 있음. 비활성 값은 앱에 알리지 않음 (preflight 2.11)
      if (!option || option.isDisabled || index === currentState.selectedIndex) return;
      send({ type: 'option.select', index });
      currentProps.onValueChange(option.value);
    },
    [latest, send],
  );

  const settleAt = useCallback(
    (position: number, durationMilliseconds?: number) => {
      const targetIndex = nearestEnabledIndex(latest.current.props.options, position);
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      settlingIndexRef.current = targetIndex;
      setRenderCenter(targetIndex);
      motion.animateTo(targetIndex, durationMilliseconds, () => commitIndex(targetIndex));
    },
    [latest, motion, commitIndex],
  );

  // Goal: 값이 밖에서 바뀌면(제어 값·항목 교체) 위치를 선택된 항목에 맞춤. 사용자가 움직이는 중이거나 정착 중이면 건드리지 않음
  useEffect(() => {
    if (isInteractingRef.current || settlingIndexRef.current !== null) return;
    setRenderCenter(selectedPosition);
    motion.setPosition(selectedPosition);
  }, [selectedPosition, motion]);

  const recenterRenderWindow = (position: number): void => {
    if (Math.abs(position - renderCenter) > RECENTER_DISTANCE) setRenderCenter(Math.round(position));
  };

  useNativeWheelListener(columnRef, {
    isDisabled,
    onWheel: (deltaPixels) => {
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      isInteractingRef.current = true;
      motion.stop();
      const nextPosition = clampPosition(
        motion.positionRef.current + deltaPixels / motion.readItemSize(),
        props.options.length,
      );
      motion.setPosition(nextPosition);
      recenterRenderWindow(nextPosition);
    },
    onSettle: () => {
      if (gestureRef.current === null) settleAt(motion.positionRef.current);
    },
  });

  const movePointer = (event: GesturePointerEvent): void => {
    const gesture = gestureRef.current;
    if (gesture === null) return;
    const deltaPixels = event.clientY - gesture.startY;
    if (!gesture.isDragging && Math.abs(deltaPixels) < DRAG_THRESHOLD_PIXELS) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    if (!gesture.isDragging) gestureRef.current = { ...gesture, isDragging: true };
    velocityTracker.add({ position: event.clientY, timeMs: event.timeStamp });
    const nextPosition = clampPosition(
      gesture.startPosition - deltaPixels / motion.readItemSize(),
      props.options.length,
    );
    motion.setPosition(nextPosition);
    recenterRenderWindow(nextPosition);
  };

  const releasePointer = (event: GesturePointerEvent): void => {
    const gesture = gestureRef.current;
    if (gesture === null) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    gestureRef.current = null;
    if (!gesture.isDragging) {
      settleAt(gesture.pressedIndex ?? motion.positionRef.current);
      return;
    }
    // Constraint: 마지막 move 뒤 멈춰 있던 시간이 속도에 반영되도록 손을 떼는 순간의 샘플을 한 번 더 넣음 (계약 §2.9 ②)
    velocityTracker.add({ position: event.clientY, timeMs: event.timeStamp });
    const itemSize = motion.readItemSize();
    const inertia = projectInertia({
      offset: motion.positionRef.current * itemSize,
      velocity: -velocityTracker.velocity(),
      itemSize,
      itemCount: props.options.length,
    });
    settleAt(inertia.index, inertia.durationMs);
  };

  // Goal: 브라우저가 제스처를 가져가면(pointercancel) 제스처를 끝내고 가까운 항목에 맞춤. 탭 선택·관성은 적용하지 않음
  const cancelGesture = (): void => {
    if (gestureRef.current === null) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    gestureRef.current = null;
    settleAt(motion.positionRef.current);
  };

  const followPointer = useDocumentPointerListeners({
    onCancel: cancelGesture,
    onMove: movePointer,
    onUp: releasePointer,
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (isDisabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    motion.stop();
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    isInteractingRef.current = true;
    velocityTracker.reset();
    velocityTracker.add({ position: event.clientY, timeMs: event.timeStamp });
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    gestureRef.current = {
      isDragging: false,
      pressedIndex: itemIndexOf(event.target),
      startPosition: motion.positionRef.current,
      startY: event.clientY,
    };
    followPointer(event.currentTarget.ownerDocument, event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isDisabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const baseIndex = settlingIndexRef.current ?? state.selectedIndex;
    const targetIndex = keyboardTargetIndex(event.key, baseIndex, props.options.length);
    if (targetIndex === null) return;
    event.preventDefault();
    settleAt(
      firstEnabledFrom({ direction: targetIndex >= baseIndex ? 1 : -1, index: targetIndex, options: props.options }),
    );
  };

  const attachColumn = useCallback((node: HTMLDivElement | null) => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    columnRef.current = node;
  }, []);

  const selectedOption = props.options[state.selectedIndex];

  return {
    selectedIndex: state.selectedIndex,
    renderedRange: renderWindowAround(renderCenter, props.options.length, RENDER_RADIUS),
    getColumnProps: () => ({
      ref: attachColumn,
      role: 'spinbutton',
      tabIndex: isDisabled ? -1 : 0,
      // Goal: 서버 렌더와 첫 화면부터 선택된 항목에 위치함. 같은 값이면 React가 다시 쓰지 않아 움직이는 중의 직접 갱신과 부딪히지 않음
      style: cssVariables({ [WHEEL_POSITION_PROPERTY]: selectedPosition }),
      'aria-label': props.label,
      'aria-valuemin': 0,
      'aria-valuemax': Math.max(props.options.length - 1, 0),
      'aria-valuenow': state.selectedIndex >= 0 ? state.selectedIndex : undefined,
      'aria-valuetext': selectedOption?.label,
      'aria-disabled': isDisabled || undefined,
      onPointerDown,
      onKeyDown,
      ...partAttributes('wheel-column', { disabled: isDisabled }),
    }),
    getTrackProps: () => ({ 'aria-hidden': true, ...partAttributes('wheel-track') }),
    getItemProps: (index) => {
      const option = props.options[index];
      return {
        children: option?.label,
        style: cssVariables({ [WHEEL_INDEX_PROPERTY]: index }),
        ...partAttributes('wheel-item', {
          selected: index === state.selectedIndex,
          disabled: option?.isDisabled === true,
        }),
      };
    },
  };
};

// Constraint: CSS 사용자 정의 속성(--lsp-*)은 React CSSProperties 타입에 없음
const cssVariables = (variables: Readonly<Record<`--${string}`, number>>): CSSProperties =>
  // as: 사용자 정의 속성만 담은 객체를 React style 값으로 넘김
  variables as CSSProperties;

const firstEnabledFrom = <Value>({ direction, index, options }: FirstEnabledOptions<Value>): number => {
  for (
    let candidate = clampPosition(index, options.length);
    candidate >= 0 && candidate < options.length;
    candidate += direction
  ) {
    if (options[candidate]?.isDisabled === false) return candidate;
  }
  return nearestEnabledIndex(options, index);
};

// Constraint: 부품 계약상 data-* 상태 속성만 출력하므로 항목 인덱스는 항목 style의 --lsp-wheel-index에서 읽음
const itemIndexOf = (target: EventTarget): number | null => {
  const item = target instanceof Element ? target.closest(`[${PART_ATTRIBUTE}="wheel-item"]`) : null;
  if (!(item instanceof HTMLElement)) return null;
  const index = Number.parseInt(item.style.getPropertyValue(WHEEL_INDEX_PROPERTY), 10);
  return Number.isInteger(index) ? index : null;
};

const keyboardTargetIndex = (key: string, selectedIndex: number, itemCount: number): number | null => {
  switch (key) {
    case 'ArrowUp':
      return selectedIndex - 1;
    case 'ArrowDown':
      return selectedIndex + 1;
    case 'PageUp':
      return selectedIndex - PAGE_STEP;
    case 'PageDown':
      return selectedIndex + PAGE_STEP;
    case 'Home':
      return 0;
    case 'End':
      return itemCount - 1;
    default:
      return null;
  }
};

// Constraint: setPointerCapture 대신 누른 동안만 문서에 리스너를 붙임. Firefox는 포인터 캡처가 같은 브라우저의 다른 페이지 마우스 입력까지 이 열로 끌어옴(병렬 테스트에서 확인). 터치는 브라우저가 누른 요소로 암묵 캡처하고, 마우스는 버튼을 누른 동안 문서 밖 이동도 문서로 전달됨
const useDocumentPointerListeners = (
  listeners: GesturePointerListeners,
): ((ownerDocument: Document, pointerId: number) => void) => {
  const latestListeners = useLatestRef(listeners);
  const detachRef = useRef<(() => void) | null>(null);
  useEffect(() => () => detachRef.current?.(), []);
  return useCallback(
    (ownerDocument: Document, pointerId: number) => {
      detachRef.current?.();
      const onMove = (event: globalThis.PointerEvent): void => {
        if (event.pointerId === pointerId) latestListeners.current.onMove(event);
      };
      const onUp = (event: globalThis.PointerEvent): void => {
        if (event.pointerId !== pointerId) return;
        detach();
        latestListeners.current.onUp(event);
      };
      const onCancel = (event: globalThis.PointerEvent): void => {
        if (event.pointerId !== pointerId) return;
        detach();
        latestListeners.current.onCancel();
      };
      const detach = (): void => {
        ownerDocument.removeEventListener('pointermove', onMove);
        ownerDocument.removeEventListener('pointerup', onUp);
        ownerDocument.removeEventListener('pointercancel', onCancel);
        // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
        detachRef.current = null;
      };
      ownerDocument.addEventListener('pointermove', onMove);
      ownerDocument.addEventListener('pointerup', onUp);
      ownerDocument.addEventListener('pointercancel', onCancel);
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      detachRef.current = detach;
    },
    [latestListeners],
  );
};

// Constraint: React의 onWheel은 passive라 preventDefault가 안 됨. 페이지가 같이 스크롤되지 않도록 비passive 리스너를 직접 붙임
const useNativeWheelListener = (columnRef: RefObject<HTMLElement | null>, handlers: NativeWheelHandlers): void => {
  const latestHandlers = useLatestRef(handlers);
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent): void => {
      if (latestHandlers.current.isDisabled) return;
      event.preventDefault();
      latestHandlers.current.onWheel(normalizeWheelDelta(event.deltaY, event.deltaMode, column.clientHeight));
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => latestHandlers.current.onSettle(), WHEEL_SETTLE_DELAY_MILLISECONDS);
    };
    column.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(settleTimer);
      column.removeEventListener('wheel', onWheel);
    };
  }, [columnRef, latestHandlers]);
};
