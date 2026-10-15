import type { CalendarId, CalendarSystem, EpochDay } from '@lunisolar-picker/calendar';
import type { MonthGrid, MonthGridCell, NavigationEvent, NavigationState, PickerContext } from '@lunisolar-picker/core';
import type {
  ButtonHTMLAttributes,
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  RefObject,
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
    readonly ref: RefObject<HTMLDivElement | null>;
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
  consumeFocusRequest(): boolean;
  // Goal: 고른 버튼이 사라지는 보기 전환(월·연 고르기) 뒤에 새로 그려지는 탭 정지점이 포커스를 이어 받게 함
  requestFocus(): void;
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
  const gridLabelProps = (month: MonthGrid | undefined): { readonly 'aria-label'?: string } =>
    month ? { 'aria-label': context.locale.formatHeading(month.month, calendar.id) } : {};

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
    // Constraint: 비활성 달력은 M3 비활성 입력 칸처럼 탭 정지점이 없음. 읽기 전용은 둘러볼 수 있게 남김
    const isTabStop = state.isFocused && !interaction.isDisabled;
    return {
      gridCell: {
        role: 'gridcell',
        // Constraint: 범위 달력은 범위 안 모든 날(고르는 중이면 anchor~미리보기)을 선택된 것으로 읽힘. data-selected는 양 끝에만 남겨 테마가 끝을 채움 (계약 §3.4)
        'aria-selected': behavior.mode === 'range' ? state.isInRange : state.isSelected,
        ...(state.isDisabled ? { 'aria-disabled': true } : {}),
        ...partAttributes('calendar-cell'),
        ...cellDataAttributes(cell, state),
      },
      button: {
        type: 'button',
        tabIndex: isTabStop ? 0 : -1,
        // Goal: Popover·Sheet가 열릴 때 탭으로 들어가는 칸(선택한 날, 없으면 오늘)에 포커스가 가게 함 (스펙 10.4, preflight 3.3)
        ...(isTabStop ? { [AUTOFOCUS_ATTRIBUTE]: '' } : {}),
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
          if (interaction.isDisabled) return;
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
      // Goal: 보이는 제목과 같은 글로 이름을 붙여 Heading·ViewButton 중 무엇을 그리든(둘 다 그려도) id 연결 없이 격자 이름이 같음 (T3 리뷰 4)
      ...gridLabelProps(months[monthIndex]),
      ...(behavior.mode === 'range' ? { 'aria-multiselectable': true } : {}),
      onKeyDown: (event: KeyboardEvent<HTMLTableElement>) => {
        if (interaction.isDisabled) return;
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
      ref: foundation.rootRef,
      ...partAttributes('calendar', {
        calendar: navigation.displayCalendarId,
        view: navigation.view,
        disabled: interaction.isDisabled,
        readonly: interaction.isReadOnly,
        invalid: interaction.isInvalid,
      }),
    }),
    consumeFocusRequest: foundation.consumeFocusRequest,
    requestFocus: foundation.requestFocus,
  };
};

const isRightToLeft = (element: Element): boolean => getComputedStyle(element).direction === 'rtl';
