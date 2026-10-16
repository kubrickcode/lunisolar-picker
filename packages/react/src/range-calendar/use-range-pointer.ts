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
import { isRightToLeft } from '../utilities/is-right-to-left';
import { useLatestRef } from '../utilities/use-latest-ref';

const DRAG_POINTER_TYPES: ReadonlySet<string> = new Set(['mouse', 'pen']);
const EDGE_POLL_INTERVAL_MILLISECONDS = 100;
const KEYBOARD_CLICK_DETAIL = 0;
// Constraint: iPad Pencil·Android 스타일러스는 탭의 클릭을 손 뗀 뒤 다음 작업보다 늦게 보내기도 함. 그 클릭을 고르기로 받으면 누른 날 하루짜리 범위가 확정되므로, 손 뗀 뒤 이 시간 안에 오는 첫 클릭은 그 누르기의 클릭으로 보고 버림
export const PRESS_CLICK_WINDOW_MILLISECONDS = 1000;
const PRIMARY_BUTTON = 0;

type ActiveDrag = {
  // Goal: 손 뗀 뒤 탭 정지점을 둘 날. 마지막으로 들어온 칸, 없으면 누른 칸. 달력 가장자리 밖으로 나가면 비워 월 넘김 뒤 원래 달로 돌아가지 않게 함
  readonly endEpochDay: EpochDay | null;
  // Constraint: 고르는 중(anchor)에 누르면 그 누르기가 반대 끝을 정하거나 거절됨. 그 뒤 호버를 보내면 거절된 누르기 뒤에 미리보기가 남으므로 보내지 않음
  readonly isForwardingHover: boolean;
  // Constraint: 끄는 포인터의 호버만 받음. 다른 포인터(멈춰 있는 마우스 아래로 칸이 다시 그려질 때 등)의 pointerover가 끝 날을 바꾸지 않게 함
  readonly pointerId: number;
  readonly stop: () => void;
};

type DragStart = {
  readonly event: PointerEvent<HTMLButtonElement>;
  readonly isForwardingHover: boolean;
  readonly pressedEpochDay: EpochDay;
};

type DragTracking = {
  readonly onEdgeDwell: (direction: EdgeDirection) => void;
  readonly onEdgePass: () => void;
  readonly onRelease: (releasedAtMilliseconds: number) => void;
  readonly ownerDocument: Document;
  readonly pointerId: number;
  readonly readEdgeDirection: (clientX: number) => EdgeDirection | null;
};

type EdgeDirectionInput = {
  readonly bounds: DOMRect | undefined;
  readonly clientX: number;
  readonly isRightToLeft: boolean;
};

type PressClick = {
  // Goal: 손 뗀 시각(event.timeStamp). 아직 누르는 중이면 null
  readonly releasedAtMilliseconds: number | null;
};

export type RangePointerHandlers = {
  readonly cellButtonProps: (cell: MonthGridCell) => ButtonHTMLAttributes<HTMLButtonElement>;
  readonly shouldIgnoreClick: (event: MouseEvent<HTMLButtonElement>) => boolean;
};

export type RangePointerOptions = {
  readonly displayCalendarId: CalendarId;
  readonly isInteractive: boolean;
  readonly navigateWithFocus: (event: NavigationEvent) => void;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly selection: RangeSelectionState;
  readonly sendNavigation: (event: NavigationEvent) => void;
  readonly sendSelection: (event: RangeSelectionEvent) => void;
};

