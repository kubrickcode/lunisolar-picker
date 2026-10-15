import { type CalendarSystem, type DateRangeValue, type EpochDay, gregory } from '@lunisolar-picker/calendar';
import {
  createRangeSelectionState,
  type RangeConstraints,
  type RangeSelectionEvent,
  type RangeSelectionState,
  type ResolvedConstraints,
  rangeSelectionReducer,
  rangeValidity,
  rangeValue,
  type SelectedDay,
  type SelectedRange,
  VALID,
  type Validity,
  validateEpochDay,
  validateEpochRange,
} from '@lunisolar-picker/core';
import { type RefObject, useMemo, useState } from 'react';
import { type CalendarViewApi, createCalendarViewApi } from '../calendar/calendar-view-api';
import { parseRangeSelection, rangeSelectionKey } from '../calendar/parsed-selection';
import { isCalendarProvided, providedCalendarOf, toProvidedCalendar } from '../calendar/provided-calendar';
import {
  createCommittedReporter,
  focusTabbableDay,
  MISSING_REQUIRED,
  restorableDefault,
  useMountSelections,
} from '../calendar/selection-binding';
import { type CalendarFoundationProps, useCalendarFoundation } from '../calendar/use-calendar-foundation';
import { useSelectionSync } from '../calendar/use-selection-sync';
import type { RangeSide } from '../date-range-field/use-date-range-field';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { type DateRangeInput, describeRangeInput, parseOptionalRange } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { describeRangeAnnouncement } from './range-announcement';
import { rangeCellFlags } from './range-cell-flags';
import { useRangePointer } from './use-range-pointer';

type CommittedValidityInput = {
  readonly committed: SelectedRange | null;
  readonly constraints: ResolvedConstraints;
  readonly isRequired: boolean;
};

export interface RangeCalendarApi extends CalendarViewApi {
  readonly selection: RangeSelectionState;
  readonly value: DateRangeValue | null;
  // Goal: 확인 모드에서 확정 전 고른 범위. 확인 버튼·프리셋 표시에 씀
  readonly draftValue: DateRangeValue | null;
  // Goal: 보이는(임시·미리보기 포함) 범위의 유효성. 확인 버튼과 live region이 씀. 테두리 무효 표시는 확정 값 기준 isInvalid (preflight 3.6)
  readonly validity: Validity;
  readonly announcement: string;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  sendSelection(event: RangeSelectionEvent): void;
  setRange(range: DateRangeInput | null): void;
  commit(): void;
  cancel(): void;
  getHiddenInputProps(side: RangeSide): HiddenInputProps;
}

// Constraint: 범위는 startName·endName으로만 폼에 참여하므로 단일 name은 받지 않음 (DateRangeField와 같음)
export interface UseRangeCalendarProps extends Omit<CalendarFoundationProps, 'name'>, RangeConstraints {
  readonly value?: DateRangeInput | null | undefined;
  readonly defaultValue?: DateRangeInput | null | undefined;
  readonly onValueChange?: ((value: DateRangeValue | null, details: ValueChangeDetails) => void) | undefined;
  readonly startName?: string | undefined;
  readonly endName?: string | undefined;
}

