import type { CalendarId, EpochDay } from '@lunisolar-picker/calendar';
import {
  createEdgeDwell,
  displayedRange,
  EDGE_DWELL_DELAY_MS,
  type EdgeDirection,
  type MonthGridCell,
  type NavigationEvent,
  type RangeHandle,
  type RangeSelectionEvent,
  type RangeSelectionState,
} from '@lunisolar-picker/core';
import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from 'react';
import { useLatestRef } from '../utilities/use-latest-ref';

const DRAG_POINTER_TYPES: ReadonlySet<string> = new Set(['mouse', 'pen']);
const EDGE_POLL_INTERVAL_MILLISECONDS = 100;
const KEYBOARD_CLICK_DETAIL = 0;
const PRIMARY_BUTTON = 0;

type DragTracking = {
  readonly onEdgeDwell: (direction: EdgeDirection) => void;
  readonly onRelease: () => void;
  readonly ownerDocument: Document;
  readonly pointerId: number;
  readonly readEdgeDirection: (clientX: number) => EdgeDirection | null;
};

type EdgeDirectionInput = {
  readonly bounds: DOMRect | undefined;
  readonly clientX: number;
  readonly isRightToLeft: boolean;
};

export type RangePointerHandlers = {
  readonly cellButtonProps: (cell: MonthGridCell) => ButtonHTMLAttributes<HTMLButtonElement>;
  readonly shouldIgnoreClick: (event: MouseEvent<HTMLButtonElement>) => boolean;
};

export type RangePointerOptions = {
  readonly displayCalendarId: CalendarId;
  readonly isInteractive: boolean;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly selection: RangeSelectionState;
  readonly sendNavigation: (event: NavigationEvent) => void;
  readonly sendSelection: (event: RangeSelectionEvent) => void;
};

// Goal: 마우스·펜만 드래그로 범위를 고름. 터치는 페이지 스크롤과 부딪혀 탭 두 번(클릭 경로)으로 고름 (스펙 10.5)
// Constraint: 선택 변경 알림은 sendSelection(사용자 선택 경로)이 pointer.up을 보낼 때 한 번만 나감. 누르기·호버는 확정 값을 바꾸지 않음
export const useRangePointer = (options: RangePointerOptions): RangePointerHandlers => {
  const latestOptions = useLatestRef(options);
  const stopDragRef = useRef<(() => void) | null>(null);
  // Goal: 드래그를 시작한 누르기에 이어 오는 클릭만 버림. 누르기 없이 오는 클릭(보조 기술)은 클릭 경로로 고름
  const isPressClickPendingRef = useRef(false);
  const clearPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      stopDragRef.current?.();
      clearTimeout(clearPressTimerRef.current);
    },
    [],
  );

  // Constraint: 끄는 중에 비활성·읽기 전용이 되면 그 뒤 호버·손 떼기로 범위가 바뀌지 않게 드래그를 버리고 확정 범위로 되돌림
  useEffect(() => {
    if (options.isInteractive || stopDragRef.current === null) return;
    stopDragRef.current();
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    stopDragRef.current = null;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    isPressClickPendingRef.current = false;
    latestOptions.current.sendSelection({ type: 'cancel' });
  }, [options.isInteractive, latestOptions]);

  const finishDrag = (): void => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    stopDragRef.current = null;
    latestOptions.current.sendSelection({ type: 'pointer.up' });
    // Constraint: 브라우저는 pointerup과 그 클릭을 한 작업 안에서 보내므로, 다음 작업에서 표시를 지우면 이 누르기의 클릭만 버려짐
    clearTimeout(clearPressTimerRef.current);
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    clearPressTimerRef.current = setTimeout(() => {
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      isPressClickPendingRef.current = false;
    });
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    stopDragRef.current?.();
    const root = latestOptions.current.rootRef.current;
    const isRightToLeft = root !== null && getComputedStyle(root).direction === 'rtl';
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    isPressClickPendingRef.current = true;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    stopDragRef.current = trackDrag({
      onEdgeDwell: (direction) =>
        latestOptions.current.sendNavigation({ type: 'month.shift', amount: direction === 'next' ? 1 : -1 }),
      onRelease: finishDrag,
      ownerDocument: event.currentTarget.ownerDocument,
      pointerId: event.pointerId,
      readEdgeDirection: (clientX) =>
        edgeDirectionOf({
          bounds: latestOptions.current.rootRef.current?.getBoundingClientRect(),
          clientX,
          isRightToLeft,
        }),
    });
  };

  return {
    cellButtonProps: (cell) => ({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        const current = latestOptions.current;
        if (!DRAG_POINTER_TYPES.has(event.pointerType) || event.button !== PRIMARY_BUTTON) return;
        if (!current.isInteractive) return;
        releaseImplicitCapture(event);
        const handle = grabbableHandleAt(current.selection, cell.epochDay);
        current.sendSelection(
          handle === null
            ? { type: 'pointer.down', epochDay: cell.epochDay, calendarId: current.displayCalendarId }
            : { type: 'handle.grab', handle },
        );
        startDrag(event);
      },
      // Constraint: 좌표가 아니라 들어온 날짜 칸만 store로 보냄 (스펙 6.2). 드래그가 끝난 뒤의 호버는 무시함 (Review Focus 4)
      onPointerEnter: () => {
        if (stopDragRef.current === null) return;
        latestOptions.current.sendSelection({ type: 'pointer.enter', epochDay: cell.epochDay });
      },
    }),
    shouldIgnoreClick: (event) => event.detail !== KEYBOARD_CLICK_DETAIL && isPressClickPendingRef.current,
  };
};

