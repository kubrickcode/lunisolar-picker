import type { EpochDay } from '@lunisolar-picker/calendar';
import {
  displayedRange,
  isEpochDayInBlockedRange,
  type RangeSelectionState,
  type ResolvedConstraints,
} from '@lunisolar-picker/core';
import type { CellSelectionFlags } from '../calendar/cell-state';

export type RangeCellFlagsInput = {
  readonly constraints: ResolvedConstraints;
  readonly epochDay: EpochDay;
  readonly selection: RangeSelectionState;
};

// Constraint: 그리기는 displayedRange 기준(고르는 중·미리보기 포함)이고, "고르는 중"은 anchor 유무로 판단함. 끝 손잡이를 잡은 동안에도 draft 끝은 남아 있음 (계약 §2.6 (a), preflight 4.10)
export const rangeCellFlags = ({ constraints, epochDay, selection }: RangeCellFlagsInput): CellSelectionFlags => {
  const range = displayedRange(selection);
  const end = range?.end ?? range?.start ?? null;
  const isInRange = range !== null && end !== null && epochDay >= range.start && epochDay <= end;
  const isRangeStart = range !== null && epochDay === range.start;
  const isRangeEnd = end !== null && epochDay === end;
  const isBlocked = selection.anchor !== null && isEpochDayInBlockedRange(selection.anchor, epochDay, constraints);
  return {
    isSelected: isRangeStart || isRangeEnd,
    isInRange,
    isRangeStart,
    isRangeEnd,
    isPreview: selection.preview !== null && isInRange,
    isBlocked,
  };
};
