import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput } from '../value/hidden-input';
import { CalendarViewContext, SingleCalendarContext } from './calendar-context';
import { CalendarLayout } from './calendar-layout';
import { splitProps } from './split-props';
import { type CalendarApi, type UseCalendarProps, useCalendar } from './use-calendar';

// Constraint: isolatedDeclarations에서 export한 `as const satisfies`는 TS9010이므로 모듈 안에만 둠 (preflight 2.3)
const CALENDAR_PROP_NAMES = [
  'calendars',
  'commitMode',
  'defaultDisplayCalendar',
  'defaultValue',
  'disabled',
  'displayCalendar',
  'form',
  'getCellLabel',
  'invalid',
  'isDateDisabled',
  'locale',
  'max',
  'min',
  'name',
  'numberOfMonths',
  'onBlur',
  'onDisplayCalendarChange',
  'onInvalidValue',
  'onPick',
  'onValueChange',
  'readOnly',
  'required',
  'timeZone',
  'today',
  'value',
  'weekStartsOn',
] as const satisfies readonly (keyof UseCalendarProps)[];

// Constraint: 훅 prop을 하나라도 빠뜨리면 DOM으로 새어 나가므로 컴파일 시점에 목록 완전성을 검사함
const isCalendarPropListComplete: [MissingCalendarPropName] extends [never] ? true : false = true;
void isCalendarPropListComplete;

export type CalendarRootProps = UseCalendarProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof UseCalendarProps | 'children'> & {
    readonly children?: ReactNode;
    readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, CalendarApi> | undefined;
  };

type MissingCalendarPropName = Exclude<keyof UseCalendarProps, (typeof CALENDAR_PROP_NAMES)[number]>;

export const CalendarRoot = (props: CalendarRootProps): ReactElement => {
  const [hookProps, { children, render, ...domProps }] = splitProps(props, CALENDAR_PROP_NAMES);
  const api = useCalendar(hookProps);
  const rootProps = mergeProps(api.getRootProps(), {
    ...domProps,
    children: (
      <>
        {children ?? <CalendarLayout />}
        <HiddenInput {...api.getHiddenInputProps()} />
      </>
    ),
  });

  return (
    <CalendarViewContext value={api}>
      <SingleCalendarContext value={api}>{renderElement('div', render, rootProps, api)}</SingleCalendarContext>
    </CalendarViewContext>
  );
};
