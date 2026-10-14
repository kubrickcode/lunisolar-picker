import { type CalendarId, calendarIdOf, type DateString, epochDayOf, gregory } from '@lunisolar-picker/calendar';
import type { DateConstraints } from '@lunisolar-picker/core';
import { useMemo, useState } from 'react';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useControllableState } from '../utilities/use-controllable-state';
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
  const [entryCalendarId, setEntryCalendar] = useControllableState(
    props.entryCalendar,
    props.defaultEntryCalendar ?? (initialValue === null ? gregory.id : calendarIdOf(initialValue)),
    props.onEntryCalendarChange,
  );
  const core = useDateFieldCore({
    settings,
    constraints: props,
    initialEpochDay: initialValue === null ? null : epochDayOf(initialValue),
    entryCalendarId,
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

  // Constraint: 부모가 다른 역법으로 적힌 값을 주면 store가 그 역법으로 바뀜. React 쪽 입력 역법도 같은 배치에서 맞춰야 다음 이펙트가 옛 역법으로 되돌리지 않음 (preflight 3.1)
  // Side effect: 그때 onEntryCalendarChange가 불림. 부모가 entryCalendar를 제어하며 거부하면 필드는 entryCalendar를 따름
  useValueBridge<DateString>({
    committedValue: value,
    controlled,
    isEqual: Object.is,
    syncStore: (next) => {
      core.send({
        type: 'value.sync',
        selected: next === null ? null : { epochDay: epochDayOf(next), calendarId: calendarIdOf(next) },
        entryCalendarId: next === null ? entryCalendarId : calendarIdOf(next),
      });
      if (next !== null) setEntryCalendar(calendarIdOf(next));
    },
    onValueChange: (next) => props.onValueChange?.(next, { validity }),
  });

  const focus = (): void => core.segmentedField.focusSegment(0);

  return {
    ...core,
    value,
    entryCalendarId,
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
