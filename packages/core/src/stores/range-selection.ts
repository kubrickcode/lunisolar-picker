import { type CalendarId, type DateRangeValue, type EpochDay, formatDate } from '@lunisolar-picker/calendar';
import { isEpochDayInBlockedRange, validateEpochRange } from '../constraints/validate';
import { findCalendar, type PickerContext } from '../context';
import type { Reducer } from '../create-store';
import { type EpochRange, invalidBecause, type Validity } from '../types';
import { isSelectableDay, type SelectedDay } from './selectable';

const IDLE_TRANSIENT = { anchor: null, grabbedHandle: null, pointerPhase: 'idle', preview: null } as const;

export type RangeHandle = 'start' | 'end';

export type RangePointerPhase = 'idle' | 'pressing' | 'dragging';

type RangeSelectionScope = {
  readonly context: PickerContext;
  readonly state: RangeSelectionState;
};

export type RangeSelectionEvent =
  | { readonly type: 'pointer.down'; readonly epochDay: EpochDay; readonly calendarId: CalendarId }
  | { readonly type: 'pointer.enter'; readonly epochDay: EpochDay }
  | { readonly type: 'pointer.up' }
  | { readonly type: 'handle.grab'; readonly handle: RangeHandle }
  | { readonly type: 'date.select'; readonly epochDay: EpochDay; readonly calendarId: CalendarId }
  | { readonly type: 'range.set'; readonly range: EpochRange; readonly calendarId: CalendarId }
  | { readonly type: 'commit' }
  | { readonly type: 'cancel' }
  | { readonly type: 'clear' }
  | { readonly type: 'value.sync'; readonly selected: SelectedRange | null };

export interface RangeSelectionState {
  readonly committed: SelectedRange | null;
  readonly draft: SelectedRange | null;
  readonly anchor: EpochDay | null;
  readonly preview: EpochDay | null;
  readonly grabbedHandle: RangeHandle | null;
  readonly pointerPhase: RangePointerPhase;
  readonly pendingCalendarId: CalendarId;
}

type ResetTarget = {
  readonly committed: SelectedRange | null;
  readonly draft: SelectedRange | null;
};

export interface SelectedRange {
  readonly range: EpochRange;
  readonly calendarId: CalendarId;
}

export const createRangeSelectionState = (committed: SelectedRange | null): RangeSelectionState => {
  const sorted = sortedSelectedRange(committed);
  return { committed: sorted, draft: sorted, ...IDLE_TRANSIENT, pendingCalendarId: sorted?.calendarId ?? 'gregory' };
};

export const displayedRange = (state: RangeSelectionState): EpochRange | null => {
  if (state.anchor === null) return state.draft?.range ?? null;
  return state.preview === null ? { start: state.anchor, end: null } : sortedRange(state.anchor, state.preview);
};

export const rangeSelectionReducer: Reducer<RangeSelectionState, RangeSelectionEvent, PickerContext> = (
  state,
  event,
  context,
) => {
  const scope: RangeSelectionScope = { context, state };
  switch (event.type) {
    case 'date.select':
      return selectEndpoint(scope, {
        calendarId: state.anchor === null ? event.calendarId : state.pendingCalendarId,
        epochDay: event.epochDay,
      });
    case 'pointer.down':
      return pressDay(scope, { calendarId: event.calendarId, epochDay: event.epochDay });
    case 'pointer.enter':
      return enterDay(scope, event.epochDay);
    case 'pointer.up':
      return releasePointer(scope);
    case 'handle.grab':
      return grabHandle(state, event.handle);
    case 'range.set':
      return setRange(scope, { calendarId: event.calendarId, range: event.range });
    case 'commit':
      return commitDraft(scope);
    case 'cancel':
      return resetTo(state, { committed: state.committed, draft: state.committed });
    case 'clear':
      return resetTo(state, { committed: context.commitMode === 'immediate' ? null : state.committed, draft: null });
    case 'value.sync': {
      const selected = sortedSelectedRange(event.selected);
      return resetTo(state, { committed: selected, draft: selected });
    }
  }
};

export const rangeValidity = (state: RangeSelectionState, context: PickerContext): Validity => {
  const range = displayedRange(state);
  return range === null ? invalidBecause(['incomplete']) : validateEpochRange(range, context.constraints);
};

export const rangeValue = (state: RangeSelectionState, context: PickerContext): DateRangeValue | null => {
  if (state.committed === null) return null;
  const calendar = findCalendar(context.calendars, state.committed.calendarId);
  const start = formatDate(state.committed.range.start, calendar);
  const end = state.committed.range.end === null ? null : formatDate(state.committed.range.end, calendar);
  if (!start.isOk || (end !== null && !end.isOk)) return null;
  return { start: start.value, end: end === null ? null : end.value };
};

const selectEndpoint = (scope: RangeSelectionScope, selected: SelectedDay): RangeSelectionState => {
  const { state } = scope;
  if (!isSelectable(scope, selected)) return state;
  if (state.anchor === null) return startRange(state, selected);
  return completeRange(scope, sortedRange(state.anchor, selected.epochDay));
};

const isSelectable = ({ context, state }: RangeSelectionScope, selected: SelectedDay): boolean => {
  if (!isSelectableDay(selected.epochDay, findCalendar(context.calendars, selected.calendarId), context)) return false;
  return state.anchor === null || !isEpochDayInBlockedRange(state.anchor, selected.epochDay, context.constraints);
};

