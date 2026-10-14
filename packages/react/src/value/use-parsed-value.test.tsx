import { gregory } from '@lunisolar-picker/calendar';
import { type ReactElement, StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { parseOptionalDate } from './parse-controlled-value';
import { useParsedValue } from './use-parsed-value';

type ProbeProps = { readonly onInvalidValue: (input: string, reason: string) => void };

const Probe = ({ onInvalidValue }: ProbeProps): ReactElement => {
  const [value, setValue] = useState('2026-1-5');
  const [renderCount, setRenderCount] = useState(0);
  const controlled = useParsedValue(value, (input) => parseOptionalDate(input, [gregory]), String, onInvalidValue);
  return (
    <>
      <output>{String(controlled.value)}</output>
      <button type="button" onClick={() => setRenderCount(renderCount + 1)}>
        Re-render
      </button>
      <button type="button" onClick={() => setValue('2026-10-14')}>
        Fix value
      </button>
      <button type="button" onClick={() => setValue('2026-1-5')}>
        Break value
      </button>
    </>
  );
};

describe('useParsedValue', () => {
  it('treats an invalid controlled value as empty and reports it once per input', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(<Probe onInvalidValue={onInvalidValue} />);

    await screen.getByRole('button', { name: 'Re-render' }).click();
    await screen.getByRole('button', { name: 'Re-render' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('null');
    expect(onInvalidValue).toHaveBeenCalledOnce();
    expect(onInvalidValue).toHaveBeenCalledWith('2026-1-5', 'invalid-date');
  });

  it('accepts the value once it becomes canonical', async () => {
    const screen = await render(<Probe onInvalidValue={vi.fn()} />);

    await screen.getByRole('button', { name: 'Fix value' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-10-14');
  });

  it('reports again when the same invalid input comes back after a valid one', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(<Probe onInvalidValue={onInvalidValue} />);

    await screen.getByRole('button', { name: 'Fix value' }).click();
    await screen.getByRole('button', { name: 'Break value' }).click();

    await expect.poll(() => onInvalidValue.mock.calls.length).toBe(2);
  });

  it('reports only once under StrictMode double effects', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(
      <StrictMode>
        <Probe onInvalidValue={onInvalidValue} />
      </StrictMode>,
    );

    await screen.getByRole('button', { name: 'Re-render' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('null');
    expect(onInvalidValue).toHaveBeenCalledOnce();
  });
});
