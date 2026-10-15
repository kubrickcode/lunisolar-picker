import {
  brandEpochDay,
  type CalendarId,
  type CalendarSystem,
  isWithinSupportedRange,
} from '@lunisolar-picker/calendar';
import {
  boundsFor,
  type CalendarBounds,
  daysInVisibleMonth,
  fieldsOf,
  listMonthsOfYear,
  listYearPage,
  type NavigationEvent,
  type VisibleMonth,
  YEAR_PAGE_SIZE,
} from '@lunisolar-picker/core';
import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactElement, useId } from 'react';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { useCalendarView } from './calendar-context';
import type { CalendarViewApi } from './calendar-view-api';
import { type ButtonGridItem, MonthButtonGrid } from './month-button-grid';

const MONTH_COLUMN_COUNT = 3;
const YEAR_COLUMN_COUNT = 4;

type CalendarToggleButtonProps = {
  readonly api: CalendarViewApi;
  readonly calendarId: CalendarId;
};

export interface CalendarToggleProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, CalendarViewApi> | undefined;
}

export interface CalendarViewButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, CalendarViewApi> | undefined;
}

type MonthPickableInput = {
  readonly bounds: CalendarBounds;
  readonly calendar: CalendarSystem;
  readonly month: VisibleMonth;
};

export const CalendarMonthGrid = (): ReactElement | null => {
  const api = useCalendarView();
  const { calendar, context, navigation } = api;
  if (navigation.view !== 'months') return null;
  const bounds = boundsFor(calendar, context.constraints);
  const items = listMonthsOfYear(calendar, navigation.visibleMonth.year).map((month): ButtonGridItem => {
    const name = context.locale.formatMonthName(month, calendar.id);
    return {
      key: month.monthCode,
      label: name,
      accessibleName: name,
      isSelected: month.monthCode === navigation.visibleMonth.monthCode,
      isDisabled: !isMonthPickable({ bounds, calendar, month }),
      onPick: () => pickWithFocus(api, { type: 'month.pick', month }),
    };
  });
  return (
    <MonthButtonGrid
      items={items}
      columnCount={MONTH_COLUMN_COUNT}
      label={context.locale.labels.chooseMonth}
      part="calendar-month-grid"
      isDisabled={api.isDisabled}
      consumeFocusRequest={api.consumeFocusRequest}
    />
  );
};

export const CalendarToggle = ({ render, ...domProps }: CalendarToggleProps): ReactElement | null => {
  const api = useCalendarView();
  const calendarIds = api.context.calendars.map((calendar) => calendar.id);
  if (calendarIds.length < 2) return null;
  // Constraint: Biome의 role 규칙은 JSX에 직접 쓴 role만 보므로 속성 객체로 펼침 (preflight 2.7)
  const groupProps = mergeProps(
    {
      role: 'group',
      ...partAttributes('calendar-toggle', { disabled: api.isDisabled }),
      children: calendarIds.map((calendarId) => (
        <CalendarToggleButton key={calendarId} api={api} calendarId={calendarId} />
      )),
    },
    domProps,
  );
  return renderElement('div', render, groupProps, api);
};

export const CalendarViewButton = ({ render, ...domProps }: CalendarViewButtonProps): ReactElement => {
  const api = useCalendarView();
  const idPrefix = useId();
  const textId = `${idPrefix}-text`;
  const actionId = `${idPrefix}-action`;
  const { labels } = api.context.locale;
  const { view } = api.navigation;
  // Constraint: 연 보기는 더 내려갈 단계가 없으므로 누를 수 없음. 포커스는 받아 지금 단계를 읽을 수 있게 aria-disabled만 씀
  const isAvailable = !api.isDisabled && view !== 'years';
  const buttonProps = {
    ...mergeProps(
      {
        type: 'button' as const,
        ...(isAvailable ? {} : { 'aria-disabled': true }),
        ...partAttributes('calendar-view-button', { view, disabled: !isAvailable }),
        onClick: () => {
          if (isAvailable) api.sendNavigation({ type: 'view.set', view: view === 'days' ? 'months' : 'years' });
        },
      },
      domProps,
    ),
    // Goal: 보이는 글로 시작하는 이름이라 음성 입력 사용자가 보이는 글자로 누를 수 있음 (WCAG 2.5.3). 구분자를 직접 붙이지 않도록 이름 조합은 브라우저에 맡김
    // Constraint: 이름은 아래 두 span으로 정해지므로 앱이 aria-labelledby·내용을 바꾸지 못함 (Cell 예약 속성과 같은 방식)
    'aria-labelledby': `${textId} ${actionId}`,
    children: (
      <>
        <span id={textId} aria-live="polite">
          {viewButtonText(api)}
        </span>
        {/* Goal: 연 보기에서는 "월 선택" 대신 지금 고르는 단위를 알림 (preflight 4.11) */}
        <span id={actionId} hidden>
          {view === 'years' ? labels.year : labels.chooseMonth}
        </span>
      </>
    ),
  };
  return renderElement('button', render, buttonProps, api);
};

