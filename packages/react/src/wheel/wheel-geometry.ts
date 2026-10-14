import {
  type ColumnOption,
  createVelocityTracker,
  type InertiaTarget,
  type PointerSample,
  projectInertia,
} from '@lunisolar-picker/core';

const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const LINE_HEIGHT_PIXELS = 16;

export type ReleaseInput = {
  readonly itemCount: number;
  readonly itemSize: number;
  // Constraint: 항목 단위 위치. 관성은 픽셀로 계산하므로 itemSize를 곱해 넘김
  readonly position: number;
  readonly release: PointerSample;
  readonly samples: readonly PointerSample[];
};

export const clampPosition = (position: number, itemCount: number): number =>
  Math.min(Math.max(position, 0), Math.max(itemCount - 1, 0));

// Constraint: 활성 항목이 하나도 없으면 자른 인덱스를 그대로 돌려줌. 확정 단계가 비활성 항목을 걸러냄 (preflight 2.11)
export const nearestEnabledIndex = <Value>(options: readonly ColumnOption<Value>[], index: number): number => {
  const clampedIndex = clampPosition(Math.round(index), options.length);
  for (let distance = 0; distance < options.length; distance += 1) {
    if (options[clampedIndex - distance]?.isDisabled === false) return clampedIndex - distance;
    if (options[clampedIndex + distance]?.isDisabled === false) return clampedIndex + distance;
  }
  return clampedIndex;
};

// Goal: 마우스 휠은 줄 단위, 트랙패드는 픽셀 단위로 보냄. 브라우저마다 다른 deltaMode를 픽셀로 맞춤 (스펙 10.3)
export const normalizeWheelDelta = (deltaY: number, deltaMode: number, pageHeight: number): number => {
  if (deltaMode === DOM_DELTA_LINE) return deltaY * LINE_HEIGHT_PIXELS;
  if (deltaMode === DOM_DELTA_PAGE) return deltaY * pageHeight;
  return deltaY;
};

// Constraint: 마지막 move 뒤 멈춰 있던 시간이 속도에 반영되도록 손을 떼는 순간의 샘플을 한 번 더 넣음 (계약 §2.9 ②)
// Constraint: 샘플 축은 clientY라 위로 끌면 속도가 음수. 위치(항목 번호)는 위로 끌 때 커지므로 부호를 뒤집음
export const projectRelease = ({ itemCount, itemSize, position, release, samples }: ReleaseInput): InertiaTarget => {
  const tracker = createVelocityTracker();
  for (const sample of [...samples, release]) tracker.add(sample);
  return projectInertia({ offset: position * itemSize, velocity: -tracker.velocity(), itemSize, itemCount });
};

export const renderWindowAround = (
  centerIndex: number,
  itemCount: number,
  radius: number,
): { readonly start: number; readonly end: number } => {
  const start = Math.max(0, Math.round(centerIndex) - radius);
  const end = Math.min(itemCount - 1, Math.round(centerIndex) + radius);
  return { start, end };
};
