import { type ColumnOption, columnReducer, createColumnState, type PointerSample } from '@lunisolar-picker/core';
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
import { flushSync } from 'react-dom';
import { type DataAttributeProps, PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import { useStoreInstance } from '../store/use-store-instance';
import { useLatestRef } from '../utilities/use-latest-ref';
import { useWheelMotion, WHEEL_POSITION_PROPERTY } from './use-wheel-motion';
import {
  clampPosition,
  nearestEnabledIndex,
  normalizeWheelDelta,
  projectRelease,
  renderWindowAround,
} from './wheel-geometry';

const DRAG_THRESHOLD_PIXELS = 4;
// Constraint: 속도는 core가 최근 100ms 샘플로 계산함. 긴 끌기에서 배열이 끝없이 늘지 않도록 최근 샘플만 둠(165Hz × 100ms보다 넉넉함)
const MAX_GESTURE_SAMPLES = 32;
const PAGE_STEP = 5;
const RECENTER_DISTANCE = 10;
const RENDER_RADIUS = 30;
// Goal: 숫자를 이어 치는 동안에는 보이기만 하고, 잠깐 멈췄을 때 한 번만 확정해 2026을 칠 때 2·20·202를 알리지 않음
const TYPEAHEAD_COMMIT_DELAY_MILLISECONDS = 300;
const TYPEAHEAD_RESET_MILLISECONDS = 1000;
const WHEEL_INDEX_PROPERTY = '--lsp-wheel-index';
const WHEEL_SETTLE_DELAY_MILLISECONDS = 120;

type FirstEnabledOptions<Value> = {
  readonly direction: 1 | -1;
  readonly index: number;
  readonly options: readonly ColumnOption<Value>[];
};

type FollowPointerOptions = {
  readonly ownerDocument: Document;
  readonly pointerId: number;
};

type GesturePointerEvent = {
  readonly clientY: number;
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
  readonly samples: readonly PointerSample[];
  readonly startPosition: number;
  readonly startY: number;
};

type TypeaheadBuffer = {
  readonly text: string;
  readonly timeMs: number;
};

type TypeaheadMatchOptions<Value> = {
  readonly options: readonly ColumnOption<Value>[];
  readonly text: string;
};

type WheelListenerOptions = {
  readonly column: HTMLElement;
  readonly handlers: RefObject<NativeWheelHandlers>;
  readonly settleTimerRef: RefObject<ReturnType<typeof setTimeout> | undefined>;
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
  const motion = useWheelMotion({ columnRef, initialPosition: selectedPosition });
  const [renderCenter, setRenderCenter] = useState(selectedPosition);
  // Goal: 애니메이션 프레임 콜백이 지난 렌더의 값이 아니라 지금 그려진 창의 중심과 비교하게 함
  const renderCenterRef = useRef(selectedPosition);
  const isInteractingRef = useRef(false);
  const gestureRef = useRef<PointerGesture | null>(null);
  // Goal: 정착 애니메이션이 향하는 항목. 키를 누르고 있어 애니메이션이 끝나기 전에 다음 키가 와도 그 다음 항목으로 넘어감
  const settlingIndexRef = useRef<number | null>(null);
  const typeaheadRef = useRef<TypeaheadBuffer>({ text: '', timeMs: Number.NEGATIVE_INFINITY });
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const detachWheelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    send({ type: 'options.replace', options: props.options, preferredValue: props.value });
  }, [props.options, props.value, send]);

  useEffect(
    () => () => {
      clearTimeout(settleTimerRef.current);
      clearTimeout(typeaheadTimerRef.current);
      detachWheelRef.current?.();
    },
    [],
  );

  // Goal: 위치가 그려진 창 중심에서 RECENTER_DISTANCE 넘게 벗어날 때만 다시 그림(항목 10개당 최대 한 번)
  // Constraint: 한 프레임에 수백 항목을 건너는 관성·Home/End에서도 그 프레임에 보이는 항목이 DOM에 있도록 바로 그림
  const recenterRenderWindow = useCallback((position: number) => {
    if (Math.abs(position - renderCenterRef.current) <= RECENTER_DISTANCE) return;
    const center = Math.round(position);
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    renderCenterRef.current = center;
    flushSync(() => setRenderCenter(center));
  }, []);

  const commitIndex = useCallback(
    (index: number) => {
      const { props: currentProps, state: currentState } = latest.current;
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      isInteractingRef.current = false;
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      settlingIndexRef.current = null;
      const option = currentProps.options[index];
      // Constraint: 전부 비활성인 열에서 멈춘 항목도 비활성일 수 있음. 비활성 값은 앱에 알리지 않고 위치를 선택된 자리로 되돌림 (preflight 2.11)
      if (!option || option.isDisabled) {
        const restingPosition = Math.max(currentState.selectedIndex, 0);
        motion.setPosition(restingPosition);
        recenterRenderWindow(restingPosition);
        return;
      }
      if (index === currentState.selectedIndex) return;
      send({ type: 'option.select', index });
      currentProps.onValueChange(option.value);
    },
    [latest, motion, recenterRenderWindow, send],
  );

  const settleAt = useCallback(
    (position: number, durationMilliseconds?: number) => {
      clearTimeout(typeaheadTimerRef.current);
      const targetIndex = nearestEnabledIndex(latest.current.props.options, position);
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      settlingIndexRef.current = targetIndex;
      motion.animateTo({
        durationMilliseconds,
        onFrame: recenterRenderWindow,
        onSettle: () => commitIndex(targetIndex),
        target: targetIndex,
      });
    },
    [latest, motion, commitIndex, recenterRenderWindow],
  );

  // Goal: 값이 밖에서 바뀌면(제어 값·항목 교체) 위치를 선택된 항목에 맞춤. 사용자가 움직이는 중이거나 정착 중이면 건드리지 않음
  useEffect(() => {
    if (isInteractingRef.current || settlingIndexRef.current !== null) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    renderCenterRef.current = selectedPosition;
    setRenderCenter(selectedPosition);
    motion.setPosition(selectedPosition);
  }, [selectedPosition, motion]);

  const wheelHandlers = useLatestRef<NativeWheelHandlers>({
    isDisabled,
    onWheel: (deltaPixels) => {
      clearTimeout(typeaheadTimerRef.current);
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
    gestureRef.current = {
      ...gesture,
      isDragging: true,
      samples: [...gesture.samples, { position: event.clientY, timeMs: event.timeStamp }].slice(-MAX_GESTURE_SAMPLES),
    };
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
    const inertia = projectRelease({
      itemCount: props.options.length,
      itemSize: motion.readItemSize(),
      position: motion.positionRef.current,
      release: { position: event.clientY, timeMs: event.timeStamp },
      samples: gesture.samples,
    });
    settleAt(inertia.index, inertia.durationMs);
  };

  // Goal: 브라우저가 제스처를 가져가거나(pointercancel) 버튼을 뗀 것을 놓치면 제스처를 끝내고 가까운 항목에 맞춤. 탭 선택·관성은 적용하지 않음
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
    clearTimeout(typeaheadTimerRef.current);
    motion.stop();
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    isInteractingRef.current = true;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    gestureRef.current = {
      isDragging: false,
      pressedIndex: itemIndexOf(event.target),
      samples: [{ position: event.clientY, timeMs: event.timeStamp }],
      startPosition: motion.positionRef.current,
      startY: event.clientY,
    };
    followPointer({ ownerDocument: event.currentTarget.ownerDocument, pointerId: event.pointerId });
  };

  // Goal: 9999개 연도 열에서도 숫자를 쳐서 바로 감 (스펙 10.3). 1초 동안 이어 친 글자를 접두어로 보고 처음 맞는 활성 항목으로 감
  // Constraint: 공백은 버퍼에 넣지 않음. Space는 지금처럼 브라우저 기본 동작에 맡김
  const jumpToTypedOption = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key.length !== 1 || event.key.trim() === '') return;
    const previous = typeaheadRef.current;
    const isContinuing = event.timeStamp - previous.timeMs < TYPEAHEAD_RESET_MILLISECONDS;
    const text = `${isContinuing ? previous.text : ''}${event.key}`;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    typeaheadRef.current = { text, timeMs: event.timeStamp };
    const matchIndex = typeaheadMatchIndex({ options: props.options, text });
    if (matchIndex === null) return;
    event.preventDefault();
    previewTypedOption(matchIndex);
  };

  const previewTypedOption = (index: number): void => {
    clearTimeout(typeaheadTimerRef.current);
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    settlingIndexRef.current = index;
    motion.animateTo({ onFrame: recenterRenderWindow, onSettle: () => undefined, target: index });
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    typeaheadTimerRef.current = setTimeout(() => settleAt(index), TYPEAHEAD_COMMIT_DELAY_MILLISECONDS);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const isModified = event.altKey || event.ctrlKey || event.metaKey;
    if (isDisabled || isModified || event.nativeEvent.isComposing) return;
    const baseIndex = settlingIndexRef.current ?? state.selectedIndex;
    const targetIndex = keyboardTargetIndex(event.key, baseIndex, props.options.length);
    if (targetIndex === null) {
      jumpToTypedOption(event);
      return;
    }
    event.preventDefault();
    settleAt(
      firstEnabledFrom({ direction: targetIndex >= baseIndex ? 1 : -1, index: targetIndex, options: props.options }),
    );
  };

  // Goal: 열 요소가 붙을 때마다 휠 리스너를 붙임. 나중에 열을 그리는 훅 사용자도 마우스 휠을 받음
  // Constraint: 앱이 ref를 감싸면 React는 정리 함수 대신 null로 부름. 이전 리스너를 훅이 들고 있다가 매 호출 처음에 떼야 렌더마다 리스너가 쌓이지 않음
  // Constraint: 정착 타이머는 훅이 소유함. 렌더마다 다시 붙어도 스크롤 뒤 정착이 취소되지 않음
  const attachColumn = useCallback(
    (node: HTMLDivElement | null) => {
      detachWheelRef.current?.();
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      detachWheelRef.current = null;
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      columnRef.current = node;
      if (node === null) return;
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      detachWheelRef.current = listenToWheel({ column: node, handlers: wheelHandlers, settleTimerRef });
    },
    [wheelHandlers],
  );

  const selectedOption = props.options[state.selectedIndex];

  return {
    selectedIndex: state.selectedIndex,
    renderedRange: renderWindowAround(renderCenter, props.options.length, RENDER_RADIUS),
    getColumnProps: () => ({
      ref: attachColumn,
      role: 'spinbutton',
      tabIndex: isDisabled ? -1 : 0,
      // Goal: 서버 렌더와 첫 화면부터 선택된 항목에 위치함. 같은 값이면 React가 다시 쓰지 않아 움직이는 중의 직접 갱신과 부딪히지 않음
      // Constraint: 터치 끌기를 브라우저 스크롤이 가져가지 않게 touch-action은 테마가 아니라 부품이 정함 (스펙 10.3)
      style: { touchAction: 'none', ...cssVariables({ [WHEEL_POSITION_PROPERTY]: selectedPosition }) },
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
const itemIndexOf = (target: EventTarget | null): number | null => {
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

// Constraint: React의 onWheel은 passive라 preventDefault가 안 됨. 페이지가 같이 스크롤되지 않도록 비passive 리스너를 직접 붙임
const listenToWheel = ({ column, handlers, settleTimerRef }: WheelListenerOptions): (() => void) => {
  const onWheel = (event: WheelEvent): void => {
    if (handlers.current.isDisabled) return;
    event.preventDefault();
    handlers.current.onWheel(normalizeWheelDelta(event.deltaY, event.deltaMode, column.clientHeight));
    clearTimeout(settleTimerRef.current);
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    settleTimerRef.current = setTimeout(() => handlers.current.onSettle(), WHEEL_SETTLE_DELAY_MILLISECONDS);
  };
  column.addEventListener('wheel', onWheel, { passive: false });
  return () => column.removeEventListener('wheel', onWheel);
};

const typeaheadMatchIndex = <Value>({ options, text }: TypeaheadMatchOptions<Value>): number | null => {
  const prefix = text.toLocaleLowerCase();
  const index = options.findIndex(
    (option) => !option.isDisabled && option.label.toLocaleLowerCase().startsWith(prefix),
  );
  return index === -1 ? null : index;
};

// Constraint: setPointerCapture 대신 누른 동안만 문서에 캡처 단계 리스너를 붙임. 포인터 캡처를 쓰면 병렬로 도는 Firefox 테스트에서 다른 테스트의 마우스 입력이 이 열로 들어온 것으로 보였음(원인은 확정하지 못함)
// Constraint: 캡처 단계라 하위 요소의 stopPropagation에 막히지 않음. 문서 밖에서 버튼을 떼 pointerup을 놓친 마우스는 다음 move의 buttons === 0으로 끝냄
const useDocumentPointerListeners = (listeners: GesturePointerListeners): ((options: FollowPointerOptions) => void) => {
  const latestListeners = useLatestRef(listeners);
  const detachRef = useRef<(() => void) | null>(null);
  useEffect(() => () => detachRef.current?.(), []);
  return useCallback(
    ({ ownerDocument, pointerId }: FollowPointerOptions) => {
      detachRef.current?.();
      const onMove = (event: globalThis.PointerEvent): void => {
        if (event.pointerId !== pointerId) return;
        if (event.pointerType === 'mouse' && event.buttons === 0) {
          detach();
          latestListeners.current.onCancel();
          return;
        }
        latestListeners.current.onMove(event);
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
        ownerDocument.removeEventListener('pointermove', onMove, true);
        ownerDocument.removeEventListener('pointerup', onUp, true);
        ownerDocument.removeEventListener('pointercancel', onCancel, true);
        // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
        detachRef.current = null;
      };
      ownerDocument.addEventListener('pointermove', onMove, true);
      ownerDocument.addEventListener('pointerup', onUp, true);
      ownerDocument.addEventListener('pointercancel', onCancel, true);
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      detachRef.current = detach;
    },
    [latestListeners],
  );
};