export const useRangeCalendar = (props: UseRangeCalendarProps): RangeCalendarApi => {
  const settings = usePickerSettings(props);
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalRange(input, settings.calendars),
    describeRangeInput,
    props.onInvalidValue,
    settings.calendarKey,
  );
  const { defaultSelected, initialSelected } = useMountSelections({
    controlled,
    readDefault: () => parseOptionalRange(props.defaultValue, settings.calendars).value,
    toSelected: parseRangeSelection,
  });
  const foundation = useCalendarFoundation({
    props,
    settings,
    constraints: props,
    initialSelected: rangeStartOf(initialSelected),
  });
  const { context } = foundation;
  // Constraint: 앱이 값의 역법을 calendars에서 빼면 값 문자열을 만들 때 던지므로, 역법 구성이 바뀌면 store를 다시 만들어 같은 날을 양력으로 옮겨 적음. 제어 값은 useParsedValue가 해석 실패로 알리고 아래 동기화가 비움 (preflight 3.5)
  const {
    getSnapshot,
    send: sendSelection,
    state: selection,
  } = useStoreInstance(
    (previous: RangeSelectionState | undefined) =>
      previous === undefined
        ? createRangeSelectionState(initialSelected)
        : moveSelectionOffRemovedCalendar(previous, context.calendars),
    rangeSelectionReducer,
    context,
    { resetKey: settings.calendarKey },
  );
  const value = rangeValue(selection, context);
  const validity = useMemo(() => rangeValidity(selection, context), [selection, context]);
  const isRequired = props.required === true;
  const committedValidity = useMemo(
    () => committedValidityOf({ committed: selection.committed, constraints: context.constraints, isRequired }),
    [selection.committed, context.constraints, isRequired],
  );
  const controlledSelected = useMemo(() => parseRangeSelection(controlled.value), [controlled.value]);

  const selectionSync = useSelectionSync({
    committedKey: rangeSelectionKey(selection.committed),
    controlledKey: controlled.isControlled ? rangeSelectionKey(controlledSelected) : undefined,
    resetKey: settings.calendarKey,
    syncToControlled: () => sendSelection({ type: 'value.sync', selected: controlledSelected }),
    emitChange: () => props.onValueChange?.(value, { validity: committedValidity }),
  });

  const reportCommitted = createCommittedReporter({
    getSnapshot,
    keyOf: (snapshot) => rangeSelectionKey(snapshot.committed),
    report: (snapshot) =>
      props.onValueChange?.(rangeValue(snapshot, context), {
        validity: committedValidityOf({ committed: snapshot.committed, constraints: context.constraints, isRequired }),
      }),
    selectionSync,
  });

  // Constraint: 확정 범위를 바꿀 수 있는 사용자 이벤트(date.select·pointer.*·range.set·clear·commit)는 모두 이 경로로 보냄. 확정 값이 그대로면 알리지 않음
  const sendUserSelection = (event: RangeSelectionEvent): void => {
    sendSelection(event);
    reportCommitted();
  };

  const isDisabled = props.disabled === true;
  const isReadOnly = props.readOnly === true;
  const isInteractive = !isDisabled && !isReadOnly;
  const pointer = useRangePointer({
    displayCalendarId: foundation.navigation.displayCalendarId,
    isInteractive,
    rootRef: foundation.rootRef,
    selection,
    sendNavigation: foundation.sendNavigation,
    sendSelection: sendUserSelection,
  });

  // Constraint: 프리셋도 날짜를 고르는 사용자 조작이므로 비활성·읽기 전용이면 무시함
  const setRange = (range: DateRangeInput | null): void => {
    if (!isInteractive) return;
    const parsed = parseOptionalRange(range, settings.calendars);
    if (range !== null && parsed.invalidReason !== null) {
      props.onInvalidValue?.(describeRangeInput(range), parsed.invalidReason);
      return;
    }
    const selected = parseRangeSelection(parsed.value);
    if (selected === null) {
      sendUserSelection({ type: 'clear' });
      return;
    }
    const previous = getSnapshot();
    sendUserSelection({ type: 'range.set', range: selected.range, calendarId: selected.calendarId });
    // Constraint: store가 받지 않은 범위(열린 끝 불허, 입력 역법으로 적을 수 없는 끝)면 포커스도 그대로 둠
    if (getSnapshot() === previous) return;
    foundation.sendNavigation({ type: 'focus.set', epochDay: selected.range.start });
  };

  // Goal: 비제어만 form reset에서 처음 기본값으로 돌아가며 알림(이펙트가 알림). 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 양 끝 숨은 입력이 둘 다 알려도 같은 값이라 한 번 바뀐 것과 같음
  const resetToDefault = (): void => {
    if (controlled.isControlled) return;
    sendSelection({ type: 'value.sync', selected: restorableDefault(defaultSelected, context.calendars) });
  };

  // Goal: 마운트 때는 말하지 않음. 범위 picker는 열 때마다 달력을 새로 마운트하므로 이미 고른 범위를 매번 다시 읽지 않게 함 (React Aria와 같음). 이후 바뀐 선택은 사용자 조작이든 부모 값이든 알림
  // Constraint: store는 바뀔 때만 새 상태 객체를 만들므로 마운트 때 상태 객체와 같으면 아직 바뀐 적이 없음
  const [mountedSelection] = useState(selection);
  const hasSelectionChanged = selection !== mountedSelection;

  const isRequiredBySide: Readonly<Record<RangeSide, boolean>> = {
    start: isRequired,
    // Constraint: 열린 끝이 허용되면 종료일은 선택 입력 (DateRangeField와 같음)
    end: isRequired && props.isOpenEndAllowed !== true,
  };

  const viewApi = createCalendarViewApi({
    foundation,
    behavior: {
      mode: 'range',
      selectionFlags: (cell) =>
        rangeCellFlags({ constraints: context.constraints, epochDay: cell.epochDay, selection }),
      selectEpochDay: (epochDay: EpochDay) => {
        if (!validateEpochDay(epochDay, context.constraints).isValid) return;
        sendUserSelection({ type: 'date.select', epochDay, calendarId: foundation.navigation.displayCalendarId });
      },
      extraButtonProps: pointer.cellButtonProps,
      shouldIgnoreClick: pointer.shouldIgnoreClick,
    },
    interaction: {
      getCellLabel: props.getCellLabel,
      isDisabled,
      isInvalid: isVisiblyInvalid({ invalid: props.invalid === true, reasons: committedValidity.reasons }),
      isReadOnly,
      onBlur: props.onBlur,
    },
  });

  return {
    ...viewApi,
    selection,
    value,
    draftValue: draftValueOf(selection.draft, context.calendars),
    validity,
    announcement: hasSelectionChanged
      ? describeRangeAnnouncement({ calendar: foundation.calendar, locale: context.locale, selection, validity })
      : '',
    rootRef: foundation.rootRef,
    sendSelection,
    setRange,
    commit: () => sendUserSelection({ type: 'commit' }),
    cancel: () => sendSelection({ type: 'cancel' }),
    getHiddenInputProps: (side) => ({
      name: side === 'start' ? props.startName : props.endName,
      form: props.form,
      value: (side === 'start' ? value?.start : value?.end) ?? '',
      required: isRequiredBySide[side],
      disabled: props.disabled,
      onFocusRequest: () => focusTabbableDay(foundation.rootRef),
      onFormReset: resetToDefault,
    }),
  };
};