// Goal: 끌기 중 달력 왼쪽·오른쪽 밖. 오른쪽에서 왼쪽으로 쓰는 문서는 다음 달이 왼쪽에 있음
const edgeDirectionOf = ({ bounds, clientX, isRightToLeft }: EdgeDirectionInput): EdgeDirection | null => {
  if (bounds === undefined) return null;
  if (clientX < bounds.left) return isRightToLeft ? 'next' : 'previous';
  if (clientX > bounds.right) return isRightToLeft ? 'previous' : 'next';
  return null;
};

// Constraint: 손잡이는 완성된 범위의 끝에서만 잡힘. 고르는 중(anchor)이면 누른 날이 반대 끝이 되도록 pointer.down을 보냄 (계약 §2.6 (a))
const grabbableHandleAt = (selection: RangeSelectionState, epochDay: EpochDay): RangeHandle | null => {
  const range = selection.anchor === null ? displayedRange(selection) : null;
  if (range === null || range.end === null) return null;
  if (epochDay === range.start) return 'start';
  if (epochDay === range.end) return 'end';
  return null;
};

// Constraint: 펜이 화면에 닿는 기기는 누른 요소에 포인터를 암묵적으로 캡처할 수 있어 다른 칸에 pointerover가 오지 않음. 캡처를 새로 걸지 않고 브라우저가 건 것만 풂
const releaseImplicitCapture = (event: PointerEvent<HTMLButtonElement>): void => {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
};

// Constraint: setPointerCapture 대신 끄는 동안만 문서에 캡처 단계 리스너를 붙임(M3 휠과 같음). 포인터 캡처는 병렬 Firefox 테스트에서 다른 테스트의 입력을 끌어왔고, 캡처하면 칸 사이 pointerover도 오지 않음
// Constraint: 문서 밖에서 버튼을 떼 pointerup을 놓친 마우스는 다음 move의 buttons === 0으로 끝냄. pointercancel도 손을 뗀 것으로 봄 (계약 §2.6)
const trackDrag = ({
  onEdgeDwell,
  onRelease,
  ownerDocument,
  pointerId,
  readEdgeDirection,
}: DragTracking): (() => void) => {
  const dwell = createEdgeDwell(EDGE_DWELL_DELAY_MS);
  let currentDirection: EdgeDirection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const pollDwell = (): void => {
    const direction = dwell.poll(performance.now());
    if (direction !== null) onEdgeDwell(direction);
  };
  const trackEdge = (clientX: number): void => {
    const direction = readEdgeDirection(clientX);
    if (direction === currentDirection) return;
    currentDirection = direction;
    clearInterval(pollTimer);
    if (direction === null) {
      dwell.leave();
      return;
    }
    dwell.enter(direction, performance.now());
    pollTimer = setInterval(pollDwell, EDGE_POLL_INTERVAL_MILLISECONDS);
  };
  const onMove = (event: globalThis.PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      release(event);
      return;
    }
    trackEdge(event.clientX);
  };
  const release = (event: globalThis.PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    stop();
    onRelease();
  };
  const stop = (): void => {
    clearInterval(pollTimer);
    ownerDocument.removeEventListener('pointermove', onMove, true);
    ownerDocument.removeEventListener('pointerup', release, true);
    ownerDocument.removeEventListener('pointercancel', release, true);
  };

  ownerDocument.addEventListener('pointermove', onMove, true);
  ownerDocument.addEventListener('pointerup', release, true);
  ownerDocument.addEventListener('pointercancel', release, true);
  return stop;
};
