import type { CalendarId, CalendarSystem } from '@lunisolar-picker/calendar';
import { invalidBecause, type Validity } from '@lunisolar-picker/core';
import { type RefObject, useState } from 'react';
import { focusInitialElement } from '../focus/focusable-elements';
import type { ControlledInput } from '../value/use-parsed-value';
import { isCalendarProvided } from './provided-calendar';
import type { SelectionSync } from './use-selection-sync';

// Goal: 비어 있는 required 달력의 확정 값 유효성. 'incomplete'라 isVisiblyInvalid가 빨간 표시는 하지 않음
export const MISSING_REQUIRED: Validity = invalidBecause(['incomplete']);

export type CommittedReporterInput<State> = {
  readonly getSnapshot: () => State;
  // Goal: 확정 값의 동일성 문자열. 이미 알린 값이면 다시 알리지 않음
  readonly keyOf: (state: State) => string;
  readonly report: (state: State) => void;
  readonly selectionSync: SelectionSync;
};

export type MountSelections<Selected> = {
  // Goal: form reset이 돌아갈 처음 기본값. 입력 칸처럼 마운트 때 값으로 고정함
  readonly defaultSelected: Selected | null;
  // Constraint: 제어 중이면 처음 포커스·표시 역법도 부모 값(null 포함)만 따름. 쓰이지 않는 defaultValue가 화면을 정하지 않게 함
  readonly initialSelected: Selected | null;
};

export type MountSelectionsInput<Value, Selected> = {
  readonly controlled: ControlledInput<Value>;
  readonly readDefault: () => Value | null;
  readonly toSelected: (value: Value | null) => Selected | null;
};

// Goal: 사용자 조작이 같은 핸들러에서 달력을 닫아(언마운트) 이펙트가 돌지 않아도 확정 값을 알림. 공개 sendSelection으로 바로 보낸 이벤트는 이펙트가 알림 (preflight 1.4, 계약 §3.4)
export const createCommittedReporter =
  <State>({ getSnapshot, keyOf, report, selectionSync }: CommittedReporterInput<State>): (() => void) =>
  () => {
    const snapshot = getSnapshot();
    const committedKey = keyOf(snapshot);
    if (selectionSync.isReported(committedKey)) return;
    selectionSync.markReported(committedKey);
    report(snapshot);
  };

// Goal: 브라우저가 required 검증 실패로 숨은 입력에 포커스를 주면 탭으로 들어가는 칸으로 옮김
export const focusTabbableDay = (rootRef: RefObject<HTMLElement | null>): void => {
  const root = rootRef.current;
  if (root) focusInitialElement(root);
};

// Constraint: 처음 기본값의 역법을 앱이 calendars에서 뺐으면 그 값을 적을 수 없으므로 form reset은 비움
export const restorableDefault = <Selected extends { readonly calendarId: CalendarId }>(
  defaultSelected: Selected | null,
  calendars: readonly CalendarSystem[],
): Selected | null =>
  defaultSelected === null || isCalendarProvided(calendars, defaultSelected.calendarId) ? defaultSelected : null;

export const useMountSelections = <Value, Selected>({
  controlled,
  readDefault,
  toSelected,
}: MountSelectionsInput<Value, Selected>): MountSelections<Selected> => {
  const [selections] = useState(() => {
    const defaultSelected = toSelected(readDefault());
    return {
      defaultSelected,
      initialSelected: controlled.isControlled ? toSelected(controlled.value) : defaultSelected,
    };
  });
  return selections;
};
