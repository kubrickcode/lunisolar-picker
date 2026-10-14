import type { ColumnOption } from '@lunisolar-picker/core';

const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const LINE_HEIGHT_PIXELS = 16;

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

export const renderWindowAround = (
  centerIndex: number,
  itemCount: number,
  radius: number,
): { readonly start: number; readonly end: number } => {
  const start = Math.max(0, Math.round(centerIndex) - radius);
  const end = Math.min(itemCount - 1, Math.round(centerIndex) + radius);
  return { start, end };
};
