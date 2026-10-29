import { describe, expect, it, vi } from 'vitest';
import { createStore } from './create-store';

type CounterEvent = { readonly type: 'add'; readonly amount: number } | { readonly type: 'noop' };

const createCounterStore = (readStep: () => number) =>
  createStore<number, CounterEvent, number>({
    initialState: 0,
    readContext: readStep,
    reducer: (state, event, step) => (event.type === 'add' ? state + event.amount * step : state),
  });

describe('createStore', () => {
  it('applies events through the reducer with the latest context', () => {
    let step = 1;
    const store = createCounterStore(() => step);

    store.send({ type: 'add', amount: 2 });
    step = 10;
    store.send({ type: 'add', amount: 1 });

    expect(store.getSnapshot()).toBe(12);
  });

  it('notifies subscribers only when the state reference changes', () => {
    const store = createCounterStore(() => 1);
    const listener = vi.fn();
    store.subscribe(listener);

    store.send({ type: 'noop' });
    store.send({ type: 'add', amount: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createCounterStore(() => 1);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.send({ type: 'add', amount: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('still notifies the remaining listeners when one unsubscribes during notification', () => {
    const store = createCounterStore(() => 1);
    const laterListener = vi.fn();
    const unsubscribeFirst = store.subscribe(() => unsubscribeFirst());
    store.subscribe(laterListener);

    store.send({ type: 'add', amount: 1 });

    expect(laterListener).toHaveBeenCalledTimes(1);
  });
});
