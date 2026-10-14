export interface InertiaInput {
  readonly itemCount: number;
  readonly itemSize: number;
  readonly offset: number;
  readonly velocity: number;
}

export interface InertiaTarget {
  readonly durationMs: number;
  readonly index: number;
}

// 🟡 잠정: 감속 상수와 정착 시간 범위는 M3 iOS 실기기 튜닝으로 바뀔 수 있음
const DECELERATION_PX_PER_MS2 = 0.002;
const EASE_EXPONENT = 3;
const MAX_SETTLE_MS = 900;
const MIN_SETTLE_MS = 120;
const SNAP_DURATION_MS = 200;

// Goal: 등감속 운동으로 멈출 위치를 예측해 가장 가까운 항목에 맞춤. 프레임 루프는 바인딩이 돌림 (스펙 6.2)
export const projectInertia = (input: InertiaInput): InertiaTarget => {
  const travel = (input.velocity * Math.abs(input.velocity)) / (2 * DECELERATION_PX_PER_MS2);
  const projectedIndex = Math.round((input.offset + travel) / input.itemSize);
  const index = Math.min(Math.max(projectedIndex, 0), input.itemCount - 1);
  if (input.velocity === 0) return { durationMs: SNAP_DURATION_MS, index };
  const durationMs = Math.min(
    Math.max(Math.abs(input.velocity) / DECELERATION_PX_PER_MS2, MIN_SETTLE_MS),
    MAX_SETTLE_MS,
  );
  return { durationMs, index };
};

export const easeOutPosition = (from: number, to: number, elapsedMs: number, durationMs: number): number => {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  if (elapsedMs <= 0) return from;
  const progress = elapsedMs / durationMs;
  return from + (to - from) * (1 - (1 - progress) ** EASE_EXPONENT);
};
