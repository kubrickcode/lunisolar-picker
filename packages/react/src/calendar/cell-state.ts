import type { EpochDay } from '@lunisolar-picker/calendar';
import { type MonthGridCell, type ResolvedConstraints, validateEpochDay } from '@lunisolar-picker/core';
import { type DataAttributeProps, stateAttributes } from '../contract/data-attributes';

export type CellRenderInfo = MonthGridCell & CellState;

// Goal: 선택 store마다 다른 칸의 선택 상태. 단일 달력은 isSelected만, 범위 달력은 범위 표시와 막힌 날까지 채움
export type CellSelectionFlags = {
  readonly isBlocked: boolean;
  readonly isInRange: boolean;
  readonly isPreview: boolean;
  readonly isRangeEnd: boolean;
  readonly isRangeStart: boolean;
  readonly isSelected: boolean;
};

export interface CellState {
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isDisabled: boolean;
  readonly isOutsideMonth: boolean;
  readonly isInRange: boolean;
  readonly isRangeStart: boolean;
  readonly isRangeEnd: boolean;
  readonly isPreview: boolean;
  readonly isFocused: boolean;
}

export type CellStateInput = {
  readonly constraints: ResolvedConstraints;
  readonly focusedEpochDay: EpochDay;
  readonly selection: CellSelectionFlags;
  readonly todayEpochDay: EpochDay;
};

export const buildCellState = (cell: MonthGridCell, input: CellStateInput): CellState => ({
  isSelected: input.selection.isSelected,
  isToday: cell.epochDay === input.todayEpochDay,
  isDisabled:
    input.selection.isBlocked ||
    cell.isOutsideSupportedRange ||
    !validateEpochDay(cell.epochDay, input.constraints).isValid,
  isOutsideMonth: cell.isOutsideMonth,
  isInRange: input.selection.isInRange,
  isRangeStart: input.selection.isRangeStart,
  isRangeEnd: input.selection.isRangeEnd,
  isPreview: input.selection.isPreview,
  // Constraint: 두 달을 보여 주면 같은 날이 앞 달의 바깥 날짜로도 나옴. 탭으로 들어가는 칸은 그 달 안의 칸 하나뿐이어야 함
  isFocused: cell.epochDay === input.focusedEpochDay && !cell.isOutsideMonth,
});

export const cellDataAttributes = (cell: MonthGridCell, state: CellState): DataAttributeProps =>
  stateAttributes({
    selected: state.isSelected,
    today: state.isToday,
    disabled: state.isDisabled,
    outside: state.isOutsideMonth,
    'in-range': state.isInRange,
    'range-start': state.isRangeStart,
    'range-end': state.isRangeEnd,
    preview: state.isPreview,
    focused: state.isFocused,
    weekday: cell.weekday,
  });