// Goal: 확정 범위의 유효성. 확인 모드의 임시 범위와 고르는 중인 시작일은 확정 전이라 반영하지 않음 (계약 §2.6 (b))
const committedValidityOf = ({ committed, constraints, isRequired }: CommittedValidityInput): Validity => {
  if (committed === null) return isRequired ? MISSING_REQUIRED : VALID;
  return validateEpochRange(committed.range, constraints);
};

// Constraint: 렌더 중이라 던지지 않음. 적을 수 없는 끝이 있으면 값 없음으로 둠
const draftValueOf = (draft: SelectedRange | null, calendars: readonly CalendarSystem[]): DateRangeValue | null => {
  if (draft === null) return null;
  const calendar = providedCalendarOf(calendars, draft.calendarId);
  const start = formatOrNull(draft.range.start, calendar);
  const end = formatOrNull(draft.range.end, calendar);
  if (start === null || (draft.range.end !== null && end === null)) return null;
  return { start, end };
};

// Constraint: 고르는 중인 시작일의 역법(pendingCalendarId)도 옮겨야 다음 선택이 빠진 역법을 찾다 던지지 않음
const moveSelectionOffRemovedCalendar = (
  previous: RangeSelectionState,
  calendars: readonly CalendarSystem[],
): RangeSelectionState => {
  const committed = toProvidedCalendar(previous.committed, calendars);
  const draft = toProvidedCalendar(previous.draft, calendars);
  const pendingCalendarId = isCalendarProvided(calendars, previous.pendingCalendarId)
    ? previous.pendingCalendarId
    : gregory.id;
  const isUnchanged =
    committed === previous.committed && draft === previous.draft && pendingCalendarId === previous.pendingCalendarId;
  return isUnchanged ? previous : { ...previous, committed, draft, pendingCalendarId };
};

const rangeStartOf = (selected: SelectedRange | null): SelectedDay | null =>
  selected === null ? null : { epochDay: selected.range.start, calendarId: selected.calendarId };
