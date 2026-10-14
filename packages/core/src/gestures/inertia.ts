import { LunisolarPickerError } from '@lunisolar-picker/calendar';

// 🟡 잠정: 감속 상수와 정착 시간 범위는 M3 iOS 실기기 튜닝으로 바뀔 수 있음
const DECELERATION_PX_PER_MS2 = 0.002;
const EASE_EXPONENT = 3;
const MAX_SETTLE_MS = 900;
const MIN_SETTLE_MS = 120;
const SNAP_DURATION_MS = 200;

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

// Constraint: itemCount 0이면 index -1 (선택 없음, column과 같은 규약). 입력은 유한한 수여야 하며 속도가 유한하지 않으면 0으로 봄
// Goal: 등감속 운동으로 멈출 위치를 예측해 가장 가까운 항목에 맞춤. 프레임 루프는 바인딩이 돌림 (스펙 6.2)
export const projectInertia = (input: InertiaInput): InertiaTarget => {
  if (!(input.itemSize > 0)) {
    throw new LunisolarPickerError(`itemSize must be positive, received ${input.itemSize}`);
  }
  const velocity = Number.isFinite(input.velocity) ? input.velocity : 0;
  const travel = (velocity * Math.abs(velocity)) / (2 * DECELERATION_PX_PER_MS2);
  const projectedIndex = Math.round((input.offset + travel) / input.itemSize);
  const index = Math.min(Math.max(projectedIndex, 0), input.itemCount - 1);
  if (velocity === 0) return { durationMs: SNAP_DURATION_MS, index };
  const durationMs = Math.min(Math.max(Math.abs(velocity) / DECELERATION_PX_PER_MS2, MIN_SETTLE_MS), MAX_SETTLE_MS);
  return { durationMs, index };
};

// 입력은 유한한 수여야 함. 유한하지 않은 시간은 도착한 것으로 봄
export const easeOutPosition = (from: number, to: number, elapsedMs: number, durationMs: number): number => {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(durationMs)) return to;
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  if (elapsedMs <= 0) return from;
  const progress = elapsedMs / durationMs;
  return from + (to - from) * (1 - (1 - progress) ** EASE_EXPONENT);
};
