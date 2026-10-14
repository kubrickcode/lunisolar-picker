export type Reducer<State, Event, Context> = (state: State, event: Event, context: Context) => State;

export interface CreateStoreOptions<State, Event, Context> {
  readonly initialState: State;
  readonly readContext: () => Context;
  readonly reducer: Reducer<State, Event, Context>;
}

export interface Store<State, Event> {
  getSnapshot(): State;
  send(event: Event): void;
  subscribe(listener: () => void): () => void;
}

// Goal: 바인딩이 최신 prop을 readContext로 넘기므로 prop이 바뀌어도 store를 다시 만들지 않음 (스펙 3.3)
export const createStore = <State, Event, Context>(
  options: CreateStoreOptions<State, Event, Context>,
): Store<State, Event> => {
  let state = options.initialState;
  let listeners: ReadonlySet<() => void> = new Set();
  return {
    getSnapshot: () => state,
    send(event) {
      const nextState = options.reducer(state, event, options.readContext());
      if (Object.is(nextState, state)) return;
      state = nextState;
      // Intentionally iterates the set captured now - listeners removed mid-notification must not skip later ones
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners = new Set([...listeners, listener]);
      return () => {
        listeners = new Set([...listeners].filter((existing) => existing !== listener));
      };
    },
  };
};