// Goal: 완성된 범위에서 다시 고르면 새 범위를 시작함 (web-console 정책과 같음)
const startRange = (state: RangeSelectionState, { calendarId, epochDay }: SelectedDay): RangeSelectionState => ({
  ...state,
  ...IDLE_TRANSIENT,
  anchor: epochDay,
  draft: { calendarId, range: { start: epochDay, end: null } },
  pendingCalendarId: calendarId,
});

const completeRange = ({ context, state }: RangeSelectionScope, range: EpochRange): RangeSelectionState => {
  const draft: SelectedRange = { calendarId: state.pendingCalendarId, range };
  return {
    ...state,
    ...IDLE_TRANSIENT,
    committed: context.commitMode === 'immediate' ? draft : state.committed,
    draft,
  };
};

const pressDay = (scope: RangeSelectionScope, selected: SelectedDay): RangeSelectionState => {
  const { state } = scope;
  if (state.anchor !== null) {
    return selectEndpoint(scope, { calendarId: state.pendingCalendarId, epochDay: selected.epochDay });
  }
  if (!isSelectable(scope, selected)) return state;
  return { ...startRange(state, selected), pointerPhase: 'pressing' };
};

// Constraint: 막힌 날짜 위를 지나면 미리보기는 직전 유효한 날에 머묾 (Review Focus 5)
const enterDay = (scope: RangeSelectionScope, epochDay: EpochDay): RangeSelectionState => {
  const { state } = scope;
  if (state.anchor === null || epochDay === (state.preview ?? state.anchor)) return state;
  if (!isSelectable(scope, { calendarId: state.pendingCalendarId, epochDay })) return state;
  return { ...state, pointerPhase: state.pointerPhase === 'idle' ? 'idle' : 'dragging', preview: epochDay };
};

const releasePointer = (scope: RangeSelectionScope): RangeSelectionState => {
  const { state } = scope;
  if (state.pointerPhase === 'dragging' && state.anchor !== null) {
    return completeRange(scope, sortedRange(state.anchor, state.preview ?? state.anchor));
  }
  if (state.pointerPhase !== 'pressing') return state;
  if (state.grabbedHandle !== null && state.preview !== null) {
    return startRange(state, { calendarId: state.pendingCalendarId, epochDay: state.preview });
  }
  return { ...state, pointerPhase: 'idle' };
};

const grabHandle = (state: RangeSelectionState, handle: RangeHandle): RangeSelectionState => {
  const range = state.draft?.range;
  if (!state.draft || !range || range.end === null || state.anchor !== null) return state;
  const isStart = handle === 'start';
  return {
    ...state,
    anchor: isStart ? range.end : range.start,
    grabbedHandle: handle,
    pendingCalendarId: state.draft.calendarId,
    pointerPhase: 'pressing',
    preview: isStart ? range.start : range.end,
  };
};

const setRange = ({ context, state }: RangeSelectionScope, selected: SelectedRange): RangeSelectionState => {
  if (selected.range.end === null && !context.constraints.isOpenEndAllowed) return state;
  if (!isRepresentableRange(selected, context)) return state;
  const draft: SelectedRange = { calendarId: selected.calendarId, range: sortedEpochRange(selected.range) };
  return {
    ...state,
    ...IDLE_TRANSIENT,
    committed: context.commitMode === 'immediate' ? draft : state.committed,
    draft,
    pendingCalendarId: selected.calendarId,
  };
};

// Goal: 입력 역법으로 적을 수 없는 프리셋을 저장하면 rangeValue가 조용히 null이 되므로 처음부터 받지 않음. min/max·막힌 날 위반은 저장하고 rangeValidity로 알림
const isRepresentableRange = ({ calendarId, range }: SelectedRange, context: PickerContext): boolean => {
  const calendar = findCalendar(context.calendars, calendarId);
  return formatDate(range.start, calendar).isOk && (range.end === null || formatDate(range.end, calendar).isOk);
};

const commitDraft = ({ context, state }: RangeSelectionScope): RangeSelectionState => {
  if (state.anchor !== null || state.draft === null || isSameSelectedRange(state.draft, state.committed)) return state;
  if (state.draft.range.end === null && !context.constraints.isOpenEndAllowed) return state;
  return { ...state, committed: state.draft };
};

// Constraint: 바뀐 값이 없으면 같은 참조를 돌려줘야 createStore가 구독자를 깨우지 않음
const resetTo = (state: RangeSelectionState, { committed, draft }: ResetTarget): RangeSelectionState => {
  const isUnchanged =
    isSameSelectedRange(state.committed, committed) &&
    isSameSelectedRange(state.draft, draft) &&
    state.anchor === null &&
    state.pointerPhase === 'idle';
  if (isUnchanged) return state;
  return {
    ...state,
    ...IDLE_TRANSIENT,
    committed,
    draft,
    pendingCalendarId: draft?.calendarId ?? state.pendingCalendarId,
  };
};

const sortedRange = (first: EpochDay, second: EpochDay): EpochRange =>
  first <= second ? { start: first, end: second } : { start: second, end: first };

// Constraint: 밖에서 들어온 범위도 시작 ≤ 끝으로 맞춰 둠 (스펙 4.2)
const sortedSelectedRange = (selected: SelectedRange | null): SelectedRange | null =>
  selected === null ? null : { calendarId: selected.calendarId, range: sortedEpochRange(selected.range) };

const sortedEpochRange = (range: EpochRange): EpochRange =>
  range.end === null ? range : sortedRange(range.start, range.end);

const isSameSelectedRange = (first: SelectedRange | null, second: SelectedRange | null): boolean => {
  if (first === null || second === null) return first === second;
  return (
    first.calendarId === second.calendarId &&
    first.range.start === second.range.start &&
    first.range.end === second.range.end
  );
};
