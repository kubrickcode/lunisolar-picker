import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { CalendarViewContext } from '../calendar/calendar-context';
import { CalendarLayout } from '../calendar/calendar-layout';
import { splitProps } from '../calendar/split-props';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput } from '../value/hidden-input';
import { LiveRegion } from './live-region';
import { RangeCalendarContext } from './range-calendar-context';
import { type RangeCalendarApi, type UseRangeCalendarProps, useRangeCalendar } from './use-range-calendar';

// Constraint: isolatedDeclarations에서 export한 `as const satisfies`는 TS9010이므로 모듈 안에만 둠 (preflight 2.3)
const RANGE_CALENDAR_PROP_NAMES = [
  'calendars',
  'commitMode',
  'defaultDisplayCalendar',
  'defaultValue',
  'disabled',
  'displayCalendar',
  'endName',
  'form',
  'getCellLabel',
  'invalid',
  'isDateDisabled',
  'isOpenEndAllowed',
  'limitMode',
  'locale',
  'max',
  'maxDays',
  'min',
  'minDays',
  'numberOfMonths',
  'onBlur',
  'onDisplayCalendarChange',
  'onInvalidValue',
  'onValueChange',
  'readOnly',
  'required',
  'startName',
  'timeZone',
  'today',
  'value',
  'weekStartsOn',
] as const satisfies readonly (keyof UseRangeCalendarProps)[];

// Constraint: 훅 prop을 하나라도 빠뜨리면 DOM으로 새어 나가므로 컴파일 시점에 목록 완전성을 검사함
const isRangePropListComplete: [MissingRangePropName] extends [never] ? true : false = true;
void isRangePropListComplete;

type MissingRangePropName = Exclude<keyof UseRangeCalendarProps, (typeof RANGE_CALENDAR_PROP_NAMES)[number]>;

export type RangeCalendarRootProps = UseRangeCalendarProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof UseRangeCalendarProps | 'children'> & {
    readonly children?: ReactNode;
    readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, RangeCalendarApi> | undefined;
  };

export const RangeCalendarRoot = (props: RangeCalendarRootProps): ReactElement => {
  const [hookProps, { children, render, ...domProps }] = splitProps(props, RANGE_CALENDAR_PROP_NAMES);
  const api = useRangeCalendar(hookProps);
  const rootProps = mergeProps(api.getRootProps(), {
    ...domProps,
    children: (
      <>
        {children ?? <CalendarLayout />}
        <LiveRegion message={api.announcement} />
        <HiddenInput {...api.getHiddenInputProps('start')} />
        <HiddenInput {...api.getHiddenInputProps('end')} />
      </>
    ),
  });

  return (
    <CalendarViewContext value={api}>
      <RangeCalendarContext value={api}>{renderElement('div', render, rootProps, api)}</RangeCalendarContext>
    </CalendarViewContext>
  );
};
