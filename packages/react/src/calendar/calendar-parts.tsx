import { type MonthGridCell, shiftVisibleMonth, toWeekday, type Weekday } from '@lunisolar-picker/core';
import {
  type ButtonHTMLAttributes,
  Fragment,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TableHTMLAttributes,
} from 'react';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import { AUTOFOCUS_ATTRIBUTE } from '../focus/focusable-elements';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { useCalendarView } from './calendar-context';
import type { CalendarViewApi, CellProps } from './calendar-view-api';
import type { CellRenderInfo } from './cell-state';

const DAYS_PER_WEEK = 7;

export interface CalendarCellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly cell: MonthGridCell;
  readonly children?: ReactNode | ((info: CellRenderInfo) => ReactNode);
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, CellRenderInfo> | undefined;
}

export interface CalendarGridProps extends Omit<TableHTMLAttributes<HTMLTableElement>, 'children'> {
  readonly children?: ((cell: MonthGridCell) => ReactNode) | undefined;
  readonly monthIndex?: number | undefined;
  readonly render?: RenderProp<TableHTMLAttributes<HTMLTableElement>, CalendarViewApi> | undefined;
}

export interface CalendarHeadCellProps extends HTMLAttributes<HTMLTableCellElement> {
  readonly weekday: Weekday;
}

export interface CalendarHeaderProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, CalendarViewApi> | undefined;
}

export interface CalendarHeadingProps extends HTMLAttributes<HTMLSpanElement> {
  readonly monthIndex?: number | undefined;
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, CalendarViewApi> | undefined;
}

export interface CalendarNavButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, CalendarViewApi> | undefined;
}

type NavigationDirection = -1 | 1;

export const CalendarCell = ({ cell, children, render, ...buttonProps }: CalendarCellProps): ReactElement => {
  const api = useCalendarView();
  const state = api.getCellState(cell);
  const info: CellRenderInfo = { ...cell, ...state };
  const { gridCell, button } = api.getCellProps(cell);
  const content = typeof children === 'function' ? children(info) : (children ?? <DefaultCellContent info={info} />);
  // Constraint: 키로 옮긴 칸만 포커스함. 다시 그려질 때마다 불리므로 요청이 있을 때 한 번만 소비함
  const focusOnRequest = (element: HTMLButtonElement | null): void => {
    if (element && state.isFocused && api.consumeFocusRequest()) element.focus();
  };
  // Goal: 앱 핸들러가 먼저 돌고 preventDefault 하면 칸의 선택을 건너뜀 (M3 mergeProps 규칙, preflight 2.18)
  const props = {
    ...mergeProps({ ...button, ref: focusOnRequest }, { ...buttonProps, children: content }),
    ...reservedCellProps(button),
  };
  return <td {...gridCell}>{renderElement('button', render, props, info)}</td>;
};

