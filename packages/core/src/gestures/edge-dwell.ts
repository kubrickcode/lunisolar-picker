// Goal: 드래그 중 달력 가장자리에 0.5초 머물면 달을 넘김 (web-console 동작과 같음)
export const EDGE_DWELL_DELAY_MS = 500;

export type EdgeDirection = 'next' | 'previous';

export interface EdgeDwell {
  enter(direction: EdgeDirection, nowMs: number): void;
  leave(): void;
  poll(nowMs: number): EdgeDirection | null;
}

type DwellState = {
  readonly direction: EdgeDirection;
  readonly sinceMs: number;
};

export const createEdgeDwell = (delayMs: number = EDGE_DWELL_DELAY_MS): EdgeDwell => {
  let state: DwellState | null = null;
  return {
    enter: (direction, nowMs) => {
      if (state?.direction === direction) return;
      state = { direction, sinceMs: nowMs };
    },
    leave: () => {
      state = null;
    },
    poll: (nowMs) => {
      if (state === null || nowMs - state.sinceMs < delayMs) return null;
      state = { direction: state.direction, sinceMs: nowMs };
      return state.direction;
    },
  };
};
