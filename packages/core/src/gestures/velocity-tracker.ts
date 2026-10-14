export interface PointerSample {
  readonly position: number;
  readonly timeMs: number;
}

export interface VelocityTracker {
  add(sample: PointerSample): void;
  reset(): void;
  velocity(): number;
}

// Constraint: 손을 떼기 직전의 속도만 관성에 반영해야 해서 최근 100ms 샘플만 씀
const VELOCITY_WINDOW_MS = 100;

export const createVelocityTracker = (): VelocityTracker => {
  let samples: readonly PointerSample[] = [];
  return {
    add: (sample) => {
      samples = [...samples, sample].filter((candidate) => sample.timeMs - candidate.timeMs <= VELOCITY_WINDOW_MS);
    },
    reset: () => {
      samples = [];
    },
    velocity: () => {
      const first = samples[0];
      const last = samples.at(-1);
      if (!first || !last || last.timeMs === first.timeMs) return 0;
      return (last.position - first.position) / (last.timeMs - first.timeMs);
    },
  };
};
