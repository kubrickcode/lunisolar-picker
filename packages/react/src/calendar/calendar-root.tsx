import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { useRef } from 'react';
import { focusInitialElement } from '../focus/focusable-elements';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput } from '../value/hidden-input';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { CalendarViewContext, SingleCalendarContext } from './calendar-context';
import { CalendarLayout } from './calendar-layout';
import { parseSelection } from './parsed-selection';
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isControlled = hookProps.value !== undefined;

  // Goal: 브라우저가 required 검증 실패로 숨은 입력에 포커스를 주면 탭으로 들어가는 칸으로 옮김
  const focusTabbableDay = (): void => {
    if (rootRef.current) focusInitialElement(rootRef.current);
  };

  // Constraint: 비제어만 form reset에서 defaultValue로 돌아가며 알림. 제어는 부모 값이 정하므로 무시함 (계약 §3.3 #1, preflight 3.2)
  const resetToDefault = (): void => {
    if (isControlled) return;
    const defaultValue = parseOptionalDate(hookProps.defaultValue, api.context.calendars).value;
    api.sendSelection({ type: 'value.sync', selected: parseSelection(defaultValue) });
  };

  const rootProps = mergeProps(
    { ...api.getRootProps(), ref: rootRef },
    {
      ...domProps,
      children: (
        <>
          {children ?? <CalendarLayout />}
          <HiddenInput
            name={hookProps.name}
            form={hookProps.form}
            value={api.value ?? ''}
            required={hookProps.required}
            disabled={hookProps.disabled}
            onFocusRequest={focusTabbableDay}
            onFormReset={resetToDefault}
          />
        </>
      ),
    },
  );

  return (
    <CalendarViewContext value={api}>
      <SingleCalendarContext value={api}>{renderElement('div', render, rootProps, api)}</SingleCalendarContext>
    </CalendarViewContext>
  );
};
