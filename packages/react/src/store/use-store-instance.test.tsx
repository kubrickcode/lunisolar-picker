import type { Reducer } from '@lunisolar-picker/core';
import { type ReactElement, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { useStoreInstance } from './use-store-instance';

type CounterEvent = { readonly type: 'increment' };

const counterReducer: Reducer<number, CounterEvent, { readonly step: number }> = (count, _event, context) =>
  count + context.step;

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

  it('renders the initial state on the server', () => {
    expect(renderToString(<Counter />)).toContain('<output>10</output>');
  });

  describe('resetKey', () => {
    it('starts a fresh store from the initial state when the key changes', async () => {
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
  });
});
