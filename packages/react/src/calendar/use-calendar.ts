import type { CalendarSystem, DateString, EpochDay } from '@lunisolar-picker/calendar';
import {
  createSingleSelectionState,
  type DateConstraints,
  formatSelectedDay,
  type ResolvedConstraints,
  type SelectedDay,
  type SingleSelectionEvent,
  type SingleSelectionState,
  singleSelectionReducer,
  singleValue,
  VALID,
  type Validity,
  validateEpochDay,
} from '@lunisolar-picker/core';
import { useMemo } from 'react';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { type CalendarViewApi, createCalendarViewApi } from './calendar-view-api';
import { parseSelection, selectionKey } from './parsed-selection';
import { toProvidedCalendar } from './provided-calendar';
import {
  createCommittedReporter,
  focusTabbableDay,
  MISSING_REQUIRED,
  restorableDefault,
  useMountSelections,
} from './selection-binding';
import { type CalendarFoundationProps, useCalendarFoundation } from './use-calendar-foundation';
import { useSelectionSync } from './use-selection-sync';

export interface CalendarApi extends CalendarViewApi {
  readonly selection: SingleSelectionState;
  readonly value: DateString | null;
  readonly validity: Validity;
  sendSelection(event: SingleSelectionEvent): void;
  commit(): void;
  cancel(): void;
  getHiddenInputProps(): HiddenInputProps;
}

type CommittedValidityInput = {
  readonly committed: SelectedDay | null;
  readonly constraints: ResolvedConstraints;
  readonly isRequired: boolean;
};

export interface UseCalendarProps extends CalendarFoundationProps, DateConstraints {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: DateString | null, details: ValueChangeDetails) => void) | undefined;
  // Goal: 받아들인 사용자 고르기마다(이미 고른 날을 다시 골라도, 확인 모드의 임시 선택도) 알림. 완성형 picker가 닫을 때를 정함. onValueChange는 값이 바뀔 때만
  readonly onPick?: ((value: DateString) => void) | undefined;
}

export const useCalendar = (props: UseCalendarProps): CalendarApi => {
  const settings = usePickerSettings(props);
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalDate(input, settings.calendars),
    String,
    props.onInvalidValue,
    settings.calendarKey,
  );
  const { defaultSelected, initialSelected } = useMountSelections({
    controlled,
    readDefault: () => parseOptionalDate(props.defaultValue, settings.calendars).value,
    toSelected: parseSelection,
  });
  const foundation = useCalendarFoundation({ props, settings, constraints: props, initialSelected });
  const { context } = foundation;
  // Constraint: 앱이 값의 역법을 calendars에서 빼면 값 문자열을 만들 때 던지므로, 역법 구성이 바뀌면 store를 다시 만들어 같은 날을 양력으로 옮겨 적음. 제어 값은 useParsedValue가 해석 실패로 알리고 아래 동기화가 비움 (preflight 3.5)
  const {
    getSnapshot,
    send: sendSelection,
    state: selection,
  } = useStoreInstance(
    (previous: SingleSelectionState | undefined) =>
      previous === undefined
        ? createSingleSelectionState(initialSelected)
        : moveSelectionOffRemovedCalendar(previous, context.calendars),
    singleSelectionReducer,
    context,
    { resetKey: settings.calendarKey },
  );
  const value = singleValue(selection, context);
  const isRequired = props.required === true;
  const validity = useMemo(
    () => committedValidityOf({ committed: selection.committed, constraints: context.constraints, isRequired }),
    [selection.committed, context.constraints, isRequired],
  );
  const controlledSelected = useMemo(() => parseSelection(controlled.value), [controlled.value]);

  const selectionSync = useSelectionSync({
    committedKey: selectionKey(selection.committed),
    controlledKey: controlled.isControlled ? selectionKey(controlledSelected) : undefined,
    resetKey: settings.calendarKey,
    syncToControlled: () => sendSelection({ type: 'value.sync', selected: controlledSelected }),
    emitChange: () => props.onValueChange?.(value, { validity }),
  });

  const reportCommitted = createCommittedReporter({
    getSnapshot,
    keyOf: (snapshot) => selectionKey(snapshot.committed),
    report: (snapshot) =>
      props.onValueChange?.(singleValue(snapshot, context), {
        validity: committedValidityOf({ committed: snapshot.committed, constraints: context.constraints, isRequired }),
      }),
    selectionSync,
  });

  // Constraint: store가 고르지 못하는 날(입력 역법 밖 등)은 임시 선택이 그 날이 되지 않으므로 알리지 않음
  const reportPick = (epochDay: EpochDay): void => {
    const picked = getSnapshot().draft;
    if (picked?.epochDay !== epochDay) return;
    const value = formatSelectedDay(picked, context);
    if (value !== null) props.onPick?.(value);
  };

  const commit = (): void => {
    sendSelection({ type: 'commit' });
    reportCommitted();
  };

  // Goal: 비제어만 form reset에서 처음 기본값으로 돌아가며 알림(이펙트가 알림). 제어 값은 부모가 정함 (계약 §3.3 #1)
  const resetToDefault = (): void => {
    if (controlled.isControlled) return;
    sendSelection({ type: 'value.sync', selected: restorableDefault(defaultSelected, context.calendars) });
  };

  const viewApi = createCalendarViewApi({
    foundation,
    behavior: {
      mode: 'single',
      selectionFlags: (cell) => ({
        isSelected: selection.draft?.epochDay === cell.epochDay,
        isInRange: false,
        isRangeStart: false,
        isRangeEnd: false,
        isPreview: false,
        isBlocked: false,
      }),
      selectEpochDay: (epochDay: EpochDay) => {
        if (!validateEpochDay(epochDay, context.constraints).isValid) return;
        sendSelection({ type: 'date.select', epochDay, calendarId: foundation.navigation.displayCalendarId });
        reportCommitted();
        reportPick(epochDay);
      },
    },
    interaction: {
      getCellLabel: props.getCellLabel,
      isDisabled: props.disabled === true,
      isInvalid: isVisiblyInvalid({ invalid: props.invalid === true, reasons: validity.reasons }),
      isReadOnly: props.readOnly === true,
      onBlur: props.onBlur,
    },
  });

  return {
    ...viewApi,
    selection,
    value,
    validity,
    sendSelection,
    commit,
    cancel: () => sendSelection({ type: 'cancel' }),
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: value ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: () => focusTabbableDay(foundation.rootRef),
      onFormReset: resetToDefault,
    }),
  };
};

// Goal: 확정 값의 유효성. 확인 모드의 임시 선택은 확정 전이라 반영하지 않음 (계약 §2.6 (b))
const committedValidityOf = ({ committed, constraints, isRequired }: CommittedValidityInput): Validity => {
  if (committed === null) return isRequired ? MISSING_REQUIRED : VALID;
  return validateEpochDay(committed.epochDay, constraints);
};

const moveSelectionOffRemovedCalendar = (
  previous: SingleSelectionState,
  calendars: readonly CalendarSystem[],
): SingleSelectionState => {
  const committed = toProvidedCalendar(previous.committed, calendars);
  const draft = toProvidedCalendar(previous.draft, calendars);
  return committed === previous.committed && draft === previous.draft ? previous : { committed, draft };
};
