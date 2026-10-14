import { type CalendarId, calendarIdOf, type DateString, epochDayOf, gregory } from '@lunisolar-picker/calendar';
import type { DateConstraints } from '@lunisolar-picker/core';
import { useMemo, useState } from 'react';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';
import { type DateFieldCore, useDateFieldCore } from './use-date-field-core';

const CALENDAR_KEY_SEPARATOR = ',';

export interface DateFieldApi extends DateFieldCore {
  readonly value: DateString | null;
  readonly entryCalendarId: CalendarId;
  setEntryCalendar(calendarId: CalendarId): void;
  focus(): void;
  getHiddenInputProps(): HiddenInputProps;
}

export interface UseDateFieldProps extends SharedPickerProps, DateConstraints {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: DateString | null, details: ValueChangeDetails) => void) | undefined;
  readonly entryCalendar?: CalendarId | undefined;
  readonly defaultEntryCalendar?: CalendarId | undefined;
  readonly onEntryCalendarChange?: ((calendarId: CalendarId) => void) | undefined;
  readonly separator?: string | undefined;
}

export const useDateField = (props: UseDateFieldProps): DateFieldApi => {
  const settings = usePickerSettings(props);
  const calendarKey = settings.calendars.map((calendar) => calendar.id).join(CALENDAR_KEY_SEPARATOR);
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalDate(input, settings.calendars),
    String,
    props.onInvalidValue,
    calendarKey,
  );
  const [initialValue] = useState(
    () => controlled.value ?? parseOptionalDate(props.defaultValue, settings.calendars).value,
  );
  const core = useDateFieldCore({
    settings,
    constraints: props,
    initialSelected:
      initialValue === null ? null : { epochDay: epochDayOf(initialValue), calendarId: calendarIdOf(initialValue) },
    initialEntryCalendarId: props.entryCalendar ?? props.defaultEntryCalendar ?? gregory.id,
    requestedEntryCalendarId: props.entryCalendar,
    separator: props.separator,
    isDisabled: props.disabled === true,
    isReadOnly: props.readOnly === true,
    isRequired: props.required === true,
    isInvalidFromApp: props.invalid === true,
    onFocusLeave: props.onBlur,
  });
  const value = useMemo(
    () => formatOrNull(core.result.epochDay, core.entryCalendar),
    [core.result.epochDay, core.entryCalendar],
  );
  const { validity } = core.result;

  // Constraint: 부모가 다른 역법으로 적힌 값을 주면 store의 입력 역법도 그 역법이 됨(값의 역법 우선). 부모가 한 일이라 onEntryCalendarChange는 부르지 않음
  useValueBridge<DateString>({
    committedValue: value,
    controlled,
    isEqual: Object.is,
    syncStore: (next) => {
      core.send({
        type: 'value.sync',
        selected: next === null ? null : { epochDay: epochDayOf(next), calendarId: calendarIdOf(next) },
        entryCalendarId: next === null ? core.state.entryCalendarId : calendarIdOf(next),
      });
    },
    onValueChange: (next) => props.onValueChange?.(next, { validity }),
  });

  const focus = (): void => core.segmentedField.focusSegment(0);
  // Constraint: 입력 칸은 부모가 거부해도 되돌리지 않음(useValueBridge와 같은 정책). 사용자가 바꾼 역법은 바로 반영하고 알림. 제어 prop은 다음에 바뀔 때 다시 밀어 넣음
  const setEntryCalendar = (calendarId: CalendarId): void => {
    if (calendarId === core.state.entryCalendarId) return;
    core.send({ type: 'calendar.set', calendarId });
    props.onEntryCalendarChange?.(calendarId);
  };

  return {
    ...core,
    value,
    entryCalendarId: core.state.entryCalendarId,
    setEntryCalendar,
    focus,
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: value ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: focus,
    }),
  };
};
