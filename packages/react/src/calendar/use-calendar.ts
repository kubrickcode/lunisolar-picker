import type { CalendarSystem, DateString, EpochDay } from '@lunisolar-picker/calendar';
import {
  createSingleSelectionState,
  type DateConstraints,
  invalidBecause,
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
import { useMemo, useState } from 'react';
import { focusInitialElement } from '../focus/focusable-elements';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { type CalendarViewApi, createCalendarViewApi } from './calendar-view-api';
import { parseSelection, selectionKey } from './parsed-selection';
import { isCalendarProvided, toProvidedCalendar } from './provided-calendar';
import { type CalendarFoundationProps, useCalendarFoundation } from './use-calendar-foundation';
import { useSelectionSync } from './use-selection-sync';

const MISSING_REQUIRED: Validity = invalidBecause(['incomplete']);

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
  // Goal: form reset이 돌아갈 처음 기본값. 입력 칸(DateField)처럼 마운트 때 값으로 고정함
  const [defaultSelected] = useState(() =>
    parseSelection(parseOptionalDate(props.defaultValue, settings.calendars).value),
  );
  // Constraint: 제어 중이면 처음 포커스·표시 역법도 부모 값(null 포함)만 따름. 쓰이지 않는 defaultValue가 화면을 정하지 않게 함
  const [initialSelected] = useState(() =>
    controlled.isControlled ? parseSelection(controlled.value) : defaultSelected,
  );
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

  // Goal: 사용자 조작이 같은 핸들러에서 달력을 닫아(언마운트) 이펙트가 돌지 않아도 확정 값을 알림. 공개 sendSelection으로 바로 보낸 이벤트는 이펙트가 알림 (preflight 1.4, 계약 §3.5 Popover.Close 조립)
  const reportCommitted = (): void => {
    const snapshot = getSnapshot();
    const committedKey = selectionKey(snapshot.committed);
    if (selectionSync.isReported(committedKey)) return;
    selectionSync.markReported(committedKey);
    props.onValueChange?.(singleValue(snapshot, context), {
      validity: committedValidityOf({ committed: snapshot.committed, constraints: context.constraints, isRequired }),
    });
  };

  const commit = (): void => {
    sendSelection({ type: 'commit' });
    reportCommitted();
  };

  // Goal: 비제어만 form reset에서 처음 기본값으로 돌아가며 알림(이펙트가 알림). 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 처음 기본값의 역법을 앱이 calendars에서 뺐으면 그 값을 적을 수 없으므로 비움
  const resetToDefault = (): void => {
    if (controlled.isControlled) return;
    const isDefaultWritable =
      defaultSelected === null || isCalendarProvided(context.calendars, defaultSelected.calendarId);
    sendSelection({ type: 'value.sync', selected: isDefaultWritable ? defaultSelected : null });
  };

  // Goal: 브라우저가 required 검증 실패로 숨은 입력에 포커스를 주면 탭으로 들어가는 칸으로 옮김
  const focusTabbableDay = (): void => {
    const root = foundation.rootRef.current;
    if (root) focusInitialElement(root);
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
      onFocusRequest: focusTabbableDay,
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
