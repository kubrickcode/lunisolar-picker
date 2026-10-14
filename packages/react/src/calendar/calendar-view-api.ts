import type { CalendarId, CalendarSystem, EpochDay } from '@lunisolar-picker/calendar';
import type { MonthGrid, MonthGridCell, NavigationEvent, NavigationState, PickerContext } from '@lunisolar-picker/core';
import type {
  ButtonHTMLAttributes,
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  TableHTMLAttributes,
  TdHTMLAttributes,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { AUTOFOCUS_ATTRIBUTE } from '../focus/focusable-elements';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { calendarKeyAction } from './calendar-key-action';
import { buildCellLabel } from './cell-label';
import { buildCellState, type CellSelectionFlags, type CellState, cellDataAttributes } from './cell-state';
import type { CalendarFoundation, SlideDirection } from './use-calendar-foundation';

export type CalendarInteraction = {
  readonly getCellLabel: ((cell: MonthGridCell) => string | undefined) | undefined;
  readonly isDisabled: boolean;
  // Goal: 확정 값 기준의 보이는 무효 여부(isVisiblyInvalid). 선택 store마다 확정 값의 유효성 계산이 다름 (계약 §2.6 (b), preflight 3.6)
  readonly isInvalid: boolean;
  readonly isReadOnly: boolean;
  readonly onBlur: (() => void) | undefined;
};

export type CalendarRootDomProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & {
    readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  };

export interface CalendarViewApi {
  readonly mode: 'single' | 'range';
  readonly context: PickerContext;
  readonly navigation: NavigationState;
  readonly months: readonly MonthGrid[];
  readonly calendar: CalendarSystem;
  readonly secondaryCalendar: CalendarSystem | null;
  readonly slideDirection: SlideDirection | null;
  readonly isDisabled: boolean;
  readonly isInvalid: boolean;
  readonly isReadOnly: boolean;
  readonly isTodayVisible: boolean;
  sendNavigation(event: NavigationEvent): void;
  selectDisplayCalendar(calendarId: CalendarId): void;
  selectEpochDay(epochDay: EpochDay): void;
  getCellState(cell: MonthGridCell): CellState;
  getCellProps(cell: MonthGridCell): CellProps;
  getGridProps(monthIndex: number): TableHTMLAttributes<HTMLTableElement>;
  getRootProps(): CalendarRootDomProps;
  headingId(monthIndex: number): string;
  consumeFocusRequest(): boolean;
}

export type CalendarViewInput = {
  readonly behavior: SelectionBehavior;
  readonly foundation: CalendarFoundation;
  readonly interaction: CalendarInteraction;
};

export interface CellProps {
  readonly gridCell: TdHTMLAttributes<HTMLTableCellElement>;
  readonly button: ButtonHTMLAttributes<HTMLButtonElement> & { readonly [AUTOFOCUS_ATTRIBUTE]?: string };
}

export type SelectionBehavior = {
  readonly extraButtonProps?: ((cell: MonthGridCell) => ButtonHTMLAttributes<HTMLButtonElement>) | undefined;
  readonly mode: 'single' | 'range';
  readonly selectEpochDay: (epochDay: EpochDay) => void;
  readonly selectionFlags: (cell: MonthGridCell) => CellSelectionFlags;
  readonly shouldIgnoreClick?: ((event: MouseEvent<HTMLButtonElement>) => boolean) | undefined;
};

export const createCalendarViewApi = ({ behavior, foundation, interaction }: CalendarViewInput): CalendarViewApi => {
  const { calendar, context, months, navigation, secondaryCalendar } = foundation;
  const isInteractive = !interaction.isDisabled && !interaction.isReadOnly;
  const headingId = (monthIndex: number): string => `${foundation.idPrefix}-heading-${monthIndex}`;

  const getCellState = (cell: MonthGridCell): CellState =>
    buildCellState(cell, {
      todayEpochDay: context.today,
      focusedEpochDay: navigation.focusedEpochDay,
      constraints: context.constraints,
      selection: behavior.selectionFlags(cell),
    });

  const selectEpochDay = (epochDay: EpochDay): void => {
    if (!isInteractive) return;
    behavior.selectEpochDay(epochDay);
    foundation.sendNavigation({ type: 'focus.set', epochDay });
  };

  const getCellProps = (cell: MonthGridCell): CellProps => {
    const state = getCellState(cell);
    return {
      gridCell: {
        role: 'gridcell',
        'aria-selected': state.isSelected,
        ...(state.isDisabled ? { 'aria-disabled': true } : {}),
        ...partAttributes('calendar-cell'),
        ...cellDataAttributes(cell, state),
      },
      button: {
        type: 'button',
        tabIndex: state.isFocused ? 0 : -1,
        // Goal: Popover·Sheet가 열릴 때 탭으로 들어가는 칸(선택한 날, 없으면 오늘)에 포커스가 가게 함 (스펙 10.4, preflight 3.3)
        ...(state.isFocused ? { [AUTOFOCUS_ATTRIBUTE]: '' } : {}),
        'aria-label': buildCellLabel({
          cell,
          calendar,
          secondaryCalendar,
          locale: context.locale,
          appLabel: interaction.getCellLabel?.(cell),
        }),
        ...(state.isToday ? { 'aria-current': 'date' as const } : {}),
        ...(state.isDisabled || !isInteractive ? { 'aria-disabled': true } : {}),
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          if (state.isDisabled || behavior.shouldIgnoreClick?.(event)) return;
          selectEpochDay(cell.epochDay);
        },
        onFocus: () => {
          if (cell.epochDay !== navigation.focusedEpochDay && !cell.isOutsideMonth) {
            foundation.sendNavigation({ type: 'focus.set', epochDay: cell.epochDay });
          }
        },
        ...behavior.extraButtonProps?.(cell),
      },
    };
  };

  return {
    mode: behavior.mode,
    context,
    navigation,
    months,
    calendar,
    secondaryCalendar,
    slideDirection: foundation.slideDirection,
    isDisabled: interaction.isDisabled,
    isInvalid: interaction.isInvalid,
    isReadOnly: interaction.isReadOnly,
    isTodayVisible: months.some((month) =>
      month.weeks.some((week) => week.some((cell) => !cell.isOutsideMonth && cell.epochDay === context.today)),
    ),
    sendNavigation: foundation.sendNavigation,
    selectDisplayCalendar: foundation.selectDisplayCalendar,
    selectEpochDay,
    getCellState,
    getCellProps,
    getGridProps: (monthIndex) => ({
      role: 'grid',
      'aria-labelledby': headingId(monthIndex),
      ...(behavior.mode === 'range' ? { 'aria-multiselectable': true } : {}),
      onKeyDown: (event: KeyboardEvent<HTMLTableElement>) => {
        const action = calendarKeyAction({
          key: event.key,
          isShiftPressed: event.shiftKey,
          isRightToLeft: isRightToLeft(event.currentTarget),
        });
        if (!action) return;
        event.preventDefault();
        if (action.kind === 'select') {
          selectEpochDay(navigation.focusedEpochDay);
          return;
        }
        foundation.requestFocus();
        foundation.sendNavigation(action.event);
      },
    }),
    // Constraint: 칸 사이 이동은 달력 안이므로 달력 전체를 벗어날 때만 onBlur를 알림. react-hook-form의 touched 판정에 씀 (preflight 3.1)
    getRootProps: () => ({
      onBlur: createFocusLeaveListener(interaction.onBlur),
      ...partAttributes('calendar', {
        calendar: navigation.displayCalendarId,
        view: navigation.view,
        disabled: interaction.isDisabled,
        readonly: interaction.isReadOnly,
        invalid: interaction.isInvalid,
      }),
    }),
    headingId,
    consumeFocusRequest: foundation.consumeFocusRequest,
  };
};

const isRightToLeft = (element: Element): boolean => getComputedStyle(element).direction === 'rtl';
