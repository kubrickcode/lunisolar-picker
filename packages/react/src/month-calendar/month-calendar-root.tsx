import type { HTMLAttributes, ReactElement } from 'react';
import { MonthButtonGrid } from '../calendar/month-button-grid';
import { splitProps } from '../calendar/split-props';
import { partAttributes } from '../contract/data-attributes';
import { mergeProps } from '../utilities/merge-props';
import { HiddenInput } from '../value/hidden-input';
import { type MonthCalendarApi, type UseMonthCalendarProps, useMonthCalendar } from './use-month-calendar';

const MONTH_COLUMN_COUNT = 3;

// Constraint: isolatedDeclarations에서 export한 `as const satisfies`는 TS9010이므로 모듈 안에만 둠 (preflight 2.3)
const MONTH_CALENDAR_PROP_NAMES = [
  'calendars',
  'defaultValue',
  'disabled',
  'form',
  'invalid',
  'locale',
  'max',
  'min',
  'name',
  'onBlur',
  'onInvalidValue',
  'onValueChange',
  'readOnly',
  'required',
  'timeZone',
  'today',
  'value',
  'weekStartsOn',
] as const satisfies readonly (keyof UseMonthCalendarProps)[];

// Constraint: 훅 prop을 하나라도 빠뜨리면 DOM으로 새어 나가므로 컴파일 시점에 목록 완전성을 검사함
const isMonthCalendarPropListComplete: [MissingMonthCalendarPropName] extends [never] ? true : false = true;
void isMonthCalendarPropListComplete;

type MissingMonthCalendarPropName = Exclude<keyof UseMonthCalendarProps, (typeof MONTH_CALENDAR_PROP_NAMES)[number]>;

// Constraint: SharedPickerProps.onBlur(() => void)와 DOM onBlur(FocusEventHandler)가 겹치므로 interface 확장이 아니라 Omit으로 합침 (preflight 2.9)
export type MonthCalendarRootProps = UseMonthCalendarProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof UseMonthCalendarProps | 'children'>;

type YearButtonProps = {
  readonly api: MonthCalendarApi;
  readonly direction: YearDirection;
};

type YearDirection = -1 | 1;

export const MonthCalendarRoot = (props: MonthCalendarRootProps): ReactElement => {
  const [hookProps, domProps] = splitProps(props, MONTH_CALENDAR_PROP_NAMES);
  const api = useMonthCalendar(hookProps);
  const rootProps = mergeProps(api.getRootProps(), {
    ...domProps,
    children: (
      <>
        <div {...partAttributes('month-calendar-header')}>
          <YearButton api={api} direction={-1} />
          <span aria-live="polite" {...partAttributes('calendar-heading')}>
            {api.year}
          </span>
          <YearButton api={api} direction={1} />
        </div>
        <MonthButtonGrid
          items={api.items}
          columnCount={MONTH_COLUMN_COUNT}
          label={api.locale.labels.chooseMonth}
          part="calendar-month-grid"
          defaultFocusKey={api.todayMonthKey}
          isDisabled={api.isDisabled}
          isReadOnly={api.isReadOnly}
        />
        <HiddenInput {...api.getHiddenInputProps()} />
      </>
    ),
  });
  return <div {...rootProps} />;
};

// Constraint: 지원 범위(1~9999년) 끝이나 비활성 월 달력에서는 aria-disabled로 둠(포커스는 받음). 읽기 전용은 둘러볼 수 있음
const YearButton = ({ api, direction }: YearButtonProps): ReactElement => {
  const targetYear = api.year + direction;
  const isPossible = api.canShowYear(targetYear);
  const { labels } = api.locale;
  return (
    <button
      type="button"
      aria-label={direction < 0 ? labels.previousYear : labels.nextYear}
      {...(isPossible ? {} : { 'aria-disabled': true })}
      {...partAttributes('calendar-nav-button', { disabled: !isPossible })}
      onClick={() => api.showYear(targetYear)}
    >
      <span aria-hidden="true">{direction < 0 ? '‹' : '›'}</span>
    </button>
  );
};
