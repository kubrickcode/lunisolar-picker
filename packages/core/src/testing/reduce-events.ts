import type { Reducer } from '../create-store';

export const reduceEvents = <State, Event, Context>(
  reducer: Reducer<State, Event, Context>,
  initialState: State,
  events: readonly Event[],
  context: Context,
): State => events.reduce((state, event) => reducer(state, event, context), initialState);
