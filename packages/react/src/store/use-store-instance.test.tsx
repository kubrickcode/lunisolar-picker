import type { Reducer } from '@lunisolar-picker/core';
import { type ReactElement, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useValueBridge } from '../value/use-value-bridge';
import { useStoreInstance } from './use-store-instance';

type CounterEvent = { readonly type: 'increment' };

type LocalizedFieldProps = { readonly onValueChange: (value: string | null) => void };

type LocalizedFieldState = { readonly locale: string; readonly value: string | null };

type PickEvent = { readonly type: 'pick'; readonly value: string };

type SnapshotCounterProps = { readonly onIncrement: (count: number) => void };

const counterReducer: Reducer<number, CounterEvent, { readonly step: number }> = (count, _event, context) =>
  count + context.step;

const pickReducer: Reducer<LocalizedFieldState, PickEvent, null> = (state, event) => ({
  ...state,
  value: event.value,
});

const Counter = (): ReactElement => {
  const [step, setStep] = useState(1);
  const counter = useStoreInstance(() => 10, counterReducer, { step });
  return (
    <>
      <output>{counter.state}</output>
      <button type="button" onClick={() => counter.send({ type: 'increment' })}>
        Increment
      </button>
      <button type="button" onClick={() => setStep(5)}>
        Use step 5
      </button>
    </>
  );
};

const SnapshotCounter = ({ onIncrement }: SnapshotCounterProps): ReactElement => {
  const counter = useStoreInstance(() => 10, counterReducer, { step: 1 });
  return (
    <button
      type="button"
      onClick={() => {
        counter.send({ type: 'increment' });
        onIncrement(counter.getSnapshot());
      }}
    >
      Increment
    </button>
  );
};

const ResettableCounter = (): ReactElement => {
  const [resetKey, setResetKey] = useState('ko');
  const counter = useStoreInstance(() => 10, counterReducer, { step: 1 }, { resetKey });
  return (
    <>
      <output>{counter.state}</output>
      <button type="button" onClick={() => counter.send({ type: 'increment' })}>
        Increment
      </button>
      <button type="button" onClick={() => setResetKey('en')}>
        Switch locale
      </button>
    </>
  );
};

const LocalizedField = ({ onValueChange }: LocalizedFieldProps): ReactElement => {
  const [locale, setLocale] = useState('ko');
  const field = useStoreInstance(
    (previous: LocalizedFieldState | undefined) => ({ locale, value: previous?.value ?? null }),
    pickReducer,
    null,
    { resetKey: locale },
  );
  useValueBridge<string>({
    committedValue: field.state.value,
    controlled: { isControlled: false, value: null },
    isEqual: Object.is,
    onValueChange,
    syncStore: () => {},
  });
  return (
    <>
      <output>{`${field.state.locale} ${String(field.state.value)}`}</output>
      <button type="button" onClick={() => field.send({ type: 'pick', value: '2026-10-14' })}>
        Pick
      </button>
      <button type="button" onClick={() => setLocale('en')}>
        Switch locale
      </button>
    </>
  );
};

describe('useStoreInstance', () => {
  it('renders the store snapshot and re-renders after an event', async () => {
    const screen = await render(<Counter />);

    await screen.getByRole('button', { name: 'Increment' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('11');
  });

  it('reads the latest context without recreating the store', async () => {
    const screen = await render(<Counter />);

    await screen.getByRole('button', { name: 'Use step 5' }).click();
    await screen.getByRole('button', { name: 'Increment' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('15');
  });

  it('keeps separate state for each component instance', async () => {
    const screen = await render(
      <>
        <Counter />
        <Counter />
      </>,
    );

    await screen.getByRole('button', { name: 'Increment' }).first().click();

    await expect.element(screen.getByRole('status').first()).toHaveTextContent('11');
    await expect.element(screen.getByRole('status').last()).toHaveTextContent('10');
  });

  it('reads the state right after an event, before React renders it', async () => {
    const onIncrement = vi.fn();
    const screen = await render(<SnapshotCounter onIncrement={onIncrement} />);

    await screen.getByRole('button', { name: 'Increment' }).click();

    expect(onIncrement).toHaveBeenCalledWith(11);
  });

  it('renders the initial state on the server', () => {
    expect(renderToString(<Counter />)).toContain('<output>10</output>');
  });

  describe('resetKey', () => {
    it('recreates the store through the factory when the key changes', async () => {
      const screen = await render(<ResettableCounter />);

      await screen.getByRole('button', { name: 'Increment' }).click();
      await expect.element(screen.getByRole('status')).toHaveTextContent('11');
      await screen.getByRole('button', { name: 'Switch locale' }).click();

      await expect.element(screen.getByRole('status')).toHaveTextContent('10');
    });

    it('keeps sending events to the fresh store after a reset', async () => {
      const screen = await render(<ResettableCounter />);

      await screen.getByRole('button', { name: 'Switch locale' }).click();
      await screen.getByRole('button', { name: 'Increment' }).click();

      await expect.element(screen.getByRole('status')).toHaveTextContent('11');
    });

    it('rebuilds from the previous state so the committed value survives without a change report', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<LocalizedField onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Pick' }).click();
      await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-10-14']]);
      await screen.getByRole('button', { name: 'Switch locale' }).click();

      await expect.element(screen.getByRole('status')).toHaveTextContent('en 2026-10-14');
      expect(onValueChange.mock.calls).toEqual([['2026-10-14']]);
    });
  });
});
