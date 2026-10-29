// Constraint: 손을 떼기 직전의 속도만 관성에 반영해야 해서 최근 100ms 샘플만 씀
const VELOCITY_WINDOW_MS = 100;

export interface PointerSample {
  readonly position: number;
  readonly timeMs: number;
}

export interface VelocityTracker {
  add(sample: PointerSample): void;
  reset(): void;
  velocity(): number;
}

// 속도는 샘플 position과 같은 축·부호로 나옴. 손 뗄 때의 마지막 샘플 추가는 바인딩 책임
export const createVelocityTracker = (): VelocityTracker => {
  let samples: readonly PointerSample[] = [];
  return {
    add: (sample) => {
      const newest = samples.at(-1);
      if (newest && sample.timeMs < newest.timeMs) return;
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