// Goal: 마우스·펜만 드래그로 범위를 고름. 터치는 페이지 스크롤과 부딪혀 탭 두 번(클릭 경로)으로 고름 (스펙 10.5)
// Constraint: 선택 변경 알림은 sendSelection(사용자 선택 경로)이 pointer.up을 보낼 때 한 번만 나감. 누르기·호버는 확정 값을 바꾸지 않음
export const useRangePointer = (options: RangePointerOptions): RangePointerHandlers => {
  const latestOptions = useLatestRef(options);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  // Goal: 드래그를 시작한 누르기에 이어 오는 클릭만 버림. 누르기 없이 오는 클릭(보조 기술)은 클릭 경로로 고름
  const pressClickRef = useRef<PressClick | null>(null);

  useEffect(() => () => activeDragRef.current?.stop(), []);

  // Constraint: 끄는 중에 비활성·읽기 전용이 되면 그 뒤 호버·손 떼기로 범위가 바뀌지 않게 드래그를 버리고 확정 범위로 되돌림
  useEffect(() => {
    const drag = activeDragRef.current;
    if (options.isInteractive || drag === null) return;
    drag.stop();
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    activeDragRef.current = null;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    pressClickRef.current = null;
    latestOptions.current.sendSelection({ type: 'cancel' });
  }, [options.isInteractive, latestOptions]);

  const setDragEndDay = (endEpochDay: EpochDay | null): void => {
    const drag = activeDragRef.current;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    if (drag !== null) activeDragRef.current = { ...drag, endEpochDay };
  };

  const finishDrag = (releasedAtMilliseconds: number): void => {
    const endEpochDay = activeDragRef.current?.endEpochDay ?? null;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    activeDragRef.current = null;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    pressClickRef.current = { releasedAtMilliseconds };
    const current = latestOptions.current;
    current.sendSelection({ type: 'pointer.up' });
    if (endEpochDay === null) return;
    const focusEvent: NavigationEvent = { type: 'focus.set', epochDay: endEpochDay };
    // Goal: 누를 때 버튼에 포커스를 주는 브라우저(Chromium 등)는 DOM 포커스도 끝난 날로 옮겨 Tab 정지점이 둘이 되지 않게 하고, 바깥 달의 날을 골라 달이 바뀌어도 포커스가 body로 떨어지지 않게 함
    // Constraint: 포커스를 주지 않는 브라우저(macOS Safari·Firefox)는 포커스가 달력 밖이므로 탭 정지점만 옮기고 포커스를 끌어오지 않음. 바깥 달의 날이면 그 달을 보여 줌 (클릭 경로와 같음)
    if (hasFocusWithin(current.rootRef.current)) current.navigateWithFocus(focusEvent);
    else current.sendNavigation(focusEvent);
  };

  const startDrag = ({ event, isForwardingHover, pressedEpochDay }: DragStart): void => {
    activeDragRef.current?.stop();
    const root = latestOptions.current.rootRef.current;
    const isRootRightToLeft = root !== null && isRightToLeft(root);
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    pressClickRef.current = { releasedAtMilliseconds: null };
    const stop = trackDrag({
      onEdgeDwell: (direction) =>
        latestOptions.current.sendNavigation({ type: 'month.shift', amount: direction === 'next' ? 1 : -1 }),
      onEdgePass: () => setDragEndDay(null),
      onRelease: finishDrag,
      ownerDocument: event.currentTarget.ownerDocument,
      pointerId: event.pointerId,
      readEdgeDirection: (clientX) =>
        edgeDirectionOf({
          bounds: latestOptions.current.rootRef.current?.getBoundingClientRect(),
          clientX,
          isRightToLeft: isRootRightToLeft,
        }),
    });
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    activeDragRef.current = { endEpochDay: pressedEpochDay, isForwardingHover, pointerId: event.pointerId, stop };
  };

  return {
    cellButtonProps: (cell) => ({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        // Constraint: 새 누르기(터치 포함)가 오면 지난 누르기의 클릭은 더 오지 않음
        // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
        pressClickRef.current = null;
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
        // Constraint: 누른 뒤 store 상태는 동기 디스패치에서 아직 렌더되지 않았으므로 누르기 전 anchor로 판단함
        startDrag({ event, isForwardingHover: current.selection.anchor === null, pressedEpochDay: cell.epochDay });
      },
      // Constraint: 좌표가 아니라 들어온 날짜 칸만 store로 보냄 (스펙 6.2). 드래그가 끝난 뒤의 호버는 무시함 (Review Focus 4)
      onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
        const drag = activeDragRef.current;
        if (drag === null || !drag.isForwardingHover || event.pointerId !== drag.pointerId) return;
        setDragEndDay(cell.epochDay);
        latestOptions.current.sendSelection({ type: 'pointer.enter', epochDay: cell.epochDay });
      },
    }),
    // Side effect: 누르기의 클릭 표시를 첫 포인터 클릭에서 소비함. 키보드 클릭(detail 0)은 소비하지 않음
    shouldIgnoreClick: (event) => {
      if (event.detail === KEYBOARD_CLICK_DETAIL) return false;
      const pressClick = pressClickRef.current;
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      pressClickRef.current = null;
      if (pressClick === null) return false;
      if (pressClick.releasedAtMilliseconds === null) return true;
      return event.timeStamp - pressClick.releasedAtMilliseconds <= PRESS_CLICK_WINDOW_MILLISECONDS;
    },
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

const hasFocusWithin = (root: HTMLElement | null): boolean =>
  root !== null && root.contains(root.ownerDocument.activeElement);

// Constraint: 펜이 화면에 닿는 기기는 누른 요소(칸 안의 글자 요소일 수 있음)에 포인터를 암묵적으로 캡처할 수 있어 다른 칸에 pointerover가 오지 않음. 캡처를 새로 걸지 않고 브라우저가 건 것만 풂
const releaseImplicitCapture = (event: PointerEvent<HTMLButtonElement>): void => {
  const { pointerId, target } = event;
  if (target instanceof Element && target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
};

// Constraint: setPointerCapture 대신 끄는 동안만 문서에 캡처 단계 리스너를 붙임(M3 휠과 같음). 포인터 캡처는 병렬 Firefox 테스트에서 다른 테스트의 입력을 끌어왔고, 캡처하면 칸 사이 pointerover도 오지 않음
// Constraint: 문서 밖에서 버튼을 떼 pointerup을 놓친 마우스는 다음 move의 buttons === 0으로 끝냄. pointercancel도 손을 뗀 것으로 봄 (계약 §2.6)
const trackDrag = ({
  onEdgeDwell,
  onEdgePass,
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
    onEdgePass();
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
    onRelease(event.timeStamp);
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
