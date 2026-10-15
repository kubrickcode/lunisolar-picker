import type { CalendarId } from '@lunisolar-picker/calendar';
import type { MonthGridCell, NavigationEvent, RangeSelectionEvent, RangeSelectionState } from '@lunisolar-picker/core';
import type { ButtonHTMLAttributes, MouseEvent, RefObject } from 'react';

export type RangePointerHandlers = {
  readonly cellButtonProps: (cell: MonthGridCell) => ButtonHTMLAttributes<HTMLButtonElement>;
  readonly shouldIgnoreClick: (event: MouseEvent<HTMLButtonElement>) => boolean;
};

export type RangePointerOptions = {
  readonly displayCalendarId: CalendarId;
  readonly isInteractive: boolean;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly selection: RangeSelectionState;
  readonly sendNavigation: (event: NavigationEvent) => void;
  readonly sendSelection: (event: RangeSelectionEvent) => void;
};

// Goal: 탭·키보드 선택만 먼저 제공함. 마우스·펜 드래그는 M4-T5가 같은 시그니처로 채움
export const useRangePointer = (_options: RangePointerOptions): RangePointerHandlers => ({
  cellButtonProps: () => ({}),
  shouldIgnoreClick: () => false,
});