export const CalendarGrid = ({
  children,
  monthIndex = 0,
  render,
  ...domProps
}: CalendarGridProps): ReactElement | null => {
  const api = useCalendarView();
  const month = api.months[monthIndex];
  if (api.navigation.view !== 'days' || !month) return null;
  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, offset) =>
    toWeekday((api.context.weekStartsOn + offset) % DAYS_PER_WEEK),
  );
  const gridProps = mergeProps(
    {
      ...api.getGridProps(monthIndex),
      ...partAttributes('calendar-grid'),
      children: (
        <>
          <thead>
            <tr>
              {weekdays.map((weekday) => (
                <CalendarHeadCell key={weekday} weekday={weekday} />
              ))}
            </tr>
          </thead>
          {/* Constraint: 달이 바뀔 때마다 tbody를 다시 마운트해야 CSS 슬라이드 애니메이션이 다시 시작됨 */}
          <tbody
            key={`${month.month.year}-${month.month.monthCode}`}
            {...stateAttributes({ slide: api.slideDirection ?? undefined })}
          >
            {month.weeks.map((week) => (
              <tr key={week[0]?.epochDay}>
                {week.map((cell) =>
                  children ? (
                    <Fragment key={cell.epochDay}>{children(cell)}</Fragment>
                  ) : (
                    <CalendarCell key={cell.epochDay} cell={cell} />
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </>
      ),
    },
    domProps,
  );
  return renderElement('table', render, gridProps, api);
};

export const CalendarHeadCell = ({ weekday, ...domProps }: CalendarHeadCellProps): ReactElement => {
  const { weekdays } = useCalendarView().context.locale;
  const headCellProps = mergeProps(
    {
      scope: 'col',
      abbr: weekdays.long[weekday],
      ...partAttributes('calendar-head-cell', { weekday }),
      children: weekdays.narrow[weekday],
    },
    domProps,
  );
  return <th {...headCellProps} />;
};

export const CalendarHeader = ({ render, ...domProps }: CalendarHeaderProps): ReactElement => {
  const api = useCalendarView();
  return renderElement('div', render, mergeProps(partAttributes('calendar-header'), domProps), api);
};

export const CalendarHeading = ({ monthIndex = 0, render, ...domProps }: CalendarHeadingProps): ReactElement => {
  const api = useCalendarView();
  const month = api.months[monthIndex];
  const text = month ? api.context.locale.formatHeading(month.month, api.calendar.id) : '';
  // Constraint: 격자의 aria-labelledby가 이 id를 가리키므로 앱 id가 덮지 못함
  const headingProps = {
    ...mergeProps({ 'aria-live': 'polite' as const, ...partAttributes('calendar-heading'), children: text }, domProps),
    id: api.headingId(monthIndex),
  };
  return renderElement('span', render, headingProps, api);
};

export const CalendarNextButton = (props: CalendarNavButtonProps): ReactElement => (
  <CalendarNavButton {...props} direction={1} />
);

export const CalendarPrevButton = (props: CalendarNavButtonProps): ReactElement => (
  <CalendarNavButton {...props} direction={-1} />
);

export const CalendarTodayButton = ({ children, render, ...domProps }: CalendarNavButtonProps): ReactElement => {
  const api = useCalendarView();
  const isAvailable = !api.isDisabled && !api.isTodayVisible;
  const buttonProps = mergeProps(
    {
      type: 'button' as const,
      ...(isAvailable ? {} : { 'aria-disabled': true }),
      ...partAttributes('calendar-today-button', { disabled: !isAvailable }),
      onClick: () => {
        if (isAvailable) api.sendNavigation({ type: 'today.go' });
      },
    },
    { ...domProps, children: children ?? api.context.locale.labels.today },
  );
  return renderElement('button', render, buttonProps, api);
};

const CalendarNavButton = ({
  children,
  direction,
  render,
  ...domProps
}: CalendarNavButtonProps & { readonly direction: NavigationDirection }): ReactElement => {
  const api = useCalendarView();
  // Constraint: 비활성 달력은 둘러보기도 막음. 읽기 전용은 둘러볼 수 있음
  const isPossible = !api.isDisabled && canNavigate(api, direction);
  const buttonProps = mergeProps(
    {
      type: 'button' as const,
      'aria-label': navigationLabel(api, direction),
      ...(isPossible ? {} : { 'aria-disabled': true }),
      ...partAttributes('calendar-nav-button', { disabled: !isPossible }),
      onClick: () => {
        if (isPossible) navigateBy(api, direction);
      },
    },
    { ...domProps, children: children ?? <span aria-hidden="true">{direction < 0 ? '‹' : '›'}</span> },
  );
  return renderElement('button', render, buttonProps, api);
};

const DefaultCellContent = ({ info }: { readonly info: CellRenderInfo }): ReactElement => {
  const { locale } = useCalendarView().context;
  return (
    <>
      <span>{info.day}</span>
      {info.secondary ? (
        <span aria-hidden="true" {...partAttributes('calendar-cell-secondary')}>
          {locale.formatSecondaryLabel(info.secondary)}
        </span>
      ) : null}
    </>
  );
};

// Constraint: 지원 범위 끝에서는 더 갈 곳이 없으므로 버튼을 aria-disabled로 둠(포커스는 받음)
const canNavigate = (api: CalendarViewApi, direction: NavigationDirection): boolean => {
  const { calendar, navigation } = api;
  if (navigation.view === 'days') {
    const shifted = shiftVisibleMonth(calendar, navigation.visibleMonth, direction);
    return shifted.year !== navigation.visibleMonth.year || shifted.monthCode !== navigation.visibleMonth.monthCode;
  }
  const first = calendar.fromEpochDay(calendar.supportedRange.min);
  const last = calendar.fromEpochDay(calendar.supportedRange.max);
  if (!first.isOk || !last.isOk) return false;
  const pivot = navigation.view === 'months' ? navigation.visibleMonth.year : navigation.yearPageStart;
  return direction < 0 ? pivot > first.value.year : pivot < last.value.year;
};

const navigateBy = (api: CalendarViewApi, direction: NavigationDirection): void => {
  const { navigation } = api;
  if (navigation.view === 'days') {
    api.sendNavigation({ type: 'month.shift', amount: direction });
    return;
  }
  if (navigation.view === 'months') {
    api.sendNavigation({ type: 'year.pick', year: navigation.visibleMonth.year + direction });
    return;
  }
  api.sendNavigation({ type: 'yearPage.shift', amount: direction });
};

// Constraint: roving tabindex·열릴 때 포커스·비활성 의미는 격자 전체 규칙이라 앱 prop이 덮지 못함
const reservedCellProps = (button: CellProps['button']) => ({
  tabIndex: button.tabIndex,
  'aria-disabled': button['aria-disabled'],
  [AUTOFOCUS_ATTRIBUTE]: button[AUTOFOCUS_ATTRIBUTE],
});

const navigationLabel = (api: CalendarViewApi, direction: NavigationDirection): string => {
  const { labels } = api.context.locale;
  if (api.navigation.view === 'years') return direction < 0 ? labels.previousYears : labels.nextYears;
  return direction < 0 ? labels.previousMonth : labels.nextMonth;
};
