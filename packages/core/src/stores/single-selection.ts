import { type CalendarId, type DateString, type EpochDay, formatDate } from '@lunisolar-picker/calendar';
import { findCalendar, type PickerContext } from '../context';
import type { Reducer } from '../create-store';
import { isSelectableDay, type SelectedDay } from './selectable';

export type SingleSelectionEvent =
  | { readonly type: 'date.select'; readonly epochDay: EpochDay; readonly calendarId: CalendarId }
  | { readonly type: 'commit' }
  | { readonly type: 'cancel' }
  | { readonly type: 'clear' }
  | { readonly type: 'value.sync'; readonly selected: SelectedDay | null };

type SingleSelectionScope = {
  readonly context: PickerContext;
  readonly state: SingleSelectionState;
};

export interface SingleSelectionState {
  readonly committed: SelectedDay | null;
  readonly draft: SelectedDay | null;
}

export const createSingleSelectionState = (committed: SelectedDay | null): SingleSelectionState => ({
  committed,
  draft: committed,
});

export const formatSelectedDay = (selected: SelectedDay, context: PickerContext): DateString | null => {
  const formatted = formatDate(selected.epochDay, findCalendar(context.calendars, selected.calendarId));
  return formatted.isOk ? formatted.value : null;
};

export const singleSelectionReducer: Reducer<SingleSelectionState, SingleSelectionEvent, PickerContext> = (
  state,
  event,
  context,
) => {
  switch (event.type) {
    case 'date.select':
      return selectDay({ context, state }, { epochDay: event.epochDay, calendarId: event.calendarId });
    case 'commit':
      return isSameSelectedDay(state.committed, state.draft) ? state : { ...state, committed: state.draft };
    case 'cancel':
      return isSameSelectedDay(state.committed, state.draft) ? state : { ...state, draft: state.committed };
    case 'clear':
      return clearSelection({ context, state });
    case 'value.sync':
      return isSameSelectedDay(state.committed, event.selected) && isSameSelectedDay(state.draft, event.selected)
        ? state
        : createSingleSelectionState(event.selected);
  }
};

export const singleValue = (state: SingleSelectionState, context: PickerContext): DateString | null =>
  state.committed === null ? null : formatSelectedDay(state.committed, context);

const selectDay = ({ context, state }: SingleSelectionScope, selected: SelectedDay): SingleSelectionState => {
  if (!isSelectableDay(selected.epochDay, findCalendar(context.calendars, selected.calendarId), context)) return state;
  if (context.commitMode === 'confirm') {
    return isSameSelectedDay(state.draft, selected) ? state : { ...state, draft: selected };
  }
  return isSameSelectedDay(state.committed, selected) && isSameSelectedDay(state.draft, selected)
    ? state
    : { committed: selected, draft: selected };
};

const clearSelection = ({ context, state }: SingleSelectionScope): SingleSelectionState => {
  const committed = context.commitMode === 'immediate' ? null : state.committed;
  return state.draft === null && state.committed === committed ? state : { committed, draft: null };
};

const isSameSelectedDay = (first: SelectedDay | null, second: SelectedDay | null): boolean => {
  if (first === null || second === null) return first === second;
  return first.epochDay === second.epochDay && first.calendarId === second.calendarId;
};