export const CalendarYearGrid = (): ReactElement | null => {
  const api = useCalendarView();
  const { calendar, context, navigation } = api;
  if (navigation.view !== 'years') return null;
  const bounds = boundsFor(calendar, context.constraints);
  const firstYear = fieldsOf(calendar, bounds.min).year;
  const lastYear = fieldsOf(calendar, bounds.max).year;
  const items = listYearPage(calendar, navigation.yearPageStart, YEAR_PAGE_SIZE).map(
    (year): ButtonGridItem => ({
      key: String(year),
      label: String(year),
      accessibleName: String(year),
      isSelected: year === navigation.visibleMonth.year,
      isDisabled: year < firstYear || year > lastYear,
      onPick: () => pickWithFocus(api, { type: 'year.pick', year }),
    }),
  );
  return (
    <MonthButtonGrid
      items={items}
      columnCount={YEAR_COLUMN_COUNT}
      label={context.locale.labels.year}
      part="calendar-year-grid"
      isDisabled={api.isDisabled}
      consumeFocusRequest={api.consumeFocusRequest}
    />
  );
};

const CalendarToggleButton = ({ api, calendarId }: CalendarToggleButtonProps): ReactElement => {
  const isPressed = api.navigation.displayCalendarId === calendarId;
  return (
    <button
      type="button"
      aria-pressed={isPressed}
      {...(api.isDisabled ? { 'aria-disabled': true } : {})}
      // Goal: theme은 aria가 아니라 data-selected로 고름 (preflight 1.3)
      {...stateAttributes({ selected: isPressed, disabled: api.isDisabled })}
      onClick={() => {
        if (!api.isDisabled) api.selectDisplayCalendar(calendarId);
      }}
    >
      {api.context.locale.calendarNames[calendarId]}
    </button>
  );
};

// Constraint: 지원 범위 밖에서 시작하는 달은 고르면 core가 다른 날로 옮기므로 막음. min·max를 하루도 겹치지 않는 달도 막음
const isMonthPickable = ({ bounds, calendar, month }: MonthPickableInput): boolean => {
  const firstDay = calendar.toEpochDay({ ...month, day: 1 });
  if (!firstDay.isOk || !isWithinSupportedRange(calendar, firstDay.value)) return false;
  const lastDay = brandEpochDay(firstDay.value + daysInVisibleMonth(calendar, month) - 1);
  return firstDay.value <= bounds.max && lastDay >= bounds.min;
};

// Goal: 고른 버튼이 사라져도 키보드 포커스가 다음 보기(월 격자 또는 날짜)로 이어지게 함
const pickWithFocus = (api: CalendarViewApi, event: NavigationEvent): void => {
  api.requestFocus();
  api.sendNavigation(event);
};

const viewButtonText = ({ calendar, context, navigation }: CalendarViewApi): string => {
  if (navigation.view === 'days') return context.locale.formatHeading(navigation.visibleMonth, calendar.id);
  if (navigation.view === 'months') return String(navigation.visibleMonth.year);
  const years = listYearPage(calendar, navigation.yearPageStart, YEAR_PAGE_SIZE);
  const firstYear = years[0] ?? navigation.yearPageStart;
  const lastYear = years.at(-1) ?? firstYear;
  return `${firstYear}${context.locale.rangeSeparator}${lastYear}`;
};
